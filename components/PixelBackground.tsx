import React, { useEffect, useRef } from 'react';

interface PixelBackgroundProps {
  theme: 'DARK' | 'LIGHT';
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  char: string;
  size: number;
  opacity: number;
  color: string;
}

const PixelBackground: React.FC<PixelBackgroundProps> = ({ theme }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -9999, y: -9999 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = 0;
    let height = 0;
    
    const chars = "01XYZE<>[]{}+-*/=@#";
    const particles: Particle[] = [];
    
    // Configuration
    const particleDensity = 4000; // Higher = fewer particles (width*height / density)
    const baseSpeed = 0.2;
    const friction = 0.96;
    const influenceRadius = 150;
    
    // Theme Colors
    const colorIdle = theme === 'DARK' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)';
    const colorActive = theme === 'DARK' ? '#FF4500' : '#FF4500'; // International Orange
    const colorText = theme === 'DARK' ? '#FFFFFF' : '#000000';

    const init = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      width = canvas.width = rect?.width || window.innerWidth;
      height = canvas.height = rect?.height || window.innerHeight;
      
      const count = Math.floor((width * height) / particleDensity);
      particles.length = 0; // Clear existing

      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * baseSpeed,
          vy: (Math.random() - 0.5) * baseSpeed,
          char: chars[Math.floor(Math.random() * chars.length)],
          size: Math.floor(Math.random() * 10) + 8, // 8px to 18px
          opacity: Math.random() * 0.5 + 0.1,
          color: colorIdle
        });
      }
    };

    const draw = () => {
      // Clear with trail effect? No, clean clear for crisp text.
      ctx.clearRect(0, 0, width, height);
      
      const time = Date.now() * 0.001;
      const mouseX = mouseRef.current.x;
      const mouseY = mouseRef.current.y;

      particles.forEach(p => {
        // 1. Tidal Flow (Sine Wave Physics)
        // Creates a gentle, oceanic drift
        const tideX = Math.sin(time + p.y * 0.002) * 0.2;
        const tideY = Math.cos(time + p.x * 0.002) * 0.1;

        p.vx += tideX * 0.01;
        p.vy += tideY * 0.01;

        // 2. Mouse Interaction (Repulsion & Excitation)
        const dx = mouseX - p.x;
        const dy = mouseY - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < influenceRadius) {
            const force = (influenceRadius - dist) / influenceRadius;
            const angle = Math.atan2(dy, dx);
            
            // Push away
            p.vx -= Math.cos(angle) * force * 0.5;
            p.vy -= Math.sin(angle) * force * 0.5;

            // "Digital Glitch": Randomize character when disturbed
            if (Math.random() > 0.8) {
                p.char = chars[Math.floor(Math.random() * chars.length)];
            }
            
            // Highlight
            p.opacity = Math.min(p.opacity + 0.1, 1);
            p.color = colorActive;
        } else {
            // Decay back to normal
            p.opacity = Math.max(p.opacity - 0.01, 0.1); // Min opacity 0.1
            p.color = colorIdle;
        }

        // 3. Update Position
        p.vx *= friction;
        p.vy *= friction;
        p.x += p.vx;
        p.y += p.vy;

        // 4. Wrap Around Screen
        if (p.x > width) p.x = 0;
        if (p.x < 0) p.x = width;
        if (p.y > height) p.y = 0;
        if (p.y < 0) p.y = height;

        // 5. Draw
        ctx.font = `${p.size}px monospace`;
        
        // Handle Color Blending manually for performance
        if (p.color === colorActive) {
             ctx.fillStyle = `rgba(255, 69, 0, ${p.opacity})`; // Explicit Orange
        } else {
             // Theme based idle color
             if (theme === 'DARK') {
                 ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity * 0.2})`;
             } else {
                 ctx.fillStyle = `rgba(0, 0, 0, ${p.opacity * 0.2})`;
             }
        }
        
        ctx.fillText(p.char, p.x, p.y);
      });

      animationFrameId = requestAnimationFrame(draw);
    };

    init();
    draw();

    const handleResize = () => init();
    
    const handleMouseMove = (e: MouseEvent) => {
        const rect = canvas.getBoundingClientRect();
        mouseRef.current = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [theme]);

  return (
    <canvas 
      ref={canvasRef} 
      className="absolute inset-0 w-full h-full pointer-events-none z-0 mix-blend-screen"
    />
  );
};

export default PixelBackground;