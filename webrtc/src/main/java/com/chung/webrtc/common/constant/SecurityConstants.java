package com.chung.webrtc.common.constant;

public final class SecurityConstants {
    private SecurityConstants(){}

    public static final String USER = "USER";
    public static final String ADMIN = "ADMIN";
    public static final String GUEST = "GUEST";


    public static final String TOKEN_TYPE = "Bearer";
    public static final String AUTH_HEADER = "Authorization";

    public static final String CLAIM_ROLES = "roles";
    public static final String CLAIM_PERMISSIONS = "permissions";

    public static final String CREATE_GROUP = "/api/chat/group/create";
    public static final String ADD_GROUP = "/api/chat/group/add";
    public static final String REMOVE_GROUP = "/api/chat/group/remove";
    public static final String UPDATE_MEMBER_ROLE = "/api/chat/group/role";
    public static final String UPDATE_GROUP = "/api/chat/group/update";
    public static final String DELETE_GROUP = "/api/chat/group/delete";
    public static final String GET_MY_GROUP = "/api/chat/group/my";
}
