import React, { useEffect, useRef } from 'react';

interface AsciiBackgroundProps {
  theme: 'DARK' | 'LIGHT';
}

const AsciiBackground: React.FC<AsciiBackgroundProps> = ({ theme }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;
    
    const chars = '01XYZE░▒▓█<>/';
    const charArray = chars.split('');
    const fontSize = 14;
    const columns = width / fontSize;
    const drops: number[] = [];

    for (let i = 0; i < columns; i++) {
      drops[i] = 1;
    }

    const draw = () => {
      // Trail effect color depends on theme
      // Dark: Almost black trail. Light: Almost white trail.
      if (theme === 'DARK') {
        ctx.fillStyle = 'rgba(5, 5, 5, 0.05)';
        ctx.fillStyle = '#1a1a1a'; // Dark grey text
      } else {
        ctx.fillStyle = 'rgba(242, 242, 242, 0.05)'; // Matches --color-void #F2F2F2
      }
      
      ctx.fillRect(0, 0, width, height);

      // Text color
      if (theme === 'DARK') {
          ctx.fillStyle = '#1a1a1a'; // Subtle dark grey for background noise
      } else {
          ctx.fillStyle = '#D4D4D8'; // Light grey (zinc-300) for light mode noise
      }
      
      ctx.font = `${fontSize}px monospace`;

      for (let i = 0; i < drops.length; i++) {
        const text = charArray[Math.floor(Math.random() * charArray.length)];
        ctx.fillText(text, i * fontSize, drops[i] * fontSize);

        if (drops[i] * fontSize > height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }
    };

    const interval = setInterval(draw, 33);

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', handleResize);
    };
  }, [theme]);

  return (
    <canvas 
      ref={canvasRef} 
      className="fixed top-0 left-0 w-full h-full -z-10 pointer-events-none opacity-40"
    />
  );
};

export default AsciiBackground;