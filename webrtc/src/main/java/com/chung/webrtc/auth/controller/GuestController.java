package com.chung.webrtc.auth.controller;

import com.chung.webrtc.auth.dto.request.GuestRequest;
import com.chung.webrtc.auth.dto.response.GuestResponse;
import com.chung.webrtc.auth.service.GuestService;
import com.chung.webrtc.common.controller.BaseController;
import com.chung.webrtc.common.dto.response.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/guest")
@RequiredArgsConstructor
public class GuestController extends BaseController {

    private final GuestService guestService;

    @PostMapping("/join")
    public ResponseEntity<ApiResponse<GuestResponse>> join(
            @Valid @RequestBody GuestRequest req,
            HttpServletRequest request
    ) {
        GuestResponse guest = guestService.createGuest(req);
        return ResponseEntity.ok(buildSuccessResponse(guest, request));
    }
}
