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
public class MeetingTempFileConfig {

    private final MongoTemplate mongoTemplate;

    @PostConstruct
    public void ensureTTLIndex() {
        try {
            if (!mongoTemplate.collectionExists("meeting_temp_files")) {
                mongoTemplate.createCollection("meeting_temp_files");
                log.info("Created collection meeting_temp_files");
            }

            IndexOptions options = new IndexOptions()
                    .expireAfter(7L, TimeUnit.DAYS)
                    .name("expire_after_7_days");

            mongoTemplate.getCollection("meeting_temp_files")
                    .createIndex(new Document("timestamp", 1), options);

            log.info("TTL index created for meeting_temp_files (expireAfter=7 days)");
        } catch (Exception e) {
            log.error("Failed to create TTL index for meeting_temp_files", e);
        }
    }
}