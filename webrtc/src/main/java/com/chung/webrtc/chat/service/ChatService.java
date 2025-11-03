package com.chung.webrtc.chat.service;

import com.chung.webrtc.chat.entity.*;
import com.chung.webrtc.chat.enums.ConversationType;
import com.chung.webrtc.chat.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class ChatService {

    private final ConversationRepository conversationRepo;
    private final MessageRepository messageRepo;

    /** 🔹 Lấy hoặc tạo conversation giữa 2 người (đảm bảo đối xứng) */
    public Conversation getOrCreateConversation(String userA, String userB) {
        if (userA.equalsIgnoreCase(userB)) {
            throw new IllegalArgumentException("Cannot create conversation with yourself");
        }

        return conversationRepo.findDirectBetween(userA, userB)
                .orElseGet(() -> {
                    Conversation conv = Conversation.builder()
                            .type(ConversationType.DIRECT)
                            .participants(Set.of(userA, userB))
                            .createdAt(Instant.now())
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

    /** 💾 Lưu message + cập nhật lastMessage, unreadMap (đã encode key email an toàn cho Mongo) */
    public Message saveMessage(String conversationId, String sender, String content) {
        Message msg = Message.builder()
                .conversationId(conversationId)
                .sender(sender)
                .content(content)
                .timestamp(Instant.now())
                .build();

        Message saved = messageRepo.save(msg);

        // 🆕 Cập nhật conversation metadata
        conversationRepo.findById(conversationId).ifPresent(conv -> {
            conv.setLastMessage(content);
            Map<String, Boolean> unread = conv.getUnreadMap() != null
                    ? new HashMap<>(conv.getUnreadMap())
                    : new HashMap<>();

            // Đặt unread = true cho mọi người trừ người gửi (dùng key đã encode)
            conv.getParticipants().forEach(u -> {
                String safeKey = encodeKey(u);
                unread.put(safeKey, !u.equals(sender));
            });

            conv.setUnreadMap(unread);
            conversationRepo.save(conv);
        });

        return saved;
    }

    /** 📜 Lấy lịch sử tin nhắn */
    public List<Message> getMessages(String conversationId) {
        return messageRepo.findByConversationIdOrderByTimestampAsc(conversationId);
    }

    /** 🔹 Lấy danh sách conversation theo user */
    public List<Conversation> getConversationsByUser(String email) {
        return conversationRepo.findByParticipantsContaining(email);
    }

    /** 🔹 Lấy conversation có tin nhắn */
    public List<Conversation> getConversationsByUserWithMessages(String email) {
        List<Conversation> all = conversationRepo.findByParticipantsContaining(email);
        return all.stream()
                .filter(conv -> !messageRepo.findByConversationIdOrderByTimestampAsc(conv.getId()).isEmpty())
                .toList();
    }

    /** 🔹 Đánh dấu đã đọc (decode key để khớp với DB) */
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
    // ⚙️ Tiện ích encode/decode key
    // ==============================

    /** Encode email thành key an toàn cho MongoDB */
    private String encodeKey(String email) {
        if (email == null) return null;
        return email.replace(".", "_dot_").replace("@", "_at_");
    }

    /** Decode key về lại email thật (nếu cần trong DTO hoặc response) */
    public String decodeKey(String key) {
        if (key == null) return null;
        return key.replace("_dot_", ".").replace("_at_", "@");
    }

    /** Decode toàn bộ unreadMap để gửi ra frontend */
    public Map<String, Boolean> decodeUnreadMap(Map<String, Boolean> encoded) {
        if (encoded == null) return null;
        Map<String, Boolean> decoded = new HashMap<>();
        encoded.forEach((k, v) -> decoded.put(decodeKey(k), v));
        return decoded;
    }
}
