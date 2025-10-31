package com.chung.webrtc.auth.service.impl;

import com.chung.webrtc.common.constant.SecurityConstants;
import com.chung.webrtc.auth.dto.request.AuthenticationRequest;
import com.chung.webrtc.auth.dto.request.RegisterRequest;
import com.chung.webrtc.auth.dto.response.AuthenticationResponse;
import com.chung.webrtc.auth.entity.RefreshToken;
import com.chung.webrtc.auth.entity.Role;
import com.chung.webrtc.auth.entity.User;
import com.chung.webrtc.auth.repository.RoleRepository;
import com.chung.webrtc.auth.repository.UserRepository;
import com.chung.webrtc.auth.service.AuthService;
import com.chung.webrtc.auth.service.JwtService;
import com.chung.webrtc.auth.service.RefreshTokenService;
import com.chung.webrtc.common.exception.AppException;
import com.chung.webrtc.common.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final RefreshTokenService refreshTokenService;
    private final AuthenticationManager authenticationManager;

    @Override
    public AuthenticationResponse register(RegisterRequest req) {
        if (userRepository.existsByEmail(req.getEmail())) {
            throw new AppException(ErrorCode.EMAIL_ALREADY_EXISTS,"Email already used");
        }

        Role userRole = roleRepository.findByName(SecurityConstants.USER)
                .orElseGet(() -> roleRepository.save(
                        Role.builder()
                                .name(SecurityConstants.USER)
                                .description("Default user")
                                .build()
                ));

        User u = User.builder()
                .email(req.getEmail())
                .password(passwordEncoder.encode(req.getPassword()))
                .firstName(req.getFirstName())
                .lastName(req.getLastName())
                .roles(Set.of(userRole))
                .isEnabled(true)                // thêm rõ ràng
                .isAccountNonLocked(true)       // thêm rõ ràng
                .build();

        userRepository.save(u);

        String access = jwtService.generateAccessToken(u);
        RefreshToken refresh = refreshTokenService.createRefreshToken(u, jwtService.refreshExpirationMs());

        return AuthenticationResponse.builder()
                .accessToken(access)
                .refreshToken(refresh.getToken())
                .tokenType(SecurityConstants.TOKEN_TYPE)
                .roles(u.getRoles().stream().map(Role::getName).collect(Collectors.toSet()))
                .permissions(
                        u.getRoles() == null ? Set.of()
                                : u.getRoles().stream()
                                .flatMap(r -> (r.getPermissions() == null ? Set.<com.chung.webrtc.auth.entity.Permission>of() : r.getPermissions()).stream())
                                .map(p -> p.getName())
                                .collect(Collectors.toSet()))
                .build();
    }

    @Override
    public AuthenticationResponse authenticate(AuthenticationRequest req) {
        authenticationManager.authenticate(new UsernamePasswordAuthenticationToken(req.getEmail(), req.getPassword()));
        User u = userRepository.findByEmail(req.getEmail()).orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND,"User not found"));

        String access = jwtService.generateAccessToken(u);
        RefreshToken refresh = refreshTokenService.createRefreshToken(u, jwtService.refreshExpirationMs());

        return AuthenticationResponse.builder()
                .accessToken(access)
                .refreshToken(refresh.getToken())
                .tokenType(SecurityConstants.TOKEN_TYPE)
                .roles(u.getRoles().stream().map(Role::getName).collect(Collectors.toSet()))
                .permissions(u.getRoles().stream().flatMap(r -> r.getPermissions().stream()).map(p -> p.getName()).collect(Collectors.toSet()))
                .build();
    }

    @Override
    public AuthenticationResponse refreshToken(String refreshToken) {
        if (!refreshTokenService.validateTokenString(refreshToken)) {
            throw new IllegalArgumentException("Invalid refresh token");
        }
        User u = refreshTokenService.getUserFromToken(refreshToken);
        if (u == null) throw new IllegalArgumentException("Invalid refresh token");

        // rotate: revoke old, create new
        refreshTokenService.revoke(refreshToken);
        var newRefresh = refreshTokenService.createRefreshToken(u, jwtService.refreshExpirationMs());
        String access = jwtService.generateAccessToken(u);

        return AuthenticationResponse.builder()
                .accessToken(access)
                .refreshToken(newRefresh.getToken())
                .tokenType(SecurityConstants.TOKEN_TYPE)
                .roles(u.getRoles().stream().map(Role::getName).collect(Collectors.toSet()))
                .permissions(u.getRoles().stream().flatMap(r -> r.getPermissions().stream()).map(p -> p.getName()).collect(Collectors.toSet()))
                .build();
    }

    @Override
    public void logout(String refreshToken) {
        refreshTokenService.revoke(refreshToken);
    }
}