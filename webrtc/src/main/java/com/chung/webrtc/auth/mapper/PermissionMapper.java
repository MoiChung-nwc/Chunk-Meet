package com.chung.webrtc.auth.mapper;

import com.chung.webrtc.auth.dto.response.PermissionResponse;
import com.chung.webrtc.auth.entity.Permission;
import org.springframework.stereotype.Component;

@Component
public class PermissionMapper {

    /**
     * Chuyển đổi Permission entity sang PermissionResponse DTO.
     *
     * @param permission thực thể Permission trong database
     * @return PermissionResponse DTO
     */
    public PermissionResponse toResponse(Permission permission) {
        if (permission == null) {
            return null;
        }

        PermissionResponse response = new PermissionResponse();
        response.setId(permission.getId());
        response.setName(permission.getName());
        response.setDescription(permission.getDescription());
        return response;
    }
}
