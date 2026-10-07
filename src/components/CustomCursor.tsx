import React, { useEffect, useState } from 'react';

const CustomCursor = () => {
  const [trail, setTrail] = useState<{ x: number; y: number; id: number }[]>([]);

  useEffect(() => {
    let idCounter = 0;
    const updatePosition = (e: MouseEvent) => {
      setTrail((prevTrail) => {
        const newTrail = [...prevTrail, { x: e.clientX, y: e.clientY, id: idCounter++ }];
        if (newTrail.length > 20) {
          newTrail.shift();
        }
        return newTrail;
      });
    };

    window.addEventListener('mousemove', updatePosition);

    const interval = setInterval(() => {
      setTrail((prevTrail) => {
        if (prevTrail.length > 0) {
          return prevTrail.slice(1);
        }
        return prevTrail;
      });
    }, 50);

    return () => {
      window.removeEventListener('mousemove', updatePosition);
      clearInterval(interval);
    };
  }, []);

  const pastelColors = ['#F472B6', '#38BDF8', '#C084FC', '#FDE047', '#34D399', '#FDA4AF'];

  return (
    <>
      {/* Pastel Starlight Trail */}
      {trail.map((point, index) => {
        const color = pastelColors[point.id % pastelColors.length];
        return (
          <div
            key={point.id}
            className="pointer-events-none fixed z-50 rounded-full blur-[1.5px] mix-blend-screen transition-opacity duration-300"
            style={{
              left: `${point.x - 4}px`,
              top: `${point.y - 4}px`,
              backgroundColor: color,
              boxShadow: `0 0 8px ${color}`,
              width: `${Math.max(2, 9 - (trail.length - index) * 0.35)}px`,
              height: `${Math.max(2, 9 - (trail.length - index) * 0.35)}px`,
              opacity: (index / trail.length) * 0.85,
            }}
          />
        );
      })}
    </>
  );
};

export default CustomCursor;
