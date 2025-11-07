import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { FaSearch, FaCircle, FaUsers, FaPlus } from "react-icons/fa";
import { wsChatManager } from "../../utils/WebSocketManager";
import ChatGroupModal from "./ChatGroupModal";
import GroupManagerModal from "./GroupManagerModal";
import GroupUpdateModal from "./GroupUpdateModal";

const ChatSidebar = ({ onSelectUser }) => {
  const [query, setQuery] = useState("");
  const [recentChats, setRecentChats] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [showGroupList, setShowGroupList] = useState(false);
  const [groups, setGroups] = useState([]);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [showGroupManager, setShowGroupManager] = useState(false);
  const [showGroupUpdate, setShowGroupUpdate] = useState(false);

  const token = sessionStorage.getItem("accessToken");
  const email =
    sessionStorage.getItem("email") ||
    JSON.parse(localStorage.getItem("user") || "{}").email;

  const ts = () => new Date().toLocaleTimeString("vi-VN");
  const wsListenerRef = useRef(null);

  // ======================================================
  // 📡 API LOADERS
  // ======================================================
  const fetchGroups = async () => {
    try {
      const res = await axios.get(
        `http://localhost:8081/api/chat/group/my?email=${email}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const list = res.data.data || [];
      console.log(`[ChatSidebar ${ts()}] 🧩 Loaded ${list.length} groups`);
      const uniqueGroups = Array.from(new Map(list.map((g) => [g.id, g])).values());
      setGroups(uniqueGroups);
    } catch (err) {
      console.error(`[ChatSidebar ${ts()}] ❌ Load groups error:`, err);
    }
  };

  const fetchRecentChats = async () => {
    try {
      const res = await axios.get(
        `http://localhost:8081/api/chat/my-conversations?email=${email}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const convs = res.data || [];
      const normalized = convs.map((c) => ({
        ...c,
        createdAt: c.lastMessageTime || c.updatedAt || c.createdAt,
      }));
      const unique = Array.from(new Map(normalized.map((c) => [c.id, c])).values());
      setRecentChats(unique.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    } catch (err) {
      console.error(`[ChatSidebar ${ts()}] ❌ Load chat list error:`, err);
    }
  };

  useEffect(() => {
    fetchRecentChats();
    fetchGroups();
  }, [email, token]);

  // ======================================================
  // 🧩 LOCAL UPDATE PREVIEW (Realtime)
  // ======================================================
  const updateConversationPreview = (groupId, message, timestamp, senderName) => {
    setGroups((prev) => {
      const updated = prev.map((g) =>
        g.id === groupId
          ? {
              ...g,
              lastMessage: message,
              lastMessageTime: timestamp,
              lastSenderName: senderName,
              createdAt: timestamp,
            }
          : g
      );
      return updated.sort(
        (a, b) =>
          new Date(b.lastMessageTime || b.createdAt || 0) -
          new Date(a.lastMessageTime || a.createdAt || 0)
      );
    });
  };

  // ======================================================
  // 🔌 WebSocket Sync
  // ======================================================
  useEffect(() => {
    if (!token) return;
    const endpoint = "/ws/chat";

    if (wsListenerRef.current) {
      wsChatManager.removeListener(endpoint, wsListenerRef.current);
    }

    const handler = (data) => {
      try {
        console.log(`[ChatSidebar ${ts()}] 📥 WS Received:`, data);

        switch (data.type) {
          // === PRIVATE CHAT ===
          case "chat":
          case "new-message":
          case "message": {
            const { conversationId, message, timestamp, senderName, sender } = data;
            const now = timestamp || new Date().toISOString();
            setRecentChats((prev) => {
              const updated = [...prev];
              const idx = updated.findIndex((c) => c.id === conversationId);
              if (idx !== -1) {
                updated[idx] = {
                  ...updated[idx],
                  lastSender: sender,
                  lastSenderName: senderName,
                  lastMessage: message,
                  lastMessageTime: now,
                  createdAt: now,
                };
              } else {
                updated.push({
                  id: conversationId,
                  lastSender: sender,
                  lastSenderName: senderName,
                  lastMessage: message,
                  lastMessageTime: now,
                  createdAt: now,
                });
              }
              return updated.sort(
                (a, b) =>
                  new Date(b.lastMessageTime || 0) - new Date(a.lastMessageTime || 0)
              );
            });
            break;
          }

          // 💬 === GROUP CHAT ===
          case "group-chat":
          case "group-message": {
            const { groupId, message, timestamp, senderName, sender } = data;
            console.log(
              `[ChatSidebar ${ts()}] 💬 Group message → groupId=${groupId}, sender=${senderName}, message="${message}"`
            );

            setGroups((prev) => {
              const safeEmail = email.replace(/@/g, "_at_").replace(/\./g, "_dot_");
              return prev.map((g) => {
                if (g.id === groupId) {
                  const isMyMsg = sender === email;
                  return {
                    ...g,
                    lastMessage: message,
                    lastMessageTime: timestamp,
                    lastSenderName: senderName,
                    lastSender: sender,
                    createdAt: timestamp,
                    unreadMap: {
                      ...g.unreadMap,
                      [safeEmail]: isMyMsg ? false : true, // người khác gửi → đánh dấu chưa đọc
                    },
                  };
                }
                return g;
              });
            });
            break;
          }


          // 🔁 === GROUP SYNC ===
          case "group-sync": {
            const incoming = Array.isArray(data.groups) ? data.groups : [];
            if (!incoming.length) return;

            setGroups((prev) => {
              const map = new Map(prev.map((g) => [g.id, g]));

              incoming.forEach((g) => {
                const old = map.get(g.id);

                // ⚙️ Gộp dữ liệu cũ và mới
                const merged = { ...old, ...g };

                // ✅ Giữ lại trạng thái unread nếu server gửi về
                if (typeof g.unread === "boolean") {
                  merged.unread = g.unread;
                }

                // ⚙️ Ưu tiên dữ liệu có lastMessageTime mới hơn
                if (
                  !old ||
                  !old.lastMessageTime ||
                  new Date(g.lastMessageTime) > new Date(old.lastMessageTime)
                ) {
                  map.set(g.id, merged);
                }
              });

              return Array.from(map.values()).sort(
                (a, b) =>
                  new Date(b.lastMessageTime || 0) - new Date(a.lastMessageTime || 0)
              );
            });

            console.log(
              `[ChatSidebar ${ts()}] 🔁 Synced ${incoming.length} groups (merged smart)`
            );
            break;
          }

          case "read-update":
            console.log(`[ChatSidebar ${ts()}] 👁️ Read-update`);
            setTimeout(() => fetchRecentChats(), 500);
            break;

          case "online-users":
            setOnlineUsers(new Set(data.users || []));
            break;

          case "user-status":
            setOnlineUsers((prev) => {
              const next = new Set(prev);
              data.online ? next.add(data.email) : next.delete(data.email);
              return next;
            });
            break;

          default:
            break;
        }
      } catch (err) {
        console.error(`[ChatSidebar ${ts()}] ❌ WS handler error:`, err);
      }
    };

    wsListenerRef.current = handler;
    wsChatManager
      .connect(endpoint, token, handler)
      .then(() => {
        wsChatManager.send({ type: "request-online-users" });
        wsChatManager.send({ type: "request-sync" });
      })
      .catch((err) => console.error(`[ChatSidebar ${ts()}] ❌ WS connect error:`, err));

    return () => wsChatManager.removeListener(endpoint, handler);
  }, [token]);

  // ======================================================
  // 🎯 UI Actions
  // ======================================================
  const handleSelect = async (targetUser) => {
    if (targetUser.isGroup) {
      onSelectUser({
        email: targetUser.name || targetUser.id,
        firstName: targetUser.name || "Nhóm",
        conversationId: targetUser.id,
        isGroup: true,
        members: targetUser.members,
      });
      return;
    }

    try {
      const userEmail =
        targetUser.email ||
        (targetUser.participants
          ? [...targetUser.participants].find((p) => p !== email)
          : null);
      if (!userEmail) return;

      const res = await axios.post(
        `http://localhost:8081/api/chat/conversation?userA=${email}&userB=${userEmail}`,
        null,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const conversation = res.data;
      sessionStorage.setItem("lastConversation", JSON.stringify(conversation));

      onSelectUser({
        email: userEmail,
        firstName: targetUser.firstName || userEmail,
        conversationId: conversation.id,
        isGroup: false,
      });
    } catch (err) {
      console.error(`[ChatSidebar ${ts()}] ❌ handleSelect error:`, err);
    }
  };

  const formatTime = (time) => {
    if (!time) return "";
    const d = new Date(time);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    return isToday
      ? d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
      : d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
  };


  // ======================================================
  // 🖥️ UI
  // ======================================================
  return (
    <div className="w-80 h-full bg-white border-r flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center px-5 py-4 border-b bg-gray-50">
        <h2 className="font-semibold text-lg text-gray-800">Chats</h2>
        <button
          onClick={() => {
            // ⚙️ Nếu chưa có dữ liệu nhóm realtime thì mới fetch
            if (groups.length === 0) {
              fetchGroups();
            }
            setShowGroupList(true);
          }}
          className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition"
          title="Nhóm Chat"
        >
          <FaUsers className="text-gray-600" />
        </button>

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
        {[...groups, ...recentChats]
          .filter((v, i, arr) => v && arr.findIndex((x) => x.id === v.id) === i)
          .map((u) => {
            const userEmail =
              u.email || [...(u.participants || [])].find((p) => p !== email);
            const isOnline = onlineUsers.has(userEmail);
            const isGroup = !!u.members;
            const safeEmail = email.replace(/@/g, "_at_").replace(/\./g, "_dot_");
            const unread = isGroup ? u.unreadMap?.[safeEmail] : u.unreadMap?.[email];

            return (
              <div
                key={isGroup ? `group-${u.id}` : `chat-${u.id || userEmail}`}
                onClick={() =>
                  handleSelect(
                    isGroup ? { ...u, isGroup: true, name: u.name } : u
                  )
                }
                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition group ${
                  unread ? "bg-blue-50 hover:bg-blue-100" : "hover:bg-gray-100"
                }`}
              >
                <img
                  src={
                    isGroup
                      ? u.avatar ||
                        "https://cdn-icons-png.flaticon.com/512/1077/1077114.png"
                      : "https://cdn-icons-png.flaticon.com/512/3135/3135715.png"
                  }
                  alt={isGroup ? u.name : userEmail}
                  className="w-10 h-10 rounded-full border"
                />
                <div className="flex-1 text-left min-w-0">
                  <div className="flex justify-between items-center">
                    <p
                      className={`font-medium text-sm truncate ${
                        unread ? "font-bold text-gray-900" : "text-gray-800"
                      }`}
                    >
                      {u.firstName || u.name || userEmail}
                    </p>
                    <span className="text-[10px] text-gray-400 ml-2">
                      {formatTime(u.lastMessageTime || u.createdAt)}
                    </span>
                  </div>
                  <span
                    className={`text-xs truncate ${
                      unread ? "font-semibold text-gray-900" : "text-gray-500"
                    }`}
                  >
                    {(() => {
                      const isGroup = !!u.members;
                      const time = u.lastMessageTime
                        ? (() => {
                            const d = new Date(u.lastMessageTime);
                            const now = new Date();
                            const isToday = d.toDateString() === now.toDateString();
                            return isToday
                              ? d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
                              : d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
                          })()
                        : "";

                      console.log(`[ChatSidebar ${ts()}] 🧩 Render preview for ${u.id}:`, {
                        isGroup,
                        lastSender: u.lastSender,
                        lastSenderName: u.lastSenderName,
                        lastMessage: u.lastMessage,
                        lastMessageTime: u.lastMessageTime,
                        currentUser: email,
                      });

                      // 🧠 Nếu không có tin nhắn cuối, fallback hiển thị nhóm
                      if (!u.lastMessage) {
                        return isGroup
                          ? `${u.members?.length || 0} thành viên`
                          : "Chưa có tin nhắn";
                      }

                      // ✅ Kiểm tra nếu chính mình là người gửi
                      if (u.lastSender === email) {
                        const displaySenderName =
                          u.lastSender === email ? "You" : u.lastSenderName || (isGroup ? "Ẩn danh" : "");
                        return `${displaySenderName}: ${u.lastMessage || ""} • ${time}`;
                      }

                      // ✅ Nếu có tên người gửi thì hiển thị
                      if (u.lastSenderName && u.lastSenderName.trim() !== "") {
                        return `${u.lastSenderName}: ${u.lastMessage || ""} • ${time}`;
                      }

                      // ✅ Fallback: lấy prefix email người gửi
                      const sender = u.lastSender?.split("@")[0] || "Họ";
                      return `${sender}: ${u.lastMessage || ""} • ${time}`;
                    })()}
                  </span>

                </div>
                {unread && (
                  <span className="ml-1 inline-block w-2 h-2 bg-blue-500 rounded-full"></span>
                )}

                {!isGroup && (
                  <FaCircle
                    className={`text-[10px] ${
                      isOnline ? "text-green-500" : "text-gray-300"
                    }`}
                  />
                )}
              </div>
            );
          })}
      </div>

      {/* --- Các Modal giữ nguyên --- */}
      {showGroupList && (
        <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50">
          <div className="bg-white rounded-xl shadow-lg w-96 p-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-2 mb-3">
              <h3 className="font-semibold text-gray-800 text-lg">Nhóm Chat</h3>
              <button
                onClick={() => setShowGroupList(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            {groups.length === 0 ? (
              <p className="text-gray-400 text-sm text-center">
                Chưa có nhóm nào
              </p>
            ) : (
              groups.map((g) => (
                <div key={`group-${g.id}`} className="p-3 border-b">
                  <div
                    onClick={() => {
                      setShowGroupList(false);
                      onSelectUser({
                        email: g.name,
                        firstName: g.name,
                        conversationId: g.id,
                        isGroup: true,
                        members: g.members,
                      });
                    }}
                    className="flex items-center gap-3 hover:bg-gray-100 rounded-lg cursor-pointer p-2"
                  >
                    <img
                      src={
                        g.avatar ||
                        "https://cdn-icons-png.flaticon.com/512/1077/1077114.png"
                      }
                      alt={g.name}
                      className="w-10 h-10 rounded-full border"
                    />
                    <div>
                      <p className="font-medium text-sm">{g.name}</p>
                      <p className="text-xs text-gray-500">
                        {g.members?.length || 0} thành viên
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end mt-2">
                    <button
                      onClick={() => {
                        setSelectedGroup(g);
                        setShowGroupManager(true);
                      }}
                      className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200"
                    >
                      👥 Thành viên
                    </button>
                    <button
                      onClick={() => {
                        setSelectedGroup(g);
                        setShowGroupUpdate(true);
                      }}
                      className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200"
                    >
                      ✏️ Chỉnh sửa
                    </button>
                  </div>
                </div>
              ))
            )}

            <div className="mt-4 border-t pt-3">
              <button
                onClick={() => {
                  setShowGroupList(false);
                  setShowCreateGroup(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 w-full justify-center"
              >
                <FaPlus /> Tạo nhóm mới
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreateGroup && (
        <ChatGroupModal
          isOpen={showCreateGroup}
          onClose={() => setShowCreateGroup(false)}
          onGroupCreated={() => {
            fetchGroups();
            setShowCreateGroup(false);
            setShowGroupList(true);
          }}
        />
      )}

      {showGroupManager && (
        <GroupManagerModal
          group={selectedGroup}
          onClose={() => setShowGroupManager(false)}
          onUpdated={() => fetchGroups()}
        />
      )}

      {showGroupUpdate && (
        <GroupUpdateModal
          group={selectedGroup}
          onClose={() => setShowGroupUpdate(false)}
          onUpdated={() => fetchGroups()}
        />
      )}
    </div>
  );
};

export default ChatSidebar;
