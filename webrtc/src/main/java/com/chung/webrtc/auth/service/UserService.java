package com.chung.webrtc.auth.service;

import com.chung.webrtc.auth.dto.request.UserUpdateRequest;
import com.chung.webrtc.auth.dto.response.UserResponse;

import java.util.List;

public interface UserService {
    UserResponse getCurrentUser();
    UserResponse updateCurrentUser(UserUpdateRequest req);
    void deleteCurrentUser();
    List<UserResponse> searchUsers(String keyword, String authHeader);
}
