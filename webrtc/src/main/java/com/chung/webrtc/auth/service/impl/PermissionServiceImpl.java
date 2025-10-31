package com.chung.webrtc.auth.service.impl;

import com.chung.webrtc.auth.dto.request.CreatePermissionRequest;
import com.chung.webrtc.auth.dto.response.PermissionResponse;
import com.chung.webrtc.auth.entity.Permission;
import com.chung.webrtc.auth.mapper.PermissionMapper;
import com.chung.webrtc.auth.repository.PermissionRepository;
import com.chung.webrtc.auth.service.PermissionService;
import com.chung.webrtc.common.exception.AppException;
import com.chung.webrtc.common.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class PermissionServiceImpl implements PermissionService {

    private final PermissionRepository permissionRepository;
    private final PermissionMapper permissionMapper;

    @Override
    @Transactional
    public PermissionResponse createPermission(CreatePermissionRequest req) {
        log.info("Creating new permission: {}", req.getName());

        permissionRepository.findByName(req.getName()).ifPresent(existing -> {
            throw new AppException(ErrorCode.PERMISSION_ALREADY_EXISTS,
                    "Permission '" + req.getName() + "' already exists");
        });

        Permission permission = Permission.builder()
                .name(req.getName())
                .description(req.getDescription())
                .build();

        Permission saved = permissionRepository.save(permission);
        log.info("Permission created successfully: id={}, name={}", saved.getId(), saved.getName());
        return permissionMapper.toResponse(saved);
    }

    @Override
    public List<PermissionResponse> getAllPermissions() {
        return permissionRepository.findAll()
                .stream()
                .map(permissionMapper::toResponse)
                .toList();
    }

    @Override
    public PermissionResponse updatePermission(Long id, CreatePermissionRequest req) {
        Permission permission = permissionRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.PERMISSION_NOT_FOUND, "Permission not found"));

        // Kiểm tra tên bị trùng với permission khác
        permissionRepository.findByName(req.getName()).ifPresent(existing -> {
            if (!existing.getId().equals(id)) {
                throw new AppException(ErrorCode.PERMISSION_ALREADY_EXISTS,
                        "Permission name '" + req.getName() + "' already exists");
            }
        });

        permission.setName(req.getName());
        permission.setDescription(req.getDescription());

        Permission updated = permissionRepository.save(permission);
        log.info("Permission updated successfully: id={}, name={}", updated.getId(), updated.getName());
        return permissionMapper.toResponse(updated);
    }

    @Override
    @Transactional
    public void deletePermission(Long id) {
        log.warn("Deleting permission with id={}", id);
        if (!permissionRepository.existsById(id)) {
            throw new AppException(ErrorCode.PERMISSION_NOT_FOUND, "Permission not found");
        }
        permissionRepository.deleteById(id);
        log.info("Permission deleted successfully: id={}", id);
    }
}
