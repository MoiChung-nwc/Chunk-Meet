package com.chung.webrtc.chat.repository;

import com.chung.webrtc.chat.entity.Group;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface ChatGroupRepository extends MongoRepository<Group, String> {
    List<Group> findByMembersContaining(String email);
}