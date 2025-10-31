import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { wsManager } from "../utils/WebSocketManager";
import { createSignalingSocket } from "../utils/signaling";
import { FaVideo, FaPlus, FaRegClock, FaSearch } from "react-icons/fa";
import { MdOutlineScreenShare } from "react-icons/md";
import toast from "react-hot-toast";
import ChatSidebar from "../components/Chat/ChatSidebar";

/**
 * ✅ DashboardPage
 * - Gọi video, quản lý meeting
 * - Thêm sidebar chat Messenger-style + search user
 */
const DashboardPage = () => {
  const [time, setTime] = useState(new Date());
  const [meetings, setMeetings] = useState([]);
  const [showChat, setShowChat] = useState(false);
  const [searchUser, setSearchUser] = useState("");
  const navigate = useNavigate();

  const token = sessionStorage.getItem("accessToken");
  const email =
    sessionStorage.getItem("email") ||
    JSON.parse(localStorage.getItem("user") || "{}").email;

  // 🕒 Cập nhật thời gian realtime
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 🔌 Kết nối socket /ws/call
  useEffect(() => {
    if (!token || !email) {
      navigate("/login");
      return;
    }

    const connectCallSocket = async () => {
      try {
        await wsManager.connect("/ws/call", token, async (msg) => {
          console.log("[CallWS] ←", msg);

          if (msg.type === "incoming-call") {
            if (msg.from === email) return;

            const accept = window.confirm(`📞 Có cuộc gọi từ ${msg.from}. Chấp nhận?`);
            if (!accept) {
              wsManager.send({ type: "reject-call", from: email, to: msg.from }, "/ws/call");
              return;
            }

            sessionStorage.setItem("peerEmail", msg.from);
            sessionStorage.setItem("isCaller", "false");
            window.isInCall = true;

            try {
              await createSignalingSocket(token);
            } catch (e) {
              console.error("❌ Signaling open failed", e);
            }

            wsManager.send({ type: "accept-call", from: email, to: msg.from }, "/ws/call");
            navigate("/videocall", {
              state: { from: msg.from, to: email, isCaller: false },
            });
          }

          if (msg.type === "accept-call") {
            if (msg.from === email) return;

            sessionStorage.setItem("peerEmail", msg.from);
            sessionStorage.setItem("isCaller", "true");
            window.isInCall = true;

            try {
              await createSignalingSocket(token);
            } catch (e) {
              console.error("❌ Signaling open failed", e);
            }

            navigate("/videocall", {
              state: { from: email, to: msg.from, isCaller: true },
            });
          }

          if (msg.type === "reject-call") {
            toast.error(`${msg.from} đã từ chối cuộc gọi.`);
          }
        });
      } catch (err) {
        console.error("❌ Cannot connect /ws/call:", err);
        toast.error("Không thể kết nối call socket");
      }
    };

    connectCallSocket();

    // 🧹 Cleanup
    return () => {
      if (!window.isInCall && wsManager.isConnected("/ws/call")) {
        wsManager.disconnect("/ws/call", "Leaving dashboard");
      }
    };
  }, [token, email, navigate]);

  // 📞 Gọi người khác
  const startNewCall = async () => {
    const toEmail = prompt("Nhập email người nhận:");
    if (!toEmail) return;
    if (toEmail === email) return alert("⚠️ Bạn không thể gọi chính mình!");

    sessionStorage.setItem("peerEmail", toEmail);
    sessionStorage.setItem("isCaller", "true");

    const ready = await wsManager.waitUntilReady("/ws/call", 2000);
    if (!ready) return toast.error("Call socket chưa sẵn sàng!");

    window.isInCall = true;
    wsManager.send({ type: "start-call", from: email, to: toEmail }, "/ws/call");
    toast.success(`📤 Đã gửi lời gọi tới ${toEmail}`);
  };

  // 📅 Demo meeting
  useEffect(() => {
    setMeetings([
      {
        id: 1,
        title: "Weekly Sync-up",
        host: "James Collison",
        time: "14:45 - 16:00",
        status: "Now",
        participants: 6,
        joined: true,
      },
      {
        id: 2,
        title: "Marketing Discussion",
        host: "Laura Kim",
        time: "16:30 - 17:00",
        status: "Upcoming",
        participants: 3,
        joined: false,
      },
    ]);
  }, []);

  const formatTime = (d) =>
    d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  const formatDate = (d) =>
    d.toLocaleDateString("vi-VN", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  // 🧱 UI
  return (
    <div className="min-h-screen bg-white text-gray-800 flex flex-col">
      {/* ===== HEADER ===== */}
      <header className="flex justify-between items-center px-8 py-4 border-b bg-white shadow-sm">
        <div className="flex items-center gap-2">
          <img
            src="https://cdn-icons-png.flaticon.com/512/906/906349.png"
            alt="Logo"
            className="w-6 h-6"
          />
          <span className="font-semibold text-lg">MeetPro</span>
        </div>

        <nav className="flex gap-8 text-gray-700 font-medium">
          <a href="#">Home</a>
          <a href="#">Meetings</a>
          <a href="#">Schedule</a>
          <a href="#">Settings</a>
        </nav>

        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowChat((prev) => !prev)}
            className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition"
          >
            💬 Chat
          </button>
          <button>🔔</button>
          <img
            src="https://cdn-icons-png.flaticon.com/512/3135/3135715.png"
            alt="Avatar"
            className="w-8 h-8 rounded-full border"
          />
        </div>
      </header>

      {/* ===== MAIN ===== */}
      <main className="flex-1 flex flex-col items-center text-center mt-10">
        {/* Thanh tìm kiếm user */}
        <div className="w-[60%] mb-8 flex items-center gap-2 border rounded-full px-4 py-2 shadow-sm focus-within:ring-2 focus-within:ring-blue-500 transition">
          <FaSearch className="text-gray-500" />
          <input
            type="text"
            value={searchUser}
            onChange={(e) => setSearchUser(e.target.value)}
            placeholder="Tìm kiếm người dùng..."
            className="flex-1 outline-none text-sm text-gray-700"
          />
        </div>

        {/* Thời gian */}
        <div className="text-4xl font-semibold mb-2">{formatTime(time)}</div>
        <div className="text-gray-500 mb-10">{formatDate(time)}</div>

        {/* Nút chức năng */}
        <div className="flex gap-6 mb-8">
          <div className="flex flex-col items-center">
            <button className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200">
              <FaPlus className="text-gray-600 text-xl" />
            </button>
            <span className="text-sm mt-2">Join</span>
          </div>

          <div className="flex flex-col items-center">
            <button
              onClick={startNewCall}
              className="w-16 h-16 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700"
            >
              <FaVideo className="text-xl" />
            </button>
            <span className="text-sm mt-2">New meeting</span>
          </div>

          <div className="flex flex-col items-center">
            <button className="w-16 h-16 rounded-full border flex items-center justify-center hover:bg-gray-100">
              <MdOutlineScreenShare className="text-gray-700 text-xl" />
            </button>
            <span className="text-sm mt-2">Share screen</span>
          </div>
        </div>

        {/* Danh sách meeting */}
        <section className="w-[70%] text-left">
          <h2 className="text-lg font-semibold mb-3">
            Today, {time.toLocaleDateString("vi-VN")}
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {meetings.map((m) => (
              <div
                key={m.id}
                className="border rounded-xl p-4 bg-white shadow hover:shadow-md transition-all"
              >
                <div className="flex justify-between items-center mb-1">
                  <h3 className="font-semibold">{m.title}</h3>
                  {m.status === "Now" && (
                    <span className="text-red-500 text-sm font-medium">Now</span>
                  )}
                </div>
                <p className="text-gray-500 text-sm">
                  <FaRegClock className="inline-block mr-1" />
                  {m.time}
                </p>
                <p className="text-gray-500 text-sm mt-1">Host: {m.host}</p>
                <div className="flex items-center mt-3 justify-between">
                  <div className="flex items-center">
                    <span className="text-red-500 text-xs mr-2">🔴</span>
                    <span className="text-sm text-gray-600">
                      {m.participants} joined
                    </span>
                  </div>
                  <button
                    onClick={() =>
                      navigate("/videocall", {
                        state: { from: email, to: "meeting", isCaller: true },
                      })
                    }
                    className={`px-3 py-1 rounded-md text-sm ${
                      m.joined
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {m.joined ? "Join" : "Start"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* ===== CHAT SIDEBAR ===== */}
      {showChat && <ChatSidebar onClose={() => setShowChat(false)} />}
    </div>
  );
};

export default DashboardPage;
