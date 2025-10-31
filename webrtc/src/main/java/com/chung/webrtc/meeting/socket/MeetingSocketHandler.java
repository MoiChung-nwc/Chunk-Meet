package com.chung.webrtc.meeting.socket;

import com.chung.webrtc.auth.service.JwtService;
import com.chung.webrtc.meeting.service.MeetingSessionRegistry;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

@Slf4j
@Component
@RequiredArgsConstructor
public class MeetingSocketHandler extends TextWebSocketHandler {

    private final JwtService jwtService;
    private final MeetingSessionRegistry sessionRegistry;
    private final ObjectMapper mapper = new ObjectMapper();

    /** ✅ Khi client kết nối */
    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        log.info("🔗 [WS] Connection opened: {}", session.getId());
    }

    /** 📩 Khi nhận tin nhắn */
    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        try {
            JsonNode msg = mapper.readTree(message.getPayload());
            String type = msg.path("type").asText();

            switch (type) {
                case "join" -> handleJoin(session, msg);
                case "offer", "answer", "ice-candidate" -> handleSignaling(session, msg);
                case "chat" -> handleChat(session, msg);
                case "leave" -> handleLeave(session);
                default -> log.warn("⚠️ Unknown message type: {}", type);
            }

        } catch (Exception e) {
            log.error("❌ Error handling WS message: {}", e.getMessage(), e);
        }
    }

    /** 👥 Khi user join phòng */
    private void handleJoin(WebSocketSession session, JsonNode msg) {
        String meetingCode = msg.path("meetingCode").asText();
        String email = msg.path("email").asText();

        // ✅ Lấy token trong query param và validate
        String token = null;
        try {
            var query = session.getUri().getQuery();
            if (query != null && query.startsWith("token=")) {
                token = query.substring(6);
            }
        } catch (Exception ignored) {}

        if (token == null || !jwtService.isTokenValid(token)) {
            log.warn("🚫 Invalid token for {}", email);
            try { session.close(CloseStatus.NOT_ACCEPTABLE); } catch (Exception ignored) {}
            return;
        }

        // ✅ Lưu user vào registry
        session.getAttributes().put("meetingCode", meetingCode);
        session.getAttributes().put("email", email);
        sessionRegistry.addUserToRoom(meetingCode, email, session);

        // ✅ Thông báo cho các participant khác
        ObjectNode joinMsg = mapper.createObjectNode();
        joinMsg.put("type", "participant-joined");
        joinMsg.put("email", email);
        sessionRegistry.broadcast(meetingCode, joinMsg.toString(), session);

        log.info("🟢 [{}] {} joined meeting", meetingCode, email);
    }

    /** 🔁 Xử lý signaling (offer/answer/ice) */
    private void handleSignaling(WebSocketSession session, JsonNode msg) {
        String meetingCode = sessionRegistry.getMeetingCode(session);
        String fromEmail = sessionRegistry.getEmail(session);
        String toEmail = msg.path("to").asText(null);

        if (meetingCode == null || toEmail == null) {
            log.warn("⚠️ Invalid signaling message: missing meetingCode or to");
            return;
        }

        ObjectNode relayMsg = msg.deepCopy();
        relayMsg.put("from", fromEmail);

        // ✅ Gửi trực tiếp tới người nhận
        sessionRegistry.sendToUser(meetingCode, toEmail, relayMsg.toString());
        log.debug("📡 [{}] {} → {} ({})", meetingCode, fromEmail, toEmail, msg.path("type").asText());
    }

    /** 💬 Chat nhóm (broadcast toàn phòng) */
    private void handleChat(WebSocketSession session, JsonNode msg) {
        String meetingCode = sessionRegistry.getMeetingCode(session);
        String fromEmail = sessionRegistry.getEmail(session);

        if (meetingCode == null) return;

        ObjectNode chatMsg = mapper.createObjectNode();
        chatMsg.put("type", "chat");
        chatMsg.put("from", fromEmail);
        chatMsg.put("message", msg.path("message").asText());

        sessionRegistry.broadcast(meetingCode, chatMsg.toString(), null);
        log.info("💬 [{}] {}: {}", meetingCode, fromEmail, msg.path("message").asText());
    }

    /** 🚪 Khi user rời phòng */
    private void handleLeave(WebSocketSession session) {
        String meetingCode = sessionRegistry.getMeetingCode(session);
        String email = sessionRegistry.getEmail(session);

        sessionRegistry.removeUser(session);

        if (meetingCode != null && email != null) {
            ObjectNode leaveMsg = mapper.createObjectNode();
            leaveMsg.put("type", "participant-left");
            leaveMsg.put("email", email);
            sessionRegistry.broadcast(meetingCode, leaveMsg.toString(), null);

            log.info("🔴 [{}] {} left meeting", meetingCode, email);
        }
    }

    /** 🧹 Khi mất kết nối đột ngột */
    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        handleLeave(session);
        log.info("🔌 [WS] Disconnected: {} ({})", session.getId(), status);
    }
}
