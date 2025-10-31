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

    /** meetingCode -> participants (email -> session) */
    private final Map<String, Map<String, WebSocketSession>> rooms = new ConcurrentHashMap<>();

    /** sessionId -> meetingCode */
    private final Map<String, String> sessionToRoom = new ConcurrentHashMap<>();

    /** sessionId -> email */
    private final Map<String, String> sessionToEmail = new ConcurrentHashMap<>();

    /** 🟢 Thêm user vào phòng */
    public void addUserToRoom(String meetingCode, String email, WebSocketSession session) {
        rooms.computeIfAbsent(meetingCode, k -> new ConcurrentHashMap<>()).put(email, session);
        sessionToRoom.put(session.getId(), meetingCode);
        sessionToEmail.put(session.getId(), email);
        log.info("✅ User {} joined meeting {}", email, meetingCode);
    }

    /** 🔴 Xoá user khỏi phòng */
    public void removeUser(WebSocketSession session) {
        String meetingCode = sessionToRoom.remove(session.getId());
        String email = sessionToEmail.remove(session.getId());

        if (meetingCode != null && rooms.containsKey(meetingCode)) {
            rooms.get(meetingCode).remove(email);
            if (rooms.get(meetingCode).isEmpty()) {
                rooms.remove(meetingCode);
                log.info("🧹 Removed empty room {}", meetingCode);
            }
            log.info("❌ User {} left meeting {}", email, meetingCode);
        }
    }

    /** 📡 Broadcast đến tất cả trong phòng (trừ 1 người nếu có) */
    public void broadcast(String meetingCode, String message, WebSocketSession exclude) {
        Map<String, WebSocketSession> participants = rooms.getOrDefault(meetingCode, Collections.emptyMap());
        participants.values().forEach(session -> {
            if (session.isOpen() && !session.equals(exclude)) {
                try {
                    session.sendMessage(new TextMessage(message));
                } catch (IOException e) {
                    log.error("❌ Error sending broadcast to {}", session.getId(), e);
                }
            }
        });
    }

    /** 🎯 Gửi tin nhắn đến 1 người cụ thể theo email */
    public void sendToUser(String meetingCode, String toEmail, String message) {
        WebSocketSession target = Optional.ofNullable(rooms.get(meetingCode))
                .map(map -> map.get(toEmail))
                .orElse(null);
        if (target != null && target.isOpen()) {
            try {
                target.sendMessage(new TextMessage(message));
                log.info("📨 Sent message to {} in meeting {}", toEmail, meetingCode);
            } catch (IOException e) {
                log.error("❌ Error sending message to {}: {}", toEmail, e.getMessage());
            }
        } else {
            log.warn("⚠️ Cannot send to {}, not connected", toEmail);
        }
    }

    /** 👥 Lấy danh sách participants trong phòng */
    public Set<String> getParticipants(String meetingCode) {
        return rooms.containsKey(meetingCode)
                ? new HashSet<>(rooms.get(meetingCode).keySet())
                : Collections.emptySet();
    }

    /** 🔍 Lấy email từ session */
    public String getEmail(WebSocketSession session) {
        return sessionToEmail.get(session.getId());
    }

    /** 🔍 Lấy meetingCode từ session */
    public String getMeetingCode(WebSocketSession session) {
        return sessionToRoom.get(session.getId());
    }
}
