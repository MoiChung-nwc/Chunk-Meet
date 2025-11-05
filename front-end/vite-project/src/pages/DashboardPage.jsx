import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { wsManager } from "../utils/WebSocketManager";
import {
  FaVideo,
  FaPlus,
  FaCalendarAlt,
  FaBell,
  FaShareSquare,
} from "react-icons/fa";
import toast from "react-hot-toast";
import axios from "axios";

const DashboardPage = () => {
  const [time, setTime] = useState(new Date());
  const [meetings, setMeetings] = useState([]);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showCallModal, setShowCallModal] = useState(false);
  const [callEmail, setCallEmail] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [meetingTitle, setMeetingTitle] = useState("");
  const navigate = useNavigate();

  const token = sessionStorage.getItem("accessToken");
  const email =
    sessionStorage.getItem("email") ||
    JSON.parse(localStorage.getItem("user") || "{}").email;

  // 🧩 Lắng nghe sự kiện toàn cục từ CallIntegration (reset input & navigate)
  useEffect(() => {
    // 🧹 Reset input email khi call bị reject hoặc end
    const clearHandler = () => {
      console.log("[Dashboard] 🧹 clearCalleeEmail → reset input");
      setCallEmail("");
      setShowCallModal(false);
    };

    // 🎬 Caller tự navigate sang videocall khi callee accept
    const acceptHandler = (e) => {
      const { to } = e.detail || {};
      console.log("[Dashboard] 🎬 callAccepted event → navigate to videocall", to);

      // ✅ Lưu peerEmail & isCaller vào sessionStorage để đồng bộ với callee
      sessionStorage.setItem("peerEmail", to);
      sessionStorage.setItem("isCaller", "true");

      setCallEmail("");
      setShowCallModal(false);
      navigate("/videocall", { state: { to, isCaller: true } });
    };

    window.addEventListener("clearCalleeEmail", clearHandler);
    window.addEventListener("callAccepted", acceptHandler);

    return () => {
      window.removeEventListener("clearCalleeEmail", clearHandler);
      window.removeEventListener("callAccepted", acceptHandler);
    };
  }, [navigate]);

  // 🕒 Đồng hồ realtime
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 📞 New Call
  const startNewCall = async () => {
    if (!callEmail.trim()) return toast.error("Vui lòng nhập email người nhận!");
    if (callEmail === email) return toast.error("⚠️ Bạn không thể gọi chính mình!");

    try {
      const ready = await wsManager.waitUntilReady("/ws/call", 2000);
      if (!ready) return toast.error("Call socket chưa sẵn sàng!");

      window.isInCall = true;
      wsManager.send({ type: "start-call", from: email, to: callEmail }, "/ws/call");
      toast.success(`📤 Đã gửi lời gọi tới ${callEmail}`);

      // ✅ Đặt sau khi gửi thành công
      setShowCallModal(false);
      sessionStorage.setItem("peerEmail", callEmail);
      sessionStorage.setItem("isCaller", "true");
    } catch (err) {
      toast.error("Không thể gửi cuộc gọi!");
      console.error("Call error:", err);
    }
  };

  // 🧩 Group meeting
  const createGroupMeeting = async () => {
    if (!meetingTitle.trim()) return toast.error("Vui lòng nhập tên phòng!");
    try {
      const res = await axios.post(
        "http://localhost:8081/api/meetings",
        { title: meetingTitle },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const { meetingCode, title } = res.data;
      toast.success(`🎉 Phòng "${title}" đã được tạo!`);
      setShowGroupModal(false);
      navigate(`/group/${meetingCode.toLowerCase()}`);
    } catch {
      toast.error("Không thể tạo phòng họp nhóm!");
    }
  };

  const joinGroupMeeting = async () => {
    if (!joinCode.trim()) return toast.error("Vui lòng nhập mã phòng!");
    try {
      const normCode = joinCode.trim().toLowerCase();
      await axios.post(
        "http://localhost:8081/api/meetings/join",
        { meetingCode: normCode },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setShowGroupModal(false);
      navigate(`/group/${normCode}`);
    } catch {
      toast.error("❌ Mã phòng không hợp lệ!");
    }
  };

  // 📅 Meeting mẫu
  useEffect(() => {
    setMeetings([
      {
        id: 1,
        title: "Team Sync-up",
        host: "James Collison",
        time: "14:45 - 16:00",
        status: "Now",
        participants: 5,
      },
      {
        id: 2,
        title: "Design Discussion",
        host: "Laura Kim",
        time: "16:30 - 17:00",
        status: "Upcoming",
        participants: 3,
      },
    ]);
  }, []);

  // Format thời gian
  const formatTime = (d) =>
    d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  const formatDate = (d) =>
    d.toLocaleDateString("vi-VN", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  return (
    <div className="min-h-screen bg-white text-gray-800 flex flex-col font-[Inter]">
      {/* HEADER */}
      <header className="flex justify-between items-center px-12 py-5 border-b bg-white shadow-sm">
        <div className="flex items-center gap-2">
          <img
            src="https://cdn-icons-png.flaticon.com/512/906/906349.png"
            alt="Logo"
            className="w-6 h-6"
          />
          <span className="font-semibold text-xl">MeetPro</span>
        </div>

        <nav className="flex gap-10 text-gray-700 font-medium">
          <a href="#">Home</a>
          <a href="#">Meetings</a>
          <a href="#">Schedule</a>
          <a href="#">Settings</a>
        </nav>

        <div className="flex items-center gap-6">
          <FaBell className="text-gray-500 text-xl cursor-pointer hover:text-blue-600 transition" />
          <img
            src="https://cdn-icons-png.flaticon.com/512/3135/3135715.png"
            alt="Avatar"
            className="w-9 h-9 rounded-full border"
          />
        </div>
      </header>

      {/* MAIN */}
      <main className="flex-1 flex flex-col items-center justify-center mt-8">
        <div className="text-5xl font-semibold mb-2">{formatTime(time)}</div>
        <div className="text-gray-500 mb-10">{formatDate(time)}</div>

        <div className="flex gap-10 mb-6">
          <button
            onClick={() => setShowGroupModal(true)}
            className="flex flex-col items-center justify-center w-28 h-28 rounded-full bg-cyan-50 hover:bg-cyan-100 text-cyan-700 shadow-md transition"
          >
            <FaPlus className="text-3xl mb-2" />
            <span className="font-medium text-sm">Join</span>
          </button>

          <button
            onClick={() => setShowCallModal(true)}
            className="flex flex-col items-center justify-center w-28 h-28 rounded-full text-white bg-gradient-to-b from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 shadow-lg transition transform hover:scale-105"
          >
            <FaVideo className="text-3xl mb-2" />
            <span className="font-medium text-sm">New Meeting</span>
          </button>

          <button
            onClick={() => toast("🗓 Coming soon!")}
            className="flex flex-col items-center justify-center w-28 h-28 rounded-full bg-violet-50 hover:bg-violet-100 text-violet-700 shadow-md transition"
          >
            <FaCalendarAlt className="text-3xl mb-2" />
            <span className="font-medium text-sm">Schedule</span>
          </button>

          <button
            onClick={() => navigate("/chat")}
            className="flex flex-col items-center justify-center w-28 h-28 rounded-full bg-pink-50 hover:bg-pink-100 text-pink-700 shadow-md transition"
          >
            💬
            <span className="font-medium text-sm mt-1">Chat</span>
          </button>
        </div>

        <button
          onClick={() => toast("📤 Coming soon!")}
          className="flex items-center gap-2 border border-gray-300 rounded-full px-5 py-2 text-sm text-gray-700 hover:bg-gray-100 transition"
        >
          <FaShareSquare /> Share screen
        </button>
      </main>

      {/* MEETING LIST */}
      <section className="w-full px-16 mt-12 mb-20">
        <h2 className="text-gray-600 font-semibold mb-4">
          Today, {time.toLocaleDateString("vi-VN")}
        </h2>

        <div className="grid grid-cols-2 gap-6">
          {meetings.map((m) => (
            <div
              key={m.id}
              className="border rounded-2xl p-5 bg-gradient-to-br from-white to-gray-50 shadow hover:shadow-lg transition-all"
            >
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-semibold text-lg text-gray-800">{m.title}</h4>
                {m.status === "Now" ? (
                  <span className="text-red-500 text-sm font-medium">Now</span>
                ) : (
                  <span className="text-gray-500 text-sm">{m.status}</span>
                )}
              </div>
              <p className="text-gray-500 text-sm mb-1">🕒 {m.time}</p>
              <p className="text-gray-500 text-sm mb-3">Host: {m.host}</p>

              <div className="flex justify-between items-center">
                <div className="flex items-center -space-x-2">
                  {[...Array(Math.min(m.participants, 3))].map((_, i) => (
                    <img
                      key={i}
                      src="https://cdn-icons-png.flaticon.com/512/3135/3135715.png"
                      className="w-7 h-7 rounded-full border-2 border-white"
                      alt=""
                    />
                  ))}
                  {m.participants > 3 && (
                    <span className="text-xs bg-gray-200 px-2 py-0.5 rounded-full text-gray-600">
                      +{m.participants - 3}
                    </span>
                  )}
                </div>

                <button
                  onClick={() =>
                    navigate(`/group/${(m.id === 1 ? "ROOM123" : "ROOM456").toLowerCase()}`)
                  }
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium ${
                    m.status === "Now"
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {m.status === "Now" ? "Join" : "Start"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* MODALS */}
      {showCallModal && (
        <Modal title="📞 New Call" onClose={() => setShowCallModal(false)}>
          <input
            type="email"
            placeholder="Nhập email người nhận..."
            value={callEmail}
            onChange={(e) => setCallEmail(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 mb-3 text-center focus:ring focus:ring-blue-200"
          />
          <button
            onClick={startNewCall}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 shadow"
          >
            🚀 Bắt đầu gọi
          </button>
        </Modal>
      )}

      {showGroupModal && (
        <Modal title="🎥 Group Meeting" onClose={() => setShowGroupModal(false)}>
          <input
            type="text"
            placeholder="Nhập tên phòng họp..."
            value={meetingTitle}
            onChange={(e) => setMeetingTitle(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-center mb-3 focus:ring focus:ring-blue-200"
          />
          <button
            onClick={createGroupMeeting}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 mb-4 shadow"
          >
            ➕ Tạo phòng mới
          </button>

          <input
            type="text"
            placeholder="Nhập mã phòng"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-center mb-3 focus:ring focus:ring-green-200"
          />
          <button
            onClick={joinGroupMeeting}
            className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 shadow"
          >
            🚀 Tham gia phòng
          </button>
        </Modal>
      )}
    </div>
  );
};

// 🪶 Modal component
const Modal = ({ title, children, onClose }) => (
  <div className="fixed inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-50">
    <div className="bg-white rounded-2xl shadow-2xl p-6 w-96 text-center transform scale-95 animate-[fadeIn_0.2s_ease-in-out_forwards]">
      <h2 className="text-lg font-semibold mb-4">{title}</h2>
      {children}
      <button
        onClick={onClose}
        className="text-gray-500 hover:text-gray-700 hover:underline text-sm mt-3"
      >
        Hủy
      </button>
    </div>
  </div>
);

export default DashboardPage;
