package com.chung.webrtc.meeting.security;

import com.chung.webrtc.auth.service.JwtService;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class JwtHandshakeInterceptor implements HandshakeInterceptor {

    private final JwtService jwtService;

    @Override
    public boolean beforeHandshake(
            ServerHttpRequest request,
            ServerHttpResponse response,
            WebSocketHandler wsHandler,
            Map<String, Object> attributes
    ) {
        if (!(request instanceof ServletServerHttpRequest servletRequest)) {
            log.warn("❌ Not a servlet request");
            return false;
        }

        var http = servletRequest.getServletRequest();
        String token = http.getParameter("token");
        if (token == null || token.isBlank()) {
            log.warn("❌ Missing token in handshake query");
            return false;
        }

        try {
            // ✅ Parse token (chấp nhận token expired)
            Claims claims;
            try {
                claims = jwtService.parseClaims(token);
            } catch (ExpiredJwtException e) {
                log.warn("⚠️ Token expired, still allowing WebSocket: {}", e.getMessage());
                claims = e.getClaims();
            }

            String username = claims.getSubject();
            if (username == null || username.isBlank()) {
                log.warn("❌ No subject in token");
                return false;
            }

            // ✅ Save user info to WS session
            attributes.put("username", username);
            log.info("✅ WebSocket handshake OK for user: {}", username);
            return true;

        } catch (JwtException e) {
            log.error("🚫 Invalid JWT during handshake: {}", e.getMessage());
            return false;
        } catch (Exception e) {
            log.error("🚫 Unexpected error validating WS token: {}", e.getMessage());
            return false;
        }
    }

    @Override
    public void afterHandshake(
            ServerHttpRequest request,
            ServerHttpResponse response,
            WebSocketHandler wsHandler,
            Exception exception
    ) {
        // nothing to do
    }
}
