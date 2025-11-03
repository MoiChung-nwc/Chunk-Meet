import React, { useEffect, useState, useRef, useCallback } from "react";
import { IoSend, IoArrowBackSharp } from "react-icons/io5";
import axios from "axios";
import { wsChatManager } from "../../utils/WebSocketManager";

const ChatWindow = ({ user, onBack }) => {
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const lastTypingSentRef = useRef(0);

  const token = sessionStorage.getItem("accessToken");
  const email =
    sessionStorage.getItem("email") ||
    JSON.parse(localStorage.getItem("user") || "{}").email;

  // 🧠 Connect to WebSocket
  useEffect(() => {
    if (!user?.conversationId) return;

    const connect = async () => {
      try {
        await wsChatManager.connect("/ws/chat", token, handleMessage);
        wsChatManager.send(
          { type: "join", conversationId: user.conversationId },
          "/ws/chat"
        );

        // ✅ Mark conversation as read when opened
        markConversationAsRead(user.conversationId);
      } catch (err) {
        console.error("❌ Chat WS connect error:", err);
      }
    };

    connect();
    return () => wsChatManager.disconnect("/ws/chat", "Leaving chat");
  }, [user]);

  /** ✅ Mark messages as read in backend */
  const markConversationAsRead = async (conversationId) => {
    try {
      await axios.put(
        `http://localhost:8081/api/chat/mark-read?conversationId=${conversationId}&email=${email}`,
        null,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // 🧩 Gửi event qua WebSocket để sidebar cập nhật realtime
      wsChatManager.send(
        { type: "read-update", conversationId, reader: email },
        "/ws/chat"
      );
    } catch (err) {
      console.error("⚠️ Lỗi markAsRead:", err);
    }
  };

  // 📩 Handle messages from WebSocket
  const handleMessage = (msg) => {
    switch (msg.type) {
      case "chat-history":
        setMessages(msg.messages || []);
        break;

      case "chat":
        if (msg.conversationId === user.conversationId) {
          setMessages((prev) => [...prev, msg]);
        }
        break;

      case "typing":
        if (msg.from === user.email) {
          setIsTyping(true);
          clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 2000);
        }
        break;

      // 👇 NEW: update online / offline / last seen
      case "user-status":
        if (msg.email === user.email) {
          setIsOnline(msg.online);
          setLastSeen(msg.lastSeen || null);
        }
        break;

      // 👇 NEW: handle read update realtime
      case "read-update":
        if (msg.conversationId === user.conversationId) {
          console.log("📖 Tin nhắn đã đọc bởi:", msg.reader);
        }
        break;

      default:
        console.log("📨 WS:", msg);
    }
  };

  // 🕐 Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ✍️ Send typing event (debounced)
  const sendTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingSentRef.current > 1500) {
      lastTypingSentRef.current = now;
      wsChatManager.send(
        { type: "typing", conversationId: user.conversationId, from: email },
        "/ws/chat"
      );
    }
  }, [user?.conversationId, email]);

  // 📤 Send chat message
  const sendMessage = () => {
    if (!newMsg.trim()) return;
    wsChatManager.send(
      {
        type: "chat",
        conversationId: user.conversationId,
        message: newMsg.trim(),
      },
      "/ws/chat"
    );
    setNewMsg("");
  };

  // 🧩 Render user status text (no UI change)
  const renderStatusText = () => {
    if (isTyping) return "Đang nhập...";
    if (isOnline) return "Đang hoạt động";
    if (lastSeen)
      return `Hoạt động ${new Date(lastSeen).toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
      })}`;
    return "Ngoại tuyến";
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-200 bg-gray-50">
        <button
          onClick={onBack}
          className="md:hidden text-gray-500 hover:text-gray-700"
        >
          <IoArrowBackSharp size={22} />
        </button>
        <img
          src="https://cdn-icons-png.flaticon.com/512/3135/3135715.png"
          alt={user.name}
          className="w-10 h-10 rounded-full"
        />
        <div>
          <p className="font-semibold text-gray-800">
            {user.firstName || user.name}
          </p>
          <p className="text-xs text-gray-500">{renderStatusText()}</p>
        </div>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto p-5 bg-gradient-to-b from-gray-50 to-white space-y-2">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${
              msg.sender === email ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[75%] px-4 py-2 rounded-2xl text-sm ${
                msg.sender === email
                  ? "bg-blue-600 text-white rounded-br-none"
                  : "bg-gray-200 text-gray-800 rounded-bl-none"
              }`}
            >
              {msg.message}
              <span className="block text-[10px] mt-1 opacity-70 text-right">
                {new Date(msg.timestamp).toLocaleTimeString("vi-VN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex justify-start">
            <div className="px-4 py-2 rounded-2xl bg-gray-200 text-gray-600 text-sm flex gap-1">
              <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></span>
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-150"></span>
              <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce delay-300"></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef}></div>
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200 bg-white flex items-center gap-3">
        <input
          type="text"
          value={newMsg}
          onChange={(e) => {
            setNewMsg(e.target.value);
            sendTyping();
          }}
          placeholder="Nhập tin nhắn..."
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          className="flex-1 px-4 py-2 bg-gray-100 rounded-full outline-none text-sm focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={sendMessage}
          className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition"
        >
          <IoSend size={18} />
        </button>
      </div>
    </div>
  );
};

export default ChatWindow;
