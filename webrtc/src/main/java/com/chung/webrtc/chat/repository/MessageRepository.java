package com.chung.webrtc.chat.repository;

import com.chung.webrtc.chat.entity.Message;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface MessageRepository extends MongoRepository<Message, String> {
    List<Message> findByConversationIdOrderByTimestampAsc(String conversationId);

    Optional<Message> findTopByConversationIdOrderByTimestampDesc(String conversationId);
}