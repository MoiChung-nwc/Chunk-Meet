package com.chung.webrtc.auth.controller;

import com.chung.webrtc.auth.dto.request.CreateRoleRequest;
import com.chung.webrtc.auth.dto.response.RoleResponse;
import com.chung.webrtc.auth.service.RoleService;
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
@RequestMapping("/api/admin/roles")
@RequiredArgsConstructor
public class AdminRoleController extends BaseController {

    private final RoleService roleService;

    // CREATE
    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<RoleResponse>> create(
            @Valid @RequestBody CreateRoleRequest req,
            HttpServletRequest request
    ) {
        RoleResponse role = roleService.createRole(req);
        return ResponseEntity.ok(buildSuccessResponse(role, request));
    }

    // READ ALL
    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<List<RoleResponse>>> list(HttpServletRequest request) {
        List<RoleResponse> roles = roleService.getAllRoles();
        return ResponseEntity.ok(buildSuccessResponse(roles, request));
    }

    // READ ONE
    @GetMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<RoleResponse>> getById(
            @PathVariable Long id,
            HttpServletRequest request
    ) {
        RoleResponse role = roleService.getRoleById(id);
        return ResponseEntity.ok(buildSuccessResponse(role, request));
    }

    // UPDATE
    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<RoleResponse>> update(
            @PathVariable Long id,
            @Valid @RequestBody CreateRoleRequest req,
            HttpServletRequest request
    ) {
        RoleResponse role = roleService.updateRole(id, req);
        return ResponseEntity.ok(buildSuccessResponse(role, request));
    }

    // DELETE
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Void>> delete(
            @PathVariable Long id,
            HttpServletRequest request
    ) {
        roleService.deleteRole(id);
        return ResponseEntity.ok(buildSuccessResponse(null, request));
    }
}
