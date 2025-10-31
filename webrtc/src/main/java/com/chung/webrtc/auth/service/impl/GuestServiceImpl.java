package com.chung.webrtc.auth.service.impl;

import com.chung.webrtc.auth.dto.request.GuestRequest;
import com.chung.webrtc.auth.dto.response.GuestResponse;
import com.chung.webrtc.auth.entity.Guest;
import com.chung.webrtc.auth.entity.Role;
import com.chung.webrtc.auth.mapper.GuestMapper;
import com.chung.webrtc.auth.repository.GuestRepository;
import com.chung.webrtc.auth.repository.RoleRepository;
import com.chung.webrtc.auth.service.GuestService;
import com.chung.webrtc.common.exception.AppException;
import com.chung.webrtc.common.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class GuestServiceImpl implements GuestService {

    private final GuestRepository guestRepository;
    private final RoleRepository roleRepository;
    private final GuestMapper guestMapper;

    @Override
    @Transactional
    public GuestResponse createGuest(GuestRequest request) {
        log.info("Creating guest with email: {}", request.getEmail());

        // Check trùng email
        guestRepository.findByEmail(request.getEmail())
                .ifPresent(g -> {
                    throw new AppException(ErrorCode.EMAIL_ALREADY_EXISTS,
                            "Email " + request.getEmail() + " already registered as guest");
                });

        // Lấy role "GUEST"
        Role guestRole = roleRepository.findByName("GUEST")
                .orElseThrow(() -> new AppException(ErrorCode.GUEST_ROLE_NOT_FOUND, "Guest role not found"));

        // Map & Save
        Guest guest = guestMapper.toEntity(request, guestRole);
        Guest savedGuest = guestRepository.save(guest);

        log.info("Guest created successfully: id={}, sessionId={}", savedGuest.getId(), savedGuest.getSessionId());

        return guestMapper.toResponse(savedGuest);
    }
}
