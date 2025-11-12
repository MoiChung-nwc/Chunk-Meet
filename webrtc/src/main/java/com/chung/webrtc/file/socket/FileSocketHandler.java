package com.chung.webrtc.file.socket;

import com.chung.webrtc.auth.service.JwtService;
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

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Component
@RequiredArgsConstructor
public class FileSocketHandler extends TextWebSocketHandler {

    private final JwtService jwtService;
    private final ObjectMapper mapper = new ObjectMapper();

    // email -> session
    private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        String email = jwtService.extractEmailFromSession(session);
        if (email == null) {
            log.warn("🚫 File WS rejected: invalid token");
            try {
                session.close(CloseStatus.NOT_ACCEPTABLE);
            } catch (Exception ignored) {}
            return;
        }
        sessions.put(email, session);
        log.info("📂 [WS:file] Connected {}", email);
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        try {
            JsonNode msg = mapper.readTree(message.getPayload());
            String type = msg.path("type").asText();
            String to = msg.path("to").asText(null);
            String from = jwtService.extractEmailFromSession(session);

            if (to == null || type == null || from == null) {
                log.warn("⚠️ Invalid message {}", msg);
                return;
            }

            WebSocketSession target = sessions.get(to);
            if (target == null || !target.isOpen()) {
                log.warn("⚠️ Target {} not connected for {}", to, type);
                return;
            }

            ObjectNode relay = mapper.createObjectNode();
            relay.put("type", type);
            relay.put("from", from);

            if (msg.has("meta")) relay.set("meta", msg.get("meta"));
            if (msg.has("accept")) relay.put("accept", msg.get("accept"));

            target.sendMessage(new TextMessage(relay.toString()));

            log.info("📨 [{}] {} → {} ({})", "file", from, to, type);
        } catch (Exception e) {
            log.error("❌ Error handling file WS message: {}", e.getMessage(), e);
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String email = jwtService.extractEmailFromSession(session);
        if (email != null) sessions.remove(email);
        log.info("❌ [WS:file] Disconnected {}", email);
    }
}
