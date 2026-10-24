import React, { useState } from 'react';

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom';
}

export const Tooltip: React.FC<TooltipProps> = ({ content, children, position = 'top' }) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div
      className="relative inline-flex items-center"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div
          className={`absolute ${
            position === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
          } left-1/2 -translate-x-1/2 z-50 px-2.5 py-1 text-[11px] font-medium text-slate-200 bg-slate-900/95 border border-white/15 rounded-lg shadow-xl backdrop-blur-md whitespace-nowrap pointer-events-none animate-fadeIn`}
        >
          {content}
        </div>
      )}
    </div>
  );
};
