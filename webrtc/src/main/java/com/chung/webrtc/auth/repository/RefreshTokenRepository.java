package com.chung.webrtc.auth.repository;

import com.chung.webrtc.auth.entity.RefreshToken;
import com.chung.webrtc.auth.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {
    Optional<RefreshToken> findByToken(String token);
    void deleteByUser(User user);
}
