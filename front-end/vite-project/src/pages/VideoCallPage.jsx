import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { usePeerConnection } from "../hooks/usePeerConnection";
import { useSignaling } from "../hooks/useSignaling";
import WebRTCLogger from "../utils/webrtcLogger";
import toast from "react-hot-toast";

const logger = new WebRTCLogger("VideoCallPage");

const VideoCallPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [ready, setReady] = useState(false);
  const [isCaller, setIsCaller] = useState(false);
  const [peerStream, setPeerStream] = useState(null);

  const userEmail = sessionStorage.getItem("email");
  const token = sessionStorage.getItem("accessToken"); // ✅ Đồng bộ tên token
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerEmailRef = useRef(null);
  const readyPromise = useRef(null);

  const {
    createPeerConnection,
    initLocalStream,
    createOffer,
    createAnswer,
    setRemoteDescription,
    addRemoteCandidate,
    closeConnection,
  } = usePeerConnection(userEmail, (stream) => {
    logger.log("remoteStreamAttached", `✅ Remote stream received (id=${stream.id})`);
    setPeerStream(stream);
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = stream;
  });

  // ✅ Sử dụng useSignaling đúng cách
  const { send, ready: signalingReady } = useSignaling(token, onSignalingMessage);

  // 🧠 Xác định người gọi / người nhận
  useEffect(() => {
    const state = location?.state || {};
    const storedPeer = sessionStorage.getItem("peerEmail");
    const storedIsCaller = sessionStorage.getItem("isCaller") === "true";

    let peer = null;
    let callerFlag = false;

    if (state.isCaller || storedIsCaller) {
      peer = state.to || storedPeer;
      callerFlag = true;
    } else {
      peer = state.from || storedPeer;
    }

    peerEmailRef.current = peer;
    setIsCaller(callerFlag);
    logger.log("[VideoCallPage] initial peerEmailRef set ->", peer);
  }, [location.state]);

  // 🔄 Khởi tạo WebRTC và signaling
  useEffect(() => {
    (async () => {
      if (!userEmail || !token) {
        toast.error("User chưa đăng nhập");
        navigate("/login");
        return;
      }

      window.isInCall = true;

      // 1️⃣ Tạo kết nối WebRTC và local stream
      await createPeerConnection();
      await initLocalStream(localVideoRef);

      // 2️⃣ Đợi signaling sẵn sàng
      await signalingReady;
      setReady(true);
      readyPromise.current = Promise.resolve();

      // 3️⃣ Tham gia signaling
      send({ type: "join", from: userEmail });
      logger.log("👋 Joined signaling as", userEmail);

      // 4️⃣ Gửi "ready" sau 700ms
      setTimeout(sendReady, 700);
    })();

    return () => {
      logger.log("[VideoCallPage] 🧹 Cleanup");
      window.isInCall = false;
      closeConnection();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 📤 Gửi tín hiệu "ready"
  const sendReady = async () => {
    const target = peerEmailRef.current;
    if (!target || target === userEmail) {
      console.warn(
        `🚫 Skip sending ready to self or missing target (user=${userEmail}, target=${target})`
      );
      return;
    }

    if (!ready) {
      await readyPromise.current;
    }

    send({ type: "ready", from: userEmail, to: target });
    logger.log(`🟢 Sent ready from ${userEmail} → ${target}`);
  };

  // 📩 Xử lý message từ signaling server
  async function onSignalingMessage(msg) {
    logger.log("[Signaling] ←", msg);

    switch (msg.type) {
      case "peer-ready":
        if (msg.from === userEmail) return;
        logger.log("✅ Peer ready:", msg.from);
        if (isCaller) {
          logger.log("📞 I'm caller, creating offer...");
          await createOffer(msg.from, readyPromise.current);
        }
        break;

      case "offer":
        logger.log("📩 Received offer from", msg.from);
        await createAnswer(msg.from, msg.sdp, readyPromise.current);
        break;

      case "answer":
        logger.log("📩 Received answer from", msg.from);
        await setRemoteDescription(msg.sdp);
        break;

      case "ice-candidate":
        logger.log("🧊 Received ICE candidate from", msg.from);
        await addRemoteCandidate(msg.candidate);
        break;

      case "end-call":
        logger.log("🔴 End call received, cleaning up");
        closeConnection();
        navigate("/dashboard");
        break;

      default:
        logger.log("⚠️ Unknown signaling message type:", msg.type);
    }
  }

  // 🎥 Giao diện UI hiện đại (Meet-style)
  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      {/* Header */}
      <header className="absolute top-4 left-0 right-0 flex justify-between items-center px-6 z-20">
        <h2 className="text-lg font-semibold tracking-wide text-gray-200">
          {isCaller ? "📞 Calling as" : "🎧 In call as"}{" "}
          <span className="text-blue-400">{userEmail}</span>
        </h2>
        <button
          onClick={() => navigate("/dashboard")}
          className="px-4 py-1.5 rounded-md bg-gray-700 hover:bg-gray-600 text-sm text-gray-200 transition"
        >
          ← Back
        </button>
      </header>

      {/* Video layout */}
      <div className="flex flex-col md:flex-row items-center justify-center gap-6 mt-10 md:mt-0">
        {/* Remote video */}
        <div className="relative">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-[700px] h-[450px] max-w-[90vw] rounded-2xl bg-black object-cover shadow-2xl border border-gray-700"
          />
          <div className="absolute bottom-3 left-4 bg-gray-900/70 text-sm px-3 py-1.5 rounded-lg">
            {peerEmailRef.current || "Waiting for peer..."}
          </div>
        </div>

        {/* Local video */}
        <div className="absolute bottom-28 right-10 md:bottom-10 md:right-10 w-[220px] h-[160px] rounded-xl overflow-hidden border border-gray-700 shadow-lg">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover bg-black"
          />
          <div className="absolute bottom-2 left-3 bg-gray-900/70 text-xs px-2 py-1 rounded">
            You
          </div>
        </div>
      </div>

      {/* Control bar */}
      <div className="absolute bottom-6 flex items-center justify-center gap-6 bg-gray-900/70 px-8 py-4 rounded-full shadow-lg backdrop-blur-sm border border-gray-700 z-20">
        {/* Toggle Camera */}
        <button
          onClick={() => {
            const stream = localVideoRef.current?.srcObject;
            if (!stream) return;
            const videoTrack = stream.getVideoTracks()[0];
            videoTrack.enabled = !videoTrack.enabled;
          }}
          className="flex flex-col items-center text-sm text-gray-300 hover:text-white transition"
        >
          <div className="w-12 h-12 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center shadow-md transition">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14m0 0v1a2 2 0 01-2 2H6a2 2 0 01-2-2V9a2 2 0 012-2h7a2 2 0 012 2v5z"
              />
            </svg>
          </div>
          <span className="mt-1">Camera</span>
        </button>

        {/* Toggle Microphone */}
        <button
          onClick={() => {
            const stream = localVideoRef.current?.srcObject;
            if (!stream) return;
            const audioTrack = stream.getAudioTracks()[0];
            audioTrack.enabled = !audioTrack.enabled;
          }}
          className="flex flex-col items-center text-sm text-gray-300 hover:text-white transition"
        >
          <div className="w-12 h-12 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center shadow-md transition">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 1a3 3 0 00-3 3v7a3 3 0 006 0V4a3 3 0 00-3-3z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 10v2a7 7 0 01-14 0v-2M12 19v4m-4 0h8"
              />
            </svg>
          </div>
          <span className="mt-1">Mic</span>
        </button>

        {/* Share screen */}
        <button
          onClick={async () => {
            try {
              const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
              const pc = window.currentPeerConnection; // bạn có thể lưu peerConnection trong global hoặc context
              if (pc && pc.getSenders) {
                const sender = pc.getSenders().find((s) => s.track?.kind === "video");
                if (sender) sender.replaceTrack(screenStream.getTracks()[0]);
              }
              localVideoRef.current.srcObject = screenStream;

              screenStream.getVideoTracks()[0].onended = () => {
                // Khi người dùng dừng share, revert về camera
                navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((camStream) => {
                  if (sender) sender.replaceTrack(camStream.getTracks()[0]);
                  localVideoRef.current.srcObject = camStream;
                });
              };
            } catch (err) {
              console.error("❌ Share screen failed:", err);
            }
          }}
          className="flex flex-col items-center text-sm text-gray-300 hover:text-white transition"
        >
          <div className="w-12 h-12 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center shadow-md transition">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 5h18M3 10h18M3 15h18M3 20h18"
              />
            </svg>
          </div>
          <span className="mt-1">Share</span>
        </button>

        {/* End Call */}
        <button
          onClick={() => {
            send({
              type: "end-call",
              from: userEmail,
              to: peerEmailRef.current,
            });
            closeConnection();
            navigate("/dashboard");
          }}
          className="flex flex-col items-center text-sm text-gray-300 hover:text-red-500 transition"
        >
          <div className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center shadow-md transition">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-7 h-7"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <span className="mt-1">End</span>
        </button>
      </div>
    </div>
  );

};

export default VideoCallPage;
