package com.chung.webrtc.meeting.dto.request;

import lombok.Data;
import java.util.List;

@Data
public class CreateMeetingRequest {
    private String title;
    // optional: list of emails to invite
    private List<String> inviteEmails;
}
