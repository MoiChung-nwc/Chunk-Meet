import React from "react";

export const Button = ({
  children,
  onClick,
  variant = "default",
  className = "",
}) => {
  const base =
    "px-4 py-2 rounded-md font-medium text-sm transition-colors focus:outline-none";
  const variants = {
    default: "bg-blue-600 hover:bg-blue-700 text-white",
    secondary: "bg-gray-700 hover:bg-gray-600 text-gray-200",
    danger: "bg-red-600 hover:bg-red-700 text-white",
  };
  return (
    <button onClick={onClick} className={`${base} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
};
