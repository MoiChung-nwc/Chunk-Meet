package com.chung.webrtc.chat.repository;

import com.chung.webrtc.chat.entity.Conversation;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;

import java.util.List;
import java.util.Optional;

public interface ConversationRepository extends MongoRepository<Conversation, String> {

    /**
     * 🔍 Tìm cuộc trò chuyện 1-1 giữa 2 người (bất kể thứ tự)
     * $all: chứa cả 2 user
     * $size: đúng 2 phần tử
     * type: DIRECT
     */
    @Query(value = "{ 'participants': { $all: [?0, ?1], $size: 2 }, 'type': 'DIRECT' }")
    Optional<Conversation> findDirectBetween(String userA, String userB);

    List<Conversation> findByParticipantsContaining(String email);

}
