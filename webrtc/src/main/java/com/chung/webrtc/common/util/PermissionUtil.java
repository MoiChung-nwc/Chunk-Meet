package com.chung.webrtc.common.util;

import com.chung.webrtc.auth.entity.Permission;
import com.chung.webrtc.auth.entity.User;
import com.chung.webrtc.auth.repository.UserRepository;
import com.chung.webrtc.common.exception.AppException;
import com.chung.webrtc.common.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class PermissionUtil {

    private final UserRepository userRepository;

    /**
     * Kiểm tra user có quyền hay không.
     *
     * @param email          email của user
     * @param permissionName tên quyền (ví dụ: "CHAT_SEND", "JOIN_MEETING")
     * @throws AppException nếu user không tồn tại hoặc không có quyền
     */

    public void validatePermission(String email, String permissionName) {
        if (email == null || permissionName == null || permissionName.isBlank()) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "Invalid permission validation parameters");
        }

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND, "User not found: " + email));

        boolean hasPermission = user.getRoles().stream()
                .flatMap(role -> role.getPermissions().stream())
                .map(Permission::getName)
                .anyMatch(p -> p.equalsIgnoreCase(permissionName));

        if (!hasPermission) {
            log.warn("User [{}] missing permission: {}", email, permissionName);
            throw new AppException(ErrorCode.FORBIDDEN, "Permission denied: " + permissionName);
        }

        log.debug("User [{}] has permission: {}", email, permissionName);
    }
}
