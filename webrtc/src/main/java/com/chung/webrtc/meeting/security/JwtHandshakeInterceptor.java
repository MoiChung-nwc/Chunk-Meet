package com.chung.webrtc.meeting.security;

import com.chung.webrtc.auth.service.JwtService;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
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
            response.setStatusCode(HttpStatus.BAD_REQUEST);
            return false;
        }

        var http = servletRequest.getServletRequest();
        String token = http.getParameter("token");

        if (token == null || token.isBlank()) {
            log.warn("🚫 Missing token in WS handshake query");
            response.setStatusCode(HttpStatus.UNAUTHORIZED);
            return false;
        }

        try {
            // ✅ Parse token (accept expired)
            Claims claims;
            try {
                claims = jwtService.parseClaims(token);
            } catch (ExpiredJwtException e) {
                log.warn("⚠️ Token expired, still allowing WebSocket: {}", e.getMessage());
                claims = e.getClaims();
            }

            String email = claims.getSubject();
            if (email == null || email.isBlank()) {
                log.warn("🚫 Invalid token: no subject found");
                response.setStatusCode(HttpStatus.UNAUTHORIZED);
                return false;
            }

            // ✅ Lưu thông tin user vào session attribute
            attributes.put("email", email);
            attributes.put("token", token);
            log.info("✅ WebSocket handshake OK for user: {}", email);
            return true;

        } catch (JwtException e) {
            log.error("🚫 Invalid JWT during handshake: {}", e.getMessage());
            response.setStatusCode(HttpStatus.UNAUTHORIZED);
            return false;
        } catch (Exception e) {
            log.error("🚫 Unexpected error validating WS token: {}", e.getMessage());
            response.setStatusCode(HttpStatus.INTERNAL_SERVER_ERROR);
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
