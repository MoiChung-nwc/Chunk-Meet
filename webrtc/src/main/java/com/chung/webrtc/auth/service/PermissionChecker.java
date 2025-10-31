package com.chung.webrtc.auth.service;

import com.chung.webrtc.common.exception.AppException;
import com.chung.webrtc.common.exception.ErrorCode;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

@Component
public class PermissionChecker {

    public void checkPermission(String permissionName) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            throw new AppException(ErrorCode.AUTH_INVALID_CREDENTIALS, "Unauthenticated request");
        }

        boolean hasPermission = auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals(permissionName));

        if (!hasPermission) {
            throw new AppException(ErrorCode.FORBIDDEN,
                    "You do not have permission: " + permissionName);
        }
    }
}