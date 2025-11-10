package com.chung.webrtc.meeting.socket;

import com.chung.webrtc.auth.service.JwtService;
import com.chung.webrtc.chat.entity.Message;
import com.chung.webrtc.chat.service.ChatGroupService;
import com.chung.webrtc.chat.service.ChatSessionRegistry;
import com.chung.webrtc.meeting.entity.MeetingTempMessage;
import com.chung.webrtc.meeting.service.MeetingChatTempService;
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

import java.util.List;
import java.util.Set;

@Slf4j
@Component
@RequiredArgsConstructor
public class MeetingSocketHandler extends TextWebSocketHandler {

    private final JwtService jwtService;
    private final MeetingSessionRegistry sessionRegistry;
    private final ChatGroupService chatGroupService;
    private final ChatSessionRegistry chatSessionRegistry;
    private final MeetingChatTempService meetingChatTempService; // ✅ Thêm service lưu chat TTL
    private final ObjectMapper mapper = new ObjectMapper();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        log.info("🔗 [WS] Connection opened: {}", session.getId());
    }

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
                case "meeting-chat" -> handleMeetingChat(session, msg);
                case "screen-share" -> handleScreenShare(session, msg);
                case "get-meeting-history" -> handleMeetingHistory(session);
                case "leave" -> handleLeave(session, false);
                default -> log.warn("⚠️ Unknown message type: {}", type);
            }

        } catch (Exception e) {
            log.error("❌ Error handling WS message: {}", e.getMessage(), e);
        }
    }

    private void handleJoin(WebSocketSession session, JsonNode msg) {
        String meetingCode = msg.path("meetingCode").asText(null);
        String email = jwtService.extractEmailFromSession(session);

        if (email == null || meetingCode == null || meetingCode.isBlank()) {
            log.warn("🚫 Invalid join request — meetingCode/email missing");
            try {
                session.close(CloseStatus.NOT_ACCEPTABLE);
            } catch (Exception ignored) {}
            return;
        }

        session.getAttributes().put("meetingCode", meetingCode);
        session.getAttributes().put("email", email);

        // 🟢 Đăng ký user vào cả registry meeting và chat
        sessionRegistry.addUserToRoom(meetingCode, email, session);
        chatSessionRegistry.register(email, session);
        chatSessionRegistry.addToGroup(meetingCode, email);

        sendParticipantListToUser(session, meetingCode);
        broadcastParticipantList(meetingCode);

        ObjectNode joinMsg = mapper.createObjectNode();
        joinMsg.put("type", "participant-joined");
        joinMsg.put("email", email);
        sessionRegistry.broadcast(meetingCode, joinMsg.toString(), session);

        log.info("🟢 [{}] {} joined meeting", meetingCode, email);
    }

    private void sendParticipantListToUser(WebSocketSession session, String meetingCode) {
        try {
            Set<String> participants = sessionRegistry.getParticipants(meetingCode);
            ObjectNode listMsg = mapper.createObjectNode();
            listMsg.put("type", "participant-list");
            ArrayNode arr = listMsg.putArray("participants");
            participants.forEach(arr::add);
            session.sendMessage(new TextMessage(listMsg.toString()));
        } catch (Exception e) {
            log.error("❌ Failed to send participant-list", e);
        }
    }

    private void broadcastParticipantList(String meetingCode) {
        try {
            Set<String> participants = sessionRegistry.getParticipants(meetingCode);
            ObjectNode msg = mapper.createObjectNode();
            msg.put("type", "participant-list");
            ArrayNode arr = msg.putArray("participants");
            participants.forEach(arr::add);
            sessionRegistry.broadcast(meetingCode, msg.toString(), null);
        } catch (Exception e) {
            log.error("❌ Error broadcasting participant-list", e);
        }
    }

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
    }

    /**
     * 💬 Chat trong cuộc họp:
     * - Lưu tạm thời vào Mongo TTL (MeetingChatTempService)
     * - Cập nhật conversation metadata (ChatGroupService)
     * - Gửi realtime cho tất cả WS đang tham gia
     */
    private void handleMeetingChat(WebSocketSession session, JsonNode msg) {
        String meetingCode = sessionRegistry.getMeetingCode(session);
        String sender = sessionRegistry.getEmail(session);
        String content = msg.path("message").asText("");

        if (meetingCode == null || content.isBlank()) return;

        // ✅ Lưu tạm message trong Mongo TTL
        meetingChatTempService.saveTempMessage(meetingCode, sender, content);

        // ✅ Cập nhật Conversation metadata (type = MEETING)
        chatGroupService.saveMeetingMessage(meetingCode, sender, content);

        ObjectNode node = mapper.createObjectNode();
        node.put("type", "meeting-chat");
        node.put("meetingCode", meetingCode);
        node.put("sender", sender);
        node.put("message", content);
        node.put("timestamp", java.time.Instant.now().toString());

        chatSessionRegistry.broadcastToGroup(meetingCode, node.toString());
        log.info("💬 [{}] {}: {}", meetingCode, sender, content);
    }

    /**
     * 📜 Gửi lại lịch sử chat tạm từ Mongo TTL (7 ngày)
     */
    private void handleMeetingHistory(WebSocketSession session) {
        String meetingCode = sessionRegistry.getMeetingCode(session);
        if (meetingCode == null) return;

        try {
            List<MeetingTempMessage> history = meetingChatTempService.getMessages(meetingCode);
            ObjectNode hist = mapper.createObjectNode();
            hist.put("type", "meeting-history");
            hist.put("meetingCode", meetingCode);
            ArrayNode arr = hist.putArray("messages");

            history.forEach(m -> {
                ObjectNode item = arr.addObject();
                item.put("sender", m.getSender());
                item.put("message", m.getContent());
                item.put("timestamp", m.getTimestamp().toString());
            });

            session.sendMessage(new TextMessage(hist.toString()));
            log.info("📜 [{}] Sent {} messages history (TTL)", meetingCode, history.size());
        } catch (Exception e) {
            log.error("❌ Failed to send meeting history", e);
        }
    }

    private void handleLeave(WebSocketSession session, boolean isDisconnect) {
        String meetingCode = sessionRegistry.getMeetingCode(session);
        String email = sessionRegistry.getEmail(session);

        if (meetingCode == null || email == null) return;

        sessionRegistry.removeUser(session);
        chatSessionRegistry.unregister(email, session);
        chatSessionRegistry.removeFromGroup(meetingCode, email);

        ObjectNode leaveMsg = mapper.createObjectNode();
        leaveMsg.put("type", "participant-left");
        leaveMsg.put("email", email);
        sessionRegistry.broadcast(meetingCode, leaveMsg.toString(), null);
        broadcastParticipantList(meetingCode);
    }

    private void handleScreenShare(WebSocketSession session, JsonNode msg) {
        String meetingCode = sessionRegistry.getMeetingCode(session);
        String email = sessionRegistry.getEmail(session);
        boolean active = msg.path("active").asBoolean(false);

        ObjectNode node = mapper.createObjectNode();
        node.put("type", "screen-share");
        node.put("email", email);
        node.put("active", active);

        sessionRegistry.broadcast(meetingCode, node.toString(), session);
        log.info("🖥️ [{}] {} {}", meetingCode, email, active ? "started screen share" : "stopped screen share");
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        handleLeave(session, true);
        log.info("🔌 [WS] Disconnected: {} ({})", session.getId(), status);
    }
}
