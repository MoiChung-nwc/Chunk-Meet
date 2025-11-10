package com.chung.webrtc.chat.service;

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
import com.chung.webrtc.common.util.PermissionUtil;
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
    private final ChatSessionRegistry chatSessionRegistry;
    private final ChatService chatService;
    private final PermissionUtil permissionUtil;
    private final ObjectMapper mapper = new ObjectMapper();

    // ============================================================
    // 🚀 GROUP MANAGEMENT
    // ============================================================

    public GroupResponse createGroup(CreateGroupRequest req) {
        permissionUtil.validatePermission(req.getCreatedBy(), "CHATGROUP_CREATE");

        if (req.getName() == null || req.getName().isBlank()) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "Group name is required");
        }

        Set<String> members = Optional.ofNullable(req.getMembers())
                .map(HashSet::new)
                .orElse(new HashSet<>());
        members.remove(req.getCreatedBy());

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

        group.addMember(req.getCreatedBy(), "ADMIN");
        members.forEach(m -> group.addMember(m, "USER"));

        Group saved = chatGroupRepo.save(group);

        // Tạo conversation tương ứng
        if (!saved.getMembers().isEmpty()) {
            Conversation conv = Conversation.builder()
                    .id(saved.getId())
                    .type(ConversationType.GROUP)
                    .participants(new HashSet<>(saved.getMembers()))
                    .createdAt(saved.getCreatedAt())
                    .unreadMap(new HashMap<>())
                    .build();
            conversationRepo.save(conv);
            log.info("✅ Created group [{}] with {} members", saved.getName(), saved.getMembers().size());
        }

        broadcastEventToGroup(saved.getId(), saved.getMembers(), buildGroupEvent("group-created", saved));
        return GroupMapper.toResponse(saved);
    }

    public GroupResponse addMember(String groupId, AddMemberRequest req) {
        permissionUtil.validatePermission(req.getActor(), "CHATGROUP_ADD_MEMBER");

        Group group = getGroupOrThrow(groupId);
        if (group.getMembers().contains(req.getMemberEmail())) {
            throw new AppException(ErrorCode.BUSINESS_CONFLICT, "User already in group");
        }

        group.addMember(req.getMemberEmail(), req.getRoleName());
        group.setUpdatedAt(Instant.now());
        chatGroupRepo.save(group);

        conversationRepo.findById(groupId).ifPresent(conv -> {
            conv.getParticipants().add(req.getMemberEmail());
            conversationRepo.save(conv);
        });

        broadcastEventToGroup(groupId, group.getMembers(),
                simpleEvent("group-member-added", groupId, req.getMemberEmail(), req.getRoleName()));

        // Gửi riêng thông tin nhóm cho user mới
        chatSessionRegistry.sendToUser(req.getMemberEmail(),
                buildGroupEvent("group-created", group).toString());

        return GroupMapper.toResponse(group);
    }

    public GroupResponse removeMember(String groupId, RemoveMemberRequest req) {
        permissionUtil.validatePermission(req.getActor(), "CHATGROUP_REMOVE_MEMBER");

        Group group = getGroupOrThrow(groupId);
        if (!group.getMembers().contains(req.getMemberEmail())) {
            throw new AppException(ErrorCode.USER_NOT_FOUND, "Member not found in group");
        }

        group.removeMember(req.getMemberEmail());
        group.setUpdatedAt(Instant.now());
        chatGroupRepo.save(group);

        conversationRepo.findById(groupId).ifPresent(conv -> {
            conv.getParticipants().remove(req.getMemberEmail());
            conversationRepo.save(conv);
        });

        broadcastEventToGroup(groupId, group.getMembers(),
                simpleEvent("group-member-removed", groupId, req.getMemberEmail(), null));

        return GroupMapper.toResponse(group);
    }

    public GroupResponse updateGroup(String groupId, String actor, UpdateGroupRequest req) {
        permissionUtil.validatePermission(actor, "CHATGROUP_UPDATE_INFO");

        Group group = getGroupOrThrow(groupId);
        boolean updated = false;

        if (isChanged(req.getName(), group.getName())) {
            group.setName(req.getName());
            updated = true;
        }
        if (isChanged(req.getDescription(), group.getDescription())) {
            group.setDescription(req.getDescription());
            updated = true;
        }
        if (isChanged(req.getAvatar(), group.getAvatar())) {
            group.setAvatar(req.getAvatar());
            updated = true;
        }

        if (!updated) {
            log.info("⚠️ No changes detected for group {}", groupId);
            return GroupMapper.toResponse(group);
        }

        group.setUpdatedAt(Instant.now());
        Group updatedGroup = chatGroupRepo.save(group);

        conversationRepo.findById(groupId).ifPresent(conv -> {
            conv.setLastMessage("Group info updated");
            conversationRepo.save(conv);
        });

        broadcastEventToGroup(groupId, group.getMembers(), buildGroupEvent("group-updated", updatedGroup));
        return GroupMapper.toResponse(updatedGroup);
    }

    public GroupResponse updateMemberRole(String groupId, UpdateMemberRoleRequest req) {
        permissionUtil.validatePermission(req.getActor(), "CHATGROUP_PROMOTE_MEMBER");

        Group group = getGroupOrThrow(groupId);
        if (!group.getMembers().contains(req.getMemberEmail())) {
            throw new AppException(ErrorCode.USER_NOT_FOUND, "Member not found");
        }

        group.getRoleMap().put(MongoKeyUtil.encode(req.getMemberEmail()), req.getNewRole());
        group.setUpdatedAt(Instant.now());
        chatGroupRepo.save(group);

        broadcastEventToGroup(groupId, group.getMembers(),
                roleEvent("group-role-updated", groupId, req.getMemberEmail(), req.getNewRole()));

        return GroupMapper.toResponse(group);
    }

    public void deleteGroup(String groupId, String actor) {
        permissionUtil.validatePermission(actor, "CHATGROUP_DELETE");

        Group group = getGroupOrThrow(groupId);
        chatGroupRepo.delete(group);
        conversationRepo.deleteById(groupId);

        broadcastEventToGroup(groupId, group.getMembers(),
                simpleEvent("group-deleted", groupId, null, null));

        log.info("🗑️ Deleted group {} by {}", groupId, actor);
    }

    public List<GroupResponse> getGroupsByUser(String email) {
        return chatGroupRepo.findByMembersContaining(email)
                .stream()
                .map(GroupMapper::toResponse)
                .collect(Collectors.toList());
    }

    // ============================================================
    // 💬 Realtime Group Chat
    // ============================================================

    public Message saveGroupMessage(String groupId, String sender, String content) {
        permissionUtil.validatePermission(sender, "CHAT_SEND");

        Group group = getGroupOrThrow(groupId);
        if (!group.getMembers().contains(sender)) {
            throw new AppException(ErrorCode.FORBIDDEN, "Sender is not a member of group");
        }

        Instant now = Instant.now();
        Message msg = Message.builder()
                .conversationId(groupId)
                .sender(sender)
                .content(content)
                .timestamp(now)
                .isGroup(true)
                .build();

        Message saved = messageRepo.save(msg);

        conversationRepo.findById(groupId).ifPresent(conv -> updateConversation(conv, sender, content, now));

        group.setUpdatedAt(now);
        chatGroupRepo.save(group);

        return saved;
    }

    public List<Message> getGroupMessages(String groupId) {
        Group group = getGroupOrThrow(groupId);
        List<Message> messages = messageRepo.findByConversationIdOrderByTimestampAsc(groupId);
        log.info("📜 Loaded {} messages for group {}", messages.size(), group.getName());
        return messages;
    }

    // ============================================================
    // 💬 Meeting Chat Reuse
    // ============================================================

    public Message saveMeetingMessage(String meetingCode, String sender, String content) {
        permissionUtil.validatePermission(sender, "CHAT_SEND");

        Instant now = Instant.now();

        // ✅ Không lưu Message vào messageRepo (chỉ lưu Conversation metadata)
        conversationRepo.findById(meetingCode).ifPresentOrElse(conv -> {
            updateConversation(conv, sender, content, now);
        }, () -> {
            Conversation conv = Conversation.builder()
                    .id(meetingCode)
                    .type(ConversationType.MEETING)
                    .participants(Set.of(sender))
                    .createdAt(now)
                    .lastMessage(content)
                    .lastSender(sender)
                    .lastSenderName(chatService.getDisplayNameByEmail(sender))
                    .lastMessageTime(now)
                    .unreadMap(new HashMap<>())
                    .build();
            conversationRepo.save(conv);
        });

        // ⚠️ Không lưu thực vào messageRepo, chỉ trả message tạm để gửi realtime
        return Message.builder()
                .conversationId(meetingCode)
                .sender(sender)
                .content(content)
                .timestamp(now)
                .isGroup(true)
                .build();
    }

    public List<Message> getMeetingMessages(String meetingCode) {
        return messageRepo.findByConversationIdOrderByTimestampAsc(meetingCode);
    }

    // ============================================================
    // 🧩 Helpers
    // ============================================================

    private Group getGroupOrThrow(String id) {
        return chatGroupRepo.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.BUSINESS_CONFLICT, "Group not found"));
    }

    private void broadcastEventToGroup(String groupId, Set<String> members, ObjectNode event) {
        try {
            chatSessionRegistry.broadcastToGroupMembers(groupId, members, event.toString());
        } catch (Exception e) {
            log.error("❌ Failed to broadcast event [{}] for group {}: {}", event.get("type"), groupId, e.getMessage());
        }
    }

    private void updateConversation(Conversation conv, String sender, String content, Instant now) {
        conv.setLastMessage(content);
        conv.setLastMessageTime(now);
        conv.setLastSender(sender);
        conv.setLastSenderName(chatService.getDisplayNameByEmail(sender));

        Map<String, Boolean> unread = Optional.ofNullable(conv.getUnreadMap()).orElse(new HashMap<>());
        conv.getParticipants().forEach(u -> unread.put(MongoKeyUtil.encode(u), !u.equals(sender)));
        conv.setUnreadMap(unread);

        conversationRepo.save(conv);
    }

    private boolean isChanged(String newVal, String oldVal) {
        return newVal != null && !newVal.isBlank() && !newVal.equals(oldVal);
    }

    private ObjectNode buildGroupEvent(String type, Group group) {
        ObjectNode event = mapper.createObjectNode();
        event.put("type", type);
        event.put("groupId", group.getId());
        event.put("name", group.getName());
        event.put("description", group.getDescription());
        event.put("avatar", group.getAvatar());
        event.put("createdBy", group.getCreatedBy());
        event.put("createdAt", group.getCreatedAt().toString());
        event.putPOJO("members", group.getMembers());
        return event;
    }

    private ObjectNode simpleEvent(String type, String groupId, String email, String role) {
        ObjectNode event = mapper.createObjectNode();
        event.put("type", type);
        event.put("groupId", groupId);
        if (email != null) event.put("email", email);
        if (role != null) event.put("role", role);
        return event;
    }

    private ObjectNode roleEvent(String type, String groupId, String email, String newRole) {
        ObjectNode event = mapper.createObjectNode();
        event.put("type", type);
        event.put("groupId", groupId);
        event.put("email", email);
        event.put("newRole", newRole);
        event.put("updatedAt", Instant.now().toString());
        return event;
    }
}
