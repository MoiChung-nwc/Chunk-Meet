package com.chung.webrtc.file.controller;

import com.chung.webrtc.common.dto.response.ApiResponse;
import com.chung.webrtc.common.exception.AppException;
import com.chung.webrtc.common.exception.ErrorCode;
import com.chung.webrtc.common.util.PermissionUtil;
import com.chung.webrtc.file.entity.MeetingTempFile;
import com.chung.webrtc.file.service.MeetingTempFileService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.security.Principal;
import java.util.List;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/meeting/files")
@RequiredArgsConstructor
public class MeetingTempFileController {

    private final MeetingTempFileService fileService;
    private final PermissionUtil permissionUtil;

    /** Upload file (MEETING) */
    @PostMapping("/{meetingCode}")
    public ResponseEntity<ApiResponse<MeetingTempFile>> uploadFile(
            @PathVariable String meetingCode,
            @RequestParam("file") MultipartFile file,
            Principal principal,
            HttpServletRequest req
    ) throws IOException {
        String traceId = UUID.randomUUID().toString();
        String email = principal.getName();

        permissionUtil.validatePermission(email, "MEETING_FILE_SEND");

        MeetingTempFile saved = fileService.saveFile(meetingCode, email, file);
        return ResponseEntity.ok(ApiResponse.success(saved, req.getRequestURI(), traceId));
    }

    /** Danh sách file trong meeting */
    @GetMapping("/{meetingCode}")
    public ResponseEntity<ApiResponse<List<MeetingTempFile>>> listFiles(
            @PathVariable String meetingCode,
            Principal principal,
            HttpServletRequest req
    ) {
        String traceId = UUID.randomUUID().toString();
        String email = principal.getName();

        permissionUtil.validatePermission(email, "MEETING_FILE_READ");

        List<MeetingTempFile> files = fileService.getFilesByMeeting(meetingCode);
        return ResponseEntity.ok(ApiResponse.success(files, req.getRequestURI(), traceId));
    }

    /** Download file */
    @GetMapping("/download/{id}")
    public ResponseEntity<ByteArrayResource> download(
            @PathVariable String id,
            Principal principal
    ) throws IOException {
        String email = principal.getName();
        permissionUtil.validatePermission(email, "MEETING_FILE_READ");

        MeetingTempFile meta = fileService.getFileMeta(id)
                .orElseThrow(() -> new AppException(ErrorCode.BUSINESS_CONFLICT, "File không tồn tại"));

        byte[] data = fileService.downloadFile(id);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(meta.getMimeType()))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + meta.getFileName() + "\"")
                .body(new ByteArrayResource(data));
    }

    /** Xóa file thủ công (host/admin) */
    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteFile(
            @PathVariable String id,
            Principal principal,
            HttpServletRequest req
    ) {
        String traceId = UUID.randomUUID().toString();
        String email = principal.getName();

        permissionUtil.validatePermission(email, "MEETING_FILE_DELETE");

        fileService.deleteFile(id);
        return ResponseEntity.ok(ApiResponse.success(null, req.getRequestURI(), traceId));
    }
}