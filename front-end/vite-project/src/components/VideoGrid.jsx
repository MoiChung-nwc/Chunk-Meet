import React from 'react';

/**
 * VideoGrid - main large video area + dynamic background / large image
 * Props:
 *  - mainSrc: URL or null (fallback bg)
 *  - children: optional overlay elements
 */
export default function VideoGrid({ mainSrc, children }) {
  return (
    <div className="flex-1 relative bg-gray-100 dark:bg-gray-900 overflow-hidden rounded-lg m-4">
      {/* Main large video / background */}
      <div className="w-full h-full">
        {mainSrc ? (
          <img src={mainSrc} alt="main" className="object-cover w-full h-full rounded-lg" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-900 rounded-lg" />
        )}
      </div>

      {/* overlay slot (e.g., local small preview) */}
      <div className="absolute left-4 bottom-4">{children}</div>
    </div>
  );
}
