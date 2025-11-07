package com.chung.webrtc.chat.socket;

import com.chung.webrtc.auth.service.JwtService;
import com.chung.webrtc.chat.dto.response.GroupResponse;
import com.chung.webrtc.chat.entity.Conversation;
import com.chung.webrtc.chat.entity.Message;
import com.chung.webrtc.chat.repository.ConversationRepository;
import com.chung.webrtc.chat.repository.MessageRepository;
import com.chung.webrtc.chat.service.ChatService;
import com.chung.webrtc.chat.service.ChatGroupService;
import com.chung.webrtc.chat.service.ChatSessionRegistry;
import com.chung.webrtc.common.util.MongoKeyUtil;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.time.LocalTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;
import java.util.stream.StreamSupport;

@Slf4j
@Component
@RequiredArgsConstructor
public class ChatSocketHandler extends TextWebSocketHandler {

    private final JwtService jwtService;
    private final ChatService chatService;
    private final ChatGroupService chatGroupService;
    private final ChatSessionRegistry chatSessionRegistry;
    private final ConversationRepository conversationRepo;
    private final MessageRepository messageRepo;
    private final ObjectMapper mapper;

    private final Map<String, Set<WebSocketSession>> roomSessions = new ConcurrentHashMap<>();
    private final Map<String, Set<WebSocketSession>> groupRooms = new ConcurrentHashMap<>();

    private String ts() {
        return "[" + LocalTime.now().withNano(0) + "]";
    }

    // ======================================================
    // 🔌 HANDLE INCOMING MESSAGES
    // ======================================================
    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        try {
            JsonNode msg = mapper.readTree(message.getPayload());
            String type = msg.path("type").asText();

            switch (type) {
                // === PRIVATE CHAT ===
                case "join" -> handleJoin(session, msg);
                case "chat" -> handleChat(session, msg);
                case "typing" -> handleTyping(session, msg);
                case "read-update" -> handleReadUpdate(session, msg);
                case "get-history" -> handleGetHistory(session, msg);
                case "request-online-users" -> handleRequestOnlineUsers(session);
                case "request-sync" -> handleRequestSync(session);

                // === GROUP CHAT ===
                case "join-group" -> handleJoinGroup(session, msg);
                case "leave-group" -> handleLeaveGroup(session, msg);
                case "group-chat" -> handleGroupChat(session, msg);
                case "typing-group" -> handleTypingGroup(session, msg);
                case "get-group-history" -> handleGetGroupHistory(session, msg);

                default -> log.warn("{} ⚠️ Unknown message type: {}", ts(), type);
            }
        } catch (Exception e) {
            log.error("{} ❌ WS message error: {}", ts(), e.getMessage(), e);
        }
    }

    // ======================================================
    // 💬 PRIVATE CHAT HANDLERS
    // ======================================================
    private void handleJoin(WebSocketSession session, JsonNode msg) throws IOException {
        String conversationId = msg.path("conversationId").asText();
        String token = extractToken(session);
        String email = jwtService.extractUsername(token);

        if (conversationId == null || conversationId.isBlank()) return;

        roomSessions.computeIfAbsent(conversationId, k -> ConcurrentHashMap.newKeySet()).add(session);
        session.getAttributes().put("conversationId", conversationId);
        session.getAttributes().put("email", email);

        ObjectNode joinedEvent = mapper.createObjectNode();
        joinedEvent.put("type", "joined");
        joinedEvent.put("conversationId", conversationId);
        joinedEvent.put("email", email);
        sendSafe(session, joinedEvent);

        sendChatHistory(session, conversationId, email);
        sendOnlineUsersToClient(session);
        log.info("{} 👤 [{}] {} joined conversation {}", ts(), session.getId(), email, conversationId);
    }

    private void handleChat(WebSocketSession session, JsonNode msg) {
        try {
            String conversationId = msg.path("conversationId").asText();
            String token = extractToken(session);
            String sender = jwtService.extractUsername(token);
            String content = msg.path("message").asText();

            if (conversationId == null || content == null || content.isBlank()) return;

            Message saved = chatService.saveMessage(conversationId, sender, content);
            String senderName = chatService.getDisplayNameByEmail(sender);

            roomSessions.getOrDefault(conversationId, Set.of()).forEach(sess -> {
                String receiverEmail = (String) sess.getAttributes().get("email");
                String displayName = sender.equalsIgnoreCase(receiverEmail) ? "You" : senderName;

                ObjectNode node = mapper.createObjectNode();
                node.put("type", "chat");
                node.put("conversationId", conversationId);
                node.put("sender", sender);
                node.put("senderName", displayName);
                node.put("message", content);
                node.put("timestamp", saved.getTimestamp().toString());

                // ✅ Realtime update for sidebar preview
                node.put("lastSender", sender);
                node.put("lastSenderName", displayName);

                sendSafe(sess, node);
            });

            log.info("{} 💬 [{}] {} ({}) → {}: {}", ts(), session.getId(), senderName, sender, conversationId, content);
        } catch (Exception e) {
            log.error("{} ❌ handleChat error: {}", ts(), e.getMessage(), e);
        }
    }

    private void handleTyping(WebSocketSession session, JsonNode msg) {
        String conversationId = msg.path("conversationId").asText();
        String sender = (String) session.getAttributes().get("email");

        ObjectNode node = mapper.createObjectNode();
        node.put("type", "typing");
        node.put("from", sender);
        node.put("conversationId", conversationId);

        roomSessions.getOrDefault(conversationId, Set.of())
                .forEach(sess -> { if (sess != session) sendSafe(sess, node); });
    }

    private void handleReadUpdate(WebSocketSession session, JsonNode msg) {
        try {
            String conversationId = msg.path("conversationId").asText();
            String reader = (String) session.getAttributes().get("email");
            chatService.markAsRead(conversationId, reader);

            ObjectNode event = mapper.createObjectNode();
            event.put("type", "read-update");
            event.put("conversationId", conversationId);
            event.put("reader", reader);
            chatSessionRegistry.broadcastToAll(event.toString());
        } catch (Exception e) {
            log.error("{} ❌ handleReadUpdate error: {}", ts(), e.getMessage(), e);
        }
    }

    private void handleGetHistory(WebSocketSession session, JsonNode msg) throws IOException {
        String conversationId = msg.path("conversationId").asText();
        String email = (String) session.getAttributes().get("email");
        sendChatHistory(session, conversationId, email);
    }

    private void sendChatHistory(WebSocketSession session, String conversationId, String email) throws IOException {
        List<Message> history = chatService.getMessages(conversationId);
        ObjectNode histMsg = mapper.createObjectNode();
        histMsg.put("type", "chat-history");
        histMsg.put("conversationId", conversationId);
        ArrayNode arr = histMsg.putArray("messages");

        if (history != null) {
            history.forEach(m -> {
                ObjectNode item = arr.addObject();
                item.put("type", "chat");
                item.put("conversationId", conversationId);
                item.put("sender", m.getSender());
                String senderName = m.getSender().equalsIgnoreCase(email)
                        ? "You"
                        : chatService.getDisplayNameByEmail(m.getSender());
                item.put("senderName", senderName);
                item.put("message", m.getContent());
                item.put("timestamp", m.getTimestamp().toString());
            });
        }
        sendSafe(session, histMsg);
    }

    // ======================================================
    // 👥 GROUP CHAT HANDLERS
    // ======================================================
    private void handleJoinGroup(WebSocketSession session, JsonNode msg) throws IOException {
        String groupId = msg.path("groupId").asText();
        String email = (String) session.getAttributes().get("email");
        if (groupId == null || groupId.isBlank()) return;

        groupRooms.computeIfAbsent(groupId, k -> ConcurrentHashMap.newKeySet()).add(session);
        chatSessionRegistry.addToGroup(groupId, email);
        session.getAttributes().put("groupId", groupId);

        sendGroupHistory(session, groupId);
        log.info("{} 👥 [{}] {} joined group {}", ts(), session.getId(), email, groupId);
    }

    private void handleLeaveGroup(WebSocketSession session, JsonNode msg) {
        String groupId = msg.path("groupId").asText();
        String email = (String) session.getAttributes().get("email");
        if (groupId == null || groupId.isBlank()) return;

        Optional.ofNullable(groupRooms.get(groupId)).ifPresent(set -> set.remove(session));
        chatSessionRegistry.removeFromGroup(groupId, email);
    }

    private void handleGroupChat(WebSocketSession session, JsonNode msg) {
        try {
            String groupId = msg.path("groupId").asText();
            String sender = (String) session.getAttributes().get("email");
            String content = msg.path("message").asText();

            if (groupId.isBlank() || content.isBlank()) return;

            Message saved = chatGroupService.saveGroupMessage(groupId, sender, content);
            String senderName = chatService.getDisplayNameByEmail(sender);

            Set<String> dbMembers = new HashSet<>();
            conversationRepo.findById(groupId).ifPresent(conv -> dbMembers.addAll(conv.getParticipants()));
            if (dbMembers.isEmpty()) {
                log.warn("{} ⚠️ No DB members found for group {}", ts(), groupId);
                return;
            }

            for (String member : dbMembers) {
                ObjectNode node = mapper.createObjectNode();
                node.put("type", "group-chat");
                node.put("groupId", groupId);
                node.put("sender", sender);
                node.put("senderName", sender.equalsIgnoreCase(member) ? "You" : senderName);
                node.put("message", content);
                node.put("timestamp", saved.getTimestamp().toString());
                node.put("lastSender", sender);
                node.put("lastSenderName", sender.equalsIgnoreCase(member) ? "You" : senderName);
                chatSessionRegistry.getSessions(member).forEach(sess -> sendSafe(sess, node.deepCopy()));
            }

            log.info("{} 💬 [{}] {} ({}) → group {}: {}",
                    ts(), session.getId(), senderName, sender, groupId, content);

        } catch (Exception e) {
            log.error("{} ❌ handleGroupChat error: {}", ts(), e.getMessage(), e);
        }
    }

    private void handleTypingGroup(WebSocketSession session, JsonNode msg) {
        String groupId = msg.path("groupId").asText();
        String sender = (String) session.getAttributes().get("email");
        ObjectNode node = mapper.createObjectNode();
        node.put("type", "typing-group");
        node.put("from", sender);
        node.put("groupId", groupId);

        groupRooms.getOrDefault(groupId, Set.of())
                .forEach(sess -> { if (sess != session) sendSafe(sess, node); });
    }

    private void handleGetGroupHistory(WebSocketSession session, JsonNode msg) throws IOException {
        sendGroupHistory(session, msg.path("groupId").asText());
    }

    private void sendGroupHistory(WebSocketSession session, String groupId) throws IOException {
        String email = (String) session.getAttributes().get("email");
        List<Message> history = chatGroupService.getGroupMessages(groupId);
        ObjectNode histMsg = mapper.createObjectNode();
        histMsg.put("type", "group-history");
        histMsg.put("groupId", groupId);
        ArrayNode arr = histMsg.putArray("messages");

        if (history != null) {
            history.forEach(m -> {
                ObjectNode item = arr.addObject();
                item.put("type", "group-chat");
                item.put("groupId", groupId);
                item.put("sender", m.getSender());
                String senderName = m.getSender().equalsIgnoreCase(email)
                        ? "You"
                        : chatService.getDisplayNameByEmail(m.getSender());
                item.put("senderName", senderName);
                item.put("message", m.getContent());
                item.put("timestamp", m.getTimestamp().toString());
            });
        }
        sendSafe(session, histMsg);
    }

    // ======================================================
    // 🔁 SYNC & CONNECTION MANAGEMENT
    // ======================================================
    private void handleRequestSync(WebSocketSession session) {
        try {
            String userEmail = (String) session.getAttributes().get("email");
            if (userEmail == null) {
                log.warn("{} ⚠️ handleRequestSync called without email in session", ts());
                return;
            }

            List<GroupResponse> groups = chatGroupService.getGroupsByUser(userEmail);

            List<String> groupIds = groups.stream()
                    .map(GroupResponse::getId)
                    .filter(Objects::nonNull)
                    .collect(Collectors.toList());

            Iterable<Conversation> convs = conversationRepo.findAllById(groupIds);
            Map<String, Conversation> convMap = StreamSupport.stream(convs.spliterator(), false)
                    .collect(Collectors.toMap(Conversation::getId, c -> c));

            String safeKey = MongoKeyUtil.encode(userEmail);

            ArrayNode arr = mapper.createArrayNode();

            for (GroupResponse g : groups) {
                ObjectNode node = mapper.createObjectNode();
                node.put("id", g.getId());
                node.put("name", g.getName());
                node.put("description", g.getDescription());
                node.put("avatar", g.getAvatar());
                node.put("createdBy", g.getCreatedBy());
                node.putPOJO("members", g.getMembers());
                node.put("memberCount", g.getMembers() != null ? g.getMembers().size() : 0);

                Conversation conv = convMap.get(g.getId());
                String lastMessage = null;
                String lastSender = null;
                String lastSenderName = null;
                String lastMessageTime = null;
                boolean unread = false;

                if (conv != null) {
                    lastMessage = conv.getLastMessage();
                    lastSender = conv.getLastSender();
                    lastSenderName = conv.getLastSenderName();
                    if (conv.getLastMessageTime() != null)
                        lastMessageTime = conv.getLastMessageTime().toString();

                    Map<String, Boolean> unreadMap = conv.getUnreadMap();
                    if (unreadMap != null && unreadMap.containsKey(safeKey))
                        unread = Boolean.TRUE.equals(unreadMap.get(safeKey));
                }

                if ((lastMessage == null || lastMessage.isBlank()) && g.getId() != null) {
                    try {
                        Optional<Message> latestOpt = messageRepo.findTopByConversationIdOrderByTimestampDesc(g.getId());
                        if (latestOpt.isPresent()) {
                            Message latest = latestOpt.get();
                            lastMessage = latest.getContent();
                            lastSender = latest.getSender();
                            lastSenderName = chatService.getDisplayNameByEmail(latest.getSender());
                            lastMessageTime = latest.getTimestamp() != null
                                    ? latest.getTimestamp().toString() : null;
                        }
                    } catch (Exception ex) {
                        log.debug("⚠️ No fallback message found for group {}", g.getId());
                    }
                }

                node.put("lastMessage", lastMessage);
                node.put("lastSender", lastSender);
                node.put("lastSenderName", lastSenderName);
                node.put("lastMessageTime", lastMessageTime);
                node.put("unread", unread);

                arr.add(node);
            }

            ObjectNode event = mapper.createObjectNode();
            event.put("type", "group-sync");
            event.set("groups", arr);

            sendSafe(session, event);
            log.info("{} 📡 [{}] Sent {} groups (with preview) to {}", ts(), session.getId(), groups.size(), userEmail);

        } catch (Exception e) {
            log.error("{} ❌ handleRequestSync error: {}", ts(), e.getMessage(), e);
        }
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        try {
            String token = extractToken(session);
            String email = jwtService.extractUsername(token);
            session.getAttributes().put("email", email);
            chatSessionRegistry.register(email, session);
            broadcastOnlineStatus("user-status", email);
            sendOnlineUsersToClient(session);

            // ✅ Fixed version: merged + fallback preview for all groups
            List<GroupResponse> groups = chatGroupService.getGroupsByUser(email);
            List<String> groupIds = groups.stream()
                    .map(GroupResponse::getId)
                    .filter(Objects::nonNull)
                    .collect(Collectors.toList());

            Iterable<Conversation> convs = conversationRepo.findAllById(groupIds);
            Map<String, Conversation> convMap = StreamSupport.stream(convs.spliterator(), false)
                    .collect(Collectors.toMap(Conversation::getId, c -> c));

            String safeKey = MongoKeyUtil.encode(email);
            ArrayNode arr = mapper.createArrayNode();

            for (GroupResponse g : groups) {
                ObjectNode node = mapper.createObjectNode();
                node.put("id", g.getId());
                node.put("name", g.getName());
                node.put("description", g.getDescription());
                node.put("avatar", g.getAvatar());
                node.put("createdBy", g.getCreatedBy());
                node.putPOJO("members", g.getMembers());
                node.put("memberCount", g.getMembers() != null ? g.getMembers().size() : 0);

                Conversation conv = convMap.get(g.getId());
                String lastMessage = null;
                String lastSender = null;
                String lastSenderName = null;
                String lastMessageTime = null;
                boolean unread = false;

                if (conv != null) {
                    lastMessage = conv.getLastMessage();
                    lastSender = conv.getLastSender();
                    lastSenderName = conv.getLastSenderName();
                    if (conv.getLastMessageTime() != null)
                        lastMessageTime = conv.getLastMessageTime().toString();

                    Map<String, Boolean> unreadMap = conv.getUnreadMap();
                    if (unreadMap != null && unreadMap.containsKey(safeKey))
                        unread = Boolean.TRUE.equals(unreadMap.get(safeKey));
                }

                if ((lastMessage == null || lastMessage.isBlank()) && g.getId() != null) {
                    try {
                        Optional<Message> latestOpt = messageRepo.findTopByConversationIdOrderByTimestampDesc(g.getId());
                        if (latestOpt.isPresent()) {
                            Message latest = latestOpt.get();
                            lastMessage = latest.getContent();
                            lastSender = latest.getSender();
                            lastSenderName = chatService.getDisplayNameByEmail(latest.getSender());
                            lastMessageTime = latest.getTimestamp() != null
                                    ? latest.getTimestamp().toString() : null;
                        }
                    } catch (Exception ex) {
                        log.debug("⚠️ No fallback message found for group {}", g.getId());
                    }
                }

                node.put("lastMessage", lastMessage);
                node.put("lastSender", lastSender);
                node.put("lastSenderName", lastSenderName);
                node.put("lastMessageTime", lastMessageTime);
                node.put("unread", unread);

                arr.add(node);
            }

            ObjectNode syncMsg = mapper.createObjectNode();
            syncMsg.put("type", "group-sync");
            syncMsg.set("groups", arr);

            sendSafe(session, syncMsg);
            log.info("{} 🔗 [{}] {} connected WS | Synced {} groups (with preview)", ts(), session.getId(), email, groups.size());
        } catch (Exception e) {
            log.error("{} ❌ Error establishing WS connection: {}", ts(), e.getMessage());
            try { session.close(CloseStatus.NOT_ACCEPTABLE); } catch (IOException ignored) {}
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String email = (String) session.getAttributes().get("email");
        if (email != null) {
            chatSessionRegistry.unregister(email, session);
            roomSessions.values().forEach(s -> s.remove(session));
            groupRooms.values().forEach(s -> s.remove(session));
            broadcastOnlineStatus("user-status", email);
        }
    }

    // ======================================================
    // 🔧 UTILS
    // ======================================================
    private String extractToken(WebSocketSession session) {
        String query = Objects.requireNonNull(session.getUri()).getQuery();
        if (query != null && query.startsWith("token=")) {
            return query.substring("token=".length());
        }
        throw new IllegalArgumentException("Missing JWT token");
    }

    private void sendSafe(WebSocketSession session, ObjectNode msg) {
        synchronized (session) {
            try {
                if (session.isOpen()) {
                    session.sendMessage(new TextMessage(msg.toString()));
                }
            } catch (Exception e) {
                log.warn("{} ⚠️ Failed to send WS message: {}", ts(), e.getMessage());
            }
        }
    }

    private void handleRequestOnlineUsers(WebSocketSession session) {
        try {
            var online = chatSessionRegistry.getOnlineUsers();
            var msg = mapper.createObjectNode();
            msg.put("type", "online-users");
            var arr = msg.putArray("users");
            online.forEach(arr::add);
            sendSafe(session, msg);
        } catch (Exception e) {
            log.error("{} ❌ handleRequestOnlineUsers error: {}", ts(), e.getMessage());
        }
    }

    private void sendOnlineUsersToClient(WebSocketSession session) {
        var msg = mapper.createObjectNode();
        msg.put("type", "online-users");
        var arr = msg.putArray("users");
        chatSessionRegistry.getOnlineUsers().forEach(arr::add);
        sendSafe(session, msg);
    }

    private void broadcastOnlineStatus(String event, String email) {
        try {
            var msg = mapper.createObjectNode();
            msg.put("type", event);
            msg.put("email", email);
            msg.put("online", chatSessionRegistry.getOnlineUsers().contains(email));
            chatSessionRegistry.broadcastToAll(msg.toString());
        } catch (Exception e) {
            log.warn("{} ⚠️ Broadcast error {}: {}", ts(), event, e.getMessage());
        }
    }
}
