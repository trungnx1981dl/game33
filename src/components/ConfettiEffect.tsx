import React, { useEffect, useRef } from 'react';

interface ConfettiProps {
  duration?: number;
  particleCount?: number;
}

export default function ConfettiEffect({ duration = 7000, particleCount = 120 }: ConfettiProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const colors = [
      '#FFD700', '#FFA500', '#FF1493', '#00D9FF', 
      '#7B2CBF', '#00FF87', '#FF3366', '#FFFFFF', '#38BDF8'
    ];

    interface Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      color: string;
      rotation: number;
      vRotation: number;
      shape: 'rect' | 'circle' | 'ribbon';
      tiltAngle: number;
      tiltSpeed: number;
    }

    const particles: Particle[] = [];
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height * 0.4 - height * 0.2, // start from top & above
        vx: (Math.random() - 0.5) * 6,
        vy: Math.random() * 3 + 2.5,
        size: Math.random() * 10 + 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        vRotation: (Math.random() - 0.5) * 12,
        shape: Math.random() > 0.4 ? 'rect' : Math.random() > 0.5 ? 'circle' : 'ribbon',
        tiltAngle: Math.random() * Math.PI,
        tiltSpeed: Math.random() * 0.08 + 0.03
      });
    }

    let animId: number;
    const startTime = Date.now();

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      const elapsed = Date.now() - startTime;
      const opacity = elapsed > duration - 1500 
        ? Math.max(0, (duration - elapsed) / 1500) 
        : 1;

      ctx.globalAlpha = opacity;

      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.vRotation;
        p.tiltAngle += p.tiltSpeed;

        // Add subtle sway
        p.x += Math.sin(p.tiltAngle) * 1.5;

        // Reset if goes off screen
        if (p.y > height + 20) {
          p.y = -20;
          p.x = Math.random() * width;
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;

        if (p.shape === 'rect') {
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        } else if (p.shape === 'circle') {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 3, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Ribbon
          ctx.beginPath();
          ctx.moveTo(-p.size / 2, -p.size / 6);
          ctx.lineTo(p.size / 2, p.size / 6);
          ctx.lineWidth = 3;
          ctx.strokeStyle = p.color;
          ctx.stroke();
        }
        ctx.restore();
      });

      if (elapsed < duration) {
        animId = requestAnimationFrame(render);
      } else {
        ctx.clearRect(0, 0, width, height);
      }
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [duration, particleCount]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-[999] w-full h-full"
    />
  );
}
