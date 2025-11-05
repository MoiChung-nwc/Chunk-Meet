package com.chung.webrtc.meeting.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;

/**
 * 📞 CallSessionRegistry v4 – fixed for persistent /ws/call
 * - Không xóa session khi end-call, chỉ khi disconnect thực sự
 * - Thread-safe, multi-tab, multi-device
 */
@Slf4j
@Component
public class CallSessionRegistry {

    private final ConcurrentHashMap<String, CopyOnWriteArraySet<WebSocketSession>> sessions = new ConcurrentHashMap<>();

    /** 🔹 Đăng ký session cho user */
    public void registerUser(String email, WebSocketSession session) {
        if (email == null || session == null) return;
        sessions.computeIfAbsent(email, k -> new CopyOnWriteArraySet<>()).add(session);
        log.info("✅ User {} connected (sessionId={}), totalSessions={}", email, session.getId(), sessions.get(email).size());
    }

    /**
     * 🔹 Xóa session — có kiểm tra lý do đóng (CloseStatus)
     * ⚠️ Không remove nếu reason = "end-call"
     */
    public void removeUser(String email, WebSocketSession session, CloseStatus status) {
        if (email == null || session == null) return;

        String reason = (status != null && status.getReason() != null) ? status.getReason() : "";

        if ("end-call".equalsIgnoreCase(reason)) {
            log.debug("⚠️ Skip removing {} (reason=end-call, keep session alive)", email);
            return;
        }

        Set<WebSocketSession> userSessions = sessions.get(email);
        if (userSessions == null) {
            log.debug("ℹ️ No active sessions found for {}", email);
            return;
        }

        userSessions.remove(session);
        log.info("❌ Removed session {} for {}, remainingSessions={}", session.getId(), email, userSessions.size());

        if (userSessions.isEmpty()) {
            sessions.remove(email);
            log.info("❌ All sessions closed for user {}", email);
        }
    }

    /** 🔹 Xóa toàn bộ session của user (logout / shutdown) */
    public void removeUser(String email) {
        if (email == null) return;
        Set<WebSocketSession> set = sessions.remove(email);
        if (set == null) return;

        log.info("❌ Removing all sessions for {} (count={})", email, set.size());
        for (WebSocketSession s : set) {
            try {
                if (s.isOpen()) s.close(CloseStatus.NORMAL);
            } catch (IOException ignored) {}
        }
    }

    /** 📤 Gửi tin nhắn đến tất cả session của user */
    public boolean sendToUser(String email, String message) {
        Set<WebSocketSession> set = sessions.get(email);
        if (set == null || set.isEmpty()) {
            log.debug("⚠️ Cannot send to {}, no sessions", email);
            return false;
        }

        boolean sent = false;
        for (WebSocketSession s : set) {
            if (s != null && s.isOpen()) {
                try {
                    s.sendMessage(new TextMessage(message));
                    sent = true;
                } catch (IOException e) {
                    log.error("❌ Error sending to {} (session={}): {}", email, s.getId(), e.getMessage());
                }
            }
        }

        if (!sent)
            log.warn("⚠️ All sessions closed for {} when trying to send", email);
        return sent;
    }

    /** 🔹 Kiểm tra user có online không */
    public boolean isOnline(String email) {
        Set<WebSocketSession> set = sessions.get(email);
        if (set == null) return false;

        for (WebSocketSession s : set) {
            if (s != null && s.isOpen()) return true;
        }
        return false;
    }

    /** 🔹 Debug helper */
    public int getSessionCount(String email) {
        Set<WebSocketSession> set = sessions.get(email);
        return (set == null) ? 0 : set.size();
    }
}
