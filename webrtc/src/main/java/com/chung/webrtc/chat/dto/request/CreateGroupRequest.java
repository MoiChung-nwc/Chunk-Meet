package com.chung.webrtc.chat.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import java.util.Set;

@Data
public class CreateGroupRequest {
    @NotBlank(message = "Group name is required")
    private String name;
    private String description;

    @NotBlank(message = "Creator email is required")
    @Email
    private String createdBy;

    private String avatar;

    // Danh sách thành viên, cho phép rỗng (nhóm 1 người)
    private Set<@Email String> members;
}
