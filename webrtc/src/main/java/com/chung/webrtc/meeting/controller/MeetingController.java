package com.chung.webrtc.meeting.controller;

import com.chung.webrtc.auth.service.PermissionChecker;
import com.chung.webrtc.meeting.dto.request.CreateMeetingRequest;
import com.chung.webrtc.meeting.dto.request.JoinMeetingRequest;
import com.chung.webrtc.meeting.dto.response.MeetingResponse;
import com.chung.webrtc.meeting.entity.Meeting;
import com.chung.webrtc.meeting.service.MeetingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Objects;

@Slf4j
@RestController
@RequestMapping("/api/meetings")
@RequiredArgsConstructor
public class MeetingController {

    private final MeetingService meetingService;
    private final PermissionChecker permissionChecker;

    private String norm(String code) {
        return code == null ? null : code.trim().toLowerCase();
    }

    /** 🟢 Tạo phòng họp mới */
    @PostMapping
    public ResponseEntity<MeetingResponse> createMeeting(
            Authentication authentication,
            @RequestBody CreateMeetingRequest req
    ) {
        permissionChecker.checkPermission("CREATE_MEETING");
        String email = authentication.getName();

        log.info("🟢 {} is creating a new meeting...", email);
        MeetingResponse res = meetingService.createMeeting(email, req);
        return ResponseEntity.ok(res);
    }

    /** 🟢 Tham gia bằng mã code */
    @PostMapping("/join")
    public ResponseEntity<?> joinMeeting(
            Authentication authentication,
            @RequestBody JoinMeetingRequest req
    ) {
        permissionChecker.checkPermission("JOIN_MEETING");
        String email = authentication.getName();
        String code = norm(req.getMeetingCode());

        boolean ok = meetingService.joinMeeting(code, email);
        if (!ok) {
            log.warn("🚫 {} failed to join meeting {}", email, code);
            return ResponseEntity.badRequest()
                    .body(Map.of("success", false, "message", "❌ Meeting not found or already ended"));
        }

        log.info("✅ {} joined meeting {}", email, code);
        return ResponseEntity.ok(Map.of("success", true, "message", "✅ Joined meeting successfully"));
    }

    /** 👋 Rời phòng */
    @PostMapping("/leave")
    public ResponseEntity<?> leaveMeeting(
            Authentication authentication,
            @RequestBody JoinMeetingRequest req
    ) {
        String email = authentication.getName();
        String code = norm(req.getMeetingCode());
        meetingService.leaveMeeting(code, email);
        log.info("👋 {} left meeting {}", email, code);

        return ResponseEntity.ok(Map.of("success", true, "message", "👋 Left meeting successfully"));
    }

    /** 🔴 Kết thúc phòng họp */
    @PostMapping("/{code}/end")
    public ResponseEntity<?> endMeeting(
            Authentication authentication,
            @PathVariable String code
    ) {
        permissionChecker.checkPermission("END_MEETING");
        String email = authentication.getName();
        String normCode = norm(code);

        log.info("🟥 {} requests to end meeting {}", email, normCode);
        boolean ok = meetingService.endMeeting(normCode, email);
        if (!ok) {
            return ResponseEntity.status(403)
                    .body(Map.of("success", false, "message", "🚫 Not allowed to end this meeting"));
        }

        log.info("✅ Meeting {} ended successfully by {}", normCode, email);
        return ResponseEntity.ok(Map.of("success", true, "message", "✅ Meeting ended successfully"));
    }

    /** 🔍 Lấy thông tin phòng & auto-join nếu user mở link */
    @GetMapping("/{code}")
    public ResponseEntity<?> getAndAutoJoinMeeting(
            Authentication authentication,
            @PathVariable String code
    ) {
        String email = authentication.getName();
        String normCode = norm(code);
        log.info("🔍 {} is requesting meeting info for {}", email, normCode);

        return meetingService.findByCode(normCode)
                .map(meeting -> {
                    if (meeting.getStatus() == Meeting.MeetingStatus.ENDED) {
                        log.warn("⚠️ Meeting {} has already ended", normCode);
                        return ResponseEntity.badRequest()
                                .body(Map.of("success", false, "message", "❌ Meeting has ended"));
                    }

                    if (!meeting.getParticipants().contains(email)) {
                        meeting.getParticipants().add(email);
                        meetingService.save(meeting);
                        log.info("🟢 Auto-added {} into meeting {}", email, normCode);
                    }

                    MeetingResponse response = MeetingResponse.builder()
                            .meetingCode(meeting.getMeetingCode())
                            .joinLink(String.format("%s/group/%s", "http://localhost:5173", meeting.getMeetingCode()))
                            .title(meeting.getTitle())
                            .hostEmail(meeting.getHostEmail())
                            .participants(meeting.getParticipants())
                            .status(meeting.getStatus().name())
                            .build();

                    return ResponseEntity.ok(response);
                })
                .orElseGet(() -> {
                    log.warn("❌ Meeting {} not found", normCode);
                    return ResponseEntity.status(404)
                            .body(Map.of("success", false, "message", "❌ Meeting not found"));
                });
    }
}
