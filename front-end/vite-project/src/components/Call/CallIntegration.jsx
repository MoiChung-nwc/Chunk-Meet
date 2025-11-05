import React, { useEffect, useState, useRef, useCallback } from "react";
import { wsManager } from "../../utils/WebSocketManager";
import { useNavigate } from "react-router-dom";

/**
 * 🎥 CallIntegration v4.9 – DEBUG END NAVIGATION
 * - ✅ Ghi log chi tiết timeline điều hướng và callOrigin
 * - ✅ Dễ truy vết khi bị redirect sai về Dashboard
 * - ⚙️ Giữ nguyên toàn bộ logic cũ
 */
const CallIntegration = ({ token, myEmail }) => {
  const [incoming, setIncoming] = useState(null);
  const [isRinging, setIsRinging] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);
  const navigate = useNavigate();
  const audioRef = useRef(null);
  const timerRef = useRef(null);
  const hasAlertedRef = useRef(false);

  const log = (...args) => {
    const ts = new Date().toLocaleTimeString("vi-VN");
    console.log(`[CallIntegration:${ts}]`, ...args);
  };

  const onCallMessage = useCallback(
    (msg) => {
      log("📨 Received msg:", msg, " currentPath=", window.location.pathname);

      switch (msg.type) {
        case "incoming-call":
          if (msg.from === myEmail) return;
          if (isRinging) return;
          log("📞 Incoming call from:", msg.from);
          setIncoming({ from: msg.from });
          setIsRinging(true);
          setTimeLeft(30);
          hasAlertedRef.current = false;
          break;

        case "accept-call":
          log("✅ Call accepted by:", msg.from);
          stopRinging();

          sessionStorage.setItem("peerEmail", msg.from);
          sessionStorage.setItem("isCaller", "true");

          setIncoming(null);
          setIsRinging(false);
          hasAlertedRef.current = false;

          const currentPath = window.location.pathname;
          const origin = currentPath.includes("/chat")
            ? "chat"
            : currentPath.includes("/dashboard")
            ? "dashboard"
            : "unknown";
          sessionStorage.setItem("callOrigin", origin);
          log("🧭 [ACCEPT] Detected origin:", origin, " path=", currentPath);

          if (origin === "chat" || origin === "unknown") {
            log("➡️ Navigating to /videocall (caller)");
            navigate("/videocall", { state: { to: msg.from, isCaller: true } });
          }

          // Event cho Dashboard
          window.dispatchEvent(
            new CustomEvent("callAccepted", { detail: { to: msg.from } })
          );
          window.dispatchEvent(new CustomEvent("clearCalleeEmail"));
          break;

        case "reject-call":
          handleEndNavigation(`${msg.from} đã từ chối cuộc gọi.`, "reject");
          break;

        case "hangup":
          handleEndNavigation("Cuộc gọi đã kết thúc.", "hangup");
          break;

        default:
          break;
      }
    },
    [myEmail, isRinging, navigate]
  );

  /** 🧭 Xử lý khi kết thúc call */
  const handleEndNavigation = (message, eventType) => {
    const currentPath = window.location.pathname;
    const origin = sessionStorage.getItem("callOrigin");

    log(
      `🔚 [${eventType.toUpperCase()}] Triggered. message="${message}", currentPath=${currentPath}, callOrigin=${origin}`
    );

    if (hasAlertedRef.current) {
      log("⚠️ Skip duplicate alert (already handled)");
      return;
    }

    hasAlertedRef.current = true;
    stopRinging();
    setIncoming(null);
    alert(message);
    window.dispatchEvent(new CustomEvent("clearCalleeEmail"));
    cleanupAfterCall();

    // 🧭 Quay lại đúng nơi bắt đầu
    if (origin === "chat") {
      log("🔙 Returning to /chat based on callOrigin=chat");
      navigate("/chat");
    } else if (origin === "dashboard") {
      log("🔙 Returning to /dashboard based on callOrigin=dashboard");
      navigate("/dashboard");
    } else {
      log("⚠️ Unknown origin, staying on current path:", currentPath);
    }

    // Clear callOrigin
    sessionStorage.removeItem("callOrigin");
  };

  // 🧠 Kết nối WebSocket call
  useEffect(() => {
    if (!token) return;

    log("🔌 Connecting /ws/call with token...");
    wsManager.removeListener("/ws/call", onCallMessage);
    wsManager.connect("/ws/call", token, onCallMessage);

    return () => {
      log("🧹 Cleanup /ws/call listener");
      wsManager.removeListener("/ws/call", onCallMessage);
    };
  }, [token, onCallMessage]);

  // 🕒 Countdown tự reject
  useEffect(() => {
    if (!isRinging) return;
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          handleReject();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [isRinging]);

  // 🔊 Chuông
  useEffect(() => {
    if (isRinging && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.loop = true;
      audioRef.current.volume = 0.7;
      audioRef.current
        .play()
        .then(() => log("🔔 Ringing started"))
        .catch((e) => log("⚠️ Ringing blocked:", e));
    } else if (!isRinging && audioRef.current) {
      audioRef.current.pause();
      log("🔕 Ringing stopped");
    }
  }, [isRinging]);

  const stopRinging = () => {
    if (audioRef.current) audioRef.current.pause();
    clearInterval(timerRef.current);
    setIsRinging(false);
  };

  const cleanupAfterCall = () => {
    log("🧹 CleanupAfterCall: disconnect /ws/call and reset state");
    wsManager.disconnect("/ws/call", "end-call");
    setIncoming(null);
    setIsRinging(false);
    hasAlertedRef.current = false;

    // reconnect
    setTimeout(() => {
      log("🔁 Attempting reconnect /ws/call...");
      wsManager.connect("/ws/call", token, onCallMessage).catch(() => {
        log("⚠️ reconnect /ws/call failed");
      });
    }, 1200);
  };

  const handleAccept = async () => {
    if (!incoming) return;
    stopRinging();

    if (!wsManager.isConnected("/ws/call")) {
      log("⚙️ Waiting for /ws/call ready...");
      await wsManager.waitUntilReady("/ws/call").catch(() => {});
    }

    wsManager.send(
      { type: "accept-call", from: myEmail, to: incoming.from },
      "/ws/call"
    );

    sessionStorage.setItem("peerEmail", incoming.from);
    sessionStorage.setItem("isCaller", "false");

    const currentPath = window.location.pathname;
    const origin = currentPath.includes("/chat")
      ? "chat"
      : currentPath.includes("/dashboard")
      ? "dashboard"
      : "unknown";
    sessionStorage.setItem("callOrigin", origin);
    log("🧭 [ACCEPT by callee] Detected origin:", origin);

    setIncoming(null);
    navigate("/videocall", { state: { from: incoming.from, isCaller: false } });
    window.dispatchEvent(new CustomEvent("clearCalleeEmail"));
  };

  const handleReject = async () => {
    if (!incoming) return;
    stopRinging();
    if (!wsManager.isConnected("/ws/call")) return;
    wsManager.send(
      { type: "reject-call", from: myEmail, to: incoming.from },
      "/ws/call"
    );
    handleEndNavigation("Bạn đã từ chối cuộc gọi.", "manual-reject");
  };

  if (!incoming) return null;

  // 🧩 UI giữ nguyên
  return (
    <>
      <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-[9999] backdrop-blur-sm animate-fadeIn">
        <div className="bg-white shadow-2xl rounded-2xl p-6 w-[320px] text-center relative">
          <div className="flex justify-center mb-3">
            <img
              src="https://cdn-icons-png.flaticon.com/512/3135/3135715.png"
              alt="caller"
              className="w-20 h-20 rounded-full border-4 border-blue-500 shadow-lg animate-pulse"
            />
          </div>

          <h3 className="text-lg font-semibold text-gray-800 mb-1">
            {incoming.from}
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            Đang gọi đến bạn... ({timeLeft}s)
          </p>

          <div className="flex justify-center gap-6">
            <button
              onClick={handleReject}
              className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white shadow-md transition transform hover:scale-105"
            >
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>

            <button
              onClick={handleAccept}
              className="w-14 h-14 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center text-white shadow-md transition transform hover:scale-105"
            >
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
                  d="M22 12.54a15.05 15.05 0 00-10-3.82 15.05 15.05 0 00-10 3.82M12 3v9"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <audio ref={audioRef} src="/sounds/ringtone.mp3" preload="auto" />
    </>
  );
};

export default CallIntegration;
