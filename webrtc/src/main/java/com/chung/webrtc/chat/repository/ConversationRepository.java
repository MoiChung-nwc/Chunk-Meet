package com.chung.webrtc.chat.repository;

import com.chung.webrtc.chat.entity.Conversation;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;

import java.util.List;
import java.util.Optional;

/**
 * Repository cho collection "conversation"
 * Hỗ trợ truy vấn các cuộc trò chuyện 1-1, nhóm, và meeting.
 */
public interface ConversationRepository extends MongoRepository<Conversation, String> {

    /**
     * ✅ FIXED: Tìm cuộc trò chuyện 1-1 giữa 2 người (bất kể thứ tự)
     */
    @Query(value = "{ $and: [ { 'participants': { $all: [?0, ?1] } }, { 'participants': { $size: 2 } }, { 'type': 'DIRECT' } ] }")
    Optional<Conversation> findDirectBetween(String userA, String userB);

    /**
     * 🔹 Lấy tất cả cuộc trò chuyện có user tham gia (bao gồm cả MEETING)
     */
    List<Conversation> findByParticipantsContaining(String email);

    /**
     * 🚫 Loại bỏ các cuộc họp (type != MEETING)
     * Dùng cho ChatPage để chỉ hiển thị DIRECT / GROUP
     */
    @Query(value = "{ 'participants': ?0, 'type': { $ne: 'MEETING' } }")
    List<Conversation> findNonMeetingConversations(String email);

    /**
     * 🔍 Lấy danh sách conversation theo loại
     * Ví dụ: "DIRECT", "GROUP", "MEETING"
     */
    List<Conversation> findByParticipantsContainingAndType(String email, String type);
}
