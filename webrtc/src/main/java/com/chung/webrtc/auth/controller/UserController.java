package com.chung.webrtc.auth.controller;

import com.chung.webrtc.auth.dto.request.UserUpdateRequest;
import com.chung.webrtc.auth.dto.response.UserResponse;
import com.chung.webrtc.auth.service.UserService;
import com.chung.webrtc.common.controller.BaseController;
import com.chung.webrtc.common.dto.response.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController extends BaseController {

    private final UserService userService;

    @GetMapping("/me")
    public ResponseEntity<ApiResponse<UserResponse>> getProfile(HttpServletRequest request) {
        return ResponseEntity.ok(buildSuccessResponse(userService.getCurrentUser(), request));
    }

    @PutMapping("/me")
    public ResponseEntity<ApiResponse<UserResponse>> updateProfile(
            @Valid @RequestBody UserUpdateRequest req,
            HttpServletRequest request) {
        return ResponseEntity.ok(buildSuccessResponse(userService.updateCurrentUser(req), request));
    }

    @DeleteMapping("/me")
    public ResponseEntity<ApiResponse<Void>> deleteProfile(HttpServletRequest request) {
        userService.deleteCurrentUser();
        return ResponseEntity.ok(buildSuccessResponse(null, request));
    }
}
