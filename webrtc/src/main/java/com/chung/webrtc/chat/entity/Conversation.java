package com.chung.webrtc.chat.entity;

import com.chung.webrtc.chat.enums.ConversationType;
import jakarta.persistence.Id;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.Map;
import java.util.Set;

/**
 * 💬 Conversation có thể là:
 *  - DIRECT: Chat 1-1
 *  - GROUP: Chat nhóm
 *  - MEETING: Chat trong phòng họp (mở rộng sau)
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "conversations")
public class Conversation {

    @Id
    private String id; // UUID hoặc meetingCode

    private ConversationType type; // DIRECT, GROUP, MEETING

    private Set<String> participants; // email user hoặc groupId

    private Instant createdAt;

    private String lastMessage;

    private Instant lastMessageTime;

    private String lastSender;
    private String lastSenderName;
    /**
     * ✅ Map<userEmail, unreadFlag>
     * true nếu người đó có tin chưa đọc.
     */
    private Map<String, Boolean> unreadMap;
}
