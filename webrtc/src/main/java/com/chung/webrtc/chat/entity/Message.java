package com.chung.webrtc.chat.entity;

import jakarta.persistence.Id;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * ✅ Entity tin nhắn chung (cho cả DIRECT & GROUP)
 * conversationId: có thể là conversationId hoặc groupId
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "messages")
public class Message {

    @Id
    private String id;

    private String conversationId; // dùng chung cho chat 1-1 & nhóm
    private String sender;
    private String content;
    private Instant timestamp;

    /**
     * ✅ Đánh dấu tin nhắn thuộc nhóm hay cá nhân
     * Giúp socket và service xử lý riêng.
     */
    private boolean isGroup;
}
