package com.chung.webrtc.meeting.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;

@Slf4j
@Component
public class CallSessionRegistry {

    // allow multiple sessions per user (different endpoints or devices)
    private final ConcurrentHashMap<String, CopyOnWriteArraySet<WebSocketSession>> sessions = new ConcurrentHashMap<>();

    public void registerUser(String email, WebSocketSession session) {
        if (email == null || session == null) return;
        sessions.computeIfAbsent(email, k -> new CopyOnWriteArraySet<>()).add(session);
        log.info("✅ User {} connected (sessionId={}), totalSessions={}", email, session.getId(), sessions.get(email).size());
    }

    public void removeUser(String email, WebSocketSession session) {
        if (email == null) return;
        Set<WebSocketSession> set = sessions.get(email);
        if (set == null || set.isEmpty()) {
            log.debug("ℹ️ removeUser: no sessions for {}", email);
            return;
        }
        if (session != null) {
            set.remove(session);
            log.info("❌ Removed session {} for {}, remainingSessions={}", session.getId(), email, set.size());
        }
        if (set.isEmpty()) {
            sessions.remove(email);
            log.info("❌ All sessions closed for user {}", email);
        }
    }

    public void removeUser(String email) {
        if (email == null) return;
        Set<WebSocketSession> set = sessions.remove(email);
        if (set != null) {
            log.info("❌ Removed all sessions for {} (count={})", email, set.size());
            for (WebSocketSession s : set) {
                try { if (s.isOpen()) s.close(); } catch (IOException ignore) {}
            }
        }
    }

    /**
     * Send raw message to all open sessions for `email`.
     * Returns true if at least one send succeeded.
     */
    public boolean sendToUser(String email, String message) {
        Set<WebSocketSession> set = sessions.get(email);
        if (set == null || set.isEmpty()) {
            log.warn("⚠️ Cannot send to {}, not connected", email);
            return false;
        }
        boolean sentAtLeastOnce = false;
        for (WebSocketSession s : set) {
            if (s != null && s.isOpen()) {
                try {
                    s.sendMessage(new TextMessage(message));
                    sentAtLeastOnce = true;
                } catch (IOException e) {
                    log.error("❌ Error sending to {} (session={}): {}", email, s.getId(), e.getMessage());
                }
            }
        }
        if (!sentAtLeastOnce) log.warn("⚠️ All sessions closed for {} when trying to send", email);
        return sentAtLeastOnce;
    }

    public boolean isOnline(String email) {
        Set<WebSocketSession> set = sessions.get(email);
        if (set == null) return false;
        for (WebSocketSession s : set) if (s != null && s.isOpen()) return true;
        return false;
    }
}
