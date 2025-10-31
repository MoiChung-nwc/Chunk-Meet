package com.chung.webrtc.common.controller;

import com.chung.webrtc.common.dto.response.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.MDC;

import java.util.UUID;

public abstract class BaseController {

    protected String getTraceId() {
        return MDC.get("traceId") != null ? MDC.get("traceId") : UUID.randomUUID().toString();
    }

    protected <T> ApiResponse<T> buildSuccessResponse(T data, HttpServletRequest request) {
        return ApiResponse.success(data, request.getRequestURI(), getTraceId());
    }

    protected <T> ApiResponse<T> buildErrorResponse(
            com.chung.webrtc.common.exception.ErrorCode errorCode,
            String message,
            HttpServletRequest request
    ) {
        return ApiResponse.error(errorCode, message, request.getRequestURI(), getTraceId());
    }
}