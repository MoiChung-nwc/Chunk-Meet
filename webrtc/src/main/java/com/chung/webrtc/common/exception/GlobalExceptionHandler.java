package com.chung.webrtc.common.exception;

import com.chung.webrtc.common.dto.response.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    private String getTraceId() {
        return UUID.randomUUID().toString();
    }

    // === 1. Custom AppException ===
    @ExceptionHandler(AppException.class)
    public ResponseEntity<ApiResponse<Object>> handleAppException(AppException ex, HttpServletRequest req) {
        ErrorCode errorCode = ex.getErrorCode();
        String traceId = getTraceId();

        if (errorCode.getStatus().is4xxClientError()) {
            log.warn("[{}] Business exception at {}: {}", traceId, req.getRequestURI(), ex.getMessage());
        } else {
            log.error("[{}] System exception at {}: {}", traceId, req.getRequestURI(), ex.getMessage(), ex);
        }

        return ResponseEntity
                .status(errorCode.getStatus())
                .body(ApiResponse.error(errorCode, ex.getMessage(), req.getRequestURI(), traceId));
    }

    // === 2. Validation errors ===
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Object>> handleValidation(MethodArgumentNotValidException ex, HttpServletRequest req) {
        String traceId = getTraceId();
        String errorMsg = ex.getBindingResult().getAllErrors()
                .stream()
                .map(err -> err.getDefaultMessage())
                .collect(Collectors.joining(", "));

        log.warn("[{}] Validation error at {}: {}", traceId, req.getRequestURI(), errorMsg);
        return ResponseEntity
                .badRequest()
                .body(ApiResponse.error(ErrorCode.VALIDATION_ERROR, errorMsg, req.getRequestURI(), traceId));
    }

    // === 3. Type mismatch ===
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ApiResponse<Object>> handleTypeMismatch(MethodArgumentTypeMismatchException ex, HttpServletRequest req) {
        String traceId = getTraceId();
        String errorMsg = String.format("Invalid value '%s' for parameter '%s'", ex.getValue(), ex.getName());

        log.warn("[{}] Type mismatch at {}: {}", traceId, req.getRequestURI(), errorMsg);
        return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.error(ErrorCode.VALIDATION_ERROR, errorMsg, req.getRequestURI(), traceId));
    }

    // === 4. Method not supported ===
    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ApiResponse<Object>> handleMethodNotSupported(HttpRequestMethodNotSupportedException ex, HttpServletRequest req) {
        String traceId = getTraceId();
        log.warn("[{}] Method not allowed at {}: {}", traceId, req.getRequestURI(), ex.getMethod());

        return ResponseEntity
                .status(HttpStatus.METHOD_NOT_ALLOWED)
                .body(ApiResponse.error(ErrorCode.METHOD_NOT_ALLOWED, "Method not allowed", req.getRequestURI(), traceId));
    }

    // === 5. Unexpected exceptions ===
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Object>> handleUnexpected(Exception ex, HttpServletRequest req) {
        String traceId = getTraceId();
        log.error("[{}] Unexpected exception at {}: {}", traceId, req.getRequestURI(), ex.getMessage(), ex);

        return ResponseEntity
                .status(ErrorCode.INTERNAL_SERVER_ERROR.getStatus())
                .body(ApiResponse.error(ErrorCode.INTERNAL_SERVER_ERROR, ex.getMessage(), req.getRequestURI(), traceId));
    }
}
