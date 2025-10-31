package com.chung.webrtc.auth.service;

import com.chung.webrtc.auth.dto.request.AuthenticationRequest;
import com.chung.webrtc.auth.dto.request.RegisterRequest;
import com.chung.webrtc.auth.dto.response.AuthenticationResponse;

public interface AuthService {
    public AuthenticationResponse register(RegisterRequest req);

    public AuthenticationResponse authenticate(AuthenticationRequest req);

    public AuthenticationResponse refreshToken(String refreshToken);

    public void logout(String refreshToken);
}
