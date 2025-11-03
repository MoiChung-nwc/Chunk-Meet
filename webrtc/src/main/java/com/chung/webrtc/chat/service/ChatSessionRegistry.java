package com.chung.webrtc.chat.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.time.Instant;
import java.util.Collections;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Component
public class ChatSessionRegistry {

    // email -> set active websocket session
    private final Map<String, Set<WebSocketSession>> userSessions = new ConcurrentHashMap<>();

    // email -> last active time
    private final Map<String, Instant> lastSeenMap = new ConcurrentHashMap<>();

    public synchronized void register(String email, WebSocketSession session) {
        userSessions.computeIfAbsent(email, k -> ConcurrentHashMap.newKeySet()).add(session);
        lastSeenMap.put(email, Instant.now());
        log.info("✅ [{}] Registered new session {} for user {}", Instant.now(), session.getId(), email);
    }

    /**
     * Remove session when user disconnects
     */
    public synchronized void unregister(String email, WebSocketSession session) {
        if (email == null || session == null) return;
        Set<WebSocketSession> sessions = userSessions.get(email);

        if (sessions != null) {
            sessions.remove(session);
            if (sessions.isEmpty()) {
                userSessions.remove(email);
                lastSeenMap.put(email, Instant.now());
                log.info("🔴 [{}] User {} disconnected (last seen updated)", Instant.now(), email);
            }
        }
    }

    /**
     * Return all active sessions of a user
     */
    public Set<WebSocketSession> getSessions(String email) {
        return userSessions.getOrDefault(email, Collections.emptySet());
    }

    /**
     * Return all currently online users
     */
    public Set<String> getOnlineUsers() {
        return userSessions.keySet();
    }

    /**
     * Return last seen timestamp (if offline)
     */
    public Instant getLastSeen(String email) {
        return lastSeenMap.get(email);
    }

    /**
     * Broadcast message to all active users (system-wide event)
     */
    public void broadcastToAll(String message) {
        userSessions.values().forEach(sessions -> {
            sessions.forEach(session -> {
                if (session.isOpen()) {
                    try {
                        session.sendMessage(new TextMessage(message));
                    } catch (IOException e) {
                        log.error("❌ Failed to broadcast message to {}", session.getId(), e);
                    }
                }
            });
        });
    }

    /**
     * Remove all users (if system restart)
     */
    public void clearAll() {
        userSessions.clear();
        lastSeenMap.clear();
    }
}
