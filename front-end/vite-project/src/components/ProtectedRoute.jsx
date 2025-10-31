import React, { useContext, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { jwtDecode } from "jwt-decode";

const ProtectedRoute = ({ children, roles = [], permissions = [] }) => {
  const { accessToken, handleLogout, isLoading } = useContext(AuthContext);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const verifyAccess = () => {
      // Nếu AuthContext vẫn đang khởi tạo
      if (isLoading) return;

      const token = accessToken || sessionStorage.getItem("accessToken");
      if (!token) {
        setIsAuthorized(false);
        setChecking(false);
        return;
      }

      try {
        const decoded = jwtDecode(token);
        const now = Date.now() / 1000;

        // ⚠️ Token hết hạn
        if (decoded.exp < now) {
          console.warn("[ProtectedRoute] ⚠️ Token expired → Logging out");
          handleLogout();
          setIsAuthorized(false);
          setChecking(false);
          return;
        }

        // ✅ Kiểm tra role (nếu có yêu cầu)
        if (roles.length > 0 && !roles.some((r) => decoded.roles?.includes(r))) {
          console.warn("[ProtectedRoute] 🚫 Role not authorized");
          setIsAuthorized(false);
          setChecking(false);
          return;
        }

        // ✅ Kiểm tra permission (nếu có yêu cầu)
        if (
          permissions.length > 0 &&
          !permissions.some((p) => decoded.permissions?.includes(p))
        ) {
          console.warn("[ProtectedRoute] 🚫 Permission not authorized");
          setIsAuthorized(false);
          setChecking(false);
          return;
        }

        // ✅ Token hợp lệ
        setIsAuthorized(true);
      } catch (err) {
        console.error("[ProtectedRoute] ❌ Invalid token:", err);
        setIsAuthorized(false);
      } finally {
        setChecking(false);
      }
    };

    verifyAccess();
  }, [accessToken, isLoading, roles, permissions]);

  // ⏳ Loading hoặc đang verify token
  if (isLoading || checking) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-gray-700 text-lg font-medium animate-pulse">
          🔐 Đang xác thực người dùng...
        </div>
      </div>
    );
  }

  // ❌ Không hợp lệ → quay lại login
  if (!isAuthorized) {
    return <Navigate to="/login" replace />;
  }

  // ✅ Token hợp lệ → render component con
  return children;
};

export default ProtectedRoute;
