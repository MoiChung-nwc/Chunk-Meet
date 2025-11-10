package com.chung.webrtc.common.config;

import com.mongodb.client.model.IndexOptions;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bson.Document;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.mongodb.core.MongoTemplate;

import jakarta.annotation.PostConstruct;
import java.util.concurrent.TimeUnit;

@Slf4j
@Configuration
@RequiredArgsConstructor
public class MeetingTempMessageConfig {

    private final MongoTemplate mongoTemplate;

    @PostConstruct
    public void initTtlIndex() {
        try {
            if (!mongoTemplate.collectionExists("meeting_temp_messages")) {
                mongoTemplate.createCollection("meeting_temp_messages");
                log.info("Created collection meeting_temp_messages");
            }

            IndexOptions options = new IndexOptions()
                    .expireAfter(7L, TimeUnit.DAYS)
                    .name("expire_after_7_days");

            mongoTemplate.getCollection("meeting_temp_messages")
                    .createIndex(new Document("timestamp", 1), options);

            log.info("TTL index created for meeting_temp_messages (expireAfter=7 days)");
        } catch (Exception e) {
            log.error("Failed to create TTL index", e);
        }
    }
}