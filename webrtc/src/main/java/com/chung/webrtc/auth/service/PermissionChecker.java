package com.chung.webrtc.auth.service;

import com.chung.webrtc.common.exception.AppException;
import com.chung.webrtc.common.exception.ErrorCode;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

@Component
public class PermissionChecker {

    /**
     * ✅ Kiểm tra bắt buộc phải có quyền — nếu không có sẽ throw AppException
     */
    public void checkPermission(String permissionName) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            throw new AppException(ErrorCode.AUTH_INVALID_CREDENTIALS, "Unauthenticated request");
        }

        boolean hasPermission = auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equalsIgnoreCase(permissionName));

        if (!hasPermission) {
            throw new AppException(ErrorCode.FORBIDDEN,
                    "You do not have permission: " + permissionName);
        }
    }

    /**
     * ✅ Trả về true nếu user có ÍT NHẤT 1 trong các quyền chỉ định.
     * (Không ném lỗi, chỉ để kiểm tra điều kiện mềm)
     */
    public boolean hasAnyPermission(String... permissions) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || auth.getAuthorities() == null)
            return false;

        Set<String> userPerms = auth.getAuthorities().stream()
                .map(a -> a.getAuthority().toUpperCase())
                .collect(Collectors.toSet());

        return Arrays.stream(permissions)
                .map(String::toUpperCase)
                .anyMatch(userPerms::contains);
    }

    /**
     * ✅ Trả về true nếu user có TẤT CẢ quyền chỉ định.
     */
    public boolean hasAllPermissions(String... permissions) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || auth.getAuthorities() == null)
            return false;

        Set<String> userPerms = auth.getAuthorities().stream()
                .map(a -> a.getAuthority().toUpperCase())
                .collect(Collectors.toSet());

        return Arrays.stream(permissions)
                .map(String::toUpperCase)
                .allMatch(userPerms::contains);
    }
}
