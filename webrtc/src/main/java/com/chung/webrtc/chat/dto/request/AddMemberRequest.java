package com.chung.webrtc.chat.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class AddMemberRequest {
    @NotBlank @Email
    private String actor; // người thực hiện thêm
    @NotBlank @Email
    private String memberEmail; // thành viên được thêm
    private String roleName; // mặc định = USER
}