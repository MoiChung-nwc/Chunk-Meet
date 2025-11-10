import { useState } from "react";
import { useNotify } from "./useNotify";

/**
 * useScreenShare
 * Quản lý chia sẻ màn hình qua WebRTC
 */
export const useScreenShare = ({ pcRef, localStreamRef, sendData, logger }) => {
  const notify = useNotify();
  const [isSharing, setIsSharing] = useState(false);

  const startScreenShare = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });

      const screenTrack = screenStream.getVideoTracks()[0];
      const pc = pcRef.current;
      const sender = pc.getSenders().find((s) => s.track?.kind === "video");

      if (sender) await sender.replaceTrack(screenTrack);
      sendData?.({ type: "SHARE_START" });
      setIsSharing(true);
      notify.info("🖥️ Đang chia sẻ màn hình");

      screenTrack.onended = stopScreenShare;
      logger?.log("screenShareStart", "✅ Screen sharing started");
    } catch (err) {
      notify.error("❌ Không thể chia sẻ màn hình");
      logger?.log("screenShareError", err.message);
    }
  };

  const stopScreenShare = async () => {
    try {
      const pc = pcRef.current;
      const cameraTrack = localStreamRef.current?.getVideoTracks()?.[0];
      const sender = pc.getSenders().find((s) => s.track?.kind === "video");

      if (sender && cameraTrack) await sender.replaceTrack(cameraTrack);

      sendData?.({ type: "SHARE_STOP" });
      setIsSharing(false);
      notify.neutral("🛑 Đã dừng chia sẻ màn hình");
      logger?.log("screenShareStop", "🛑 Screen sharing stopped");
    } catch (err) {
      notify.error("❌ Lỗi khi dừng chia sẻ");
      logger?.log("screenShareStopError", err.message);
    }
  };

  return { isSharing, startScreenShare, stopScreenShare };
};
