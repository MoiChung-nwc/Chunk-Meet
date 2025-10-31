package com.chung.webrtc.auth.service.impl;

import com.chung.webrtc.auth.dto.request.AssignRoleRequest;
import com.chung.webrtc.auth.dto.response.UserResponse;
import com.chung.webrtc.auth.entity.Role;
import com.chung.webrtc.auth.entity.User;
import com.chung.webrtc.auth.mapper.UserMapper;
import com.chung.webrtc.auth.repository.RoleRepository;
import com.chung.webrtc.auth.repository.UserRepository;
import com.chung.webrtc.auth.service.AdminUserService;
import com.chung.webrtc.common.exception.AppException;
import com.chung.webrtc.common.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AdminUserServiceImpl implements AdminUserService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final UserMapper userMapper;

    @Override
    public List<UserResponse> getAllUsers() {
        return userRepository.findAll()
                .stream()
                .map(userMapper::toResponse)
                .toList();
    }

    @Override
    public UserResponse getUserById(Long userId) {
        User user = findUserById(userId);
        return userMapper.toResponse(user);
    }

    @Override
    public UserResponse assignRole(Long userId, AssignRoleRequest request) {
        User user = findUserById(userId);
        Role role = findRoleByName(request.getRoleName());

        // Tránh thêm trùng role
        if (user.getRoles().contains(role)) {
            throw new AppException(ErrorCode.VALIDATION_ERROR,
                    "User already has role: " + request.getRoleName());
        }

        user.getRoles().add(role);
        return userMapper.toResponse(saveUser(user));
    }

    @Override
    public UserResponse removeRole(Long userId, String roleName) {
        User user = findUserById(userId);
        Role role = findRoleByName(roleName);

        if (!user.getRoles().contains(role)) {
            throw new AppException(ErrorCode.VALIDATION_ERROR,
                    "User does not have role: " + roleName);
        }

        user.getRoles().remove(role);
        return userMapper.toResponse(saveUser(user));
    }

    @Override
    public UserResponse updateRoles(Long userId, List<String> roleNames) {
        User user = findUserById(userId);

        Set<Role> newRoles = roleNames.stream()
                .map(this::findRoleByName)
                .collect(Collectors.toSet());

        user.setRoles(newRoles);
        return userMapper.toResponse(saveUser(user));
    }

    // =================== PRIVATE HELPERS ===================

    private User findUserById(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new AppException(
                        ErrorCode.USER_NOT_FOUND, "User not found with id: " + userId
                ));
    }

    private Role findRoleByName(String roleName) {
        return roleRepository.findByName(roleName)
                .orElseThrow(() -> new AppException(
                        ErrorCode.ROLE_NOT_FOUND, "Role not found: " + roleName
                ));
    }

    private User saveUser(User user) {
        return userRepository.save(user);
    }
}
