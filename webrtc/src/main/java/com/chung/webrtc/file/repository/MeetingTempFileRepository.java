package com.chung.webrtc.file.repository;

import com.chung.webrtc.file.entity.MeetingTempFile;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface MeetingTempFileRepository extends MongoRepository<MeetingTempFile, String> {
    List<MeetingTempFile> findByMeetingCodeOrderByTimestampAsc(String meetingCode);
}
