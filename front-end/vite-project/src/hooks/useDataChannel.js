import { useEffect, useRef, useState } from "react";
import { useNotify } from "./useNotify";

/**
 * useDataChannel
 * Quản lý DataChannel giữa các peer WebRTC (P2P message, file, signal sync)
 */
export const useDataChannel = ({ pcRef, peerEmail, onMessage, logger }) => {
  const notify = useNotify();
  const [isOpen, setIsOpen] = useState(false);
  const channelRef = useRef(null);

  const createDataChannel = () => {
    if (!pcRef.current) {
      notify.error("❌ Không tìm thấy kết nối WebRTC");
      return;
    }

    logger?.log("dataChannelCreate", `🎯 to=${peerEmail}`);
    const channel = pcRef.current.createDataChannel("webrtc-data");
    setupChannel(channel);
    channelRef.current = channel;
  };

  const setupChannel = (channel) => {
    channel.binaryType = "arraybuffer";

    channel.onopen = () => {
      setIsOpen(true);
      notify.success("📡 DataChannel connected");
      logger?.log("dataChannelOpen", "✅ DataChannel opened");
    };

    channel.onclose = () => {
      setIsOpen(false);
      notify.warning("🔌 DataChannel disconnected");
      logger?.log("dataChannelClose", "closed");
    };

    channel.onerror = (err) => {
      notify.error("❌ Lỗi DataChannel");
      logger?.log("dataChannelError", err.message);
    };

    channel.onmessage = (event) => {
      try {
        let data = event.data;
        if (typeof data === "string") data = JSON.parse(data);
        onMessage?.(data);
        logger?.log("dataChannelMessage", data.type || "binary");
      } catch (err) {
        logger?.log("dataChannelMessageError", err.message);
      }
    };
  };

  useEffect(() => {
    const pc = pcRef.current;
    if (!pc) return;
    pc.ondatachannel = (event) => {
      logger?.log("dataChannelReceived", "📩 from remote");
      setupChannel(event.channel);
      channelRef.current = event.channel;
    };
  }, [pcRef.current]);

  const sendData = (data) => {
    const channel = channelRef.current;
    if (!channel || channel.readyState !== "open") {
      notify.info("⚠️ Kênh dữ liệu chưa sẵn sàng");
      return false;
    }
    try {
      const payload =
        typeof data === "string" || data instanceof ArrayBuffer
          ? data
          : JSON.stringify(data);
      channel.send(payload);
      logger?.log("dataChannelSend", data.type || "binary");
      return true;
    } catch (err) {
      notify.error("❌ Lỗi gửi dữ liệu");
      logger?.log("dataChannelSendError", err.message);
      return false;
    }
  };

  const closeChannel = () => {
    const channel = channelRef.current;
    if (channel) {
      channel.close();
      channelRef.current = null;
      setIsOpen(false);
      notify.neutral("🛑 DataChannel closed");
      logger?.log("dataChannelClosed");
    }
  };

  return {
    isOpen,
    sendData,
    createDataChannel,
    closeChannel,
    channelRef,
  };
};
