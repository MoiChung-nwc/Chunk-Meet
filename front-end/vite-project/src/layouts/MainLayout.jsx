import React from "react";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";

/**
 * MainLayout - Layout tổng thể full màn hình
 */
export default function MainLayout({
  children,
  center = false,
  showSidebar = false,
  showNavbar = true,
  dark = false,
}) {
  return (
    <div
      className={`h-screen w-screen flex flex-col overflow-hidden transition-colors
        ${dark ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-900"}`}
    >
      {/* Navbar */}
      {showNavbar && <Navbar />}

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        {showSidebar && (
          <div className="w-64 shrink-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
            <Sidebar />
          </div>
        )}

        {/* Main content */}
        <main
          className={`flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900 ${
            center ? "flex items-center justify-center" : "p-6"
          }`}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
