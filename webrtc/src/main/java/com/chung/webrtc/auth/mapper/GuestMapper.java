package com.chung.webrtc.auth.mapper;

import com.chung.webrtc.auth.dto.request.GuestRequest;
import com.chung.webrtc.auth.dto.response.GuestResponse;
import com.chung.webrtc.auth.entity.Guest;
import com.chung.webrtc.auth.entity.Role;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.UUID;

@Component
public class GuestMapper {

    /**
     * Chuyển từ GuestRequest thành Guest entity (dùng khi tạo mới)
     */
    public Guest toEntity(GuestRequest request, Role guestRole) {
        return Guest.builder()
                .displayName(request.getDisplayName())
                .email(request.getEmail())
                .sessionId(UUID.randomUUID().toString())
                .role(guestRole)
                .createdAt(LocalDateTime.now())
                .build();
    }

    /**
     * Chuyển từ Guest entity thành GuestResponse (trả về cho client)
     */
    public GuestResponse toResponse(Guest guest) {
        if (guest == null) return null;

        GuestResponse response = new GuestResponse();
        response.setId(guest.getId());
        response.setDisplayName(guest.getDisplayName());
        response.setEmail(guest.getEmail());
        response.setRoleName(guest.getRole() != null ? guest.getRole().getName() : null);
        response.setSessionId(guest.getSessionId());
        return response;
    }
}
