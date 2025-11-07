package com.chung.webrtc.chat.mapper;

import com.chung.webrtc.chat.dto.response.GroupResponse;
import com.chung.webrtc.chat.entity.Group;

/**
 * ✅ Mapper: chuyển từ Group entity → GroupResponse DTO
 * Tự động decode roleMap trước khi trả về frontend.
 */
public class GroupMapper {

    public static GroupResponse toResponse(Group g) {
        if (g == null) return null;

        return GroupResponse.builder()
                .id(g.getId())
                .name(g.getName())
                .description(g.getDescription())
                .createdBy(g.getCreatedBy())
                .avatar(g.getAvatar())
                .members(g.getMembers())
                .roleMap(g.getDecodedRoleMap()) // ✅ Decode key (MongoKeyUtil)
                .createdAt(g.getCreatedAt())
                .updatedAt(g.getUpdatedAt())
                .build();
    }
}
