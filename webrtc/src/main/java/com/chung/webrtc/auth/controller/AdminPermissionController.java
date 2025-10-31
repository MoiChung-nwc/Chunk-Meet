package com.chung.webrtc.auth.controller;

import com.chung.webrtc.auth.dto.request.CreatePermissionRequest;
import com.chung.webrtc.auth.dto.response.PermissionResponse;
import com.chung.webrtc.auth.service.PermissionService;
import com.chung.webrtc.common.controller.BaseController;
import com.chung.webrtc.common.dto.response.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/permissions")
@RequiredArgsConstructor
public class AdminPermissionController extends BaseController {

    private final PermissionService permissionService;

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<PermissionResponse>> create(
            @Valid @RequestBody CreatePermissionRequest req,
            HttpServletRequest request
    ) {
        PermissionResponse permission = permissionService.createPermission(req);
        return ResponseEntity.ok(buildSuccessResponse(permission, request));
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<List<PermissionResponse>>> list(HttpServletRequest request) {
        List<PermissionResponse> permissions = permissionService.getAllPermissions();
        return ResponseEntity.ok(buildSuccessResponse(permissions, request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<PermissionResponse>> update(
            @PathVariable Long id,
            @Valid @RequestBody CreatePermissionRequest req,
            HttpServletRequest request
    ) {
        PermissionResponse permission = permissionService.updatePermission(id, req);
        return ResponseEntity.ok(buildSuccessResponse(permission, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long id, HttpServletRequest request) {
        permissionService.deletePermission(id);
        return ResponseEntity.ok(buildSuccessResponse(null, request));
    }
}
