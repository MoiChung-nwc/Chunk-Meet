package com.chung.webrtc.meeting.repository;

import com.chung.webrtc.meeting.entity.Meeting;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface MeetingRepository extends JpaRepository<Meeting, Long> {
    @Query("SELECT m FROM Meeting m WHERE LOWER(m.meetingCode) = LOWER(:meetingCode)")
    Optional<Meeting> findByMeetingCode(@Param("meetingCode") String meetingCode);

    @Query("SELECT COUNT(m) > 0 FROM Meeting m WHERE LOWER(m.meetingCode) = LOWER(:meetingCode)")
    boolean existsByMeetingCode(@Param("meetingCode") String meetingCode);
}