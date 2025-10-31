package com.chung.webrtc.auth.service;

import com.chung.webrtc.auth.dto.request.GuestJoinRequest;
import com.chung.webrtc.auth.dto.request.GuestRequest;
import com.chung.webrtc.auth.dto.response.GuestResponse;

public interface GuestService {
    GuestResponse createGuest(GuestRequest req);
}
