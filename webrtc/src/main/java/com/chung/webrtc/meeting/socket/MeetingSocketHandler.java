package com.chung.webrtc.meeting.socket;

import com.chung.webrtc.auth.service.JwtService;
import com.chung.webrtc.meeting.service.MeetingSessionRegistry;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.Set;

@Slf4j
@Component
@RequiredArgsConstructor
public class MeetingSocketHandler extends TextWebSocketHandler {

    private final JwtService jwtService;
    private final MeetingSessionRegistry sessionRegistry;
    private final ObjectMapper mapper = new ObjectMapper();

    /** ✅ Khi client kết nối mới */
    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        log.info("🔗 [WS] Connection opened: {}", session.getId());
    }

    /** ✅ Xử lý khi nhận message từ client */
    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        try {
            JsonNode msg = mapper.readTree(message.getPayload());
            String type = msg.path("type").asText(null);

            if (type == null || type.isBlank()) {
                log.warn("⚠️ Message missing type field: {}", message.getPayload());
                return;
            }

            switch (type) {
                case "join" -> handleJoin(session, msg);
                case "offer", "answer", "ice-candidate" -> handleSignaling(session, msg);
                case "chat" -> handleChat(session, msg);
                case "leave" -> handleLeave(session, false);
                default -> log.warn("⚠️ Unknown message type: {}", type);
            }

        } catch (Exception e) {
            log.error("❌ Error handling WS message: {}", e.getMessage(), e);
        }
    }

    /** 👥 Xử lý khi người dùng join phòng */
    private void handleJoin(WebSocketSession session, JsonNode msg) {
        String meetingCode = msg.path("meetingCode").asText(null);
        String email = jwtService.extractEmailFromSession(session);

        if (email == null || meetingCode == null || meetingCode.isBlank()) {
            log.warn("🚫 Invalid join request — meetingCode/email missing");
            try { session.close(CloseStatus.NOT_ACCEPTABLE); } catch (Exception ignored) {}
            return;
        }

        session.getAttributes().put("meetingCode", meetingCode);
        session.getAttributes().put("email", email);

        sessionRegistry.addUserToRoom(meetingCode, email, session);
        sendParticipantListToUser(session, meetingCode);

        // Broadcast user joined
        ObjectNode joinMsg = mapper.createObjectNode();
        joinMsg.put("type", "participant-joined");
        joinMsg.put("email", email);
        sessionRegistry.broadcast(meetingCode, joinMsg.toString(), session);

        // Sync participant list
        broadcastParticipantList(meetingCode);

        log.info("🟢 [{}] {} joined meeting", meetingCode, email);
    }

    /** 📤 Gửi danh sách participants hiện tại cho user mới */
    private void sendParticipantListToUser(WebSocketSession session, String meetingCode) {
        try {
            Set<String> participants = sessionRegistry.getParticipants(meetingCode);
            ObjectNode listMsg = mapper.createObjectNode();
            listMsg.put("type", "participant-list");
            ArrayNode arr = listMsg.putArray("participants");
            participants.forEach(arr::add);
            session.sendMessage(new TextMessage(listMsg.toString()));
            log.info("📤 [{}] Sent participant-list to {}", meetingCode, session.getAttributes().get("email"));
        } catch (Exception e) {
            log.error("❌ Failed to send participant-list", e);
        }
    }

    /** 📡 Broadcast danh sách participant mới nhất cho toàn bộ phòng */
    private void broadcastParticipantList(String meetingCode) {
        try {
            Set<String> participants = sessionRegistry.getParticipants(meetingCode);
            ObjectNode msg = mapper.createObjectNode();
            msg.put("type", "participant-list");
            ArrayNode arr = msg.putArray("participants");
            participants.forEach(arr::add);
            sessionRegistry.broadcast(meetingCode, msg.toString(), null);
            log.info("📡 [{}] Broadcast participant-list: {}", meetingCode, participants);
        } catch (Exception e) {
            log.error("❌ Error broadcasting participant-list", e);
        }
    }

    /** 🔄 Xử lý tín hiệu WebRTC: offer / answer / ice */
    private void handleSignaling(WebSocketSession session, JsonNode msg) {
        String meetingCode = sessionRegistry.getMeetingCode(session);
        String fromEmail = sessionRegistry.getEmail(session);
        String toEmail = msg.path("to").asText(null);

        if (meetingCode == null || toEmail == null || fromEmail == null) {
            log.warn("⚠️ Invalid signaling message (missing meetingCode/from/to)");
            return;
        }

        ObjectNode relayMsg = msg.deepCopy();
        relayMsg.put("from", fromEmail);
        sessionRegistry.sendToUser(meetingCode, toEmail, relayMsg.toString());
        log.debug("📡 [{}] {} → {} ({})", meetingCode, fromEmail, toEmail, msg.path("type").asText());
    }

    /** 💬 Chat nhóm realtime */
    private void handleChat(WebSocketSession session, JsonNode msg) {
        String meetingCode = sessionRegistry.getMeetingCode(session);
        String fromEmail = sessionRegistry.getEmail(session);
        if (meetingCode == null || fromEmail == null) return;

        String message = msg.path("message").asText("");
        if (message.isBlank()) return;

        ObjectNode chatMsg = mapper.createObjectNode();
        chatMsg.put("type", "chat");
        chatMsg.put("from", fromEmail);
        chatMsg.put("message", message);
        sessionRegistry.broadcast(meetingCode, chatMsg.toString(), null);
        log.info("💬 [{}] {}: {}", meetingCode, fromEmail, message);
    }

    /**
     * 🟥 Khi user rời phòng (thủ công hoặc WS close)
     * @param isDisconnect true nếu là mất kết nối (not explicit leave)
     */
    private void handleLeave(WebSocketSession session, boolean isDisconnect) {
        String meetingCode = sessionRegistry.getMeetingCode(session);
        String email = sessionRegistry.getEmail(session);

        // Nếu client gửi leave sai thời điểm → bỏ qua
        if (meetingCode == null || email == null) {
            log.warn("⚠️ Ignoring stray leave message (no meeting context) [{}]", session.getId());
            return;
        }

        sessionRegistry.removeUser(session);

        // Gửi broadcast rời phòng
        ObjectNode leaveMsg = mapper.createObjectNode();
        leaveMsg.put("type", "participant-left");
        leaveMsg.put("email", email);
        sessionRegistry.broadcast(meetingCode, leaveMsg.toString(), null);
        broadcastParticipantList(meetingCode);

        log.info("{} [{}] {} left meeting", isDisconnect ? "🔌" : "🔴", meetingCode, email);
    }

    /** 🔌 Khi mất kết nối đột ngột (socket close, tab tắt, mạng rớt) */
    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        handleLeave(session, true);
        log.info("🔌 [WS] Disconnected: {} ({})", session.getId(), status);
    }
}
