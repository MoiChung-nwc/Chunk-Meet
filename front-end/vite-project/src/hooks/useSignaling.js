import { useEffect, useRef } from "react";
import { wsManager } from "../utils/WebSocketManager";

/**
 * ✅ useSignaling (Refactored)
 * - Tự động giữ kết nối signaling nếu đang trong cuộc gọi
 * - Dọn dẹp an toàn khi thoát ra ngoài
 */
export const useSignaling = (token, onMessage) => {
  const socketReady = useRef(Promise.resolve());

  useEffect(() => {
    if (!token) {
      console.warn("[useSignaling] ⚠️ Missing token, skipping connect");
      return;
    }

    console.log(`[useSignaling] 🔌 Connecting to signaling (mount) with token len=${token.length}`);

    const connect = async () => {
      try {
        socketReady.current = wsManager.connect("/ws/signaling", token, (msg) => {
          console.log("[Signaling] ←", msg);
          onMessage?.(msg);
        });
      } catch (e) {
        console.error("[useSignaling] ❌ Failed to connect signaling", e);
      }
    };

    connect();

    return () => {
      console.log(`[useSignaling] 🧹 Cleanup triggered at ${Date.now()}`);

      if (window.isInCall) {
        console.log("[useSignaling] ⚙️ Keeping signaling alive (in-call)");
        return;
      }

      console.log("[useSignaling] ❌ Closing signaling (not in call)");
      wsManager.close("/ws/signaling");
    };
  }, [token, onMessage]);

  const send = (data) => wsManager.send(data, "/ws/signaling");
  const ready = socketReady.current;

  return { send, ready };
};
