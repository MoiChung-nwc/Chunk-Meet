import React, { useState, useEffect } from "react";
import axios from "axios";
import { FaSearch, FaCircle } from "react-icons/fa";
import { wsChatManager } from "../../utils/WebSocketManager";

const ChatSidebar = ({ onSelectUser }) => {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState([]);
  const [recentChats, setRecentChats] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const token = sessionStorage.getItem("accessToken");
  const email =
    sessionStorage.getItem("email") ||
    JSON.parse(localStorage.getItem("user") || "{}").email;

  const ts = () => new Date().toLocaleTimeString("vi-VN");

  /** 📨 Lấy danh sách hội thoại */
  const fetchRecentChats = async () => {
    try {
      const res = await axios.get(
        `http://localhost:8081/api/chat/my-conversations?email=${email}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log(`[ChatSidebar ${ts()}] 📨 Loaded ${res.data.length} recent chats`);
      setRecentChats(res.data || []);
    } catch (err) {
      console.error(`[ChatSidebar ${ts()}] ❌ Load chat list error:`, err);
    }
  };

  useEffect(() => {
    fetchRecentChats();
  }, [email, token]);

  /** ♻️ Reload sau khi end call */
  useEffect(() => {
    const reload = sessionStorage.getItem("reloadChatAfterCall");
    if (reload === "true") {
      console.log(`[ChatSidebar ${ts()}] ♻️ Reloading recent chats after call`);
      sessionStorage.removeItem("reloadChatAfterCall");
      fetchRecentChats();

      // 🔄 Gửi request online users
      wsChatManager.send({ type: "request-online-users" }, "/ws/chat");

      // 🧩 Rejoin lại cuộc trò chuyện gần nhất
      const lastConv = JSON.parse(sessionStorage.getItem("lastConversation") || "null");
      if (lastConv?.id) {
        setTimeout(() => {
          console.log(`[ChatSidebar ${ts()}] 🔁 Rejoining last conversation ${lastConv.id}`);
          wsChatManager.send({ type: "join", conversationId: lastConv.id }, "/ws/chat");
        }, 1000);
      }
    }
  }, [email, token]);

  /** 🔌 Kết nối WS */
  useEffect(() => {
    if (!token) return;
    wsChatManager
      .connect(
        "/ws/chat",
        token,
        (data) => {
          console.log(`[ChatSidebar ${ts()}] 📨 WS message:`, data);
          try {
            if (data.type === "new-message") {
              const { conversationId, from, content, timestamp } = data;
              setRecentChats((prev) => {
                const idx = prev.findIndex((c) => c.id === conversationId);
                if (idx !== -1) {
                  const updated = [...prev];
                  const conv = { ...updated[idx] };
                  conv.lastMessage = content;
                  conv.lastSender = from;
                  conv.createdAt = timestamp;
                  conv.unreadMap = {
                    ...(conv.unreadMap || {}),
                    [email]: from !== email, // ✅ đánh dấu chưa đọc nếu người khác gửi
                  };
                  updated.splice(idx, 1);
                  return [conv, ...updated];
                } else {
                  return [
                    {
                      id: conversationId,
                      participants: [email, from],
                      createdAt: timestamp,
                      lastMessage: content,
                      lastSender: from,
                      unreadMap: { [email]: from !== email },
                    },
                    ...prev,
                  ];
                }
              });
            } else if (data.type === "online-users") {
              setOnlineUsers(new Set(data.users));
            } else if (data.type === "user-status") {
              setOnlineUsers((prev) => {
                const next = new Set(prev);
                data.online ? next.add(data.email) : next.delete(data.email);
                return next;
              });
            }
          } catch (err) {
            console.error(`[ChatSidebar ${ts()}] WS parse error:`, err);
          }
        },
        true
      )
      .catch((err) => console.error(`[ChatSidebar ${ts()}] ❌ WS connect error:`, err));
  }, [token, email]);

  /** 📞 Khi chọn user */
  const handleSelect = async (targetUser) => {
    try {
      const userEmail =
        targetUser.email ||
        (targetUser.participants
          ? [...targetUser.participants].find((p) => p !== email)
          : null);

      if (!userEmail || userEmail === "undefined") {
        console.warn(`[ChatSidebar ${ts()}] ⚠️ Invalid target user`, targetUser);
        return;
      }

      const res = await axios.post(
        `http://localhost:8081/api/chat/conversation?userA=${email}&userB=${userEmail}`,
        null,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const conversation = res.data;
      console.log(`[ChatSidebar ${ts()}] ✅ Open chat with ${userEmail} (${conversation.id})`);

      sessionStorage.setItem("lastConversation", JSON.stringify(conversation));

      // ✅ đánh dấu đã đọc khi click
      setRecentChats((prev) =>
        prev.map((c) =>
          c.id === conversation.id
            ? { ...c, unreadMap: { ...(c.unreadMap || {}), [email]: false } }
            : c
        )
      );

      onSelectUser({
        email: userEmail,
        firstName: targetUser.firstName || userEmail,
        conversationId: conversation.id,
      });

      wsChatManager.send(
        { type: "read-update", conversationId: conversation.id },
        "/ws/chat"
      );
    } catch (err) {
      console.error(`[ChatSidebar ${ts()}] ❌ handleSelect error:`, err);
    }
  };

  /** 🧠 Hiển thị preview tin nhắn cuối */
  const renderLastMessage = (chat) => {
    if (!chat.lastMessage)
      return <span className="text-gray-400 text-xs">Chưa có tin nhắn</span>;

    const fromMe = chat.lastSender === email;
    const unread = chat.unreadMap?.[email];

    const previewText = fromMe
      ? `Bạn: ${chat.lastMessage}`
      : `${chat.lastSender?.split("@")[0] || "Họ"}: ${chat.lastMessage}`;

    return (
      <span
        className={`text-xs truncate ${
          unread ? "font-semibold text-gray-900" : "text-gray-500"
        }`}
      >
        {previewText}
      </span>
    );
  };

  /** 🕒 Format thời gian */
  const formatTime = (time) => {
    if (!time) return "";
    const date = new Date(time);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    return isToday
      ? date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
      : date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
  };

  return (
    <div className="w-80 h-full bg-white border-r flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center px-5 py-4 border-b bg-gray-50">
        <h2 className="font-semibold text-lg text-gray-800">Chats</h2>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-gray-50">
        <FaSearch className="text-gray-400" />
        <input
          type="text"
          placeholder="Tìm kiếm người dùng..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 outline-none text-sm text-gray-700 bg-transparent"
        />
      </div>

      {/* Danh sách chat */}
      <div className="flex-1 overflow-y-auto p-2">
        {(query.trim() ? users : recentChats).map((u) => {
          const userEmail =
            u.email || [...(u.participants || [])].find((p) => p !== email);
          const isOnline = onlineUsers.has(userEmail);
          const unread = u.unreadMap?.[email];

          return (
            <div
              key={u.id || userEmail}
              onClick={() => handleSelect(u)}
              className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition group ${
                unread ? "bg-blue-50 hover:bg-blue-100" : "hover:bg-gray-100"
              }`}
            >
              <img
                src="https://cdn-icons-png.flaticon.com/512/3135/3135715.png"
                alt={userEmail}
                className="w-10 h-10 rounded-full border"
              />
              <div className="flex-1 text-left min-w-0">
                <div className="flex justify-between items-center">
                  <p
                    className={`font-medium text-sm truncate ${
                      unread ? "font-bold text-gray-900" : "text-gray-800"
                    }`}
                  >
                    {u.firstName || userEmail}
                  </p>
                  <span className="text-[10px] text-gray-400 ml-2">
                    {formatTime(u.createdAt)}
                  </span>
                </div>
                {renderLastMessage(u)}
              </div>
              <FaCircle
                className={`text-[10px] ${
                  isOnline ? "text-green-500" : "text-gray-300"
                }`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ChatSidebar;
