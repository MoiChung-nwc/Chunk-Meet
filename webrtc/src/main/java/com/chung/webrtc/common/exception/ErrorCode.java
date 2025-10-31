package com.chung.webrtc.common.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
public enum ErrorCode {

    // ===== [1xx] System / Common =====
    SUCCESS("SYS_000", "Success", HttpStatus.OK),
    INTERNAL_SERVER_ERROR("SYS_001", "Internal server error", HttpStatus.INTERNAL_SERVER_ERROR),
    VALIDATION_ERROR("SYS_002", "Validation failed", HttpStatus.BAD_REQUEST),
    METHOD_NOT_ALLOWED("SYS_003", "HTTP method not allowed", HttpStatus.METHOD_NOT_ALLOWED),
    ACCESS_DENIED("SYS_004", "Access denied", HttpStatus.FORBIDDEN),
    INVALID_REQUEST("SYS_005", "Invalid Request", HttpStatus.INTERNAL_SERVER_ERROR),

    // ===== [2xx] Authentication / Authorization =====
    AUTH_INVALID_CREDENTIALS("AUTH_001", "Invalid credentials", HttpStatus.UNAUTHORIZED),
    AUTH_TOKEN_EXPIRED("AUTH_002", "Token has expired", HttpStatus.UNAUTHORIZED),
    AUTH_TOKEN_INVALID("AUTH_003", "Invalid token", HttpStatus.UNAUTHORIZED),
    AUTH_REFRESH_TOKEN_NOT_FOUND("AUTH_004", "Refresh token not found", HttpStatus.BAD_REQUEST),
    AUTH_REFRESH_TOKEN_REVOKED("AUTH_005", "Refresh token revoked", HttpStatus.UNAUTHORIZED),
    AUTH_REFRESH_TOKEN_EXPIRED("AUTH_006", "Refresh token expired", HttpStatus.UNAUTHORIZED),

    // ===== [3xx] User =====
    USER_NOT_FOUND("USR_001", "User not found", HttpStatus.NOT_FOUND),
    USER_ALREADY_EXISTS("USR_002", "User already exists", HttpStatus.CONFLICT),
    USER_INACTIVE("USR_003", "User is inactive", HttpStatus.FORBIDDEN),
    GUEST_ROLE_NOT_FOUND("USR_004","Guest role not found", HttpStatus.NOT_FOUND),
    EMAIL_ALREADY_EXISTS("USR_005","Email already exists",  HttpStatus.CONFLICT),

    PERMISSION_NOT_FOUND("PERM_001","Permission not found", HttpStatus.NOT_FOUND),
    PERMISSION_ALREADY_EXISTS("PERM_002","Permission already exists", HttpStatus.CONFLICT),
    ROLE_NOT_FOUND("ROL_001","Role not found", HttpStatus.NOT_FOUND),

    // ===== [4xx] Business Logic =====
    BUSINESS_CONFLICT("BUS_001", "Business logic conflict", HttpStatus.CONFLICT),
    FORBIDDEN("BUS_002", "Action forbidden", HttpStatus.FORBIDDEN);

    private final String code;
    private final String message;
    private final HttpStatus status;

    ErrorCode(String code, String message, HttpStatus status) {
        this.code = code;
        this.message = message;
        this.status = status;
    }
}
