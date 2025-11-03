package com.chung.webrtc.auth.controller;

import com.chung.webrtc.auth.dto.response.UserResponse;
import com.chung.webrtc.auth.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserSearchController {

    private final UserService userService;

    /** 🔍 Tìm kiếm user (phục vụ chat 1-1) */
    @GetMapping("/search")
    public ResponseEntity<List<UserResponse>> searchUsers(
            @RequestParam String keyword,
            @RequestHeader("Authorization") String authHeader
    ) {
        List<UserResponse> results = userService.searchUsers(keyword, authHeader);
        return ResponseEntity.ok(results);
    }
}