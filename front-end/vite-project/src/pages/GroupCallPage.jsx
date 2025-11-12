import React, { useEffect, useRef, useState, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import toast from "react-hot-toast";
import { wsMeetingManager, wsFileManager } from "../utils/WebSocketManager";
import { FileP2PManager } from "../utils/FileP2P";
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

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../components/ui/dialog";
import { Button } from "../components/ui/button";

export default function GroupCallPage() {
  const { meetingCode } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  /** Refs và state */
  const localVideoRef = useRef(null);
  const peersRef = useRef({});
  const remoteVideosRef = useRef({});
  const containerRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenTrackRef = useRef(null);
  const [focusedUser, setFocusedUser] = useState(null);
  const fileManagerRef = useRef(null); // FileP2PManager ref
  const [incomingFile, setIncomingFile] = useState(null);

  const [participants, setParticipants] = useState([]);
  const [isHost, setIsHost] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(true);
  const [isSharing, setIsSharing] = useState(false);
  const [status, setStatus] = useState("🔌 Connecting...");
  const [showPeople, setShowPeople] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [videoCount, setVideoCount] = useState(1);

  /** Chat state */
  const [chatMessages, setChatMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);

  /** ====================== WebRTC Signaling Layer ====================== */
  const createOffer = async (toEmail) => {
    console.log(`🟢 Creating offer to ${toEmail}`);

    // isOfferer = true → chỉ bên này tạo fileChannel
    const pc = createPeerConnection(toEmail, true);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    wsMeetingManager.send(
      { type: "offer", to: toEmail, from: user.email, sdp: offer },
      "/ws/meeting"
    );
  };

  const handleOffer = async (msg) => {
    const { from, sdp } = msg;
    console.log(`📩 Received offer from ${from}`);

    // isOfferer = false → không tạo fileChannel, chỉ lắng nghe
    const pc = createPeerConnection(from, false);

    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    wsMeetingManager.send(
      { type: "answer", to: from, from: user.email, sdp: answer },
      "/ws/meeting"
    );
  };

  const handleAnswer = async (msg) => {
    const { from, sdp } = msg;
    console.log(`📩 Received answer from ${from}`);
    const pc = peersRef.current[from];
    if (pc) await pc.setRemoteDescription(new RTCSessionDescription(sdp));
  };

  const handleIce = async (msg) => {
    const { from, candidate } = msg;
    const pc = peersRef.current[from];
    if (pc && candidate) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error("❌ Error adding ICE:", err);
      }
    }
  };

  const handleRemoteTrack = (peerEmail, stream) => {
    console.log(`🎥 Remote stream from ${peerEmail}`);
    if (!remoteVideosRef.current[peerEmail]) {
      const video = document.createElement("video");
      video.srcObject = stream;
      video.autoplay = true;
      video.playsInline = true;
      video.className =
        "rounded-2xl border-2 border-gray-700 shadow-lg w-full h-full object-cover";
      video.onclick = () =>
        setFocusedUser((prev) => (prev === peerEmail ? null : peerEmail));
      containerRef.current.appendChild(video);
      remoteVideosRef.current[peerEmail] = video;
    }
    setVideoCount(containerRef.current.children.length);
  };

  /** ==================================================================== */

  /** Gửi tin nhắn chat */
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

  const handleEmojiClick = (emojiData) => {
    setMessageInput((prev) => prev + emojiData.emoji);
  };

  /** Khởi tạo camera/mic */
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

  /** Kết nối meeting */
  const connectMeeting = async (token) => {
    try {
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
      await wsFileManager.connect("/ws/file", token, handleFileSignal);

      fileManagerRef.current = new FileP2PManager({
        userEmail: user.email,
        peersRef,
        wsManager: wsFileManager,
        getPcByEmail: (email) => peersRef.current[email],
        onIncomingFileOffer: setIncomingFile,
      });

      wsMeetingManager.send({ type: "join", meetingCode }, "/ws/meeting");
      setTimeout(() => {
        wsMeetingManager.send({ type: "get-meeting-history" }, "/ws/meeting");
      }, 800);

      setStatus("Connected to meeting");
    } catch (err) {
      console.error("❌ Connection failed:", err);
      toast.error("Không thể kết nối đến phòng họp");
      navigate("/dashboard");
    }
  };

  /** WS message */
  const handleSocketMessage = async (msg) => {
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
            from: msg.sender || msg.from,
            message: msg.message,
            time: msg.timestamp || new Date().toISOString(),
            fileUrl: msg.fileUrl || null,
            fileName: msg.fileName || null,
            fileSize: msg.fileSize || null,
            fileType: msg.fileType || null,
          },
        ]);
        break;
      case "meeting-history":
        setChatMessages((prev) => [
          ...msg.messages.map((m) => ({
            from: m.sender,
            message: m.message,
            time: m.timestamp,
          })),
          ...prev,
        ]);
        break;
      case "meeting-ended":
        toast.error("💥 Cuộc họp đã kết thúc bởi host");
        endCall(true);
        break;
      case "screen-share":
        if (msg.active) {
          setFocusedUser(msg.email);
          toast(`${msg.email} đang chia sẻ màn hình`);
        } else if (focusedUser === msg.email) {
          setFocusedUser(null);
        }
        break;
      default:
        break;
    }
  };

  /** File signaling */
  const handleFileSignal = (msg) => {
    switch (msg.type) {
      case "file-offer":
        fileManagerRef.current?.handleSignalingFileOffer(msg);
        break;
      case "file-offer-response":
        fileManagerRef.current?.handleSignalingFileOfferResponse(msg);
        break;
      default:
        console.log("Unknown file message:", msg);
    }
  };

  /** 📁 Gửi file cho các thành viên trong phòng */
  const handleSendFile = async () => {
    try {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "*/*";

      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!fileManagerRef.current) {
          toast.error("❌ File manager chưa sẵn sàng");
          return;
        }

        // Lưu file pending để gửi sau khi người nhận chấp nhận
        fileManagerRef.current.pendingFile = file;

        // Gửi “file-offer” tới tất cả peer khác
        for (const peerEmail of Object.keys(peersRef.current)) {
          if (peerEmail === user.email) continue;
          // ✅ Gửi file thật, không gửi metadata
          fileManagerRef.current.sendFileOffer(peerEmail, file);
        }

        toast("📨 Đã gửi yêu cầu chia sẻ file, chờ người nhận chấp nhận...");
      };

      input.click();
    } catch (err) {
      console.error("❌ Lỗi khi gửi file:", err);
      toast.error("Không thể gửi file");
    }
  };



  /** Peer connection */
  const createPeerConnection = (peerEmail, isOfferer = false) => {
    if (peersRef.current[peerEmail]) return peersRef.current[peerEmail];

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    // ✅ 1️⃣ Add track trước để SDP có audio/video
    const activeStream = isSharing
      ? new MediaStream([screenTrackRef.current])
      : localStreamRef.current;

    if (activeStream) {
      activeStream.getTracks().forEach((track) => pc.addTrack(track, activeStream));
      console.log(`[RTC] 🎥 Added ${activeStream.getTracks().length} tracks for ${peerEmail}`);
    } else {
      console.warn("[RTC] ⚠️ No active stream to add tracks from");
    }

    // ✅ 2️⃣ Sau đó mới tạo fileChannel nếu là offerer
    if (fileManagerRef.current && isOfferer) {
      console.log(`[RTC] ⚡ Creating fileChannel (offerer) with ${peerEmail}`);
      const fileChannel = pc.createDataChannel("fileChannel");
      fileManagerRef.current._setupChannel(fileChannel, peerEmail, true);
    }

    // 📡 Nhận DataChannel từ peer (ở phía answerer)
    pc.ondatachannel = (e) => {
      console.log(`[RTC] 📡 ondatachannel from ${peerEmail}, label=${e.channel.label}`);
      if (e.channel.label === "fileChannel") {
        if (fileManagerRef.current) {
          fileManagerRef.current.handleIncomingChannel(peerEmail, e.channel);
        } else {
          console.warn("[RTC] ⚠️ FileManager chưa sẵn sàng, retry sau 1s...");
          setTimeout(() => {
            if (fileManagerRef.current) {
              console.log("[RTC] 🔁 Retry handleIncomingChannel");
              fileManagerRef.current.handleIncomingChannel(peerEmail, e.channel);
            } else {
              console.error("[RTC] ❌ FileManager vẫn chưa sẵn sàng sau 1s");
            }
          }, 1000);
        }
      }
    };

    // 🎥 Khi nhận track từ peer
    pc.ontrack = (e) => {
      console.log(`[RTC] 🎥 ontrack from ${peerEmail}`, e.streams);
      handleRemoteTrack(peerEmail, e.streams[0]);
    };

    // 🧊 Gửi ICE candidate
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        wsMeetingManager.send(
          {
            type: "ice-candidate",
            to: peerEmail,
            from: user.email,
            candidate: e.candidate,
          },
          "/ws/meeting"
        );
      }
    };

    // 🔍 Theo dõi trạng thái kết nối ICE
    pc.onconnectionstatechange = () => {
      console.log(`[RTC] Connection (${peerEmail}):`, pc.connectionState);
    };

    peersRef.current[peerEmail] = pc;
    return pc;
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
    return "grid auto-rows-fr grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4";
  };

  const delay = (ms) => new Promise((res) => setTimeout(res, ms));

  const endCall = async (skipEndApi = false) => {
    const token = sessionStorage.getItem("accessToken");
    if (!skipEndApi && isHost) {
      await fetch(`http://localhost:8081/api/meetings/${meetingCode}/end`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Cuộc họp đã kết thúc");
    }
    Object.values(peersRef.current).forEach((pc) => pc.close());
    peersRef.current = {};
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    wsMeetingManager.disconnect("/ws/meeting", "Leaving meeting");
    wsFileManager.disconnect("/ws/file", "Leaving meeting");
    navigate("/dashboard");
  };

  /** 🎙️ Toggle Microphone */
  const toggleMic = () => {
    const audioTracks = localStreamRef.current?.getAudioTracks() || [];
    if (audioTracks.length === 0) {
      toast.error("Không tìm thấy micro");
      return;
    }
    const newEnabled = !micEnabled;
    audioTracks.forEach((t) => (t.enabled = newEnabled));
    setMicEnabled(newEnabled);
    toast(newEnabled ? "🔊 Bật micro" : "🔇 Tắt micro");
  };

  /** 🎥 Toggle Camera */
  const toggleCam = () => {
    const videoTracks = localStreamRef.current?.getVideoTracks() || [];
    if (videoTracks.length === 0) {
      toast.error("Không tìm thấy camera");
      return;
    }
    const newEnabled = !camEnabled;
    videoTracks.forEach((t) => (t.enabled = newEnabled));
    setCamEnabled(newEnabled);
    toast(newEnabled ? "📹 Bật camera" : "📷 Tắt camera");
  };

  /** 🖥️ Toggle Screen Share */
  const toggleScreenShare = async () => {
    try {
      if (!isSharing) {
        // 🔹 Bắt đầu chia sẻ màn hình
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];
        screenTrackRef.current = screenTrack;

        // Thay thế track video gửi đi
        Object.values(peersRef.current).forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === "video");
          if (sender) sender.replaceTrack(screenTrack);
        });

        // ✅ Cập nhật preview local
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }

        // Khi user tự dừng chia sẻ từ UI của trình duyệt
        screenTrack.onended = () => {
          stopScreenShare(); // 🔥 Không gọi toggleScreenShare() nữa
        };

        setIsSharing(true);
        wsMeetingManager.send(
          { type: "screen-share", active: true, email: user.email },
          "/ws/meeting"
        );
        toast("🖥️ Đang chia sẻ màn hình");
      } else {
        stopScreenShare(); // ✅ dùng hàm riêng
      }
    } catch (err) {
      console.error("❌ Screen share error:", err);
      toast.error("Không thể chia sẻ màn hình");
    }
  };

  // 👉 Hàm dừng chia sẻ (độc lập)
  const stopScreenShare = () => {
    const camTrack = localStreamRef.current?.getVideoTracks()[0];
    Object.values(peersRef.current).forEach((pc) => {
      const sender = pc.getSenders().find((s) => s.track?.kind === "video");
      if (sender && camTrack) sender.replaceTrack(camTrack);
    });

    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }

    setIsSharing(false);
    wsMeetingManager.send(
      { type: "screen-share", active: false, email: user.email },
      "/ws/meeting"
    );
    toast("🛑 Dừng chia sẻ màn hình");
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

  const renderFileModal = () => {
    if (!incomingFile) return null;

    const { from, meta, blob, url, isReceivedFile } = incomingFile;

    // 🧠 Nếu là file đã nhận xong (tức có blob/url) → không hiển thị modal, mà đưa thẳng vào chat
    if (isReceivedFile || blob || url) {
      console.log(`[GroupCallPage] 📁 File ${meta?.name} đã nhận xong từ ${from}`);

      setChatMessages((prev) => [
        ...prev,
        {
          from,
          message: `📎 ${meta?.name}`,
          time: new Date().toISOString(),
          fileUrl: url || null,
          fileName: meta?.name || null,
          fileSize: meta?.size || null,
          fileType: meta?.type || null,
        },
      ]);

      toast.success(`${from} đã gửi file: ${meta?.name}`);
      setIncomingFile(null);
      return null;
    }

    // 📨 Nếu là offer thật sự (chưa có blob/url) → hiển thị modal bình thường
    return (
      <Dialog open={!!incomingFile} onOpenChange={() => setIncomingFile(null)}>
        <DialogContent className="bg-[#25262d] text-white rounded-xl shadow-xl p-6 max-w-md">
          <DialogHeader>
            <DialogTitle>📁 File incoming</DialogTitle>
            <DialogDescription>
              {from} muốn gửi cho bạn file{" "}
              <b className="text-blue-300">{meta.name}</b> (
              {(meta.size / 1024).toFixed(1)} KB)
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-4 flex justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                // ❌ Từ chối
                fileManagerRef.current.ws.send(
                  { type: "file-offer-response", to: from, accept: false },
                  "/ws/file"
                );
                toast("🚫 Đã từ chối nhận file");
                setIncomingFile(null);
              }}
              className="bg-gray-600 hover:bg-gray-500"
            >
              Từ chối
            </Button>

            <Button
              onClick={() => {
                // ✅ Đồng ý
                fileManagerRef.current.ws.send(
                  { type: "file-offer-response", to: from, accept: true },
                  "/ws/file"
                );
                toast("📥 Đang nhận file...");
                setIncomingFile(null);
              }}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Chấp nhận
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };


  /** Render UI */
  return (
    <div className="flex flex-col min-h-screen bg-[#1c1d22] text-white overflow-hidden">
      {/* Header */}
      <header className="flex justify-between items-center px-4 sm:px-6 py-3 bg-[#25262d] border-b border-gray-700">
        <div>
          <h1 className="text-base sm:text-lg font-semibold">Meeting Code: {meetingCode}</h1>
          <p className="text-[11px] sm:text-xs text-gray-400">{status}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowPeople(!showPeople)}
            className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-md text-xs sm:text-sm"
          >
            <FaUsers /> People
          </button>
          <button
            onClick={() => setShowChat(!showChat)}
            className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-md text-xs sm:text-sm"
          >
            <FaCommentAlt /> Chat
          </button>
        </div>
      </header>

      {/* Main grid */}
      <div className="flex flex-1 overflow-hidden">
        {/* 🎥 Video area */}
        <div className="flex-1 bg-[#1c1d22] p-2 sm:p-4 overflow-auto">
          <div
            ref={containerRef}
            className={`grid ${
              focusedUser ? "grid-cols-1" : getGridClass()
            } gap-3 sm:gap-4 w-full h-full justify-center items-center transition-all duration-300`}
          >
            {/* Local video */}
            <div
              onClick={() => setFocusedUser((prev) => (prev === user.email ? null : user.email))}
              className={`relative flex flex-col items-center justify-center bg-black rounded-2xl overflow-hidden border-2 ${
                focusedUser === user.email ? "border-yellow-400 scale-[1.02]" : "border-blue-500"
              } shadow-lg aspect-video cursor-pointer transition-transform duration-300`}
              style={{
                gridColumn: focusedUser === user.email ? "1 / -1" : undefined,
                gridRow: focusedUser === user.email ? "1 / -1" : undefined,
              }}
            >
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className={`w-full h-full object-cover ${!camEnabled ? "hidden" : ""}`}
              />
              {!camEnabled && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-800 text-4xl sm:text-5xl font-bold text-white">
                  {user?.firstName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "?"}
                </div>
              )}
              <div className="absolute bottom-2 left-2 text-xs sm:text-sm bg-black/50 px-2 py-1 rounded">
                You {isHost && "(Host)"}
              </div>
            </div>
          </div>
        </div>

        {/* 🧑‍🤝‍🧑 People sidebar */}
        {showPeople && (
          <aside className="fixed sm:relative bottom-0 sm:bottom-auto left-0 sm:left-auto w-full sm:w-64 h-[45vh] sm:h-auto bg-[#25262d] border-t sm:border-t-0 sm:border-l border-gray-700 p-4 overflow-y-auto z-40 transition-all duration-300">
            <h2 className="text-sm sm:text-md font-semibold mb-3">
              👥 Participants ({participants.length})
            </h2>
            <ul className="space-y-2 text-xs sm:text-sm">
              {participants.map((p) => (
                <li
                  key={p}
                  className={`p-2 rounded-md ${
                    p === user.email ? "bg-blue-700" : "bg-gray-700"
                  }`}
                >
                  {p === user.email ? `${p} (You)` : p}
                  {p === user.email && isHost && (
                    <span className="ml-1 text-yellow-400 text-[11px]">[Host]</span>
                  )}
                </li>
              ))}
            </ul>
          </aside>
        )}

        {/* 💬 Chat sidebar */}
        {showChat && (
          <aside className="fixed sm:relative bottom-0 sm:bottom-auto left-0 sm:left-auto w-full sm:w-80 h-[50vh] sm:h-auto bg-[#25262d] border-t sm:border-t-0 sm:border-l border-gray-700 flex flex-col z-40 transition-all duration-300">
            <div className="p-4 border-b border-gray-700">
              <h2 className="text-md font-semibold">💬 Chat</h2>
            </div>

            {/* 💬 Danh sách tin nhắn */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {chatMessages.length === 0 ? (
                <p className="text-gray-500 text-sm text-center mt-4">No messages yet</p>
              ) : (
                chatMessages.map((m, i) => {
                  const isSender = m.from === user.email;
                  const time = new Date(m.time).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <div key={i} className={`flex ${isSender ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[80%] sm:max-w-[75%] p-2 rounded-lg text-xs sm:text-sm relative ${
                          isSender ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-200"
                        }`}
                      >
                        {/* 👤 Tên người gửi */}
                        <p className="font-semibold text-[11px] text-gray-300 mb-1">
                          {isSender ? "You" : m.from}
                        </p>

                        {/* 📎 Nếu là file → hiển thị link tải */}
                        {m.fileUrl ? (
                          <div className="flex flex-col">
                            <span className="flex items-center gap-2">
                              <span>📎</span>
                              <a
                                href={m.fileUrl}
                                download={m.fileName || "file"}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline text-blue-300 hover:text-blue-400 break-all"
                              >
                                {m.fileName || "Tệp tin"}
                              </a>
                            </span>
                            {m.fileSize && (
                              <span className="text-[10px] text-gray-300 mt-1">
                                ({(m.fileSize / 1024).toFixed(1)} KB)
                              </span>
                            )}
                          </div>
                        ) : (
                          <p>{m.message}</p>
                        )}

                        {/* 🕒 Thời gian gửi */}
                        <p className="text-[10px] text-gray-400 mt-1 text-right">{time}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* 💬 Chat input */}
            <form
              onSubmit={handleSendMessage}
              className="border-t border-gray-700 p-2 sm:p-3 flex items-center gap-2 relative"
            >
              {/* 😄 Emoji */}
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
                    width={260}
                    height={320}
                  />
                </div>
              )}

              {/* ➕ Action menu */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowActionMenu((v) => !v)}
                  className="text-2xl text-gray-400 hover:text-blue-400"
                  title="More actions"
                >
                  ➕
                </button>
                {showActionMenu && (
                  <div className="absolute bottom-10 left-0 bg-gray-800 border border-gray-700 rounded-lg shadow-lg w-32 sm:w-36 p-2 z-50">
                    <button
                      onClick={() => {
                        setShowActionMenu(false);
                        handleSendFile();
                      }}
                      className="w-full text-left px-2 sm:px-3 py-2 rounded-md hover:bg-gray-700 text-xs sm:text-sm text-gray-200 flex items-center gap-2"
                    >
                      📁 Send file
                    </button>
                  </div>
                )}
              </div>

              {/* 💬 Input nhập tin nhắn */}
              <input
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 bg-gray-800 text-white rounded-md px-3 py-2 text-xs sm:text-sm outline-none"
              />
              <button
                type="submit"
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-xs sm:text-sm font-semibold"
              >
                Send
              </button>
            </form>
          </aside>
        )}
      </div>

      {/* 🎛 Toolbar */}
      <footer className="flex flex-wrap justify-center items-center gap-3 sm:gap-6 py-2 sm:py-3 bg-[#25262d] border-t border-gray-700">
        <button onClick={toggleMic} className="p-3 rounded-full bg-gray-700 hover:bg-gray-600">
          {micEnabled ? <FaMicrophone /> : <FaMicrophoneSlash />}
        </button>
        <button onClick={toggleCam} className="p-3 rounded-full bg-gray-700 hover:bg-gray-600">
          {camEnabled ? <FaVideo /> : <FaVideoSlash />}
        </button>

        {/* ✅ Nút chia sẻ màn hình */}
        <button
          onClick={toggleScreenShare}
          className={`p-3 rounded-full ${
            isSharing ? "bg-blue-600 hover:bg-blue-700" : "bg-gray-700 hover:bg-gray-600"
          }`}
        >
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
        {renderFileModal()}
      </footer>
    </div>
  );
}
