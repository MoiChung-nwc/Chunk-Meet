import React, { useState, useEffect } from "react";
import axios from "axios";
import { FaSearch, FaPhoneAlt, FaVideo } from "react-icons/fa";
import { wsChatManager } from "../../utils/WebSocketManager";

const ChatSidebar = ({ onSelectUser }) => {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState([]);
  const [recentChats, setRecentChats] = useState([]);
  const token = sessionStorage.getItem("accessToken");
  const email =
    sessionStorage.getItem("email") ||
    JSON.parse(localStorage.getItem("user") || "{}").email;

  useEffect(() => {
    const fetchRecent = async () => {
      try {
        const res = await axios.get(
          `http://localhost:8081/api/chat/my-conversations?email=${email}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setRecentChats(res.data || []);
      } catch (err) {
        console.error("❌ Lỗi tải danh sách chat gần đây:", err);
      }
    };
    fetchRecent();
  }, [email, token]);

  /** 🔌 Kết nối WebSocket chat realtime */
  useEffect(() => {
    if (!token) return;
    let connected = false;

    const connectWS = async () => {
      try {
        await wsChatManager.connect("/ws/chat", token, (msg) => {
          try {
            const data = JSON.parse(JSON.stringify(msg));

            // 🔥 Tin nhắn mới
            if (data.type === "new-message") {
              const { conversationId, from, content, timestamp } = data;
              setRecentChats((prev) => {
                const idx = prev.findIndex((c) => c.id === conversationId);
                if (idx !== -1) {
                  const updated = [...prev];
                  const conv = { ...updated[idx] };
                  conv.lastMessage = content;
                  conv.createdAt = timestamp;
                  conv.unreadMap = {
                    ...(conv.unreadMap || {}),
                    [email]: from !== email,
                  };
                  updated.splice(idx, 1);
                  return [conv, ...updated];
                } else {
                  const newConv = {
                    id: conversationId,
                    participants: [email, from],
                    createdAt: timestamp,
                    lastMessage: content,
                    unreadMap: { [email]: from !== email },
                  };
                  return [newConv, ...prev];
                }
              });
            }

            // 👁️ Người khác đã đọc → realtime bỏ bold
            if (data.type === "read-update") {
              const { conversationId, reader } = data;
              if (reader !== email) {
                setRecentChats((prev) =>
                  prev.map((c) =>
                    c.id === conversationId
                      ? {
                          ...c,
                          unreadMap: {
                            ...(c.unreadMap || {}),
                            [reader]: false,
                          },
                        }
                      : c
                  )
                );
              }
            }
          } catch (e) {
            console.error("WS parse error", e);
          }
        });
        connected = true;
      } catch (err) {
        console.error("❌ Lỗi kết nối WS chat:", err);
      }
    };

    connectWS();
    return () => {
      if (connected) wsChatManager.disconnect("/ws/chat", "sidebar closed");
    };
  }, [token, email]);

  /** 🔍 Tìm user */
  useEffect(() => {
    if (!query.trim()) {
      setUsers([]);
      return;
    }
    const fetchUsers = async () => {
      try {
        const res = await axios.get(
          `http://localhost:8081/api/users/search?keyword=${query}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setUsers(res.data || []);
      } catch {
        setUsers([]);
      }
    };
    const debounce = setTimeout(fetchUsers, 400);
    return () => clearTimeout(debounce);
  }, [query, token]);

  /** 🗨️ Chọn user để chat */
  const handleSelect = async (targetUser) => {
    try {
      const res = await axios.post(
        `http://localhost:8081/api/chat/conversation?userA=${email}&userB=${targetUser.email}`,
        null,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const conversation = res.data;
      onSelectUser({ ...targetUser, conversationId: conversation.id });

      setRecentChats((prev) => {
        const idx = prev.findIndex((c) => c.id === conversation.id);
        if (idx !== -1) {
          const updated = [...prev];
          const conv = {
            ...updated[idx],
            unreadMap: { ...(updated[idx].unreadMap || {}), [email]: false },
          };
          updated.splice(idx, 1);
          return [conv, ...updated];
        }
        const other =
          [...conversation.participants].find((u) => u !== email) ||
          targetUser.email;
        const newConv = {
          id: conversation.id,
          participants: conversation.participants,
          createdAt: conversation.createdAt || new Date().toISOString(),
          lastMessage: conversation.lastMessage || "",
          unreadMap: { [email]: false },
          otherUserDisplay: other,
        };
        return [newConv, ...prev];
      });

      // 🆕 gửi WS báo đã đọc
      wsChatManager.send(
        { type: "read-update", conversationId: conversation.id },
        "/ws/chat"
      );
    } catch (err) {
      console.error("❌ Lỗi tạo/tìm conversation:", err);
    }
  };

  const handleCall = (user, type) => {
    alert(
      type === "audio"
        ? `📞 Gọi thoại ${user.firstName || user.email}`
        : `🎥 Gọi video ${user.firstName || user.email}`
    );
  };

  return (
    <div className="w-80 h-full bg-white border-r flex flex-col">
      <div className="flex justify-between items-center px-5 py-4 border-b bg-gray-50">
        <h2 className="font-semibold text-lg text-gray-800">Chats</h2>
      </div>

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

      <div className="flex-1 overflow-y-auto p-2">
        {query.trim()
          ? // 🔍 Khi đang tìm kiếm user
            users.map((user) => (
              <div
                key={user.id}
                onClick={() => handleSelect(user)}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 cursor-pointer transition group"
              >
                <img
                  src="https://cdn-icons-png.flaticon.com/512/3135/3135715.png"
                  alt={user.firstName}
                  className="w-10 h-10 rounded-full border"
                />
                <div className="flex-1 text-left min-w-0">
                  <p className="font-medium text-sm text-gray-800 truncate">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{user.email}</p>
                </div>
              </div>
            ))
          : // 💬 Khi không tìm kiếm, hiển thị chat gần đây
            recentChats.map((conv) => {
              const other =
                conv.otherUserDisplay ||
                [...(conv.participants || [])].find((u) => u !== email) ||
                "Unknown";
              const isUnread = !!(conv.unreadMap && conv.unreadMap[email]);
              return (
                <div
                  key={conv.id}
                  onClick={() =>
                    handleSelect({
                      email: other,
                      firstName: other,
                      conversationId: conv.id,
                    })
                  }
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 cursor-pointer transition group"
                >
                  <img
                    src="https://cdn-icons-png.flaticon.com/512/3135/3135715.png"
                    alt={other}
                    className="w-10 h-10 rounded-full border"
                  />
                  <div className="flex-1 text-left min-w-0">
                    <p
                      className={`font-medium text-sm truncate ${
                        isUnread ? "font-bold text-gray-900" : "text-gray-800"
                      }`}
                    >
                      {other}
                    </p>
                    <p
                      className={`text-xs truncate ${
                        isUnread
                          ? "text-gray-900 font-semibold"
                          : "text-gray-500"
                      }`}
                    >
                      {conv.lastMessage ||
                        new Date(conv.createdAt).toLocaleDateString("vi-VN")}
                    </p>
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCall({ email: other }, "audio");
                      }}
                      className="p-1.5 rounded-full hover:bg-blue-100 text-blue-600"
                    >
                      <FaPhoneAlt className="text-sm" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCall({ email: other }, "video");
                      }}
                      className="p-1.5 rounded-full hover:bg-blue-100 text-blue-600"
                    >
                      <FaVideo className="text-sm" />
                    </button>
                  </div>
                </div>
              );
            })}
      </div>
    </div>
  );
};

export default ChatSidebar;
