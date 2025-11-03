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

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "conversations")
public class Conversation {

    @Id
    private String id; // UUID hoặc meetingCode

    private ConversationType type; // DIRECT, GROUP, MEETING
    private Set<String> participants;
    private Instant createdAt;
    private String lastMessage;
    private Map<String, Boolean> unreadMap;
}
