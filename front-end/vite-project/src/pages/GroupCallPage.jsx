import React, { useEffect, useRef, useState, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import toast from "react-hot-toast";
import { wsMeetingManager } from "../utils/WebSocketManager";
import EmojiPicker from "emoji-picker-react";
import {
  FaMicrophone,
  FaMicrophoneSlash,
  FaVideo,
  FaVideoSlash,
  FaPhoneSlash,
  FaUsers,
  FaCommentAlt,
  FaShareSquare,
  FaRegSmile,
  FaShieldAlt,
  FaRecordVinyl,
} from "react-icons/fa";

export default function GroupCallPage() {
  const { meetingCode } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  /** 🔧 Refs và state */
  const localVideoRef = useRef(null);
  const peersRef = useRef({});
  const remoteVideosRef = useRef({});
  const containerRef = useRef(null);
  const localStreamRef = useRef(null);
  const [participants, setParticipants] = useState([]);
  const [isHost, setIsHost] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(true);
  const [status, setStatus] = useState("🔌 Connecting...");
  const [showPeople, setShowPeople] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [videoCount, setVideoCount] = useState(1);

  /** 💬 Chat state */
  const [chatMessages, setChatMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  /** 💬 Gửi tin nhắn chat (chuẩn hóa với backend) */
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!messageInput.trim()) return;

    wsMeetingManager.send(
      {
        type: "meeting-chat",
        message: messageInput.trim(),
      },
      "/ws/meeting"
    );

    setMessageInput("");
    setShowEmojiPicker(false);
  };

  /** 😄 Khi chọn emoji */
  const handleEmojiClick = (emojiData) => {
    setMessageInput((prev) => prev + emojiData.emoji);
  };

  /** 🎥 Khởi tạo stream local */
  const initLocalStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      console.log("📹 Local stream initialized");
    } catch (err) {
      console.error("❌ Media error:", err);
      toast.error("Không thể mở camera hoặc micro");
    }
  };

  /** 🌐 Hàm xử lý join phòng */
  const connectMeeting = async (token) => {
    try {
      console.log("🚀 [GroupCallPage] meetingCode =", meetingCode);

      const infoRes = await fetch(`http://localhost:8081/api/meetings/${meetingCode}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (infoRes.ok) {
        const meetingInfo = await infoRes.json();
        setIsHost(meetingInfo.hostEmail === user.email);
        setParticipants(meetingInfo.participants || []);
      }

      const joinRes = await fetch(`http://localhost:8081/api/meetings/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ meetingCode }),
      });

      if (!joinRes.ok) {
        const msg = await joinRes.text();
        toast.error(msg || "Không thể tham gia phòng họp");
        navigate("/dashboard");
        return;
      }

      await initLocalStream();

      await wsMeetingManager.connect("/ws/meeting", token, handleSocketMessage);
      wsMeetingManager.send({ type: "join", meetingCode }, "/ws/meeting");

      const historyRes = await fetch(
        `http://localhost:8081/api/meetings/${meetingCode}/messages`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (historyRes.ok) {
        const data = await historyRes.json();
        if (data?.messages) {
          setChatMessages(
            data.messages.map((m) => ({
              from: m.sender,
              message: m.content,
              time: m.timestamp,
              reactions: {},
            }))
          );
        }
      }

      setStatus("🟢 Connected to meeting");
    } catch (err) {
      console.error("❌ Connection failed:", err);
      toast.error("Không thể kết nối đến phòng họp");
      navigate("/dashboard");
    }
  };

  /** ⚡ Xử lý WS message */
  const handleSocketMessage = async (msg) => {
    console.log("[WS][meeting] Message:", msg);
    switch (msg.type) {
      case "participant-list":
        setParticipants(msg.participants || []);
        await delay(50);
        msg.participants?.forEach(async (email) => {
          if (email !== user.email && user.email < email && !peersRef.current[email]) {
            await createOffer(email);
          }
        });
        break;
      case "participant-joined":
        toast.success(`${msg.email} joined`);
        setParticipants((prev) => [...new Set([...prev, msg.email])]);
        await delay(50);
        if (msg.email !== user.email && user.email < msg.email && !peersRef.current[msg.email]) {
          await createOffer(msg.email);
        }
        break;
      case "participant-left":
        toast.error(`${msg.email} left`);
        setParticipants((prev) => prev.filter((p) => p !== msg.email));
        removePeer(msg.email);
        break;
      case "offer":
        await handleOffer(msg);
        break;
      case "answer":
        await handleAnswer(msg);
        break;
      case "ice-candidate":
        await handleIce(msg);
        break;
      case "meeting-chat":
        setChatMessages((prev) => [
          ...prev,
          {
            from: msg.sender,
            message: msg.message,
            time: msg.timestamp,
            reactions: {},
          },
        ]);
        break;
      case "meeting-ended":
        toast.error("💥 Cuộc họp đã kết thúc bởi host");
        endCall(true);
        break;
      default:
        console.warn("⚠️ Unknown WS message", msg);
    }
  };

  /** 🧡 Thêm reaction cho từng tin nhắn */
  const handleAddReaction = (index, emoji) => {
    setChatMessages((prev) => {
      const updated = [...prev];
      const msg = { ...updated[index] };
      msg.reactions = msg.reactions || {};
      msg.reactions[emoji] = (msg.reactions[emoji] || 0) + 1;
      updated[index] = msg;
      return updated;
    });
  };

  /** 🧱 WebRTC utilities */
  const createPeerConnection = (peerEmail) => {
    if (peersRef.current[peerEmail]) return peersRef.current[peerEmail];
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => pc.addTrack(t, localStreamRef.current));
    }

    pc.ontrack = (e) => handleRemoteTrack(peerEmail, e.streams[0]);

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        wsMeetingManager.send(
          { type: "ice-candidate", to: peerEmail, from: user.email, candidate: e.candidate },
          "/ws/meeting"
        );
      }
    };

    peersRef.current[peerEmail] = pc;
    return pc;
  };

  const handleRemoteTrack = (peerEmail, stream) => {
    if (remoteVideosRef.current[peerEmail]) return;
    const wrapper = document.createElement("div");
    wrapper.className =
      "video-tile relative flex flex-col items-center justify-center bg-black rounded-2xl overflow-hidden border border-gray-700 shadow-md aspect-video transition-transform hover:scale-105";
    const v = document.createElement("video");
    v.autoplay = true;
    v.playsInline = true;
    v.className = "w-full h-full object-cover";
    v.srcObject = stream;
    const label = document.createElement("div");
    label.className = "absolute bottom-2 left-2 text-sm bg-black/50 px-2 py-1 rounded";
    label.textContent = peerEmail;
    wrapper.appendChild(v);
    wrapper.appendChild(label);
    containerRef.current.appendChild(wrapper);
    remoteVideosRef.current[peerEmail] = wrapper;
    setVideoCount(containerRef.current.children.length);
  };

  const createOffer = async (peerEmail) => {
    const pc = createPeerConnection(peerEmail);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    wsMeetingManager.send(
      { type: "offer", to: peerEmail, from: user.email, sdp: offer.sdp },
      "/ws/meeting"
    );
  };

  const handleOffer = async (msg) => {
    const { from, sdp } = msg;
    const pc = peersRef.current[from] || createPeerConnection(from);
    await pc.setRemoteDescription({ type: "offer", sdp });
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    wsMeetingManager.send(
      { type: "answer", to: from, from: user.email, sdp: answer.sdp },
      "/ws/meeting"
    );
  };

  const handleAnswer = async (msg) => {
    const pc = peersRef.current[msg.from];
    if (pc && pc.signalingState === "have-local-offer") {
      await pc.setRemoteDescription({ type: "answer", sdp: msg.sdp });
    } else {
      console.warn("⚠️ Skip duplicate/invalid answer:", pc?.signalingState);
    }
  };

  const handleIce = async (msg) => {
    const pc = peersRef.current[msg.from];
    if (pc && msg.candidate) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
      } catch (err) {
        console.error("❌ ICE error:", err);
      }
    }
  };

  const removePeer = (email) => {
    const pc = peersRef.current[email];
    if (pc) pc.close();
    delete peersRef.current[email];
    const video = remoteVideosRef.current[email];
    if (video) video.remove();
    delete remoteVideosRef.current[email];
    setVideoCount(containerRef.current.children.length);
  };

  const getGridClass = () => {
    if (videoCount <= 1) return "grid-cols-1";
    if (videoCount <= 2) return "grid-cols-2";
    if (videoCount <= 4) return "grid-cols-2";
    if (videoCount <= 9) return "grid-cols-3";
    if (videoCount <= 16) return "grid-cols-4";
    return "grid-cols-5";
  };

  const delay = (ms) => new Promise((res) => setTimeout(res, ms));

  const endCall = async (skipEndApi = false) => {
    const token = sessionStorage.getItem("accessToken");
    if (!skipEndApi && isHost) {
      try {
        await fetch(`http://localhost:8081/api/meetings/${meetingCode}/end`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        toast.success("✅ Cuộc họp đã kết thúc");
      } catch (err) {
        console.error("❌ End meeting failed:", err);
      }
    }

    Object.values(peersRef.current).forEach((pc) => pc.close());
    peersRef.current = {};
    if (localStreamRef.current)
      localStreamRef.current.getTracks().forEach((t) => t.stop());
    wsMeetingManager.disconnect("/ws/meeting", "Leaving meeting");
    navigate("/dashboard");
  };

  const toggleMic = () => {
    localStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = !t.enabled));
    setMicEnabled((s) => !s);
  };

  const toggleCam = () => {
    localStreamRef.current?.getVideoTracks().forEach((t) => (t.enabled = !t.enabled));
    setCamEnabled((s) => !s);
  };

  useEffect(() => {
    const token = sessionStorage.getItem("accessToken");
    if (!token) return navigate("/login");
    connectMeeting(token);
    return () => {
      wsMeetingManager.send({ type: "leave" }, "/ws/meeting");
      endCall(true);
    };
  }, [meetingCode]);

  /** 🧭 Render UI */
  return (
    <div className="flex flex-col h-screen bg-[#1c1d22] text-white">
      {/* Header */}
      <header className="flex justify-between items-center px-6 py-3 bg-[#25262d] border-b border-gray-700">
        <div>
          <h1 className="text-lg font-semibold">Meeting Code: {meetingCode}</h1>
          <p className="text-xs text-gray-400">{status}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowPeople(!showPeople)}
            className="flex items-center gap-2 px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-md text-sm"
          >
            <FaUsers /> People
          </button>
          <button
            onClick={() => setShowChat(!showChat)}
            className="flex items-center gap-2 px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-md text-sm"
          >
            <FaCommentAlt /> Chat
          </button>
        </div>
      </header>

      {/* Main grid */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 bg-[#1c1d22] p-4 overflow-auto">
          <div
            ref={containerRef}
            className={`grid ${getGridClass()} gap-4 w-full h-full justify-center items-center transition-all duration-300`}
          >
            <div className="relative flex flex-col items-center justify-center bg-black rounded-2xl overflow-hidden border-2 border-blue-500 shadow-lg aspect-video">
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className={`w-full h-full object-cover ${!camEnabled ? "hidden" : ""}`}
              />
              {!camEnabled && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-800 text-5xl font-bold text-white">
                  {user?.firstName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "?"}
                </div>
              )}
              <div className="absolute bottom-2 left-2 text-sm bg-black/50 px-2 py-1 rounded">
                You {isHost && "(Host)"}
              </div>
            </div>
          </div>
        </div>

        {/* People Sidebar */}
        {showPeople && (
          <aside className="w-64 bg-[#25262d] border-l border-gray-700 p-4 overflow-y-auto">
            <h2 className="text-md font-semibold mb-3">
              👥 Participants ({participants.length})
            </h2>
            <ul className="space-y-2 text-sm">
              {participants.map((p) => (
                <li
                  key={p}
                  className={`p-2 rounded-md ${p === user.email ? "bg-blue-700" : "bg-gray-700"}`}
                >
                  {p === user.email ? `${p} (You)` : p}
                  {p === user.email && isHost && (
                    <span className="ml-1 text-yellow-400 text-xs">[Host]</span>
                  )}
                </li>
              ))}
            </ul>
          </aside>
        )}

        {/* 💬 Chat Sidebar */}
        {showChat && (
          <aside className="w-80 bg-[#25262d] border-l border-gray-700 flex flex-col">
            <div className="p-4 border-b border-gray-700">
              <h2 className="text-md font-semibold">💬 Chat</h2>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {chatMessages.length === 0 ? (
                <p className="text-gray-500 text-sm text-center mt-4">
                  No messages yet
                </p>
              ) : (
                chatMessages.map((m, i) => (
                  <div
                    key={i}
                    className={`flex ${m.from === user.email ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[75%] p-2 rounded-lg text-sm relative ${
                        m.from === user.email
                          ? "bg-blue-600 text-white"
                          : "bg-gray-700 text-gray-200"
                      }`}
                    >
                      <p className="font-semibold text-xs text-gray-300 mb-1">
                        {m.from === user.email ? "You" : m.from}
                      </p>
                      <p>{m.message}</p>
                      {m.reactions && Object.keys(m.reactions).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {Object.entries(m.reactions).map(([emoji, count]) => (
                            <span
                              key={emoji}
                              className="bg-black/30 px-2 py-[2px] rounded-full text-xs cursor-pointer"
                              title={`${count} reaction`}
                            >
                              {emoji} {count > 1 && count}
                            </span>
                          ))}
                        </div>
                      )}
                      <button
                        onClick={() => handleAddReaction(i, "❤️")}
                        className="absolute -top-2 -right-2 bg-black/50 text-xs rounded-full px-1.5 py-0.5 hover:bg-black/70"
                        title="React ❤️"
                      >
                        ❤️
                      </button>
                      <p className="text-[10px] text-gray-400 mt-1 text-right">
                        {new Date(m.time).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* input chat + emoji */}
            <form
              onSubmit={handleSendMessage}
              className="border-t border-gray-700 p-3 flex items-center gap-2 relative"
            >
              <button
                type="button"
                onClick={() => setShowEmojiPicker((v) => !v)}
                className="text-xl text-gray-400 hover:text-yellow-400"
              >
                <FaRegSmile />
              </button>
              {showEmojiPicker && (
                <div className="absolute bottom-14 left-2 z-50">
                  <EmojiPicker
                    onEmojiClick={handleEmojiClick}
                    emojiStyle="native"
                    width={300}
                    height={350}
                  />
                </div>
              )}
              <input
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 bg-gray-800 text-white rounded-md px-3 py-2 text-sm outline-none"
              />
              <button
                type="submit"
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-sm font-semibold"
              >
                Send
              </button>
            </form>
          </aside>
        )}
      </div>

      {/* Toolbar */}
      <footer className="flex justify-center items-center gap-6 py-3 bg-[#25262d] border-t border-gray-700">
        <button onClick={toggleMic} className="p-3 rounded-full bg-gray-700 hover:bg-gray-600">
          {micEnabled ? <FaMicrophone /> : <FaMicrophoneSlash />}
        </button>
        <button onClick={toggleCam} className="p-3 rounded-full bg-gray-700 hover:bg-gray-600">
          {camEnabled ? <FaVideo /> : <FaVideoSlash />}
        </button>
        <button className="p-3 rounded-full bg-gray-700 hover:bg-gray-600">
          <FaShareSquare />
        </button>
        <button className="p-3 rounded-full bg-gray-700 hover:bg-gray-600">
          <FaRecordVinyl />
        </button>
        <button className="p-3 rounded-full bg-gray-700 hover:bg-gray-600">
          <FaRegSmile />
        </button>
        {isHost && (
          <button className="p-3 rounded-full bg-gray-700 hover:bg-gray-600">
            <FaShieldAlt />
          </button>
        )}
        <button
          onClick={() => endCall(isHost ? false : true)}
          className={`p-3 rounded-full shadow-md ${
            isHost ? "bg-red-600 hover:bg-red-700" : "bg-orange-500 hover:bg-orange-600"
          }`}
        >
          <FaPhoneSlash />
        </button>
      </footer>
    </div>
  );
}
