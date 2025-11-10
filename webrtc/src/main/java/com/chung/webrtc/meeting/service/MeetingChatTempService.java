package com.chung.webrtc.meeting.service;

import com.chung.webrtc.meeting.entity.MeetingTempMessage;
import com.chung.webrtc.meeting.repository.MeetingTempMessageRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class MeetingChatTempService {

    private final MeetingTempMessageRepository meetingTempMessageRepository;

    public MeetingTempMessage saveTempMessage(String meetingCode, String sender, String content) {
        MeetingTempMessage msg = MeetingTempMessage.builder()
                .meetingCode(meetingCode)
                .sender(sender)
                .content(content)
                .timestamp(Instant.now())
                .build();

        MeetingTempMessage saved = meetingTempMessageRepository.save(msg);
        log.info("[{}] Temporary message saved from {}", meetingCode, sender);
        return saved;
    }

    public List<MeetingTempMessage> getMessages(String meetingCode) {
        return meetingTempMessageRepository.findByMeetingCodeOrderByTimestampAsc(meetingCode);
    }
}
