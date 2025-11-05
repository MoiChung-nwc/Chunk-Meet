package com.chung.webrtc.meeting.controller;

import com.chung.webrtc.meeting.service.CallSessionRegistry;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

/**
 * ✅ SignalingController xử lý kết nối /ws/signaling giữa hai peer
 * - Nhận: join, ready, offer, answer, ice-candidate, end-call, chat...
 * - Gửi: peer-ready, relay tín hiệu giữa hai user
 *
 * 🔧 Đã fix:
 * - Chỉ gửi "peer-ready" một chiều (from → to), không gửi ngược lại cho chính mình.
 * - Log rõ ràng, tránh null pointer.
 * - Relay signaling đúng hướng theo RFC 8829 (WebRTC 1-1).
 */
@Slf4j
@Component("signalingController")
@RequiredArgsConstructor
public class SignalingController extends TextWebSocketHandler {

    private final CallSessionRegistry sessionRegistry;
    private final ObjectMapper mapper = new ObjectMapper();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        String email = (String) session.getAttributes().get("email");
        if (email != null) {
            sessionRegistry.registerUser(email, session);
            log.info("✅ [SIGNALING] Connected: {}", email);
        } else {
            log.warn("⚠️ [SIGNALING] Connection missing email attribute");
        }
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        String payload = message.getPayload();

        try {
            JsonNode json = mapper.readTree(payload);
            String type = json.path("type").asText(null);
            String from = json.path("from").asText(null);
            String to = json.path("to").asText(null);

            log.info("📨 [SIGNALING] Received type='{}' from={} → to={} payload={}", type, from, to, payload);

            if (type == null) {
                log.warn("⚠️ [SIGNALING] Missing 'type' field: {}", payload);
                return;
            }

            // 🚫 Chặn gửi tín hiệu cho chính mình
            if (from != null && to != null && from.equals(to)) {
                log.warn("🚫 [SIGNALING] Blocked self-message from {}", from);
                return;
            }

            switch (type) {

                // 👋 Client thông báo đã join signaling
                case "join" -> {
                    String email = (String) session.getAttributes().get("email");
                    if (email != null) {
                        sessionRegistry.registerUser(email, session);
                        log.info("👋 [SIGNALING] {} joined via JWT", email);
                    } else {
                        log.warn("⚠️ [SIGNALING] join received but email missing in session");
                    }
                }

                // ✅ Khi user báo đã sẵn sàng (trước khi gửi offer)
                case "ready" -> {
                    if (to != null && !to.isBlank()) {
                        // ✅ chỉ gửi peer-ready cho đối phương, không gửi ngược lại
                        boolean ok = sessionRegistry.sendToUser(
                                to,
                                mapper.createObjectNode()
                                        .put("type", "peer-ready")
                                        .put("from", from)
                                        .toString()
                        );
                        log.info("✅ [SIGNALING] {} ready → notified {} (ok={})", from, to, ok);
                    } else {
                        log.info("🟢 [SIGNALING] {} ready (no target specified yet)", from);
                    }
                }

                // ✅ Forward tất cả các tín hiệu WebRTC (1-1)
                case "offer", "answer", "ice", "ice-candidate", "end-call", "hangup", "chat" -> {
                    if (to == null || to.isBlank()) {
                        log.warn("⚠️ [SIGNALING] '{}' missing 'to' field", type);
                        return;
                    }

                    if (!sessionRegistry.isOnline(to)) {
                        log.warn("❌ [SIGNALING] Target '{}' not online, skip {}", to, type);
                        return;
                    }

                    // Bỏ qua ICE candidate null
                    if ((type.equals("ice") || type.equals("ice-candidate")) && json.path("candidate").isNull()) {
                        log.debug("⚠️ [SIGNALING] Null ICE candidate ignored from {}", from);
                        return;
                    }

                    boolean sent = sessionRegistry.sendToUser(to, json.toString());
                    if (sent) {
                        log.info("🔁 [SIGNALING] {} relayed from {} → {}", type.toUpperCase(), from, to);
                    } else {
                        log.warn("⚠️ [SIGNALING] Failed to relay {} from {} → {}", type, from, to);
                    }
                }

                default -> log.warn("⚠️ [SIGNALING] Unknown message type: {}", type);
            }

        } catch (Exception e) {
            log.error("❌ [SIGNALING] Exception: {} \nPayload: {}\n", e.getMessage(), payload, e);
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String email = (String) session.getAttributes().get("email");
        if (email != null) {
            sessionRegistry.removeUser(email, session, status);
            log.info("🔴 [SIGNALING] {} disconnected ({})", email, status);
        } else {
            log.warn("⚠️ [SIGNALING] Session closed without email attr ({})", status);
        }
    }
}
