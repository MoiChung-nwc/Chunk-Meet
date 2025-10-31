package com.chung.webrtc.auth.service;

import com.chung.webrtc.auth.dto.request.CreateRoleRequest;
import com.chung.webrtc.auth.dto.response.RoleResponse;

import java.util.List;

public interface RoleService {
    public RoleResponse createRole(CreateRoleRequest req);

    public List<RoleResponse> getAllRoles();

    public RoleResponse getRoleById(Long id);

    public RoleResponse updateRole(Long id, CreateRoleRequest req);

    public void deleteRole(Long id);
}
