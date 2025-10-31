import axios from "axios";
import { jwtDecode } from "jwt-decode";
import { refresh } from "./authApi";

// ✅ Cấu hình URL base
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8081/api";

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// ✅ Hàm kiểm tra token hết hạn
const isTokenExpired = (token) => {
  try {
    const decoded = jwtDecode(token);
    return decoded.exp < Date.now() / 1000;
  } catch {
    return true;
  }
};

// ✅ Request interceptor
axiosInstance.interceptors.request.use(async (config) => {
  let accessToken = sessionStorage.getItem("accessToken");
  const refreshToken = sessionStorage.getItem("refreshToken");

  if (accessToken && isTokenExpired(accessToken) && refreshToken) {
    try {
      const res = await refresh({ refreshToken });
      const newToken = res.data.data.accessToken;
      accessToken = newToken;
      sessionStorage.setItem("accessToken", newToken);
      console.log("[Axios] 🔁 Token refreshed successfully");
    } catch (err) {
      console.error("[Axios] ❌ Refresh token failed:", err);
      sessionStorage.clear();
      window.location.href = "/login";
    }
  }

  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  return config;
});

// ✅ Response interceptor
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.warn("[Axios] ⚠️ 401 Unauthorized → Redirecting to login");
      sessionStorage.clear();
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
