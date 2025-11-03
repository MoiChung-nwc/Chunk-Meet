package com.chung.webrtc.chat.repository;

import com.chung.webrtc.chat.entity.Conversation;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;
import java.util.Set;

public interface ConversationRepository extends MongoRepository<Conversation, String> {
    Optional<Conversation> findByParticipants(Set<String> participants);
}
