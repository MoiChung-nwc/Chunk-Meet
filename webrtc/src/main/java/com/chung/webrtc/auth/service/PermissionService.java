package com.chung.webrtc.auth.service;

import com.chung.webrtc.auth.dto.request.CreatePermissionRequest;
import com.chung.webrtc.auth.dto.response.PermissionResponse;

import java.util.List;

public interface PermissionService {
    public PermissionResponse createPermission(CreatePermissionRequest req);

    public List<PermissionResponse> getAllPermissions();

    public PermissionResponse updatePermission(Long id, CreatePermissionRequest req);

    public void deletePermission(Long id);
}
