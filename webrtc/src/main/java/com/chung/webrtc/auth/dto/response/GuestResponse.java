package com.chung.webrtc.auth.dto.response;

import lombok.Data;


@Data
public class GuestResponse {
    private Long id;
    private String displayName;
    private String email;
    private String roleName;
    private String sessionId;
}
