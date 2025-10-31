package com.chung.webrtc.auth.controller;

import com.chung.webrtc.auth.dto.request.AssignRoleRequest;
import com.chung.webrtc.auth.dto.response.UserResponse;
import com.chung.webrtc.auth.entity.Permission;
import com.chung.webrtc.auth.entity.Role;
import com.chung.webrtc.auth.entity.User;
import com.chung.webrtc.auth.mapper.UserMapper;
import com.chung.webrtc.auth.repository.RoleRepository;
import com.chung.webrtc.auth.repository.UserRepository;
import com.chung.webrtc.common.controller.BaseController;
import com.chung.webrtc.common.dto.response.ApiResponse;
import com.chung.webrtc.common.exception.AppException;
import com.chung.webrtc.common.exception.ErrorCode;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin/users")
@RequiredArgsConstructor
public class AdminUserController extends BaseController {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final UserMapper userMapper;

    @PostMapping("/{userId}/roles")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<UserResponse>> assignRole(
            @PathVariable Long userId,
            @Valid @RequestBody AssignRoleRequest req,
            HttpServletRequest request) {

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND,"User not found"));

        Role role = roleRepository.findByName(req.getRoleName())
                .orElseThrow(() -> new AppException(ErrorCode.ROLE_NOT_FOUND,"Role not found"));

        user.getRoles().add(role);
        userRepository.save(user);

        UserResponse res = userMapper.toResponse(user);

        return ResponseEntity.ok(buildSuccessResponse(res, request));
    }
}
