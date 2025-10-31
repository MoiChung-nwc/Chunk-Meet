import React from "react";
import { Link } from "react-router-dom";

export default function Navbar() {
  return (
    <nav className="bg-white dark:bg-gray-800 shadow-md px-6 py-4 flex justify-between items-center">
      {/* Logo */}
      <Link
        to="/"
        className="text-2xl font-bold text-blue-600 dark:text-blue-400 hover:opacity-90 transition"
      >
        MyApp
      </Link>

      {/* Menu phải */}
      <div className="flex items-center gap-6">
        <Link
          to="/"
          className="text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition"
        >
          Trang chủ
        </Link>
        <Link
          to="/logout"
          className="text-gray-700 dark:text-gray-200 hover:text-red-500 transition"
        >
          Đăng xuất
        </Link>
      </div>
    </nav>
  );
}
