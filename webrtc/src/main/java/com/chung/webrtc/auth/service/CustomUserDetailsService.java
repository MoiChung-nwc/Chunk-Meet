package com.chung.webrtc.auth.service;

import com.chung.webrtc.auth.entity.Role;
import com.chung.webrtc.auth.entity.User;
import com.chung.webrtc.auth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CustomUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        User u = userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + email));

        return org.springframework.security.core.userdetails.User.builder()
                .username(u.getEmail())
                .password(u.getPassword())
                .authorities(
                        u.getRoles().stream()
                                .map(Role::getName)                     // ADMIN, USER
                                .map(r -> "ROLE_" + r)                  // ROLE_ADMIN, ROLE_USER
                                .map(SimpleGrantedAuthority::new)
                                .collect(Collectors.toSet())
                )
                .accountLocked(!u.isAccountNonLocked())
                .disabled(!u.isEnabled())
                .build();
    }
}
