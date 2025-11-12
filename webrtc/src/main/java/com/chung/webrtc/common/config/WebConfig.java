package com.chung.webrtc.common.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class WebConfig {

    @Bean(name = "multipartResolver")
    public CustomMultipartResolver multipartResolver() {
        return new CustomMultipartResolver();
    }
}
