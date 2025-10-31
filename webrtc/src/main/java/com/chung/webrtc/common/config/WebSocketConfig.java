package com.chung.webrtc.common.config;

import com.chung.webrtc.meeting.security.JwtHandshakeInterceptor;
import com.chung.webrtc.meeting.socket.CallSocketHandler;
import com.chung.webrtc.meeting.controller.SignalingController;
import com.chung.webrtc.meeting.socket.MeetingSocketHandler;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.*;

/**
 * ✅ WebSocket configuration (pure WebSocket, no SockJS)
 * Handles:
 *  - /ws/signaling  → WebRTC offer/answer/ICE signaling
 *  - /ws/call       → Incoming/accept/reject call notifications
 */
@Slf4j
@Configuration
@EnableWebSocket
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketConfigurer {

    private final JwtHandshakeInterceptor jwtHandshakeInterceptor;

    @Qualifier("signalingController")
    private final SignalingController signalingHandler;

    private final CallSocketHandler callSocketHandler;

    private final MeetingSocketHandler meetingSocketHandler;

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        log.info("🔧 Registering WebSocket endpoints (pure WebSocket mode)...");

        // --- Signaling (WebRTC offer/answer exchange)
        registry.addHandler(signalingHandler, "/ws/signaling")
                .addInterceptors(jwtHandshakeInterceptor)
                // ⚠️ Dùng wildcard để chấp nhận cả localhost & IP khác
                .setAllowedOriginPatterns("*");

        // --- Call (incoming call notifications)
        registry.addHandler(callSocketHandler, "/ws/call")
                .addInterceptors(jwtHandshakeInterceptor)
                .setAllowedOriginPatterns("*");

        log.info("✅ WebSocket endpoints registered successfully without SockJS");

        registry.addHandler(meetingSocketHandler, "/ws/meeting")
                .addInterceptors(jwtHandshakeInterceptor)
                .setAllowedOriginPatterns("*");
    }
}
