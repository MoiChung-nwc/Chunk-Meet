package com.chung.webrtc.file.service;

import com.chung.webrtc.common.exception.AppException;
import com.chung.webrtc.common.exception.ErrorCode;
import com.chung.webrtc.file.entity.MeetingTempFile;
import com.chung.webrtc.file.repository.MeetingTempFileRepository;
import com.mongodb.client.gridfs.model.GridFSFile;
import com.mongodb.client.gridfs.model.GridFSUploadOptions;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bson.types.ObjectId;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.gridfs.GridFsResource;
import org.springframework.data.mongodb.gridfs.GridFsTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class MeetingTempFileService {

    private final GridFsTemplate gridFsTemplate;
    private final MeetingTempFileRepository fileRepo;

    /** ✅ Upload file (tự xoá sau 7 ngày qua TTL) */
    public MeetingTempFile saveFile(String meetingCode, String uploader, MultipartFile file) throws IOException {
        if (file.isEmpty()) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "File không hợp lệ");
        }

        GridFSUploadOptions options = new GridFSUploadOptions()
                .metadata(new org.bson.Document("meetingCode", meetingCode)
                        .append("uploader", uploader)
                        .append("mimeType", file.getContentType()));

        ObjectId gridFsId = gridFsTemplate.store(
                file.getInputStream(),
                file.getOriginalFilename(),
                file.getContentType(),
                options.getMetadata()
        );

        MeetingTempFile entity = MeetingTempFile.builder()
                .meetingCode(meetingCode)
                .uploader(uploader)
                .fileName(file.getOriginalFilename())
                .fileSize(file.getSize())
                .mimeType(file.getContentType())
                .gridFsId(gridFsId.toHexString()) // ✅ Lưu đúng ObjectId hex string
                .timestamp(Instant.now())
                .build();

        MeetingTempFile saved = fileRepo.save(entity);
        log.info("💾 Saved meeting file [{}] by {} ({} bytes)", entity.getFileName(), uploader, entity.getFileSize());
        return saved;
    }

    /** 📜 Lấy danh sách file của meeting */
    public List<MeetingTempFile> getFilesByMeeting(String meetingCode) {
        return fileRepo.findByMeetingCodeOrderByTimestampAsc(meetingCode);
    }

    /** 📄 Lấy metadata file */
    public Optional<MeetingTempFile> getFileMeta(String id) {
        return fileRepo.findById(id);
    }

    /** 📥 Download file từ GridFS */
    public byte[] downloadFile(String id) throws IOException {
        MeetingTempFile meta = fileRepo.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.BUSINESS_CONFLICT, "File không tồn tại"));

        ObjectId objectId;
        try {
            objectId = new ObjectId(meta.getGridFsId());
        } catch (IllegalArgumentException e) {
            throw new AppException(ErrorCode.BUSINESS_CONFLICT, "Invalid GridFS ObjectId: " + meta.getGridFsId());
        }

        GridFSFile gridFsFile = gridFsTemplate.findOne(Query.query(Criteria.where("_id").is(objectId)));
        if (gridFsFile == null) {
            throw new AppException(ErrorCode.INTERNAL_SERVER_ERROR,
                    "GridFs resource [" + meta.getGridFsId() + "] does not exist.");
        }

        GridFsResource resource = gridFsTemplate.getResource(gridFsFile);
        return resource.getInputStream().readAllBytes();
    }

    /** 🗑️ Xóa file thủ công (Admin/Host) */
    public void deleteFile(String id) {
        fileRepo.findById(id).ifPresent(meta -> {
            try {
                gridFsTemplate.delete(Query.query(Criteria.where("_id").is(new ObjectId(meta.getGridFsId()))));
                fileRepo.deleteById(id);
                log.info("🗑️ Deleted meeting file [{}] ({})", meta.getFileName(), meta.getMeetingCode());
            } catch (Exception e) {
                log.error("❌ Failed to delete file {}: {}", meta.getFileName(), e.getMessage());
            }
        });
    }
}
