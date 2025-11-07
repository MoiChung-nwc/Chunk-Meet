package com.chung.webrtc.chat.dto.response;

import lombok.Builder;
import lombok.Data;
import java.time.Instant;
import java.util.Map;
import java.util.Set;

@Data
@Builder
public class GroupResponse {
    private String id;
    private String name;
    private String description;
    private String createdBy;
    private String avatar;
    private Set<String> members;
    private Map<String, String> roleMap; // email → role
    private Instant createdAt;
    private Instant updatedAt;
}