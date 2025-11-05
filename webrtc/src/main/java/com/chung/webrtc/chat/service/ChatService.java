package com.chung.webrtc.chat.service;

import com.chung.webrtc.chat.entity.Conversation;
import com.chung.webrtc.chat.entity.Message;
import com.chung.webrtc.chat.enums.ConversationType;
import com.chung.webrtc.chat.repository.ConversationRepository;
import com.chung.webrtc.chat.repository.MessageRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Service xử lý toàn bộ logic chat (lưu, lấy, mark-read, decode)
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ChatService {

    private final ConversationRepository conversationRepo;
    private final MessageRepository messageRepo;

    /** 🔹 Lấy hoặc tạo conversation giữa 2 người (đảm bảo đối xứng & hợp lệ) */
    public Conversation getOrCreateConversation(String userA, String userB) {
        // ✅ Kiểm tra đầu vào hợp lệ
        if (userA == null || userB == null ||
                userA.isBlank() || userB.isBlank() ||
                userA.equalsIgnoreCase("undefined") || userB.equalsIgnoreCase("undefined") ||
                userA.equalsIgnoreCase("null") || userB.equalsIgnoreCase("null")) {
            log.warn("⚠️ Invalid conversation participants: [{}] - [{}]", userA, userB);
            throw new IllegalArgumentException("Invalid participants for conversation");
        }

        // ✅ Không cho chat với chính mình
        if (userA.equalsIgnoreCase(userB)) {
            throw new IllegalArgumentException("Cannot create conversation with yourself");
        }

        // ✅ Tìm nếu đã tồn tại (bất kể thứ tự)
        return conversationRepo.findDirectBetween(userA, userB)
                .orElseGet(() -> {
                    Conversation conv = Conversation.builder()
                            .type(ConversationType.DIRECT)
                            .participants(Set.of(userA, userB))
                            .createdAt(Instant.now())
                            .unreadMap(new HashMap<>())
                            .build();
                    log.info("🆕 Creating new conversation between {} and {}", userA, userB);
                    return conversationRepo.save(conv);
                });
    }

    /** 🔹 Tạo nhóm chat */
    public Conversation createGroupConversation(Set<String> participants) {
        return conversationRepo.save(
                Conversation.builder()
                        .participants(participants)
                        .type(ConversationType.GROUP)
                        .createdAt(Instant.now())
                        .build()
        );
    }

    /** 💾 Lưu message + cập nhật lastMessage và unreadMap */
    public Message saveMessage(String conversationId, String sender, String content) {
        Message msg = Message.builder()
                .conversationId(conversationId)
                .sender(sender)
                .content(content)
                .timestamp(Instant.now())
                .build();

        Message saved = messageRepo.save(msg);

        conversationRepo.findById(conversationId).ifPresent(conv -> {
            conv.setLastMessage(content);
            Map<String, Boolean> unread = conv.getUnreadMap() != null
                    ? new HashMap<>(conv.getUnreadMap())
                    : new HashMap<>();

            conv.getParticipants().forEach(u -> {
                String safeKey = encodeKey(u);
                unread.put(safeKey, !u.equals(sender));
            });

            conv.setUnreadMap(unread);
            conversationRepo.save(conv);
        });

        return saved;
    }

    /** 📜 Lấy toàn bộ tin nhắn theo conversationId */
    public List<Message> getMessages(String conversationId) {
        return messageRepo.findByConversationIdOrderByTimestampAsc(conversationId);
    }

    /** 🔹 Lấy tất cả conversation theo user */
    public List<Conversation> getConversationsByUser(String email) {
        return conversationRepo.findByParticipantsContaining(email);
    }

    /** 🔹 Đánh dấu đã đọc conversation */
    public void markAsRead(String conversationId, String email) {
        conversationRepo.findById(conversationId).ifPresent(conv -> {
            if (conv.getUnreadMap() != null) {
                String safeKey = encodeKey(email);
                conv.getUnreadMap().put(safeKey, false);
                conversationRepo.save(conv);
            }
        });
    }

    // ==============================
    // ⚙️ Tiện ích mã hóa / giải mã key
    // ==============================

    /** Encode email an toàn cho Mongo key */
    public String encodeKey(String email) {
        if (email == null) return null;
        return email.replace(".", "_dot_").replace("@", "_at_");
    }

    /** Decode key về lại email */
    public String decodeKey(String key) {
        if (key == null) return null;
        return key.replace("_dot_", ".").replace("_at_", "@");
    }

    /** Decode toàn bộ unreadMap */
    public Map<String, Boolean> decodeUnreadMap(Map<String, Boolean> encoded) {
        if (encoded == null) return null;
        return encoded.entrySet().stream()
                .collect(Collectors.toMap(
                        e -> decodeKey(e.getKey()),
                        Map.Entry::getValue
                ));
    }
}
