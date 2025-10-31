package com.chung.webrtc.auth.service.impl;

import com.chung.webrtc.auth.dto.request.CreateRoleRequest;
import com.chung.webrtc.auth.dto.response.RoleResponse;
import com.chung.webrtc.auth.entity.Permission;
import com.chung.webrtc.auth.entity.Role;
import com.chung.webrtc.auth.repository.PermissionRepository;
import com.chung.webrtc.auth.repository.RoleRepository;
import com.chung.webrtc.auth.service.RoleService;
import com.chung.webrtc.common.exception.AppException;
import com.chung.webrtc.common.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class RoleServiceImpl implements RoleService {
    private final RoleRepository roleRepository;
    private final PermissionRepository permissionRepository;

    @Override
    public RoleResponse createRole(CreateRoleRequest req) {
        Role r = new Role();
        r.setName(req.getName());
        r.setDescription(req.getDescription());

        Set<Permission> perms = new HashSet<>();

        if (req.getPermissionIds() != null && !req.getPermissionIds().isEmpty()) {
            perms = new HashSet<>(permissionRepository.findAllById(req.getPermissionIds()));
        }
        r.setPermissions(perms);

        Role saved = roleRepository.save(r);
        return toResponse(saved);
    }

    @Override
    public List<RoleResponse> getAllRoles() {
        return roleRepository.findAll()
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Override
    public RoleResponse getRoleById(Long id) {
        return roleRepository.findById(id)
                .map(this::toResponse)
                .orElse(null);
    }

    @Override
    public RoleResponse updateRole(Long id, CreateRoleRequest req) {
        Role role = roleRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND, "Role not found"));

        role.setName(req.getName());
        role.setDescription(req.getDescription());

        if (req.getPermissionIds() != null && !req.getPermissionIds().isEmpty()) {
            Set<Permission> perms = new HashSet<>(permissionRepository.findAllById(req.getPermissionIds()));
            role.setPermissions(perms);
        }

        Role updated = roleRepository.save(role);
        return toResponse(updated);
    }

    @Override
    public void deleteRole(Long id) {
        Role role = roleRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.ROLE_NOT_FOUND, "Role not found"));
        roleRepository.delete(role);
    }

    private RoleResponse toResponse(Role r) {
        RoleResponse res = new RoleResponse();
        res.setId(r.getId());
        res.setName(r.getName());
        res.setDescription(r.getDescription());
        res.setPermissions(
                r.getPermissions().stream()
                        .map(Permission::getName)
                        .collect(Collectors.toSet())
        );
        return res;
    }
}
