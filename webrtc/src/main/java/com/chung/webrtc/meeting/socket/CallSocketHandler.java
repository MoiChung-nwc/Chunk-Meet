package com.chung.webrtc.meeting.socket;

import com.chung.webrtc.meeting.service.CallService;
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

@Slf4j
@Component
@RequiredArgsConstructor
public class CallSocketHandler extends TextWebSocketHandler {

    private final CallService callService;
    private final CallSessionRegistry sessionRegistry;
    private final ObjectMapper mapper = new ObjectMapper();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        String email = (String) session.getAttributes().get("username");
        if (email != null) {
            sessionRegistry.registerUser(email, session);
            log.info("✅ User {} connected to /ws/call", email);
        } else {
            log.warn("⚠️ WebSocket connection without username");
        }
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        try {
            JsonNode json = mapper.readTree(message.getPayload());
            String type = json.has("type") ? json.get("type").asText() : null;
            if (type == null) return;

            switch (type) {
                case "join" -> {
                    // accept either {"type":"join","email":"..."} or {"type":"join","from":"..."}
                    String email = null;
                    if (json.has("email")) email = json.get("email").asText();
                    else if (json.has("from")) email = json.get("from").asText();

                    if (email != null) {
                        sessionRegistry.registerUser(email, session);
                        log.info("👋 {} joined call socket manually", email);
                    } else {
                        log.warn("⚠️ [CALL] join message missing email/from");
                    }
                }

                // support both "call" and "start-call" from frontend
                case "call", "start-call" -> {
                    String from = json.has("from") ? json.get("from").asText() : null;
                    String to = json.has("to") ? json.get("to").asText() : null;
                    if (from != null && to != null) {
                        callService.startCall(from, to);
                    } else {
                        log.warn("⚠️ [CALL] call/start-call missing fields: {}", json.toString());
                    }
                }

                case "accept-call" -> {
                    String from = json.get("from").asText();
                    String to = json.get("to").asText();
                    callService.acceptCall(from, to);
                }

                case "reject-call" -> {
                    String from = json.get("from").asText();
                    String to = json.get("to").asText();
                    callService.rejectCall(from, to);
                }

                case "hangup" -> {
                    String from = json.get("from").asText();
                    String to = json.get("to").asText();
                    callService.hangupCall(from, to);
                }

                default -> {
                    // Bỏ qua signaling messages ở đây, vì chúng xử lý qua /ws/signaling
                    log.debug("ℹ️ Ignored message type {} (handled elsewhere)", type);
                }
            }

        } catch (Exception e) {
            log.error("❌ Error handling WS message: {}", e.getMessage(), e);
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String email = (String) session.getAttributes().get("username");
        if (email != null) {
            // giữ removeUser (xóa session) — sessionRegistry sẽ track các session của user
            sessionRegistry.removeUser(email, session);
            log.info("🔴 {} disconnected from /ws/call ({})", email, status);
        }
    }
}
