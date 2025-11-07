package com.chung.webrtc.chat.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class UpdateMemberRoleRequest {
    @NotBlank @Email
    private String actor;
    @NotBlank @Email
    private String memberEmail;
    @NotBlank
    private String newRole;
}