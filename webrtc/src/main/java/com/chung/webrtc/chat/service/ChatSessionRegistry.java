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

    /** 🟢 Khi user connect WS */
    public synchronized void register(String email, WebSocketSession session) {
        userSessions.computeIfAbsent(email, k -> ConcurrentHashMap.newKeySet()).add(session);
        lastSeenMap.put(email, Instant.now());
        log.info("✅ [{}] Registered new session {} for user {}", Instant.now(), session.getId(), email);
    }

    /** 🔴 Khi user disconnect */
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

    /** 🔹 Lấy tất cả session của user */
    public Set<WebSocketSession> getSessions(String email) {
        return userSessions.getOrDefault(email, Collections.emptySet());
    }

    /** 🔹 Lấy danh sách user online */
    public Set<String> getOnlineUsers() {
        return userSessions.keySet();
    }

    /** 🔹 Lấy thời gian last seen */
    public Instant getLastSeen(String email) {
        return lastSeenMap.get(email);
    }

    /** 🔹 Broadcast message tới tất cả user đang online */
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

    /** 🔹 Dọn sạch cache */
    public void clearAll() {
        userSessions.clear();
        lastSeenMap.clear();
    }
}
