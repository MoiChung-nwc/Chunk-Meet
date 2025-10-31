package com.chung.webrtc.auth.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class GuestJoinRequest {
    @NotBlank
    private String displayName;
}
