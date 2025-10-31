package com.chung.webrtc.auth.service;

import com.chung.webrtc.auth.dto.request.AssignRoleRequest;
import com.chung.webrtc.auth.dto.response.UserResponse;

import java.util.List;

public interface AdminUserService {
    List<UserResponse> getAllUsers();
    UserResponse getUserById(Long userId);
    UserResponse assignRole(Long userId, AssignRoleRequest req);
    UserResponse removeRole(Long userId, String roleName);
    UserResponse updateRoles(Long userId, List<String> roleNames);
}
