package com.chung.webrtc.common.util;

import java.util.*;
import java.util.stream.Collectors;

public final class MongoKeyUtil {

    private MongoKeyUtil() {}

    /** ✅ Encode key an toàn cho MongoDB (ví dụ email) */
    public static String encode(String key) {
        if (key == null) return null;
        return key.replace(".", "_dot_").replace("@", "_at_");
    }

    /** ✅ Decode key về lại giá trị gốc */
    public static String decode(String encodedKey) {
        if (encodedKey == null) return null;
        return encodedKey.replace("_dot_", ".").replace("_at_", "@");
    }

    /** ✅ Encode toàn bộ Map key */
    public static <V> Map<String, V> encodeMap(Map<String, V> original) {
        if (original == null) return null;
        return original.entrySet().stream()
                .collect(Collectors.toMap(
                        e -> encode(e.getKey()),
                        Map.Entry::getValue
                ));
    }

    /** ✅ Decode toàn bộ Map key */
    public static <V> Map<String, V> decodeMap(Map<String, V> encoded) {
        if (encoded == null) return null;
        return encoded.entrySet().stream()
                .collect(Collectors.toMap(
                        e -> decode(e.getKey()),
                        Map.Entry::getValue
                ));
    }

    /** ✅ Encode Set<String> */
    public static Set<String> encodeSet(Set<String> original) {
        if (original == null) return null;
        return original.stream()
                .map(MongoKeyUtil::encode)
                .collect(Collectors.toSet());
    }

    /** ✅ Decode Set<String> */
    public static Set<String> decodeSet(Set<String> encoded) {
        if (encoded == null) return null;
        return encoded.stream()
                .map(MongoKeyUtil::decode)
                .collect(Collectors.toSet());
    }

    /** ✅ Encode List<String> */
    public static List<String> encodeList(List<String> original) {
        if (original == null) return null;
        return original.stream()
                .map(MongoKeyUtil::encode)
                .collect(Collectors.toList());
    }

    /** ✅ Decode List<String> */
    public static List<String> decodeList(List<String> encoded) {
        if (encoded == null) return null;
        return encoded.stream()
                .map(MongoKeyUtil::decode)
                .collect(Collectors.toList());
    }

    /** ✅ Kiểm tra nhanh key đã encode chưa */
    public static boolean isEncoded(String key) {
        return key != null && (key.contains("_dot_") || key.contains("_at_"));
    }
}
