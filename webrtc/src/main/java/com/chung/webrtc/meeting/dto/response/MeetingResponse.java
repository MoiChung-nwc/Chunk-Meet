package com.chung.webrtc.meeting.dto.response;

import lombok.Builder;
import lombok.Data;
import java.util.Set;

@Data
@Builder
public class MeetingResponse {
    private String meetingCode;
    private String joinLink;
    private String title;
    private String hostEmail;
    private Set<String> participants;
    private String status;
}