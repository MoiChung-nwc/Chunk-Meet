package com.chung.webrtc.meeting.controller;

import com.chung.webrtc.auth.service.PermissionChecker;
import com.chung.webrtc.meeting.dto.request.CreateMeetingRequest;
import com.chung.webrtc.meeting.dto.request.JoinMeetingRequest;
import com.chung.webrtc.meeting.dto.response.MeetingResponse;
import com.chung.webrtc.meeting.entity.Meeting;
import com.chung.webrtc.meeting.service.MeetingService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Objects;

@RestController
@RequestMapping("/api/meetings")
@RequiredArgsConstructor
public class MeetingController {

    private final MeetingService meetingService;
    private final PermissionChecker permissionChecker;

    /** 🟢 Tạo phòng họp mới */
    @PostMapping
    public ResponseEntity<MeetingResponse> createMeeting(
            Authentication authentication,
            @RequestBody CreateMeetingRequest req
    ) {
        permissionChecker.checkPermission("CREATE_MEETING");
        String email = authentication.getName();

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

        boolean ok = meetingService.joinMeeting(req.getMeetingCode(), email);
        if (!ok)
            return ResponseEntity.badRequest().body("❌ Meeting not found or already ended");

        return ResponseEntity.ok("✅ Joined meeting successfully");
    }

    /** 👋 Rời phòng */
    @PostMapping("/leave")
    public ResponseEntity<?> leaveMeeting(
            Authentication authentication,
            @RequestBody JoinMeetingRequest req
    ) {
        String email = authentication.getName();
        meetingService.leaveMeeting(req.getMeetingCode(), email);
        return ResponseEntity.ok("👋 Left meeting successfully");
    }

    /** 🔴 Kết thúc phòng họp */
    @PostMapping("/{code}/end")
    public ResponseEntity<?> endMeeting(
            Authentication authentication,
            @PathVariable String code
    ) {
        permissionChecker.checkPermission("END_MEETING");
        String email = authentication.getName();

        boolean ok = meetingService.endMeeting(code, email);
        if (!ok)
            return ResponseEntity.status(403).body("🚫 Not allowed to end this meeting");

        return ResponseEntity.ok("✅ Meeting ended successfully");
    }

    /**
     * 🔍 Lấy thông tin phòng & tự động join nếu user truy cập qua link
     * (dành cho frontend route /group/{code})
     */
    @GetMapping("/{code}")
    public ResponseEntity<?> getAndAutoJoinMeeting(
            Authentication authentication,
            @PathVariable String code
    ) {
        String email = authentication.getName();

        return meetingService.findByCode(code)
                .map(meeting -> {
                    // Kiểm tra trạng thái
                    if (meeting.getStatus() == Meeting.MeetingStatus.ENDED) {
                        return ResponseEntity.badRequest().body("❌ Meeting has ended");
                    }

                    // ✅ Tự động thêm user vào participants nếu chưa có
                    if (!meeting.getParticipants().contains(email)) {
                        meeting.getParticipants().add(email);
                        meetingService.save(meeting);
                    }

                    // ✅ Trả về thông tin phòng
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
                .orElse(ResponseEntity.notFound().build());
    }
}
