import { useEffect, useState } from "react";
import { wsManager } from "../utils/WebSocketManager";

export const useChat = (token) => {
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    if (!token) return;
    wsManager.connect("/ws/chat", token, (msg) => {
      setMessages((prev) => [...prev, msg]);
    });
  }, [token]);

  const send = (data) => wsManager.send(data, "/ws/chat");

  return { messages, send };
};
