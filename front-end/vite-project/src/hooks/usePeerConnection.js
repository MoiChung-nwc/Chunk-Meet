// hooks/usePeerConnection.js (v3.1 – fixed to-field + safe ICE handling)
import { useRef } from "react";
import { wsManager } from "../utils/WebSocketManager";
import WebRTCLogger from "../utils/webrtcLogger";

const logger = new WebRTCLogger("WebRTC");

/**
 * usePeerConnection
 * Quản lý lifecycle của WebRTC PeerConnection
 *
 * ✅ FIX: luôn gửi "to" chính xác cho offer/answer/ice
 * ✅ Có peerRef nhớ peer hiện tại
 * ✅ Không gửi tự thân (self-message)
 * ✅ Cleanup an toàn + logging chi tiết
 */
export const usePeerConnection = (userEmail, onRemoteStream) => {
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerEmailRef = useRef(null); // 👈 lưu peer hiện tại

  // 🌍 STUN server (dùng Google STUN mặc định)
  const RTC_CONFIG = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  };

  /**
   * 🧠 Tạo PeerConnection và đăng ký các event
   */
  const createPeerConnection = async () => {
    if (pcRef.current) {
      logger.log("reusePeerConnection");
      return pcRef.current;
    }

    logger.log("createPeerConnection");
    const pc = new RTCPeerConnection(RTC_CONFIG);
    pcRef.current = pc;

    // Gửi ICE candidate qua signaling
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const to = peerEmailRef.current;
        if (!to || to === userEmail) {
          logger.log("skipIceCandidate", `🚫 Missing or self peer (to=${to})`);
          return;
        }
        logger.log("iceCandidateGenerated", event.candidate.candidate);
        wsManager.send(
          {
            type: "ice-candidate",
            from: userEmail,
            to,
            candidate: event.candidate,
          },
          "/ws/signaling"
        );
        logger.log("sendIceCandidate", `to=${to}`);
      }
    };

    // Khi nhận remote track
    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      logger.log(
        "ontrack",
        `kind=${event.track.kind}, id=${remoteStream?.id}, readyState=${event.track.readyState}`
      );

      if (onRemoteStream) {
        onRemoteStream(remoteStream);
        logger.log("attachRemoteStream", "✅ Stream attached to UI");
      } else {
        logger.log("attachRemoteStream", "⚠️ No callback provided");
      }
    };

    // ICE connection state
    pc.oniceconnectionstatechange = () => {
      logger.log("iceStateChange", pc.iceConnectionState);
    };

    // Connection state
    pc.onconnectionstatechange = () => {
      logger.log("connectionStateChange", pc.connectionState);
      if (pc.connectionState === "failed") {
        logger.log("connectionFailed", "Restarting ICE...");
        pc.restartIce();
      }
    };

    logger.log("peerConnectionReady");
    return pc;
  };

  /**
   * 🎥 Lấy local camera/mic
   */
  const initLocalStream = async (localVideoRef) => {
    try {
      logger.log("initLocalStream", "Requesting getUserMedia...");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      localStreamRef.current = stream;

      if (localVideoRef?.current) {
        localVideoRef.current.srcObject = stream;
        logger.log("attachLocalStream", "✅ Local stream displayed");
      }

      const pc = pcRef.current;
      if (pc) {
        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
          logger.log("addTrack", `kind=${track.kind}`);
        });
      }

      return stream;
    } catch (err) {
      logger.log("error", `initLocalStream failed: ${err.message}`);
      throw err;
    }
  };

  /**
   * 📤 Caller tạo offer
   */
  const createOffer = async (to, readyPromise) => {
    const pc = pcRef.current;
    if (!pc) {
      logger.log("error", "No PeerConnection instance (createOffer)");
      return;
    }
    if (!to || to === userEmail) {
      logger.log("error", `Invalid offer target (to=${to})`);
      return;
    }

    peerEmailRef.current = to; // 👈 lưu lại peer
    logger.log("createOffer", `to=${to}`);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    logger.log("setLocalDescription", "offer");

    await readyPromise;
    wsManager.send(
      { type: "offer", from: userEmail, to, sdp: offer },
      "/ws/signaling"
    );
    logger.log("sendOffer", `to=${to}`);
  };

  /**
   * 📩 Callee tạo answer khi nhận offer
   */
  const createAnswer = async (to, remoteSdp, readyPromise) => {
    const pc = pcRef.current;
    if (!pc) {
      logger.log("error", "No PeerConnection instance (createAnswer)");
      return;
    }
    if (!to || to === userEmail) {
      logger.log("error", `Invalid answer target (to=${to})`);
      return;
    }

    peerEmailRef.current = to; // 👈 lưu lại peer
    logger.log("receiveOffer", `from=${to}`);
    await pc.setRemoteDescription(new RTCSessionDescription(remoteSdp));
    logger.log("setRemoteDescription", "offer");

    logger.log("createAnswer", `to=${to}`);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    logger.log("setLocalDescription", "answer");

    await readyPromise;
    wsManager.send(
      { type: "answer", from: userEmail, to, sdp: answer },
      "/ws/signaling"
    );
    logger.log("sendAnswer", `to=${to}`);
  };

  /**
   * 🧩 Nhận answer từ peer
   */
  const setRemoteDescription = async (sdp) => {
    const pc = pcRef.current;
    if (!pc) return;
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      logger.log("setRemoteDescription", sdp.type);
    } catch (err) {
      logger.log("error", `setRemoteDescription failed: ${err.message}`);
    }
  };

  /**
   * 🧊 Nhận ICE candidate từ peer
   */
  const addRemoteCandidate = async (candidate) => {
    const pc = pcRef.current;
    if (!pc) return;
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
      logger.log("addRemoteCandidate", "✅ Candidate added");
    } catch (err) {
      logger.log("error", `addRemoteCandidate failed: ${err.message}`);
    }
  };

  /**
   * 🔚 Đóng kết nối
   */
  const closeConnection = () => {
    const pc = pcRef.current;
    if (pc) {
      logger.log("closePeerConnection");
      pc.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      logger.log("stopLocalTracks");
    }
    logger.dump(); // 👈 Xuất toàn bộ timeline khi kết thúc call
  };

  return {
    createPeerConnection,
    initLocalStream,
    createOffer,
    createAnswer,
    setRemoteDescription,
    addRemoteCandidate,
    closeConnection,
  };
};
