package com.chung.webrtc.meeting.entity;

import jakarta.persistence.Id;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document(collection = "meeting_temp_messages")
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class MeetingTempMessage {

    @Id
    private String id;

    private String meetingCode;
    private String sender;
    private String content;

    @CreatedDate
    private Instant timestamp; // dùng để TTL tự động xóa sau 7 ngày
}
