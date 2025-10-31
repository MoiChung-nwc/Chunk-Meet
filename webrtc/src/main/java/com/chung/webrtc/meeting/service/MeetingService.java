package com.chung.webrtc.meeting.service;

import com.chung.webrtc.meeting.dto.request.CreateMeetingRequest;
import com.chung.webrtc.meeting.dto.response.MeetingResponse;
import com.chung.webrtc.meeting.entity.Meeting;
import com.chung.webrtc.meeting.repository.MeetingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
@RequiredArgsConstructor
public class MeetingService {

    private final MeetingRepository meetingRepository;

    @Value("${app.frontend.base-url:http://localhost:5173}")
    private String frontendBaseUrl;

    private String generateCode() {
        return UUID.randomUUID().toString().replace("-", "").substring(0, 8);
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
        Optional<Meeting> opt = meetingRepository.findByMeetingCode(meetingCode);
        if (opt.isEmpty()) return false;
        Meeting meeting = opt.get();
        if (meeting.getStatus() == Meeting.MeetingStatus.ENDED) return false;
        if (!meeting.getParticipants().contains(email)) {
            meeting.getParticipants().add(email);
            meetingRepository.save(meeting);
        }
        return true;
    }

    /** 👋 Rời phòng */
    @Transactional
    public void leaveMeeting(String meetingCode, String email) {
        meetingRepository.findByMeetingCode(meetingCode).ifPresent(meeting -> {
            meeting.getParticipants().remove(email);
            if (meeting.getParticipants().isEmpty()) {
                meeting.setStatus(Meeting.MeetingStatus.ENDED);
            }
            meetingRepository.save(meeting);
        });
    }

    /** 🔴 Kết thúc phòng họp */
    @Transactional
    public boolean endMeeting(String meetingCode, String requesterEmail) {
        Optional<Meeting> opt = meetingRepository.findByMeetingCode(meetingCode);
        if (opt.isEmpty()) return false;

        Meeting m = opt.get();
        if (!Objects.equals(m.getHostEmail(), requesterEmail)) {
            return false; // chỉ host có thể kết thúc
        }
        m.setStatus(Meeting.MeetingStatus.ENDED);
        meetingRepository.save(m);
        return true;
    }

    public Optional<Meeting> findByCode(String meetingCode) {
        return meetingRepository.findByMeetingCode(meetingCode);
    }

    @Transactional
    public void save(Meeting meeting) {
        meetingRepository.save(meeting);
    }

}