package com.chung.webrtc.chat.service;

import com.chung.webrtc.chat.entity.Conversation;
import com.chung.webrtc.chat.entity.Message;
import com.chung.webrtc.chat.enums.ConversationType;
import com.chung.webrtc.chat.repository.ConversationRepository;
import com.chung.webrtc.chat.repository.MessageRepository;
import com.chung.webrtc.common.util.MongoKeyUtil;
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

    public Conversation getOrCreateConversation(String userA, String userB) {
        if (isInvalid(userA) || isInvalid(userB)) {
            throw new IllegalArgumentException("Invalid participants for conversation");
        }
        if (userA.equalsIgnoreCase(userB)) {
            throw new IllegalArgumentException("Cannot create conversation with yourself");
        }

        return conversationRepo.findDirectBetween(userA, userB)
                .orElseGet(() -> {
                    Conversation conv = Conversation.builder()
                            .type(ConversationType.DIRECT)
                            .participants(Set.of(userA, userB))
                            .createdAt(Instant.now())
                            .unreadMap(new HashMap<>())
                            .build();
                    return conversationRepo.save(conv);
                });
    }

    public Message saveMessage(String conversationId, String sender, String content) {
        if (conversationId == null || conversationId.isBlank() || sender == null || content == null || content.isBlank()) {
            throw new IllegalArgumentException("Invalid message parameters");
        }

        Message msg = Message.builder()
                .conversationId(conversationId)
                .sender(sender)
                .content(content)
                .timestamp(Instant.now())
                .build();

        Message saved = messageRepo.save(msg);

        conversationRepo.findById(conversationId).ifPresent(conv -> {
            Instant now = Instant.now();

            // ✅ Cập nhật thông tin tin nhắn cuối cùng
            conv.setLastMessage(content);
            conv.setLastMessageTime(now);

            // ✅ Thêm người gửi cuối cùng
            conv.setLastSender(sender);

            // ✅ Lấy tên hiển thị (UserName hoặc rút gọn từ email)
            conv.setLastSenderName(getDisplayNameByEmail(sender));

            // ✅ Cập nhật unreadMap cho tất cả người tham gia
            Map<String, Boolean> unread = conv.getUnreadMap() != null
                    ? new HashMap<>(conv.getUnreadMap())
                    : new HashMap<>();
            conv.getParticipants().forEach(u -> unread.put(MongoKeyUtil.encode(u), !u.equals(sender)));
            conv.setUnreadMap(unread);

            conversationRepo.save(conv);

            log.info("💾 Updated conversation [{}] → lastSender={}, lastSenderName={}, message='{}'",
                    conversationId, sender, conv.getLastSenderName(), content);
        });

        return saved;
    }

    public List<Message> getMessages(String conversationId) {
        return messageRepo.findByConversationIdOrderByTimestampAsc(conversationId);
    }

    public List<Conversation> getConversationsByUser(String email) {
        return conversationRepo.findNonMeetingConversations(email);
    }

    public void markAsRead(String conversationId, String email) {
        conversationRepo.findById(conversationId).ifPresent(conv -> {
            if (conv.getUnreadMap() != null) {
                String safeKey = MongoKeyUtil.encode(email);
                conv.getUnreadMap().put(safeKey, false);
                conversationRepo.save(conv);
            }
        });
    }

    public Map<String, Boolean> decodeUnreadMap(Map<String, Boolean> encoded) {
        return MongoKeyUtil.decodeMap(encoded);
    }

    private boolean isInvalid(String s) {
        return s == null || s.isBlank() || s.equalsIgnoreCase("undefined") || s.equalsIgnoreCase("null");
    }

    /** ✅ Hiển thị tên người dùng hoặc "You" */
    public String getDisplayNameByEmail(String email) {
        try {
            if (email == null) return "Unknown";
            String namePart = email.split("@")[0];
            return namePart.substring(0, 1).toUpperCase() + namePart.substring(1);
        } catch (Exception e) {
            return email;
        }
    }
}
