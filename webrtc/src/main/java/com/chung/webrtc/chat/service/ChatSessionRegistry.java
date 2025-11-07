package com.chung.webrtc.chat.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Component
public class ChatSessionRegistry {

    /** email -> set active websocket session */
    private final Map<String, Set<WebSocketSession>> userSessions = new ConcurrentHashMap<>();

    /** email -> last active time */
    private final Map<String, Instant> lastSeenMap = new ConcurrentHashMap<>();

    /** groupId -> set of member emails (joined via WS) */
    private final Map<String, Set<String>> groupMembers = new ConcurrentHashMap<>();

    // ======================================================
    // === 🧩 USER SESSION MANAGEMENT ===
    // ======================================================

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

    /** 🔹 Dọn sạch cache */
    public void clearAll() {
        userSessions.clear();
        lastSeenMap.clear();
        groupMembers.clear();
        log.warn("🧹 Cleared all ChatSessionRegistry caches!");
    }

    // ======================================================
    // === 🧩 BROADCAST HELPERS ===
    // ======================================================

    /** 📢 Broadcast tới tất cả user đang online */
    public void broadcastToAll(String message) {
        userSessions.forEach((email, sessions) ->
                sessions.forEach(session -> sendSafe(session, message))
        );
        log.info("📡 Broadcasted message to all {} online users", userSessions.size());
    }

    /** 📢 Broadcast tới danh sách user cụ thể */
    public void broadcastToUsers(Set<String> emails, String message) {
        if (emails == null || emails.isEmpty()) return;
        for (String email : emails) {
            Set<WebSocketSession> sessions = userSessions.getOrDefault(email, Set.of());
            for (WebSocketSession session : sessions) {
                sendSafe(session, message);
            }
        }
        log.debug("📡 Broadcasted to {} specific users", emails.size());
    }

    /** 📢 Broadcast tới tất cả thành viên trong group (theo groupId) */
    public void broadcastToGroup(String groupId, String message) {
        Set<String> members = groupMembers.getOrDefault(groupId, Set.of());
        if (members.isEmpty()) {
            log.debug("⚠️ No active WS members found for group {}", groupId);
            return;
        }

        for (String email : members) {
            Set<WebSocketSession> sessions = userSessions.getOrDefault(email, Set.of());
            for (WebSocketSession session : sessions) {
                sendSafe(session, message);
            }
        }
        log.info("📢 Broadcasted to group {} → {} online members", groupId, members.size());
    }

    /** 📢 Broadcast tới tất cả thành viên nhóm (dựa theo DB, không phụ thuộc WS join) */
    public void broadcastToGroupMembers(String groupId, Set<String> memberEmails, String message) {
        if (memberEmails == null || memberEmails.isEmpty()) {
            log.debug("⚠️ No members found for broadcast group {}", groupId);
            return;
        }

        for (String email : memberEmails) {
            Set<WebSocketSession> sessions = userSessions.getOrDefault(email, Set.of());
            for (WebSocketSession session : sessions) {
                sendSafe(session, message);
            }
        }
        log.info("📢 Broadcasted message to DB members of group {} → {}", groupId, memberEmails.size());
    }

    // ======================================================
    // === 🧩 GROUP CHAT SESSION MANAGEMENT ===
    // ======================================================

    /** ➕ Thêm user vào group (khi join WS) */
    public void addToGroup(String groupId, String email) {
        groupMembers.computeIfAbsent(groupId, k -> ConcurrentHashMap.newKeySet()).add(email);
        log.info("👥 [{}] joined group {}", email, groupId);
    }

    public void sendToUser(String email, String message) {
        if (email == null || message == null) return;

        Set<WebSocketSession> sessions = userSessions.get(email);
        if (sessions == null || sessions.isEmpty()) {
            log.debug("⚠️ No active session for user {} → queued/skipped message: {}", email, message);
            return;
        }

        for (WebSocketSession session : sessions) {
            sendSafe(session, message);
        }

        log.info("📡 Sent direct message to user {} ({}) active sessions", email, sessions.size());
    }

    /** ➖ Xóa user khỏi group (khi leave WS) */
    public void removeFromGroup(String groupId, String email) {
        groupMembers.computeIfPresent(groupId, (k, members) -> {
            members.remove(email);
            return members;
        });
        log.info("🚪 [{}] left group {}", email, groupId);
    }

    /** 📋 Lấy danh sách thành viên nhóm */
    public Set<String> getGroupMembers(String groupId) {
        return groupMembers.getOrDefault(groupId, Set.of());
    }

    // ======================================================
    // === 🧩 INTERNAL HELPER ===
    // ======================================================

    private void sendSafe(WebSocketSession session, String message) {
        synchronized (session) {
            if (session.isOpen()) {
                try {
                    session.sendMessage(new TextMessage(message));
                } catch (IOException | IllegalStateException e) {
                    log.warn("⚠️ Failed to send WS to {}: {}", session.getId(), e.getMessage());
                }
            }
        }
    }
}
