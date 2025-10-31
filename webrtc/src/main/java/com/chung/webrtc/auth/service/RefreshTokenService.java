package com.chung.webrtc.auth.service;

import com.chung.webrtc.auth.entity.RefreshToken;
import com.chung.webrtc.auth.entity.User;
import com.chung.webrtc.auth.repository.RefreshTokenRepository;
import com.chung.webrtc.common.exception.AppException;
import com.chung.webrtc.common.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RefreshTokenService {

    private final RefreshTokenRepository refreshTokenRepository;
    private final JwtService jwtService;

    private final long refreshExpiryMs = 1000L * 60 * 60 * 24 * 7; // 7 ngày

    @Transactional
    public RefreshToken createRefreshToken(User user, long expiryMs) {
        refreshTokenRepository.deleteByUser(user);

        RefreshToken token = RefreshToken.builder()
                .token(UUID.randomUUID().toString())
                .user(user)
                .expiryDate(Instant.now().plusMillis(expiryMs))
                .revoked(false)
                .createdAt(Instant.now())
                .build();

        return refreshTokenRepository.save(token);
    }

    public boolean validateTokenString(String tokenStr) {
        RefreshToken token = refreshTokenRepository.findByToken(tokenStr)
                .orElseThrow(() -> new AppException(ErrorCode.AUTH_REFRESH_TOKEN_NOT_FOUND));

        if (token.isRevoked()) {
            throw new AppException(ErrorCode.AUTH_REFRESH_TOKEN_REVOKED);
        }
        if (token.getExpiryDate().isBefore(Instant.now())) {
            throw new AppException(ErrorCode.AUTH_REFRESH_TOKEN_EXPIRED);
        }

        return true;
    }

    public User getUserFromToken(String tokenStr) {
        return refreshTokenRepository.findByToken(tokenStr)
                .map(RefreshToken::getUser)
                .orElseThrow(() -> new AppException(ErrorCode.AUTH_REFRESH_TOKEN_NOT_FOUND));
    }

    @Transactional
    public void revoke(String tokenStr) {
        RefreshToken token = refreshTokenRepository.findByToken(tokenStr)
                .orElseThrow(() -> new AppException(ErrorCode.AUTH_REFRESH_TOKEN_NOT_FOUND));

        token.setRevoked(true);
        refreshTokenRepository.save(token);
    }
}
