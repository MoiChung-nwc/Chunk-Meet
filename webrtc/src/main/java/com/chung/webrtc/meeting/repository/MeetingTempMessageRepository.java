package com.chung.webrtc.meeting.repository;

import com.chung.webrtc.meeting.entity.MeetingTempMessage;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.time.Instant;
import java.util.List;

public interface MeetingTempMessageRepository extends MongoRepository<MeetingTempMessage, String> {
    List<MeetingTempMessage> findByMeetingCodeOrderByTimestampAsc(String meetingCode);
    long deleteByTimestampBefore(Instant time);
}