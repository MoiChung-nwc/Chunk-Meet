package com.chung.webrtc.auth.service.impl;

import com.chung.webrtc.auth.dto.request.UserUpdateRequest;
import com.chung.webrtc.auth.dto.response.UserResponse;
import com.chung.webrtc.auth.entity.User;
import com.chung.webrtc.auth.mapper.UserMapper;
import com.chung.webrtc.auth.repository.RefreshTokenRepository;
import com.chung.webrtc.auth.repository.UserRepository;
import com.chung.webrtc.auth.service.UserService;
import com.chung.webrtc.common.exception.AppException;
import com.chung.webrtc.common.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class UserServiceImpl implements UserService {
    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final UserMapper userMapper;

    private User getAuthenticatedUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String email = auth.getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND,"User not found"));
    }

    @Override
    public UserResponse getCurrentUser() {
        return userMapper.toResponse(getAuthenticatedUser());
    }

    @Override
    public UserResponse updateCurrentUser(UserUpdateRequest request) {
        User user = getAuthenticatedUser();
        if (request.getEmail() != null) user.setEmail(request.getEmail());
        if (request.getFirstName() != null) user.setFirstName(request.getFirstName());
        if (request.getLastName() != null) user.setLastName(request.getLastName());
        userRepository.save(user);
        return userMapper.toResponse(user);
    }

    @Override
    @Transactional
    public void deleteCurrentUser() {
        User user = getAuthenticatedUser();
        refreshTokenRepository.deleteByUser(user);
        userRepository.delete(user);
    }
}
