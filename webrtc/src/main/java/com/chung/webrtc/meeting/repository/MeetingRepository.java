package com.chung.webrtc.meeting.repository;

import com.chung.webrtc.meeting.entity.Meeting;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface MeetingRepository extends JpaRepository<Meeting, Long> {
    Optional<Meeting> findByMeetingCode(String meetingCode);
    boolean existsByMeetingCode(String meetingCode);
}