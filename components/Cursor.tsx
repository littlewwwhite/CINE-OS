import React, { useEffect, useRef } from 'react';

const Cursor: React.FC = () => {
  const cursorRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const moveMouse = (e: MouseEvent) => {
      // Direct DOM manipulation for zero latency
      // Subtract half width/height (12px) to center the 24px cursor
      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate3d(${e.clientX - 12}px, ${e.clientY - 12}px, 0)`;
      }
      
      // Update coordinates text
      if (textRef.current) {
         textRef.current.style.transform = `translate3d(${e.clientX + 20}px, ${e.clientY + 20}px, 0)`;
         textRef.current.innerText = `X:${e.clientX} Y:${e.clientY}`;
      }
    };

    window.addEventListener('mousemove', moveMouse);
    return () => window.removeEventListener('mousemove', moveMouse);
  }, []);

  return (
    <>
      {/* Main Crosshair - Fixed 24px size, centered via translate logic */}
      <div
        ref={cursorRef}
        className="fixed top-0 left-0 pointer-events-none z-[9999] mix-blend-difference w-6 h-6 flex items-center justify-center will-change-transform"
      >
        <div className="absolute w-full h-[1px] bg-[var(--color-accent)]" />
        <div className="absolute h-full w-[1px] bg-[var(--color-accent)]" />
      </div>

      {/* Coordinate Label - Minimal text, no background */}
      <div 
        ref={textRef}
        className="fixed top-0 left-0 pointer-events-none z-[9998] mix-blend-difference text-[9px] font-mono text-[var(--color-accent)] tracking-widest whitespace-nowrap will-change-transform opacity-70"
      >
        X:0 Y:0
      </div>
    </>
  );
};

export default Cursor;