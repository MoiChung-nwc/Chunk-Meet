package com.chung.webrtc.auth.dto.request;

import lombok.Data;

import java.util.Set;

@Data
public class UserUpdateRequest {
    private String email;
    private String firstName;
    private String lastName;
    private Set<Long> roleIds;
}
