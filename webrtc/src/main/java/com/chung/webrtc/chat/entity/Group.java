package com.chung.webrtc.chat.entity;

import com.chung.webrtc.common.util.MongoKeyUtil;
import jakarta.persistence.Id;
import lombok.*;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.*;

/**
 * ✅ Entity nhóm chat sử dụng Role/Permission động từ hệ thống User.
 * Email trong roleMap được encode để tránh lỗi "." với MongoDB.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "groups")
public class Group {

    @Id
    private String id;

    private String name;
    private String description;
    private String createdBy;
    private String avatar;

    private Set<String> members = new HashSet<>();
    private Map<String, String> roleMap = new HashMap<>(); // encode key

    private Instant createdAt;
    private Instant updatedAt;

    /** ✅ Thêm thành viên với vai trò */
    public void addMember(String email, String roleName) {
        members.add(email);
        roleMap.put(MongoKeyUtil.encode(email), roleName != null ? roleName : "USER");
        updatedAt = Instant.now();
    }

    /** ✅ Xóa thành viên */
    public void removeMember(String email) {
        members.remove(email);
        roleMap.remove(MongoKeyUtil.encode(email));
        updatedAt = Instant.now();
    }

    /** ✅ Lấy vai trò thực tế của 1 user */
    public String getRoleOf(String email) {
        return roleMap.getOrDefault(MongoKeyUtil.encode(email), "USER");
    }

    /** ✅ Trả map role đã decode cho API */
    public Map<String, String> getDecodedRoleMap() {
        return MongoKeyUtil.decodeMap(roleMap);
    }
}
