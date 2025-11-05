package com.chung.webrtc.chat.repository;

import com.chung.webrtc.chat.entity.Conversation;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;

import java.util.List;
import java.util.Optional;

/**
 * Repository cho collection "conversation"
 * Hỗ trợ truy vấn các cuộc trò chuyện 1-1 và nhóm.
 */
public interface ConversationRepository extends MongoRepository<Conversation, String> {

    /**
     * ✅ FIXED: Tìm cuộc trò chuyện 1-1 giữa 2 người (bất kể thứ tự)
     * MongoDB hỗ trợ $and để kết hợp $all + $size.
     */
    @Query(value = "{ $and: [ { 'participants': { $all: [?0, ?1] } }, { 'participants': { $size: 2 } }, { 'type': 'DIRECT' } ] }")
    Optional<Conversation> findDirectBetween(String userA, String userB);

    /**
     * 🔹 Lấy tất cả cuộc trò chuyện có user tham gia
     */
    List<Conversation> findByParticipantsContaining(String email);
}
