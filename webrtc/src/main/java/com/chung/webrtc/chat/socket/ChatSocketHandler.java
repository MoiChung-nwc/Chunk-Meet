package com.chung.webrtc.chat.socket;

import com.chung.webrtc.auth.service.JwtService;
import com.chung.webrtc.chat.entity.Message;
import com.chung.webrtc.chat.service.ChatService;
import com.chung.webrtc.chat.service.ChatSessionRegistry;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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

    /** conversationId -> sessions (nhóm WS trong từng cuộc trò chuyện) */
    private final Map<String, Set<WebSocketSession>> roomSessions = new ConcurrentHashMap<>();

    /**
     * 📩 Khi nhận tin nhắn WS
     */
    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        try {
            JsonNode msg = mapper.readTree(message.getPayload());
            String type = msg.path("type").asText();

            switch (type) {
                case "join" -> handleJoin(session, msg);
                case "chat" -> handleChat(session, msg);
                default -> log.warn("⚠️ Unknown WS message type: {}", type);
            }
        } catch (Exception e) {
            log.error("❌ WS error: {}", e.getMessage(), e);
        }
    }

    /**
     * 👥 Khi user join vào 1 cuộc trò chuyện (conversation)
     */
    private void handleJoin(WebSocketSession session, JsonNode msg) {
        String conversationId = msg.path("conversationId").asText();
        String email = msg.path("email").asText();

        roomSessions.computeIfAbsent(conversationId, k -> ConcurrentHashMap.newKeySet()).add(session);
        session.getAttributes().put("conversationId", conversationId);
        session.getAttributes().put("email", email);

        log.info("🟢 [{}] {} joined conversation {}", session.getId(), email, conversationId);
    }

    /**
     * 💬 Khi nhận tin nhắn chat
     */
    private void handleChat(WebSocketSession session, JsonNode msg) {
        String conversationId = msg.path("conversationId").asText();
        String sender = msg.path("sender").asText();
        String content = msg.path("message").asText();

        // Lưu message vào DB
        Message saved = chatService.saveMessage(conversationId, sender, content);

        // Gửi tin nhắn tới tất cả session trong cuộc trò chuyện
        ObjectNode node = mapper.createObjectNode();
        node.put("type", "chat");
        node.put("conversationId", conversationId);
        node.put("sender", sender);
        node.put("message", content);
        node.put("timestamp", saved.getTimestamp().toString());

        String json = node.toString();
        roomSessions.getOrDefault(conversationId, Set.of()).forEach(sess -> {
            try {
                sess.sendMessage(new TextMessage(json));
            } catch (Exception ignored) {}
        });

        log.info("💬 [{}] {}: {}", conversationId, sender, content);
    }

    /**
     * 🟢 Khi kết nối WebSocket được thiết lập
     */
    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        try {
            String token = session.getUri().getQuery().replace("token=", "");
            String email = jwtService.extractUsername(token);

            session.getAttributes().put("email", email);
            chatSessionRegistry.register(email, session);

            // 🧠 Phát sự kiện user-joined cho toàn hệ thống
            broadcastOnlineStatus("user-joined", email);

            // 📤 Gửi danh sách user online cho client mới
            sendOnlineUsersToClient(session);

            log.info("✅ WebSocket connected: {} ({})", email, session.getId());
        } catch (Exception e) {
            log.error("❌ Error establishing WS connection: {}", e.getMessage());
            try { session.close(CloseStatus.NOT_ACCEPTABLE); } catch (IOException ignored) {}
        }
    }

    /**
     * 🔴 Khi người dùng đóng kết nối
     */
    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String email = (String) session.getAttributes().get("email");
        if (email != null) {
            chatSessionRegistry.unregister(email, session);

            // 🧠 Phát sự kiện user-left
            broadcastOnlineStatus("user-left", email);

            // 📤 Cập nhật danh sách user online cho toàn hệ thống
            broadcastOnlineList();

            log.info("🔻 [{}] {} disconnected", session.getId(), email);
        }
    }

    /**
     * 📡 Gửi danh sách user online đến toàn bộ client
     */
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

    /**
     * 📤 Gửi danh sách user online tới client mới connect
     */
    private void sendOnlineUsersToClient(WebSocketSession session) {
        try {
            var msg = mapper.createObjectNode();
            msg.put("type", "online-users");
            var arr = msg.putArray("users");
            chatSessionRegistry.getOnlineUsers().forEach(arr::add);
            session.sendMessage(new TextMessage(msg.toString()));
        } catch (IOException e) {
            log.error("❌ Failed to send online users to {}", session.getId(), e);
        }
    }

    /**
     * 🧠 Gửi sự kiện user join/left đến toàn hệ thống
     */
    private void broadcastOnlineStatus(String event, String email) {
        try {
            var msg = mapper.createObjectNode();
            msg.put("type", event);
            msg.put("email", email);
            chatSessionRegistry.broadcastToAll(msg.toString());
            log.info("📣 Broadcast {} for {}", event, email);
        } catch (Exception e) {
            log.error("❌ Failed to broadcast {}", event, e);
        }
    }
}
