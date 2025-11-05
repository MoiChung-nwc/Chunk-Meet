package com.chung.webrtc.meeting.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class CallService {

    private final CallSessionRegistry sessionRegistry;
    private final ObjectMapper mapper = new ObjectMapper();

    /** 🟢 A gọi đến B */
    public boolean startCall(String from, String to) {
        if (!sessionRegistry.isOnline(to)) {
            log.warn("❌ User {} is offline, cannot call", to);

            ObjectNode fail = mapper.createObjectNode();
            fail.put("type", "call-failed");
            fail.put("to", to);
            fail.put("reason", "Người nhận đang offline");
            sessionRegistry.sendToUser(from, fail.toString());
            return false;
        }

        ObjectNode payload = mapper.createObjectNode();
        payload.put("type", "incoming-call");
        payload.put("from", from);
        boolean sent = sessionRegistry.sendToUser(to, payload.toString());

        log.info("📨 Sent incoming-call from {} -> {}", from, to);
        return sent;
    }

    /** ✅ B chấp nhận cuộc gọi */
    public void acceptCall(String from, String to) {
        log.info("📞 {} accepted call from {} — verifying readiness...", from, to);

        new Thread(() -> {
            int retries = 0;
            boolean sent = false;

            while (retries < 3 && !sent) {
                if (sessionRegistry.isOnline(to)) {
                    ObjectNode payload = mapper.createObjectNode();
                    payload.put("type", "accept-call");
                    payload.put("from", from);
                    sessionRegistry.sendToUser(to, payload.toString());
                    sent = true;
                    log.info("✅ {} accepted call from {} (signaling ready)", from, to);
                } else {
                    retries++;
                    try {
                        log.info("⏳ Waiting for {} signaling ready... ({} / 3)", to, retries);
                        Thread.sleep(1000);
                    } catch (InterruptedException ignored) {}
                }
            }

            if (!sent) log.warn("⚠️ Failed to notify {} that {} accepted the call", to, from);
        }).start();
    }

    /** 🚫 B từ chối cuộc gọi */
    public void rejectCall(String from, String to) {
        ObjectNode payload = mapper.createObjectNode();
        payload.put("type", "reject-call");
        payload.put("from", from);

        sessionRegistry.sendToUser(to, payload.toString());
        log.info("🚫 {} rejected call from {}", from, to);
    }

    /** 📴 Một bên kết thúc cuộc gọi */
    public void hangupCall(String from, String to) {
        ObjectNode payload = mapper.createObjectNode();
        payload.put("type", "hangup");
        payload.put("from", from);

        sessionRegistry.sendToUser(to, payload.toString());
        log.info("📴 {} hung up the call with {}", from, to);

        // ❌ KHÔNG close session ở đây
        // ✅ Giữ kết nối WebSocket để lần sau gọi lại không bị "offline"
    }
}
