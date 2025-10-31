package com.chung.webrtc.auth.controller;

import com.chung.webrtc.auth.dto.request.AuthenticationRequest;
import com.chung.webrtc.auth.dto.request.RefreshTokenRequest;
import com.chung.webrtc.auth.dto.request.RegisterRequest;
import com.chung.webrtc.auth.dto.response.AuthenticationResponse;
import com.chung.webrtc.auth.service.AuthService;
import com.chung.webrtc.common.controller.BaseController;
import com.chung.webrtc.common.dto.response.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController extends BaseController {

    private final AuthService authService;

    @PostMapping("/register")
    public ResponseEntity<ApiResponse<AuthenticationResponse>> register(
            @Valid @RequestBody RegisterRequest req,
            HttpServletRequest request) {
        return ResponseEntity.ok(buildSuccessResponse(authService.register(req), request));
    }

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<AuthenticationResponse>> login(
            @Valid @RequestBody AuthenticationRequest req,
            HttpServletRequest request) {
        return ResponseEntity.ok(buildSuccessResponse(authService.authenticate(req), request));
    }

    @PostMapping("/refresh-token")
    public ResponseEntity<ApiResponse<AuthenticationResponse>> refreshToken(
            @Valid @RequestBody RefreshTokenRequest req,
            HttpServletRequest request) {
        return ResponseEntity.ok(buildSuccessResponse(authService.refreshToken(req.getRefreshToken()), request));
    }

    @PostMapping("/logout")
    public ResponseEntity<ApiResponse<Void>> logout(
            @Valid @RequestBody RefreshTokenRequest req,
            HttpServletRequest request) {
        authService.logout(req.getRefreshToken());
        return ResponseEntity.ok(buildSuccessResponse(null, request));
    }
}
