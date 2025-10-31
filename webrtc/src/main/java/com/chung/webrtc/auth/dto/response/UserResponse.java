package com.chung.webrtc.auth.dto.response;

import lombok.Builder;
import lombok.Data;
import lombok.Getter;

import java.util.Set;

@Getter
@Builder
public class UserResponse {
    private Long id;
    private String email;
    private String firstName;
    private String lastName;
    private Set<String> roles;
    private Set<String> permissions;
}
