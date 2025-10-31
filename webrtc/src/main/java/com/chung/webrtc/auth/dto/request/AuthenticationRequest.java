package com.chung.webrtc.auth.dto.request;

import lombok.Data;
import jakarta.validation.constraints.*;

@Data
public class AuthenticationRequest {
    @NotBlank
    @Email
    private String email;
    @NotBlank
    private String password;
}