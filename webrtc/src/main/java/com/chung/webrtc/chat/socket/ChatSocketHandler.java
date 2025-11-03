package com.chung.webrtc.chat.socket;

import com.chung.webrtc.auth.service.JwtService;
import com.chung.webrtc.chat.entity.Message;
import com.chung.webrtc.chat.service.ChatService;
import com.chung.webrtc.chat.service.ChatSessionRegistry;
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
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Component
@RequiredArgsConstructor
public class ChatSocketHandler extends TextWebSocketHandler {

    private final JwtService jwtService;
    private final ChatService chatService;
    private final ChatSessionRegistry chatSessionRegistry;
    private final ObjectMapper mapper = new ObjectMapper();

    private final Map<String, Set<WebSocketSession>> roomSessions = new ConcurrentHashMap<>();

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        try {
            JsonNode msg = mapper.readTree(message.getPayload());
            String type = msg.path("type").asText();

            switch (type) {
                case "join" -> handleJoin(session, msg);
                case "chat" -> handleChat(session, msg);
                case "typing" -> handleTyping(session, msg);
                case "read-update" -> handleReadUpdate(session, msg); // 🆕
                default -> log.warn("⚠️ Unknown WS message type: {}", type);
            }
        } catch (Exception e) {
            log.error("❌ WS error: {}", e.getMessage(), e);
        }
    }

    /** 👥 Khi user join conversation */
    private void handleJoin(WebSocketSession session, JsonNode msg) throws IOException {
        String conversationId = msg.path("conversationId").asText();
        String token = extractToken(session);
        String email = jwtService.extractUsername(token);

        if (conversationId == null || conversationId.isBlank()) return;

        roomSessions.computeIfAbsent(conversationId, k -> ConcurrentHashMap.newKeySet()).add(session);
        session.getAttributes().put("conversationId", conversationId);
        session.getAttributes().put("email", email);

        List<Message> history = chatService.getMessages(conversationId);
        ObjectNode histMsg = mapper.createObjectNode();
        histMsg.put("type", "chat-history");
        ArrayNode arr = histMsg.putArray("messages");
        history.forEach(m -> {
            ObjectNode item = arr.addObject();
            item.put("sender", m.getSender());
            item.put("message", m.getContent());
            item.put("timestamp", m.getTimestamp().toString());
        });
        session.sendMessage(new TextMessage(histMsg.toString()));

        log.info("🟢 [{}] {} joined conversation {}", session.getId(), email, conversationId);
    }

    /** 💬 Nhận message chat */
    private void handleChat(WebSocketSession session, JsonNode msg) {
        try {
            String conversationId = msg.path("conversationId").asText();
            String token = extractToken(session);
            String sender = jwtService.extractUsername(token);
            String content = msg.path("message").asText();

            if (conversationId == null || content == null || content.isBlank()) return;

            Message saved = chatService.saveMessage(conversationId, sender, content);

            ObjectNode node = mapper.createObjectNode();
            node.put("type", "chat");
            node.put("conversationId", conversationId);
            node.put("sender", sender);
            node.put("message", content);
            node.put("timestamp", saved.getTimestamp().toString());

            String json = node.toString();
            roomSessions.getOrDefault(conversationId, Set.of()).forEach(sess -> {
                try {
                    if (sess.isOpen()) sess.sendMessage(new TextMessage(json));
                } catch (IOException ignored) {}
            });

            ObjectNode notify = mapper.createObjectNode();
            notify.put("type", "new-message");
            notify.put("conversationId", conversationId);
            notify.put("from", sender);
            notify.put("content", content);
            notify.put("timestamp", saved.getTimestamp().toString());
            chatSessionRegistry.broadcastToAll(notify.toString());

            log.info("💬 [{}] {}: {}", conversationId, sender, content);
        } catch (Exception e) {
            log.error("❌ handleChat error: {}", e.getMessage());
        }
    }

    /** ✍️ Khi user đang nhập */
    private void handleTyping(WebSocketSession session, JsonNode msg) {
        String conversationId = msg.path("conversationId").asText();
        String token = extractToken(session);
        String sender = jwtService.extractUsername(token);

        ObjectNode node = mapper.createObjectNode();
        node.put("type", "typing");
        node.put("from", sender);
        node.put("conversationId", conversationId);

        roomSessions.getOrDefault(conversationId, Set.of()).forEach(sess -> {
            try {
                if (sess.isOpen() && sess != session) {
                    sess.sendMessage(new TextMessage(node.toString()));
                }
            } catch (IOException ignored) {}
        });
    }

    /** 👁️ Khi user đọc conversation */
    private void handleReadUpdate(WebSocketSession session, JsonNode msg) {
        try {
            String conversationId = msg.path("conversationId").asText();
            String token = extractToken(session);
            String reader = jwtService.extractUsername(token);

            chatService.markAsRead(conversationId, reader);

            ObjectNode event = mapper.createObjectNode();
            event.put("type", "read-update");
            event.put("conversationId", conversationId);
            event.put("reader", reader);

            chatSessionRegistry.broadcastToAll(event.toString());
            log.info("👁️ {} read conversation {}", reader, conversationId);
        } catch (Exception e) {
            log.error("❌ handleReadUpdate error: {}", e.getMessage());
        }
    }

    // --- lifecycle & helpers ---

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        try {
            String token = extractToken(session);
            String email = jwtService.extractUsername(token);
            session.getAttributes().put("email", email);
            chatSessionRegistry.register(email, session);
            broadcastOnlineStatus("user-status", email);
            sendOnlineUsersToClient(session);
            log.info("✅ WebSocket connected: {} ({})", email, session.getId());
        } catch (Exception e) {
            log.error("❌ Error establishing WS connection: {}", e.getMessage());
            try { session.close(CloseStatus.NOT_ACCEPTABLE); } catch (IOException ignored) {}
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String email = (String) session.getAttributes().get("email");
        if (email != null) {
            chatSessionRegistry.unregister(email, session);
            broadcastOnlineStatus("user-status", email);
            broadcastOnlineList();
            log.info("🔻 [{}] {} disconnected", session.getId(), email);
        }
    }

    private String extractToken(WebSocketSession session) {
        String query = Objects.requireNonNull(session.getUri()).getQuery();
        if (query != null && query.startsWith("token=")) {
            return query.substring("token=".length());
        }
        throw new IllegalArgumentException("Missing JWT token");
    }

    private void broadcastOnlineList() {
        try {
            var msg = mapper.createObjectNode();
            msg.put("type", "online-users");
            var arr = msg.putArray("users");
            chatSessionRegistry.getOnlineUsers().forEach(arr::add);
            chatSessionRegistry.broadcastToAll(msg.toString());
        } catch (Exception e) {
            log.error("❌ Failed to broadcast online list", e);
        }
    }

    private void sendOnlineUsersToClient(WebSocketSession session) {
        try {
            var msg = mapper.createObjectNode();
            msg.put("type", "online-users");
            var arr = msg.putArray("users");
            chatSessionRegistry.getOnlineUsers().forEach(arr::add);
            session.sendMessage(new TextMessage(msg.toString()));
        } catch (IOException e) {
            log.error("❌ Failed to send online users", e);
        }
    }

    private void broadcastOnlineStatus(String event, String email) {
        try {
            var msg = mapper.createObjectNode();
            msg.put("type", event);
            msg.put("email", email);
            boolean online = chatSessionRegistry.getOnlineUsers().contains(email);
            msg.put("online", online);
            if (!online) {
                var lastSeen = chatSessionRegistry.getLastSeen(email);
                msg.put("lastSeen", lastSeen != null ? lastSeen.toString() : "");
            }
            chatSessionRegistry.broadcastToAll(msg.toString());
        } catch (Exception e) {
            log.error("❌ Failed to broadcast {}", event, e);
        }
    }
}
