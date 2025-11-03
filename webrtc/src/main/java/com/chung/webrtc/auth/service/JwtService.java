package com.chung.webrtc.auth.service;

import com.chung.webrtc.common.constant.SecurityConstants;
import com.chung.webrtc.auth.entity.Permission;
import com.chung.webrtc.auth.entity.Role;
import com.chung.webrtc.auth.entity.User;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.WebSocketSession;

import java.security.Key;
import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Service
@Slf4j
public class JwtService {
    private final Key key;
    private final long jwtExpirationMs;
    private final long refreshExpirationMs;

    public JwtService(
            @Value("${application.security.jwt.secret-key}") String secretKey,
            @Value("${application.security.jwt.expiration}") long jwtExpirationMs,
            @Value("${application.security.jwt.refresh-token.expiration}") long refreshExpirationMs
    ) {
        this.key = Keys.hmacShaKeyFor(secretKey.getBytes());
        this.jwtExpirationMs = jwtExpirationMs;
        this.refreshExpirationMs = refreshExpirationMs;
    }

    // 🔹 Sinh access token có roles & permissions
    public String generateAccessToken(User user) {
        Map<String, Object> claims = new HashMap<>();

        Set<String> roles = user.getRoles() == null ? Set.of()
                : user.getRoles().stream().map(Role::getName).collect(Collectors.toSet());

        Set<String> permissions = user.getRoles() == null ? Set.of()
                : user.getRoles().stream()
                .flatMap(r -> r.getPermissions() == null ? Stream.<Permission>empty() : r.getPermissions().stream())
                .map(Permission::getName)
                .collect(Collectors.toSet());

        claims.put(SecurityConstants.CLAIM_ROLES, roles);
        claims.put(SecurityConstants.CLAIM_PERMISSIONS, permissions);

        long now = System.currentTimeMillis();
        return Jwts.builder()
                .setClaims(claims)
                .setSubject(user.getEmail())
                .setIssuedAt(new Date(now))
                .setExpiration(new Date(now + jwtExpirationMs))
                .signWith(key, SignatureAlgorithm.HS256)
                .compact();
    }

    public String generateRefreshToken(User user) {
        long now = System.currentTimeMillis();
        return Jwts.builder()
                .setSubject(user.getEmail())
                .setIssuedAt(new Date(now))
                .setExpiration(new Date(now + refreshExpirationMs))
                .signWith(key, SignatureAlgorithm.HS256)
                .compact();
    }

    public boolean isTokenValid(String token) {
        try {
            Jwts.parserBuilder().setSigningKey(key).build().parseClaimsJws(token);
            return true;
        } catch (JwtException | IllegalArgumentException ex) {
            return false;
        }
    }

    public Claims parseClaims(String token) {
        return Jwts.parserBuilder().setSigningKey(key).build().parseClaimsJws(token).getBody();
    }

    public String extractToken(HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            return authHeader.substring(7);
        }
        return null;
    }

    public String extractUsername(String token) {
        return parseClaims(token).getSubject();
    }

    public long refreshExpirationMs() {
        return refreshExpirationMs;
    }

    // ✅ Thêm 3 hàm tiện ích mới cho JwtAuthenticationFilter

    public List<String> extractRoles(String token) {
        Claims claims = parseClaims(token);
        Object rolesObj = claims.get(SecurityConstants.CLAIM_ROLES);
        if (rolesObj instanceof Collection<?>) {
            return ((Collection<?>) rolesObj).stream().map(Object::toString).collect(Collectors.toList());
        }
        return Collections.emptyList();
    }

    public List<String> extractPermissions(String token) {
        Claims claims = parseClaims(token);
        Object permissionsObj = claims.get(SecurityConstants.CLAIM_PERMISSIONS);
        if (permissionsObj instanceof Collection<?>) {
            return ((Collection<?>) permissionsObj).stream().map(Object::toString).collect(Collectors.toList());
        }
        return Collections.emptyList();
    }

    public <T> T extractClaim(String token, java.util.function.Function<Claims, T> claimsResolver) {
        final Claims claims = parseClaims(token);
        return claimsResolver.apply(claims);
    }

    public String extractEmailFromSession(WebSocketSession session) {
        // Ưu tiên lấy từ attribute
        Object emailAttr = session.getAttributes().get("email");
        if (emailAttr != null) return emailAttr.toString();

        // Fallback: lấy từ token trong query param
        try {
            String query = session.getUri().getQuery();
            if (query != null && query.startsWith("token=")) {
                String token = query.substring(6);
                if (isTokenValid(token)) {
                    return extractUsername(token);
                }
            }
        } catch (Exception e) {
            log.warn("⚠️ extractEmailFromSession failed: {}", e.getMessage());
        }
        return null;
    }
}
