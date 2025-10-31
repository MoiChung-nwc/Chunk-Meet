package com.chung.webrtc.auth.dto.response;

import lombok.*;

import java.util.Set;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class AuthenticationResponse {
    private String accessToken;
    private String refreshToken;
    private String tokenType; // Bearer
    private Set<String> roles;
    private Set<String> permissions;
}