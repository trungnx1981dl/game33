// Client-side helper for seamless real-time server backup synchronization
// Allows the game to operate smoothly with zero interruptions even if Firestore daily write quota is exhausted

import { GameSession, Player } from '../types';

export async function syncSessionToServer(session: GameSession | Partial<GameSession>): Promise<boolean> {
  if (!session || !session.id) return false;
  try {
    const res = await fetch('/api/sync/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session })
    });
    return res.ok;
  } catch (err) {
    console.warn('Could not sync session to server backup:', err);
    return false;
  }
}

export async function fetchSessionFromServer(sessionId: string): Promise<{
  session: GameSession | null;
  players: Player[];
  submissions: any[];
} | null> {
  if (!sessionId) return null;
  try {
    const res = await fetch(`/api/sync/session/${sessionId}`);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      session: data.session || null,
      players: data.players || [],
      submissions: data.submissions || []
    };
  } catch (err) {
    return null;
  }
}

export async function fetchActiveSessionsFromServer(): Promise<GameSession[]> {
  try {
    const res = await fetch('/api/sync/sessions');
    if (!res.ok) return [];
    const data = await res.json();
    return data.sessions || [];
  } catch (err) {
    return [];
  }
}

export async function syncPlayerToServer(sessionId: string, player: Partial<Player>): Promise<boolean> {
  if (!sessionId || !player || !player.id) return false;
  try {
    const res = await fetch(`/api/sync/session/${sessionId}/player`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player })
    });
    return res.ok;
  } catch (err) {
    console.warn('Could not sync player to server backup:', err);
    return false;
  }
}

export async function syncSubmissionToServer(sessionId: string, submission: any): Promise<boolean> {
  if (!sessionId || !submission || !submission.teamId) return false;
  try {
    const res = await fetch(`/api/sync/session/${sessionId}/submission`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submission })
    });
    return res.ok;
  } catch (err) {
    return false;
  }
}

export async function syncJudgeScoreToServer(sessionId: string, teamId: string, judgeId: string, score: number): Promise<boolean> {
  if (!sessionId || !teamId || !judgeId) return false;
  try {
    const res = await fetch(`/api/sync/session/${sessionId}/score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamId, judgeId, score })
    });
    return res.ok;
  } catch (err) {
    return false;
  }
}
