package com.chung.webrtc.chat.controller;

import com.chung.webrtc.chat.dto.request.*;
import com.chung.webrtc.chat.dto.response.GroupResponse;
import com.chung.webrtc.chat.service.ChatGroupService;
import com.chung.webrtc.common.constant.SecurityConstants;
import com.chung.webrtc.common.dto.response.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/chat/group")
@RequiredArgsConstructor
public class ChatGroupController {

    private final ChatGroupService chatGroupService;

    /** 🆕 Tạo nhóm mới */
    @PostMapping("/create")
    public ResponseEntity<ApiResponse<GroupResponse>> createGroup(
            @Valid @RequestBody CreateGroupRequest req) {
        String traceId = UUID.randomUUID().toString();
        log.info("[{}] 🎯 CreateGroup request by {}", traceId, req.getCreatedBy());
        GroupResponse group = chatGroupService.createGroup(req);
        return ResponseEntity.ok(ApiResponse.success(group, SecurityConstants.CREATE_GROUP, traceId));
    }

    /** ➕ Thêm thành viên */
    @PutMapping("/{groupId}/add")
    public ResponseEntity<ApiResponse<GroupResponse>> addMember(
            @PathVariable String groupId,
            @Valid @RequestBody AddMemberRequest req) {
        String traceId = UUID.randomUUID().toString();
        log.info("[{}] ➕ AddMember: {} -> {}", traceId, req.getActor(), req.getMemberEmail());
        GroupResponse group = chatGroupService.addMember(groupId, req);
        return ResponseEntity.ok(ApiResponse.success(group, SecurityConstants.ADD_GROUP, traceId));
    }

    /** ❌ Xóa thành viên */
    @PutMapping("/{groupId}/remove")
    public ResponseEntity<ApiResponse<GroupResponse>> removeMember(
            @PathVariable String groupId,
            @Valid @RequestBody RemoveMemberRequest req) {
        String traceId = UUID.randomUUID().toString();
        log.info("[{}] ❌ RemoveMember: {} -> {}", traceId, req.getActor(), req.getMemberEmail());
        GroupResponse group = chatGroupService.removeMember(groupId, req);
        return ResponseEntity.ok(ApiResponse.success(group, SecurityConstants.REMOVE_GROUP, traceId));
    }

    /** 🔼 Cập nhật vai trò thành viên */
    @PutMapping("/{groupId}/role")
    public ResponseEntity<ApiResponse<GroupResponse>> updateMemberRole(
            @PathVariable String groupId,
            @Valid @RequestBody UpdateMemberRoleRequest req) {
        String traceId = UUID.randomUUID().toString();
        log.info("[{}] 🔼 PromoteMember: {} -> {}({})", traceId, req.getActor(), req.getMemberEmail(), req.getNewRole());
        GroupResponse group = chatGroupService.updateMemberRole(groupId, req);
        return ResponseEntity.ok(ApiResponse.success(group, SecurityConstants.UPDATE_MEMBER_ROLE, traceId));
    }

    /** 📝 Cập nhật thông tin nhóm */
    @PutMapping("/{groupId}/update")
    public ResponseEntity<ApiResponse<GroupResponse>> updateGroupInfo(
            @PathVariable String groupId,
            @Valid @RequestBody UpdateGroupRequest req,
            @RequestParam String actor) {
        String traceId = UUID.randomUUID().toString();
        log.info("[{}] 📝 UpdateGroup: {} by {}", traceId, groupId, actor);
        GroupResponse group = chatGroupService.updateGroup(groupId, actor, req);
        return ResponseEntity.ok(ApiResponse.success(group, SecurityConstants.UPDATE_GROUP, traceId));
    }

    /** 🗑️ Xóa nhóm */
    @DeleteMapping("/{groupId}")
    public ResponseEntity<ApiResponse<Void>> deleteGroup(
            @PathVariable String groupId,
            @RequestParam String actor) {
        String traceId = UUID.randomUUID().toString();
        log.info("[{}] 🗑️ DeleteGroup: {} by {}", traceId, groupId, actor);
        chatGroupService.deleteGroup(groupId, actor);
        return ResponseEntity.ok(ApiResponse.success(null, SecurityConstants.DELETE_GROUP, traceId));
    }

    /** 📜 Danh sách nhóm của user */
    @GetMapping("/my")
    public ResponseEntity<ApiResponse<List<GroupResponse>>> getMyGroups(@RequestParam String email) {
        String traceId = UUID.randomUUID().toString();
        List<GroupResponse> groups = chatGroupService.getGroupsByUser(email);
        return ResponseEntity.ok(ApiResponse.success(groups, SecurityConstants.GET_MY_GROUP, traceId));
    }
}
