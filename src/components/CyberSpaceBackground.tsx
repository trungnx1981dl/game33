import React, { useMemo } from 'react';

interface CyberSpaceBackgroundProps {
  children?: React.ReactNode;
  className?: string;
  stationColor?: string; // primary accent glow
}

export const CyberSpaceBackground: React.FC<CyberSpaceBackgroundProps> = ({
  children,
  className = '',
  stationColor = '#C084FC'
}) => {
  // Generate deterministic stars for smooth rendering without re-mount flicker
  const stars = useMemo(() => {
    return [
      { x: 5, y: 8, size: 1.5, opacity: 0.8, delay: 0.2, dur: 3.2, color: '#BAE6FD' },
      { x: 12, y: 22, size: 2.2, opacity: 0.9, delay: 1.5, dur: 4.1, color: '#DDD6FE' },
      { x: 18, y: 45, size: 1.2, opacity: 0.7, delay: 2.8, dur: 3.5, color: '#FBCFE8' },
      { x: 25, y: 15, size: 3.0, opacity: 1.0, delay: 0.6, dur: 5.0, color: '#FEF08A' },
      { x: 32, y: 72, size: 1.8, opacity: 0.8, delay: 3.1, dur: 3.8, color: '#99F6E4' },
      { x: 38, y: 35, size: 2.5, opacity: 0.9, delay: 1.1, dur: 4.4, color: '#E9D5FF' },
      { x: 45, y: 18, size: 1.4, opacity: 0.6, delay: 2.3, dur: 3.0, color: '#BAE6FD' },
      { x: 52, y: 60, size: 2.8, opacity: 0.95, delay: 0.9, dur: 4.7, color: '#FED7AA' },
      { x: 60, y: 28, size: 1.5, opacity: 0.75, delay: 1.8, dur: 3.6, color: '#C7D2FE' },
      { x: 68, y: 82, size: 2.2, opacity: 0.85, delay: 2.6, dur: 4.2, color: '#FBCFE8' },
      { x: 74, y: 12, size: 3.2, opacity: 1.0, delay: 0.4, dur: 5.2, color: '#FEF08A' },
      { x: 80, y: 48, size: 1.6, opacity: 0.8, delay: 1.4, dur: 3.4, color: '#A7F3D0' },
      { x: 87, y: 25, size: 2.4, opacity: 0.9, delay: 2.1, dur: 4.6, color: '#DDD6FE' },
      { x: 92, y: 70, size: 1.8, opacity: 0.85, delay: 0.8, dur: 3.9, color: '#BAE6FD' },
      { x: 96, y: 38, size: 2.6, opacity: 0.95, delay: 3.4, dur: 4.8, color: '#FDE68A' },
      { x: 15, y: 88, size: 1.5, opacity: 0.7, delay: 1.9, dur: 3.3, color: '#C084FC' },
      { x: 48, y: 92, size: 2.0, opacity: 0.85, delay: 0.5, dur: 4.0, color: '#67E8F9' },
      { x: 82, y: 95, size: 1.4, opacity: 0.75, delay: 2.4, dur: 3.7, color: '#F472B6' },
      { x: 28, y: 55, size: 1.2, opacity: 0.65, delay: 1.7, dur: 3.1, color: '#DDD6FE' },
      { x: 65, y: 68, size: 2.0, opacity: 0.8, delay: 2.9, dur: 4.3, color: '#BAE6FD' },
    ];
  }, []);

  return (
    <div className="relative min-h-[100dvh] w-full overflow-x-hidden bg-gradient-to-b from-[#060814] via-[#0B0F28] via-[#12163B] to-[#181233] text-slate-100 selection:bg-pink-400 selection:text-slate-950">
      {/* Mystical Starry Night Sky Canvas */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        
        {/* 1. Deep Cosmic Nebula Glows */}
        <div 
          className="absolute -top-40 -left-40 w-[36rem] h-[36rem] rounded-full blur-[140px] opacity-40 transition-colors duration-1000"
          style={{ backgroundColor: stationColor || '#C084FC' }}
        />
        <div className="absolute top-1/4 -right-40 w-[34rem] h-[34rem] rounded-full bg-[#818CF8]/25 blur-[150px]" />
        <div className="absolute bottom-1/3 -left-32 w-[32rem] h-[32rem] rounded-full bg-[#38BDF8]/20 blur-[150px]" />
        <div className="absolute -bottom-40 right-1/4 w-[38rem] h-[38rem] rounded-full bg-[#EC4899]/25 blur-[160px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[30rem] h-[30rem] rounded-full bg-[#A855F7]/15 blur-[170px]" />

        {/* 2. Mystical Constellation Orbit Rings */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] rounded-full border border-indigo-400/10 animate-[spin_180s_linear_infinite]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[680px] h-[680px] rounded-full border border-purple-400/15 border-dashed animate-[spin_120s_linear_infinite_reverse]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[450px] h-[450px] rounded-full border border-pink-400/15 animate-[spin_90s_linear_infinite]" />

        {/* 3. Subtle Starlight Grid Texture */}
        <div 
          className="absolute inset-0 opacity-[0.14]" 
          style={{
            backgroundImage: `
              radial-gradient(circle at center, rgba(255, 255, 255, 0.25) 1px, transparent 1px)
            `,
            backgroundSize: '36px 36px',
            maskImage: 'radial-gradient(ellipse 90% 90% at 50% 50%, #000 30%, transparent 95%)',
            WebkitMaskImage: 'radial-gradient(ellipse 90% 90% at 50% 50%, #000 30%, transparent 95%)'
          }}
        />

        {/* 4. Realistic Shooting Stars (Sao Băng) */}
        <div className="absolute top-[12%] right-[15%] w-36 h-[2px] bg-gradient-to-r from-transparent via-pink-200 to-white animate-shooting-star-1 opacity-0 pointer-events-none drop-shadow-[0_0_8px_rgba(255,255,255,0.9)]" />
        <div className="absolute top-[35%] right-[28%] w-44 h-[2px] bg-gradient-to-r from-transparent via-sky-200 to-white animate-shooting-star-2 opacity-0 pointer-events-none drop-shadow-[0_0_10px_rgba(56,189,248,0.9)]" />
        <div className="absolute top-[18%] left-[45%] w-32 h-[1.5px] bg-gradient-to-r from-transparent via-amber-200 to-white animate-shooting-star-3 opacity-0 pointer-events-none drop-shadow-[0_0_8px_rgba(253,224,71,0.9)]" />

        {/* 5. Twinkling Night Sky Stars with Starlight Cross Accents */}
        {stars.map((star, idx) => (
          <div
            key={idx}
            className="absolute rounded-full pointer-events-none"
            style={{
              top: `${star.y}%`,
              left: `${star.x}%`,
              width: `${star.size}px`,
              height: `${star.size}px`,
              backgroundColor: star.color,
              boxShadow: `0 0 ${star.size * 3}px ${star.color}`,
              animation: `twinkle-star ${star.dur}s ease-in-out infinite ${star.delay}s`
            }}
          />
        ))}

        {/* 6. Few Prominent 4-Point Sparkling Stars */}
        <div className="absolute top-[15%] left-[22%] text-amber-200/90 text-sm animate-pulse pointer-events-none drop-shadow-[0_0_10px_rgba(253,224,71,0.8)]">✦</div>
        <div className="absolute top-[28%] right-[20%] text-pink-300/80 text-xs animate-pulse pointer-events-none drop-shadow-[0_0_8px_rgba(244,114,182,0.8)]" style={{ animationDelay: '1.2s' }}>✦</div>
        <div className="absolute top-[65%] left-[16%] text-sky-300/80 text-sm animate-pulse pointer-events-none drop-shadow-[0_0_10px_rgba(56,189,248,0.8)]" style={{ animationDelay: '2.4s' }}>✦</div>
        <div className="absolute top-[75%] right-[25%] text-purple-300/90 text-xs animate-pulse pointer-events-none drop-shadow-[0_0_8px_rgba(192,132,252,0.8)]" style={{ animationDelay: '1.8s' }}>✦</div>
      </div>

      {/* Foreground Interactive Content */}
      <div className={`relative z-10 w-full min-h-[100dvh] flex flex-col ${className}`}>
        {children}
      </div>
    </div>
  );
};
