package com.chung.webrtc.meeting.service;

import com.chung.webrtc.meeting.dto.request.CreateMeetingRequest;
import com.chung.webrtc.meeting.dto.response.MeetingResponse;
import com.chung.webrtc.meeting.entity.Meeting;
import com.chung.webrtc.meeting.repository.MeetingRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class MeetingService {

    private final MeetingRepository meetingRepository;
    private final MeetingSessionRegistry meetingSessionRegistry;

    @Value("${app.frontend.base-url:http://localhost:5173}")
    private String frontendBaseUrl;

    private String norm(String code) {
        return code == null ? null : code.trim().toLowerCase();
    }

    private String generateCode() {
        return UUID.randomUUID().toString().replace("-", "").substring(0, 8).toLowerCase();
    }

    /** 🟢 Tạo phòng họp mới */
    @Transactional
    public MeetingResponse createMeeting(String hostEmail, CreateMeetingRequest req) {
        String code;
        do {
            code = generateCode();
        } while (meetingRepository.existsByMeetingCode(code));

        Meeting meeting = Meeting.builder()
                .meetingCode(code)
                .title(Optional.ofNullable(req.getTitle()).filter(s -> !s.isBlank()).orElse("Untitled Meeting"))
                .hostEmail(hostEmail)
                .build();

        meeting.getParticipants().add(hostEmail);
        if (req.getInviteEmails() != null) {
            req.getInviteEmails().stream()
                    .filter(Objects::nonNull)
                    .map(String::trim)
                    .filter(s -> !s.isEmpty())
                    .forEach(meeting.getParticipants()::add);
        }

        Meeting saved = meetingRepository.save(meeting);

        return MeetingResponse.builder()
                .meetingCode(saved.getMeetingCode())
                .joinLink(String.format("%s/group/%s", frontendBaseUrl.replaceAll("/$", ""), saved.getMeetingCode()))
                .title(saved.getTitle())
                .hostEmail(saved.getHostEmail())
                .participants(saved.getParticipants())
                .status(saved.getStatus().name())
                .build();
    }

    /** 🟢 Tham gia phòng bằng code */
    @Transactional
    public boolean joinMeeting(String meetingCode, String email) {
        meetingCode = norm(meetingCode);
        Optional<Meeting> opt = meetingRepository.findByMeetingCode(meetingCode);
        if (opt.isEmpty()) return false;

        Meeting meeting = opt.get();
        if (meeting.getStatus() == Meeting.MeetingStatus.ENDED) return false;

        if (!meeting.getParticipants().contains(email)) {
            meeting.getParticipants().add(email);
            meetingRepository.save(meeting);
        }
        log.info("🟢 {} joined meeting {}", email, meetingCode);
        return true;
    }

    /** 👋 Rời phòng */
    @Transactional
    public void leaveMeeting(String meetingCode, String email) {
        final String normCode = norm(meetingCode); // ✅ final variable
        meetingRepository.findByMeetingCode(normCode).ifPresent(meeting -> {
            meeting.getParticipants().remove(email);
            log.info("🚪 {} left meeting {}", email, normCode);

            if (meeting.getParticipants().isEmpty()) {
                meeting.setStatus(Meeting.MeetingStatus.ENDED);
                log.info("💥 Meeting {} is now empty -> set ENDED", normCode);
            }
            meetingRepository.save(meeting);
        });
    }

    /** 🔴 Kết thúc phòng họp (chỉ host) */
    @Transactional
    public boolean endMeeting(String meetingCode, String requesterEmail) {
        meetingCode = norm(meetingCode);
        Optional<Meeting> opt = meetingRepository.findByMeetingCode(meetingCode);
        if (opt.isEmpty()) return false;

        Meeting meeting = opt.get();
        if (!Objects.equals(meeting.getHostEmail(), requesterEmail)) {
            log.warn("🚫 {} is not host of {}, cannot end", requesterEmail, meetingCode);
            return false;
        }

        meeting.setStatus(Meeting.MeetingStatus.ENDED);
        meetingRepository.save(meeting);

        // 📡 Gửi broadcast "meeting-ended"
        String msg = String.format("{\"type\":\"meeting-ended\",\"meetingCode\":\"%s\"}", meetingCode);
        meetingSessionRegistry.broadcast(meetingCode, msg, null);

        // 🔻 Đóng toàn bộ WS session
        meetingSessionRegistry.closeRoom(meetingCode);

        log.info("🔴 Meeting {} ended by host {}", meetingCode, requesterEmail);
        return true;
    }

    public Optional<Meeting> findByCode(String meetingCode) {
        return meetingRepository.findByMeetingCode(norm(meetingCode));
    }

    @Transactional
    public void save(Meeting meeting) {
        meeting.setMeetingCode(norm(meeting.getMeetingCode()));
        meetingRepository.save(meeting);
    }
}
