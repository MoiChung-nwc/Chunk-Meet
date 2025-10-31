package com.chung.webrtc.auth.dto.response;

import lombok.Builder;
import lombok.Data;

import java.util.Set;

@Data
public class RoleResponse {
    private Long id;
    private String name;
    private String description;
    private Set<String> permissions;
}
