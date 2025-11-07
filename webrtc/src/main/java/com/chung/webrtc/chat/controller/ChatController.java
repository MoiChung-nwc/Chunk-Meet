package com.chung.webrtc.chat.controller;

import com.chung.webrtc.chat.entity.Conversation;
import com.chung.webrtc.chat.entity.Message;
import com.chung.webrtc.chat.service.ChatService;
import com.chung.webrtc.common.util.MongoKeyUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

/**
 * REST controller cho module chat 1-1 / nhóm.
 * Trả dữ liệu JSON cho frontend React.
 */
@RestController
@RequestMapping("/api/chat")
@RequiredArgsConstructor
public class ChatController {

    private final ChatService chatService;

    /** 📜 Lấy lịch sử tin nhắn của 1 conversation */
    @GetMapping("/{conversationId}")
    public ResponseEntity<List<Message>> getChatHistory(@PathVariable String conversationId) {
        return ResponseEntity.ok(chatService.getMessages(conversationId));
    }

    /** 🧩 Tạo hoặc lấy conversation giữa 2 user */
    @PostMapping("/conversation")
    public ResponseEntity<Conversation> createOrGetConversation(
            @RequestParam String userA,
            @RequestParam String userB
    ) {
        return ResponseEntity.ok(chatService.getOrCreateConversation(userA, userB));
    }

    /** 🆕 Lấy danh sách conversation của user (đã decode participants + unreadMap + sort) */
    @GetMapping("/my-conversations")
    public ResponseEntity<List<Map<String, Object>>> getMyConversations(@RequestParam String email) {
        List<Conversation> conversations = chatService.getConversationsByUser(email);

        List<Map<String, Object>> response = conversations.stream()
                .map(conv -> {
                    Map<String, Object> map = new HashMap<>();
                    map.put("id", conv.getId());
                    map.put("type", conv.getType());
                    map.put("createdAt", conv.getCreatedAt());
                    map.put("lastMessage", conv.getLastMessage());
                    map.put("lastMessageTime", conv.getLastMessageTime());
                    map.put("unreadMap", chatService.decodeUnreadMap(conv.getUnreadMap()));

                    // ✅ NEW: thêm 2 trường người gửi cuối cùng
                    map.put("lastSender", conv.getLastSender());
                    map.put("lastSenderName", conv.getLastSenderName());

                    // ✅ Giải mã participants để frontend không bị undefined
                    Set<String> decodedParticipants = conv.getParticipants().stream()
                            .map(MongoKeyUtil::decode)
                            .collect(Collectors.toSet());
                    map.put("participants", decodedParticipants);

                    return map;
                })
                .sorted((a, b) -> {
                    Instant ta = (Instant) a.get("createdAt");
                    Instant tb = (Instant) b.get("createdAt");
                    return tb.compareTo(ta);
                })
                .collect(Collectors.toList());

        return ResponseEntity.ok(response);
    }

    /** ✅ Đánh dấu đã đọc 1 conversation */
    @PutMapping("/mark-read")
    public ResponseEntity<Void> markAsRead(
            @RequestParam String conversationId,
            @RequestParam String email
    ) {
        chatService.markAsRead(conversationId, email);
        return ResponseEntity.ok().build();
    }
}
