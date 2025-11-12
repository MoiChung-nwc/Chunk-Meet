package com.chung.webrtc.common.config;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.multipart.support.StandardServletMultipartResolver;

/**
 * ✅ Custom resolver chỉ xử lý multipart cho HTTP POST.
 * Dựa trên StandardServletMultipartResolver (chuẩn servlet 3.0+)
 */
public class CustomMultipartResolver extends StandardServletMultipartResolver {

    @Override
    public boolean isMultipart(HttpServletRequest request) {
        // ✅ Chỉ bật multipart khi request là POST
        return "POST".equalsIgnoreCase(request.getMethod()) && super.isMultipart(request);
    }
}
