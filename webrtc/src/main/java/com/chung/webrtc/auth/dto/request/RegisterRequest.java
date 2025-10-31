package com.chung.webrtc.auth.dto.request;

import lombok.Data;
import jakarta.validation.constraints.*;

@Data
public class RegisterRequest {
    @NotBlank(message = "Email not blank")
    @Email
    private String email;

    @NotBlank(message = "Password not blank")
    @Size(min=6)
    private String password;

    @NotBlank
    private String firstName;

    @NotBlank
    private String lastName;
}