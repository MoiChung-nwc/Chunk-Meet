import React, { useEffect, useRef, useState, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import toast from "react-hot-toast";
import { wsManager } from "../utils/WebSocketManager";

export default function GroupCallPage() {
  const { meetingCode } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const localVideoRef = useRef(null);
  const peersRef = useRef({});
  const remoteVideosRef = useRef({});
  const containerRef = useRef(null);
  const localStreamRef = useRef(null);

  const [status, setStatus] = useState("Connecting...");
  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(true);

  useEffect(() => {
    const token = sessionStorage.getItem("accessToken");
    if (!token) {
      navigate("/login");
      return;
    }

    const onMessage = async (msg) => {
      switch (msg.type) {
        case "participant-joined":
          toast(`${msg.email} joined`);
          await createOffer(msg.email);
          break;
        case "participant-left":
          toast(`${msg.email} left`);
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
        default:
          console.log("Unknown message", msg);
      }
    };

    wsManager.connect("/ws/meeting", token, onMessage);
    wsManager.send({ type: "join", meetingCode, email: user.email });

    initLocalStream();
    setStatus("🟢 Connected to meeting");

    return () => {
      wsManager.send({ type: "leave", meetingCode, email: user.email });
      endCall();
      wsManager.disconnect("Leaving meeting");
    };
  }, [meetingCode]);

  const initLocalStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    } catch (err) {
      toast.error("Không thể mở camera hoặc micro");
    }
  };

  const createPeerConnection = (peerEmail) => {
    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => pc.addTrack(t, localStreamRef.current));
    }

    pc.ontrack = (e) => {
      if (!remoteVideosRef.current[peerEmail]) {
        const v = document.createElement("video");
        v.autoplay = true;
        v.playsInline = true;
        v.className = "w-64 h-48 rounded-lg bg-black";
        v.srcObject = e.streams[0];
        containerRef.current.appendChild(v);
        remoteVideosRef.current[peerEmail] = v;
      }
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        wsManager.send({
          type: "ice-candidate",
          meetingCode,
          from: user.email,
          candidate: e.candidate,
        });
      }
    };

    peersRef.current[peerEmail] = pc;
    return pc;
  };

  const createOffer = async (peerEmail) => {
    const pc = createPeerConnection(peerEmail);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    wsManager.send({
      type: "offer",
      to: peerEmail,
      from: user.email,
      sdp: offer.sdp,
      meetingCode,
    });
  };

  const handleOffer = async (msg) => {
    const { from, sdp } = msg;
    const pc = createPeerConnection(from);
    await pc.setRemoteDescription({ type: "offer", sdp });
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    wsManager.send({
      type: "answer",
      to: from,
      from: user.email,
      sdp: answer.sdp,
      meetingCode,
    });
  };

  const handleAnswer = async (msg) => {
    const pc = peersRef.current[msg.from];
    if (pc) await pc.setRemoteDescription({ type: "answer", sdp: msg.sdp });
  };

  const handleIce = async (msg) => {
    const pc = peersRef.current[msg.from];
    if (pc && msg.candidate) {
      await pc.addIceCandidate(msg.candidate);
    }
  };

  const removePeer = (email) => {
    const pc = peersRef.current[email];
    if (pc) pc.close();
    delete peersRef.current[email];

    const video = remoteVideosRef.current[email];
    if (video) {
      video.remove();
      delete remoteVideosRef.current[email];
    }
  };

  const endCall = () => {
    Object.values(peersRef.current).forEach((pc) => pc.close());
    peersRef.current = {};
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    navigate("/dashboard");
  };

  const toggleMic = () => {
    const tracks = localStreamRef.current?.getAudioTracks() || [];
    tracks.forEach((t) => (t.enabled = !t.enabled));
    setMicEnabled((s) => !s);
  };

  const toggleCam = () => {
    const tracks = localStreamRef.current?.getVideoTracks() || [];
    tracks.forEach((t) => (t.enabled = !t.enabled));
    setCamEnabled((s) => !s);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="w-full max-w-6xl bg-white shadow-lg rounded-xl p-6">
        <div className="flex justify-between mb-4">
          <h1 className="text-xl font-semibold">👥 Group Meeting: {meetingCode}</h1>
          <div>{status}</div>
        </div>

        <div className="grid grid-cols-3 gap-4" ref={containerRef}>
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="w-64 h-48 rounded-lg bg-black border-2 border-blue-400"
          />
        </div>

        <div className="flex gap-3 mt-6 justify-center">
          <button
            onClick={toggleMic}
            className={`px-4 py-2 rounded-lg ${micEnabled ? "bg-green-500" : "bg-gray-400"} text-white`}
          >
            {micEnabled ? "🎙 Mic On" : "🔇 Mic Off"}
          </button>
          <button
            onClick={toggleCam}
            className={`px-4 py-2 rounded-lg ${camEnabled ? "bg-green-500" : "bg-gray-400"} text-white`}
          >
            {camEnabled ? "📹 Cam On" : "📷 Cam Off"}
          </button>
          <button
            onClick={endCall}
            className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700"
          >
            🚪 Leave Meeting
          </button>
        </div>
      </div>
    </div>
  );
}
