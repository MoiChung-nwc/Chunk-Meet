package com.chung.webrtc.file.entity;

import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "meeting_temp_files")
public class MeetingTempFile {

    @Id
    private String id;

    private String meetingCode;

    private String uploader;

    private String fileName;

    private long fileSize;

    private String mimeType;

    private String gridFsId;

    @CreatedDate
    private Instant timestamp;
}
