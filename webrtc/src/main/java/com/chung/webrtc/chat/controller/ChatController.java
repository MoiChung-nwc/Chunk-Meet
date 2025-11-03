package com.chung.webrtc.chat.controller;

import com.chung.webrtc.chat.entity.Conversation;
import com.chung.webrtc.chat.entity.Message;
import com.chung.webrtc.chat.service.ChatService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/chat")
@RequiredArgsConstructor
public class ChatController {

    private final ChatService chatService;

    /** 📜 Lấy lịch sử chat theo conversationId */
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

    /** 🆕 Lấy danh sách conversation của 1 user (đã decode unreadMap + sort mới nhất) */
    @GetMapping("/my-conversations")
    public ResponseEntity<List<Map<String, Object>>> getMyConversations(@RequestParam String email) {
        List<Conversation> conversations = chatService.getConversationsByUser(email);

        List<Map<String, Object>> response = conversations.stream()
                .map(conv -> {
                    Map<String, Object> map = new HashMap<>();
                    map.put("id", conv.getId());
                    map.put("participants", conv.getParticipants());
                    map.put("type", conv.getType());
                    map.put("createdAt", conv.getCreatedAt());
                    map.put("lastMessage", conv.getLastMessage());
                    map.put("unreadMap", chatService.decodeUnreadMap(conv.getUnreadMap())); // ✅ decode key email
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

    /** ✅ Đánh dấu cuộc trò chuyện đã đọc */
    @PutMapping("/mark-read")
    public ResponseEntity<Void> markAsRead(
            @RequestParam String conversationId,
            @RequestParam String email
    ) {
        chatService.markAsRead(conversationId, email);
        return ResponseEntity.ok().build();
    }
}
