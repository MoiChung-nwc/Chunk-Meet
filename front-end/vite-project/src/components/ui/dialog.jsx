import React from "react";

export const Dialog = ({ open, onOpenChange, children }) => {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={() => onOpenChange?.(false)}
    >
      <div
        className="bg-[#25262d] text-white rounded-xl shadow-xl p-4 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
};

export const DialogContent = ({ children, className = "" }) => (
  <div className={`w-full max-w-md ${className}`}>{children}</div>
);

export const DialogHeader = ({ children }) => (
  <div className="border-b border-gray-700 pb-2 mb-2">{children}</div>
);

export const DialogTitle = ({ children }) => (
  <h2 className="text-lg font-semibold">{children}</h2>
);

export const DialogDescription = ({ children }) => (
  <p className="text-gray-400 text-sm">{children}</p>
);

export const DialogFooter = ({ children, className = "" }) => (
  <div className={`mt-3 flex justify-end gap-2 ${className}`}>{children}</div>
);
