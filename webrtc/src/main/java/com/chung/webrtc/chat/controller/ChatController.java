package com.chung.webrtc.chat.controller;

import com.chung.webrtc.chat.entity.Conversation;
import com.chung.webrtc.chat.entity.Message;
import com.chung.webrtc.chat.service.ChatService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/chat")
@RequiredArgsConstructor
public class ChatController {

    private final ChatService chatService;

    @GetMapping("/{conversationId}")
    public ResponseEntity<List<Message>> getChatHistory(@PathVariable String conversationId) {
        return ResponseEntity.ok(chatService.getMessages(conversationId));
    }

    @PostMapping("/conversation")
    public ResponseEntity<Conversation> createOrGetConversation(@RequestParam String userA, @RequestParam String userB) {
        return ResponseEntity.ok(chatService.getOrCreateConversation(userA, userB));
    }
}