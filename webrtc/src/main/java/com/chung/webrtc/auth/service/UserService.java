package com.chung.webrtc.auth.service;

import com.chung.webrtc.auth.dto.request.UserUpdateRequest;
import com.chung.webrtc.auth.dto.response.UserResponse;

public interface UserService {
    UserResponse getCurrentUser();
    UserResponse updateCurrentUser(UserUpdateRequest req);
    void deleteCurrentUser();
}
