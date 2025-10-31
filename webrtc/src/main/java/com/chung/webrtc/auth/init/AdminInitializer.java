package com.chung.webrtc.auth.init;

import com.chung.webrtc.auth.entity.Permission;
import com.chung.webrtc.auth.entity.Role;
import com.chung.webrtc.auth.entity.User;
import com.chung.webrtc.auth.repository.PermissionRepository;
import com.chung.webrtc.auth.repository.RoleRepository;
import com.chung.webrtc.auth.repository.UserRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.HashSet;
import java.util.Set;

@Component
@RequiredArgsConstructor
public class AdminInitializer {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PermissionRepository permissionRepository;
    private final PasswordEncoder passwordEncoder;

    @PostConstruct
    public void init() {
        // ====== 1. Khởi tạo Permissions ======
        Permission chatSend = permissionRepository.findByName("CHAT_SEND")
                .orElseGet(() -> permissionRepository.save(
                        Permission.builder()
                                .name("CHAT_SEND")
                                .description("Send chat")
                                .build()
                ));

        Permission meetingCreate = permissionRepository.findByName("MEETING_CREATE")
                .orElseGet(() -> permissionRepository.save(
                        Permission.builder()
                                .name("MEETING_CREATE")
                                .description("Create meeting")
                                .build()
                ));

        // ====== 2. Khởi tạo Roles ======
        Role adminRole = roleRepository.findByName("ADMIN")
                .orElseGet(() -> roleRepository.save(
                        Role.builder()
                                .name("ADMIN")
                                .description("Administrator")
                                .permissions(new HashSet<>()) // tránh null
                                .build()
                ));

        Role userRole = roleRepository.findByName("USER")
                .orElseGet(() -> roleRepository.save(
                        Role.builder()
                                .name("USER")
                                .description("Default user")
                                .permissions(new HashSet<>()) // tránh null
                                .build()
                ));

        // Đảm bảo permissions luôn được set
        if (adminRole.getPermissions() == null) {
            adminRole.setPermissions(new HashSet<>());
        }
        adminRole.getPermissions().add(chatSend);
        adminRole.getPermissions().add(meetingCreate);
        roleRepository.save(adminRole);

        if (userRole.getPermissions() == null) {
            userRole.setPermissions(new HashSet<>());
        }
        userRole.getPermissions().add(chatSend);
        roleRepository.save(userRole);

        // ====== 3. Khởi tạo Admin User ======
        if (!userRepository.existsByEmail("admin@gmail.com")) {
            User admin = User.builder()
                    .email("admin@gmail.com")
                    .password(passwordEncoder.encode("admin123"))
                    .firstName("System")
                    .lastName("Admin")
                    .roles(Set.of(adminRole))
                    .build();

            userRepository.save(admin);
        }
    }
}
