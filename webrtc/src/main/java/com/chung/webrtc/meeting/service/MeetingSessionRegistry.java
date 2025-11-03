package com.chung.webrtc.meeting.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Component
public class MeetingSessionRegistry {

    /** meetingCode -> (email -> session) */
    private final Map<String, Map<String, WebSocketSession>> rooms = new ConcurrentHashMap<>();

    /** sessionId -> meetingCode */
    private final Map<String, String> sessionToRoom = new ConcurrentHashMap<>();

    /** sessionId -> email */
    private final Map<String, String> sessionToEmail = new ConcurrentHashMap<>();

    /** 🟢 Thêm user vào phòng (thread-safe, idempotent) */
    public void addUserToRoom(String meetingCode, String email, WebSocketSession session) {
        if (meetingCode == null || email == null) {
            log.warn("🚫 Cannot add user — missing meetingCode or email");
            return;
        }

        rooms.computeIfAbsent(meetingCode, k -> new ConcurrentHashMap<>()).put(email, session);
        sessionToRoom.put(session.getId(), meetingCode);
        sessionToEmail.put(session.getId(), email);

        log.info("✅ User {} joined meeting {}", email, meetingCode);
    }

    /** 🔴 Xóa user khỏi phòng (safe & defensive) */
    public void removeUser(WebSocketSession session) {
        if (session == null) return;

        String sessionId = session.getId();
        String meetingCode = sessionToRoom.remove(sessionId);
        String email = sessionToEmail.remove(sessionId);

        if (meetingCode == null || email == null) {
            log.warn("⚠️ removeUser called for unknown session {}", sessionId);
            return;
        }

        Map<String, WebSocketSession> participants = rooms.get(meetingCode);
        if (participants != null) {
            participants.remove(email);
            log.info("❌ {} left meeting {}", email, meetingCode);

            if (participants.isEmpty()) {
                rooms.remove(meetingCode);
                log.info("🧹 Removed empty room {}", meetingCode);
            }
        }
    }

    /** 🧱 Thread-safe gửi message */
    private void safeSend(WebSocketSession session, String message) {
        if (session == null) return;
        synchronized (session) {
            try {
                if (session.isOpen()) {
                    session.sendMessage(new TextMessage(message));
                } else {
                    log.debug("⚠️ Tried to send to closed session {}", session.getId());
                    cleanupSession(session);
                }
            } catch (IOException e) {
                log.warn("⚠️ Failed to send message to {}: {}", session.getId(), e.getMessage());
                cleanupSession(session);
            } catch (IllegalStateException e) {
                log.warn("⚠️ WS busy for {}: {}", session.getId(), e.getMessage());
            }
        }
    }

    /** 📡 Broadcast đến tất cả trong phòng (trừ 1 người nếu có) */
    public void broadcast(String meetingCode, String message, WebSocketSession exclude) {
        Map<String, WebSocketSession> participants = rooms.get(meetingCode);
        if (participants == null || participants.isEmpty()) return;

        participants.forEach((email, session) -> {
            if (!session.equals(exclude)) {
                safeSend(session, message);
            }
        });
    }

    /** 🎯 Gửi tin nhắn riêng cho 1 người theo email */
    public void sendToUser(String meetingCode, String toEmail, String message) {
        WebSocketSession target = Optional.ofNullable(rooms.get(meetingCode))
                .map(map -> map.get(toEmail))
                .orElse(null);

        if (target != null && target.isOpen()) {
            safeSend(target, message);
            log.debug("📨 Sent message to {} in [{}]", toEmail, meetingCode);
        } else {
            log.debug("⚠️ Cannot send to {}, not connected or closed", toEmail);
        }
    }

    /** 👥 Lấy danh sách participants trong phòng */
    public Set<String> getParticipants(String meetingCode) {
        if (meetingCode == null) return Collections.emptySet();
        Map<String, WebSocketSession> map = rooms.get(meetingCode);
        return map != null ? new HashSet<>(map.keySet()) : Collections.emptySet();
    }

    /** 🔍 Lấy email từ session */
    public String getEmail(WebSocketSession session) {
        return session != null ? sessionToEmail.get(session.getId()) : null;
    }

    /** 🔍 Lấy meetingCode từ session */
    public String getMeetingCode(WebSocketSession session) {
        return session != null ? sessionToRoom.get(session.getId()) : null;
    }

    /** 💥 Đóng toàn bộ kết nối & cleanup phòng */
    public void closeRoom(String meetingCode) {
        Map<String, WebSocketSession> participants = rooms.remove(meetingCode);
        if (participants != null) {
            participants.forEach((email, session) -> {
                try {
                    if (session.isOpen()) session.close();
                    cleanupSession(session);
                } catch (IOException e) {
                    log.error("❌ Error closing session {}: {}", session.getId(), e.getMessage());
                }
            });
            log.info("💥 Closed room {}", meetingCode);
        }
    }

    /** 🧹 Xóa session khỏi mapping khi bị lỗi */
    private void cleanupSession(WebSocketSession session) {
        if (session == null) return;
        sessionToRoom.remove(session.getId());
        sessionToEmail.remove(session.getId());
    }

    /** 🧩 Debug: danh sách rooms đang hoạt động */
    public Map<String, Set<String>> getActiveRooms() {
        Map<String, Set<String>> result = new LinkedHashMap<>();
        rooms.forEach((room, users) -> result.put(room, new HashSet<>(users.keySet())));
        return result;
    }
}
