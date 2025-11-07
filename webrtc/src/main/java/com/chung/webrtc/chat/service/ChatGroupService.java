package com.chung.webrtc.chat.service;

import com.chung.webrtc.auth.entity.Permission;
import com.chung.webrtc.auth.entity.User;
import com.chung.webrtc.auth.repository.UserRepository;
import com.chung.webrtc.chat.dto.request.*;
import com.chung.webrtc.chat.dto.response.GroupResponse;
import com.chung.webrtc.chat.entity.Conversation;
import com.chung.webrtc.chat.entity.Group;
import com.chung.webrtc.chat.entity.Message;
import com.chung.webrtc.chat.enums.ConversationType;
import com.chung.webrtc.chat.mapper.GroupMapper;
import com.chung.webrtc.chat.repository.ChatGroupRepository;
import com.chung.webrtc.chat.repository.ConversationRepository;
import com.chung.webrtc.chat.repository.MessageRepository;
import com.chung.webrtc.common.exception.AppException;
import com.chung.webrtc.common.exception.ErrorCode;
import com.chung.webrtc.common.util.MongoKeyUtil;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ChatGroupService {

    private final ChatGroupRepository chatGroupRepo;
    private final ConversationRepository conversationRepo;
    private final MessageRepository messageRepo;
    private final UserRepository userRepo;
    private final ChatSessionRegistry chatSessionRegistry;
    private final ChatService chatService;
    private final ObjectMapper mapper = new ObjectMapper();

    public GroupResponse createGroup(CreateGroupRequest req) {
        validatePermission(req.getCreatedBy(), "CHATGROUP_CREATE");

        if (req.getName() == null || req.getName().isBlank()) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "Group name is required");
        }

        // ✅ Gom danh sách thành viên (không lặp, không bao gồm người tạo)
        Set<String> members = new HashSet<>();
        if (req.getMembers() != null) {
            members.addAll(req.getMembers());
            members.remove(req.getCreatedBy());
        }

        // ✅ Tạo entity Group
        Group group = Group.builder()
                .name(req.getName())
                .description(req.getDescription())
                .avatar(req.getAvatar())
                .createdBy(req.getCreatedBy())
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .members(new HashSet<>())
                .roleMap(new HashMap<>())
                .build();

        // ✅ Thêm vai trò mặc định
        group.addMember(req.getCreatedBy(), "ADMIN");
        for (String m : members) {
            group.addMember(m, "USER");
        }

        // ✅ Lưu group
        Group saved = chatGroupRepo.save(group);

        // ✅ Chỉ tạo Conversation nếu group có ít nhất 2 thành viên
        if (saved.getMembers() != null && !saved.getMembers().isEmpty()) {
            Conversation conv = Conversation.builder()
                    .id(saved.getId()) // 🔗 sử dụng cùng ID với group
                    .type(ConversationType.GROUP)
                    .participants(new HashSet<>(saved.getMembers()))
                    .createdAt(saved.getCreatedAt())
                    .lastMessage(null)
                    .lastSender(null)
                    .lastSenderName(null)
                    .lastMessageTime(null)
                    .unreadMap(new HashMap<>())
                    .build();

            conversationRepo.save(conv);
            log.info("✅ Created new group [{}] by {} -> Conversation synced with {} members",
                    saved.getName(), req.getCreatedBy(), saved.getMembers().size());
        } else {
            log.warn("⚠️ Group [{}] created without members — skipped Conversation sync", saved.getName());
        }

        // ✅ Broadcast event tới tất cả thành viên
        ObjectNode event = mapper.createObjectNode();
        event.put("type", "group-created");
        event.put("groupId", saved.getId());
        event.put("name", saved.getName());
        event.put("description", saved.getDescription());
        event.put("avatar", saved.getAvatar());
        event.put("createdBy", saved.getCreatedBy());
        event.put("createdAt", saved.getCreatedAt().toString());
        event.putPOJO("members", saved.getMembers());

        chatSessionRegistry.broadcastToGroupMembers(saved.getId(), saved.getMembers(), event.toString());

        log.info("📡 Broadcasted group-created [{}] to {} members",
                saved.getName(), saved.getMembers().size());

        return GroupMapper.toResponse(saved);
    }


    public GroupResponse addMember(String groupId, AddMemberRequest req) {
        validatePermission(req.getActor(), "CHATGROUP_ADD_MEMBER");
        Group group = getGroupOrThrow(groupId);

        if (group.getMembers().contains(req.getMemberEmail())) {
            throw new AppException(ErrorCode.BUSINESS_CONFLICT, "User already in group");
        }

        // ✅ Thêm thành viên mới
        group.addMember(req.getMemberEmail(), req.getRoleName());
        group.setUpdatedAt(Instant.now());
        chatGroupRepo.save(group);

        // ✅ Đồng bộ participants trong conversation
        conversationRepo.findById(groupId).ifPresent(conv -> {
            Set<String> updated = new HashSet<>(conv.getParticipants());
            updated.add(req.getMemberEmail());
            conv.setParticipants(updated);
            conversationRepo.save(conv);
        });

        // ✅ Broadcast tới toàn nhóm rằng có thành viên mới
        try {
            ObjectNode event = mapper.createObjectNode();
            event.put("type", "group-member-added");
            event.put("groupId", group.getId());
            event.put("email", req.getMemberEmail());
            event.put("role", req.getRoleName());
            event.put("updatedAt", group.getUpdatedAt().toString());

            chatSessionRegistry.broadcastToGroupMembers(
                    group.getId(),
                    group.getMembers(),
                    event.toString()
            );

            log.info("📢 Broadcasted group-member-added [{} -> {}] to {} members",
                    req.getActor(), req.getMemberEmail(), group.getMembers().size());

        } catch (Exception e) {
            log.error("❌ Failed to broadcast member-add: {}", e.getMessage());
        }

        // 🚀 GỬI RIÊNG "group-created" event CHO NGƯỜI VỪA ĐƯỢC THÊM
        try {
            ObjectNode newGroupEvent = mapper.createObjectNode();
            newGroupEvent.put("type", "group-created");
            newGroupEvent.put("groupId", group.getId());
            newGroupEvent.put("name", group.getName());
            newGroupEvent.put("description", group.getDescription());
            newGroupEvent.put("avatar", group.getAvatar());
            newGroupEvent.put("createdBy", group.getCreatedBy());
            newGroupEvent.put("createdAt", group.getCreatedAt().toString());
            newGroupEvent.putPOJO("members", group.getMembers());

            chatSessionRegistry.sendToUser(req.getMemberEmail(), newGroupEvent.toString());

            log.info("📡 Sent full group info [{}] to newly added member {}",
                    group.getName(), req.getMemberEmail());
        } catch (Exception e) {
            log.error("❌ Failed to send group info to new member: {}", e.getMessage());
        }

        return GroupMapper.toResponse(group);
    }


    public GroupResponse removeMember(String groupId, RemoveMemberRequest req) {
        validatePermission(req.getActor(), "CHATGROUP_REMOVE_MEMBER");
        Group group = getGroupOrThrow(groupId);

        if (!group.getMembers().contains(req.getMemberEmail())) {
            throw new AppException(ErrorCode.USER_NOT_FOUND, "Member not found in group");
        }

        group.removeMember(req.getMemberEmail());
        group.setUpdatedAt(Instant.now());
        chatGroupRepo.save(group);

        conversationRepo.findById(groupId).ifPresent(conv -> {
            Set<String> updated = new HashSet<>(conv.getParticipants());
            updated.remove(req.getMemberEmail());
            conv.setParticipants(updated);
            conversationRepo.save(conv);
        });

        // ✅ Broadcast member removed
        ObjectNode event = mapper.createObjectNode();
        event.put("type", "group-member-removed");
        event.put("groupId", groupId);
        event.put("email", req.getMemberEmail());
        chatSessionRegistry.broadcastToGroupMembers(groupId, group.getMembers(), event.toString());

        return GroupMapper.toResponse(group);
    }

    public GroupResponse updateGroup(String groupId, String actor, UpdateGroupRequest req) {
        validatePermission(actor, "CHATGROUP_UPDATE_INFO");
        Group group = getGroupOrThrow(groupId);

        boolean updated = false;

        if (req.getName() != null && !req.getName().isBlank() && !req.getName().equals(group.getName())) {
            group.setName(req.getName());
            updated = true;
        }
        if (req.getDescription() != null && !req.getDescription().equals(group.getDescription())) {
            group.setDescription(req.getDescription());
            updated = true;
        }
        if (req.getAvatar() != null && !req.getAvatar().equals(group.getAvatar())) {
            group.setAvatar(req.getAvatar());
            updated = true;
        }

        if (!updated) {
            log.info("⚠️ No changes detected for group {}", group.getId());
            return GroupMapper.toResponse(group);
        }

        group.setUpdatedAt(Instant.now());
        Group updatedGroup = chatGroupRepo.save(group);
        log.info("📝 Group {} updated by {} -> broadcasting realtime", updatedGroup.getName(), actor);

        // ✅ Cập nhật conversation name
        conversationRepo.findById(groupId).ifPresent(conv -> {
            conv.setLastMessage("Group info updated");
            conversationRepo.save(conv);
        });

        // ✅ Broadcast realtime tới tất cả thành viên trong DB
        try {
            ObjectNode event = mapper.createObjectNode();
            event.put("type", "group-updated");
            event.put("groupId", updatedGroup.getId());
            event.put("name", updatedGroup.getName());
            event.put("description", updatedGroup.getDescription());
            event.put("avatar", updatedGroup.getAvatar());
            event.put("updatedAt", updatedGroup.getUpdatedAt().toString());

            chatSessionRegistry.broadcastToGroupMembers(
                    updatedGroup.getId(),
                    updatedGroup.getMembers(),
                    event.toString()
            );

            log.info("📢 Broadcasted group-updated [{}] to {} members",
                    updatedGroup.getName(), updatedGroup.getMembers().size());

        } catch (Exception e) {
            log.error("❌ Failed to broadcast group update for {}: {}", groupId, e.getMessage(), e);
        }

        return GroupMapper.toResponse(updatedGroup);
    }

    public GroupResponse updateMemberRole(String groupId, UpdateMemberRoleRequest req) {
        validatePermission(req.getActor(), "CHATGROUP_PROMOTE_MEMBER");
        Group group = getGroupOrThrow(groupId);

        if (!group.getMembers().contains(req.getMemberEmail())) {
            throw new AppException(ErrorCode.USER_NOT_FOUND, "Member not found");
        }

        String encodedKey = MongoKeyUtil.encode(req.getMemberEmail());
        group.getRoleMap().put(encodedKey, req.getNewRole());
        group.setUpdatedAt(Instant.now());
        chatGroupRepo.save(group);

        // ✅ Broadcast realtime cho toàn nhóm khi role thay đổi
        try {
            ObjectNode event = mapper.createObjectNode();
            event.put("type", "group-role-updated");
            event.put("groupId", group.getId());
            event.put("email", req.getMemberEmail());
            event.put("newRole", req.getNewRole());
            event.put("updatedAt", group.getUpdatedAt().toString());

            chatSessionRegistry.broadcastToGroupMembers(
                    group.getId(),
                    group.getMembers(),
                    event.toString()
            );

            log.info("📢 Broadcasted role update [{} -> {}] in group {}",
                    req.getMemberEmail(), req.getNewRole(), group.getName());
        } catch (Exception e) {
            log.error("❌ Failed to broadcast role update: {}", e.getMessage());
        }

        return GroupMapper.toResponse(group);
    }


    public void deleteGroup(String groupId, String actor) {
        validatePermission(actor, "CHATGROUP_DELETE");
        Group group = getGroupOrThrow(groupId);
        chatGroupRepo.delete(group);
        conversationRepo.deleteById(groupId);
        log.info("🗑️ Deleted group {} and conversation by {}", groupId, actor);

        // ✅ Broadcast "group-deleted"
        ObjectNode event = mapper.createObjectNode();
        event.put("type", "group-deleted");
        event.put("groupId", groupId);
        chatSessionRegistry.broadcastToGroupMembers(groupId, group.getMembers(), event.toString());
    }

    public List<GroupResponse> getGroupsByUser(String email) {
        List<Group> groups = chatGroupRepo.findByMembersContaining(email);
        return groups.stream().map(GroupMapper::toResponse).collect(Collectors.toList());
    }

    // ============================================================
    // 💬 Realtime Group Chat Methods
    // ============================================================

    public Message saveGroupMessage(String groupId, String sender, String content) {
        Group group = getGroupOrThrow(groupId);

        if (!group.getMembers().contains(sender)) {
            throw new AppException(ErrorCode.FORBIDDEN, "Sender is not a member of group");
        }

        Instant now = Instant.now();

        // ✅ Lưu tin nhắn
        Message msg = Message.builder()
                .conversationId(groupId)
                .sender(sender)
                .content(content)
                .timestamp(now)
                .isGroup(true)
                .build();

        Message saved = messageRepo.save(msg);

        // ✅ Cập nhật conversation
        conversationRepo.findById(groupId).ifPresent(conv -> {
            conv.setLastMessage(content);
            conv.setLastMessageTime(now);
            conv.setLastSender(sender);
            // 🔗 Gọi sang ChatService để lấy display name
            conv.setLastSenderName(chatService.getDisplayNameByEmail(sender));

            // ✅ Cập nhật trạng thái đọc
            Map<String, Boolean> unread = conv.getUnreadMap() != null
                    ? new HashMap<>(conv.getUnreadMap())
                    : new HashMap<>();
            conv.getParticipants().forEach(u -> {
                String safeKey = MongoKeyUtil.encode(u);
                unread.put(safeKey, !u.equals(sender));
            });
            conv.setUnreadMap(unread);

            conversationRepo.save(conv);

            log.info("💾 Updated conversation [{}] → lastSender={}, lastSenderName={}, message='{}'",
                    conv.getId(), sender, conv.getLastSenderName(), content);
        });

        // ✅ Cập nhật metadata của group
        group.setUpdatedAt(now);
        chatGroupRepo.save(group);

        log.info("💬 Saved group message [{}] from {} in group {}", saved.getId(), sender, group.getName());
        return saved;
    }


    public List<Message> getGroupMessages(String groupId) {
        Group group = getGroupOrThrow(groupId);
        List<Message> messages = messageRepo.findByConversationIdOrderByTimestampAsc(groupId);
        log.info("📜 Loaded {} messages for group {}", messages.size(), group.getName());
        return messages;
    }

    // ============================================================
    // 🧩 Helper methods
    // ============================================================

    private Group getGroupOrThrow(String id) {
        return chatGroupRepo.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.BUSINESS_CONFLICT, "Group not found"));
    }

    private void validatePermission(String email, String permissionName) {
        User user = userRepo.findByEmail(email)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND, "User not found"));

        boolean hasPermission = user.getRoles().stream()
                .flatMap(r -> r.getPermissions().stream())
                .map(Permission::getName)
                .anyMatch(p -> p.equalsIgnoreCase(permissionName));

        if (!hasPermission) {
            throw new AppException(ErrorCode.FORBIDDEN, "Permission denied: " + permissionName);
        }
    }
}
