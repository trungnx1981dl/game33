import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import Admin from './pages/Admin';
import Host from './pages/Host';
import HostBoard from './pages/HostBoard';
import Player from './pages/Player';
import Judge from './pages/Judge';
import CustomCursor from './components/CustomCursor';
import GlobalHomeButton from './components/GlobalHomeButton';
import FirestoreQuotaBanner from './components/FirestoreQuotaBanner';

export default function App() {
  return (
    <BrowserRouter>
      <CustomCursor />
      <FirestoreQuotaBanner />
      <GlobalHomeButton />
      <div className="min-h-screen bg-[#0B0F1E] text-slate-100 selection:bg-pink-400 selection:text-slate-950 overflow-x-hidden font-sans">
        <div className="fixed inset-0 z-[-1] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-950/40 via-[#0B0F1E] to-[#080B14]"></div>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/admin/*" element={<Admin />} />
          <Route path="/practice" element={<Navigate to="/" replace />} />
          <Route path="/host" element={<Host />} />
          <Route path="/host/board/:quizId" element={<HostBoard />} />
          <Route path="/player" element={<Player />} />
          <Route path="/judge" element={<Judge />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
