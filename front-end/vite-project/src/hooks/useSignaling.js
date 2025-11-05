import { useEffect, useRef } from "react";
import { wsManager } from "../utils/WebSocketManager";
import { useNavigate } from "react-router-dom";

export const useSignaling = (token, onMessage) => {
  const socketReady = useRef(Promise.resolve());
  const navigate = useNavigate();
  const ts = () => new Date().toLocaleTimeString("vi-VN");

  useEffect(() => {
    if (!token) {
      console.warn(`[useSignaling ${ts()}] ⚠️ Missing token, skipping connect`);
      return;
    }

    console.log(`[useSignaling ${ts()}] 🔌 Connecting signaling with token`);
    const connect = async () => {
      try {
        socketReady.current = wsManager.connect("/ws/signaling", token, (msg) => {
          console.log(`[useSignaling ${ts()}] ←`, msg);
          onMessage?.(msg);
        });
      } catch (e) {
        console.error(`[useSignaling ${ts()}] ❌ Connect signaling failed`, e);
      }
    };
    connect();

    return () => {
      console.log(`[useSignaling ${ts()}] 🧹 Cleanup triggered`);

      if (window.isInCall) {
        console.log(`[useSignaling ${ts()}] ⚙️ Still in call, keep signaling`);
        return;
      }

      wsManager.disconnect("/ws/signaling", "end-call");
      const origin = sessionStorage.getItem("callOrigin");
      console.log(`[useSignaling ${ts()}] 🔍 Origin: ${origin}`);

      if (origin === "chat") {
        console.log(`[useSignaling ${ts()}] 🔙 Back to /chat`);
        sessionStorage.setItem("reloadChatAfterCall", "true");
        navigate("/chat");
      } else if (origin === "dashboard") {
        console.log(`[useSignaling ${ts()}] 🔙 Back to /dashboard`);
        navigate("/dashboard");
      } else {
        console.log(`[useSignaling ${ts()}] ⚠️ Unknown origin`);
      }

      sessionStorage.removeItem("callOrigin");
    };
  }, [token, onMessage, navigate]);

  const send = (data) => wsManager.send(data, "/ws/signaling");
  const ready = socketReady.current;
  return { send, ready };
};
