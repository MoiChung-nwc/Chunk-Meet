package com.chung.webrtc.common.config;

import com.chung.webrtc.chat.socket.ChatSocketHandler;
import com.chung.webrtc.file.socket.FileSocketHandler;
import com.chung.webrtc.meeting.security.JwtHandshakeInterceptor;
import com.chung.webrtc.meeting.socket.CallSocketHandler;
import com.chung.webrtc.meeting.controller.SignalingController;
import com.chung.webrtc.meeting.socket.MeetingSocketHandler;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.*;


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

    private final ChatSocketHandler chatSocketHandler;

    private final FileSocketHandler fileSocketHandler;

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

        registry.addHandler(meetingSocketHandler, "/ws/meeting")
                .addInterceptors(jwtHandshakeInterceptor)
                .setAllowedOriginPatterns("*");

        registry.addHandler(chatSocketHandler, "/ws/chat")
                .addInterceptors(jwtHandshakeInterceptor)
                .setAllowedOriginPatterns("*");

        registry.addHandler(fileSocketHandler, "/ws/file")
                .addInterceptors(jwtHandshakeInterceptor)
                .setAllowedOriginPatterns("*");

        log.info("✅ All WebSocket endpoints registered successfully");
    }
}
