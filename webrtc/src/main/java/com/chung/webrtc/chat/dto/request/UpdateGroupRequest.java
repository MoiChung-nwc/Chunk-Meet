package com.chung.webrtc.chat.dto.request;

import lombok.Data;

@Data
public class UpdateGroupRequest {
    private String name;
    private String description;
    private String avatar;
}