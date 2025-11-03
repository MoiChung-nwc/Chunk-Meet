package com.chung.webrtc.chat.service;

import com.chung.webrtc.chat.entity.*;
import com.chung.webrtc.chat.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;

@Service
@RequiredArgsConstructor
public class ChatService {

    private final ConversationRepository conversationRepo;
    private final MessageRepository messageRepo;

    /** Lấy hoặc tạo conversation giữa 2 người */
    public Conversation getOrCreateConversation(String userA, String userB) {
        Set<String> participants = Set.of(userA, userB);
        return conversationRepo.findByParticipants(participants)
                .orElseGet(() -> conversationRepo.save(
                        Conversation.builder()
                                .participants(participants)
                                .createdAt(Instant.now())
                                .build()
                ));
    }

    /** Lưu message */
    public Message saveMessage(String conversationId, String sender, String content) {
        Message msg = Message.builder()
                .conversationId(conversationId)
                .sender(sender)
                .content(content)
                .timestamp(Instant.now())
                .build();
        return messageRepo.save(msg);
    }

    /** Lịch sử */
    public List<Message> getMessages(String conversationId) {
        return messageRepo.findByConversationIdOrderByTimestampAsc(conversationId);
    }
}
