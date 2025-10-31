import React, { createContext, useState, useEffect } from "react";
import { login, register, refresh, logout } from "../api/authApi";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [refreshToken, setRefreshToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  /** ✅ Load dữ liệu người dùng từ sessionStorage */
  useEffect(() => {
    const email = sessionStorage.getItem("email");
    const roles = JSON.parse(sessionStorage.getItem("roles") || "[]");
    const permissions = JSON.parse(sessionStorage.getItem("permissions") || "[]");
    const acc = sessionStorage.getItem("accessToken");
    const ref = sessionStorage.getItem("refreshToken");

    if (email && acc && ref) {
      setUser({ email, roles, permissions });
      setAccessToken(acc);
      setRefreshToken(ref);
    }
    setIsLoading(false);
  }, []);

  /** ✅ Đăng nhập */
  const handleLogin = async (email, password) => {
    const res = await login({ email, password });
    const { accessToken, refreshToken, roles, permissions } = res.data.data;

    const userData = { email, roles, permissions };
    setUser(userData);
    setAccessToken(accessToken);
    setRefreshToken(refreshToken);

    // 🔹 Lưu vào sessionStorage
    Object.entries({
      email,
      roles: JSON.stringify(roles),
      permissions: JSON.stringify(permissions),
      accessToken,
      refreshToken,
    }).forEach(([k, v]) => sessionStorage.setItem(k, v));

    // 🔹 Lưu thêm vào localStorage để backup (Dashboard fallback)
    localStorage.setItem("user", JSON.stringify(userData));
  };

  /** ✅ Đăng ký */
  const handleRegister = async (data) => {
    const res = await register(data);
    const { accessToken, refreshToken, roles, permissions } = res.data.data;

    const userData = { email: data.email, roles, permissions };
    setUser(userData);
    setAccessToken(accessToken);
    setRefreshToken(refreshToken);

    // 🔹 Lưu vào sessionStorage
    Object.entries({
      email: data.email,
      roles: JSON.stringify(roles),
      permissions: JSON.stringify(permissions),
      accessToken,
      refreshToken,
    }).forEach(([k, v]) => sessionStorage.setItem(k, v));

    // 🔹 Lưu thêm vào localStorage
    localStorage.setItem("user", JSON.stringify(userData));
  };

  /** 🧹 Đóng tất cả socket */
  const closeAllSockets = () => {
    try {
      if (window.callSocket?.readyState === WebSocket.OPEN) {
        window.callSocket.close(1000, "Logout");
        delete window.callSocket;
        console.log("🧹 Closed /ws/call socket");
      }
      if (window.signalingSocket?.readyState === WebSocket.OPEN) {
        window.signalingSocket.close(1000, "Logout");
        delete window.signalingSocket;
        console.log("🧹 Closed /ws/signaling socket");
      }
    } catch (e) {
      console.warn("Socket cleanup error:", e);
    }
  };

  /** ✅ Logout */
  const handleLogout = async () => {
    try {
      if (refreshToken) await logout({ refreshToken });
    } catch (e) {
      console.warn("Logout error:", e);
    } finally {
      closeAllSockets();
      sessionStorage.clear();
      localStorage.removeItem("user"); // 🔹 Xóa backup user
      setUser(null);
      setAccessToken(null);
      setRefreshToken(null);
    }
  };

  /** 🔄 Auto refresh token mỗi 10 phút */
  useEffect(() => {
    if (!refreshToken) return;

    const interval = setInterval(async () => {
      try {
        const res = await refresh({ refreshToken });
        const newAccessToken = res.data.data.accessToken;
        setAccessToken(newAccessToken);
        sessionStorage.setItem("accessToken", newAccessToken);
        console.log("🔄 Token refreshed");
      } catch (e) {
        console.error("Auto refresh token failed:", e);
        handleLogout();
      }
    }, 1000 * 60 * 10);

    return () => clearInterval(interval);
  }, [refreshToken]);

  /** 🧹 Cleanup sockets khi đóng tab / refresh trang */
  useEffect(() => {
    const beforeUnload = () => {
      closeAllSockets();
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        refreshToken,
        isLoading,
        handleLogin,
        handleRegister,
        handleLogout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
