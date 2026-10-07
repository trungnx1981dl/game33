import { Player, Round2Group, Round2Member } from '../types';

export const ROUND_2_GROUPS_CONFIG = [
  {
    id: 'team-bye-bye-nhua',
    name: 'Team Bye Bye Nhựa',
    icon: '🚯',
    themeColor: '#F43F5E', // Rose 500
    accentBg: 'from-rose-500/20 via-pink-500/15 to-red-950/40',
    borderColor: 'border-rose-400/70',
    textColor: 'text-rose-300',
    slogan: 'Nói không với đồ nhựa dùng một lần • Giữ đại dương luôn xanh biếc'
  },
  {
    id: 'tram-zero-waste',
    name: 'Trạm Zero-Waste',
    icon: '🌱',
    themeColor: '#10B981', // Emerald 500
    accentBg: 'from-emerald-500/20 via-teal-500/15 to-green-950/40',
    borderColor: 'border-emerald-400/70',
    textColor: 'text-emerald-300',
    slogan: 'Lối sống không rác thải • Tiết giảm - Tái sử dụng - Bền vững'
  },
  {
    id: 'team-goc-xanh',
    name: 'Team Góc Xanh',
    icon: '🌍',
    themeColor: '#0EA5E9', // Sky 500
    accentBg: 'from-sky-500/20 via-cyan-500/15 to-blue-950/40',
    borderColor: 'border-sky-400/70',
    textColor: 'text-sky-300',
    slogan: 'Không gian sống xanh • Năng lượng sạch • Phủ xanh thành phố'
  },
  {
    id: 'team-tai-sinh',
    name: 'Team Tái Sinh',
    icon: '♻️',
    themeColor: '#F59E0B', // Amber 500
    accentBg: 'from-amber-500/20 via-yellow-500/15 to-orange-950/40',
    borderColor: 'border-amber-400/70',
    textColor: 'text-amber-300',
    slogan: 'Kinh tế tuần hoàn • Tái chế rác hữu cơ • Hồi sinh nguồn tài nguyên'
  },
  {
    id: 'team-dia-sach',
    name: 'Team Dĩa sạch',
    icon: '🍽️',
    themeColor: '#06B6D4', // Cyan 500
    accentBg: 'from-cyan-500/20 via-teal-500/15 to-blue-950/40',
    borderColor: 'border-cyan-400/70',
    textColor: 'text-cyan-300',
    slogan: 'Dĩa ăn sạch • Bữa ăn không rác • Tiêu dùng xanh & an lành'
  },
  {
    id: 'team-pho-xanh',
    name: 'Team Phố xanh',
    icon: '🏙️',
    themeColor: '#8B5CF6', // Purple 500
    accentBg: 'from-purple-500/20 via-indigo-500/15 to-violet-950/40',
    borderColor: 'border-purple-400/70',
    textColor: 'text-purple-300',
    slogan: 'Thành phố xanh • Không khí trong lành • Không gian sống bền vững'
  }
];

/**
 * Shuffles Top 18 students (sorted strictly by EXP desc) into 6 teams (3 members per team).
 * Constrained logic: Minimizes students from the same class in the same group.
 */
export function shuffleTop18IntoRound2Groups(allPlayers: Player[]): Round2Group[] {
  // 1. Sort strictly by EXP desc (Chỉ dùng exp để tính, không xếp hạng theo điểm số câu đúng)
  const sortedByExp = [...allPlayers].sort((a, b) => {
    const expDiff = (b.exp ?? 0) - (a.exp ?? 0);
    if (expDiff !== 0) return expDiff;
    return (a.totalTimeSpent ?? 99999) - (b.totalTimeSpent ?? 99999);
  });

  // Top 18 students
  const top18 = sortedByExp.slice(0, 18);

  // Convert to Round2Member format with ranking
  const members: Round2Member[] = top18.map((p, idx) => ({
    id: p.id,
    studentCode: p.studentCode || '',
    name: p.name,
    className: p.className || extractClassFromName(p.name) || 'Chung',
    exp: p.exp ?? 0,
    score: p.score ?? 0,
    rank: idx + 1
  }));

  // If no members, initialize empty groups
  if (members.length === 0) {
    return ROUND_2_GROUPS_CONFIG.map(cfg => ({
      ...cfg,
      members: []
    }));
  }

  // 2. Class-aware group distribution:
  // Group members by their class name
  const classBuckets: Record<string, Round2Member[]> = {};
  members.forEach(m => {
    const cName = (m.className || 'Chung').trim().toUpperCase();
    if (!classBuckets[cName]) classBuckets[cName] = [];
    classBuckets[cName].push(m);
  });

  // Shuffle within each bucket to ensure random selection on each reshuffle
  Object.keys(classBuckets).forEach(k => {
    classBuckets[k].sort(() => Math.random() - 0.5);
  });

  // Sort class buckets by size descending (place students from larger classes first)
  const sortedClassKeys = Object.keys(classBuckets).sort(
    (a, b) => classBuckets[b].length - classBuckets[a].length
  );

  // Initialize the 6 groups
  const groups: Round2Group[] = ROUND_2_GROUPS_CONFIG.map(cfg => ({
    ...cfg,
    members: []
  }));

  const maxPerGroup = Math.ceil(members.length / 6);

  // Place each student into the group that currently has:
  // 1. Less than maxPerGroup members
  // 2. The fewest students from the same class
  // 3. Random tie-breaker among best options
  for (const cName of sortedClassKeys) {
    const bucket = classBuckets[cName];
    for (const student of bucket) {
      // Filter groups that still have space
      const eligibleGroups = groups.filter(g => g.members.length < maxPerGroup);
      const targetList = eligibleGroups.length > 0 ? eligibleGroups : groups;

      // Calculate class frequency in each group
      let minClassCount = Infinity;
      let minSize = Infinity;
      targetList.forEach(g => {
        const sameClassCount = g.members.filter(m => (m.className || 'Chung').trim().toUpperCase() === cName).length;
        if (sameClassCount < minClassCount) {
          minClassCount = sameClassCount;
        }
        if (g.members.length < minSize) {
          minSize = g.members.length;
        }
      });

      // Best candidates have the lowest count of students from this class, and smallest size
      const bestCandidates = targetList.filter(g => {
        const sameClassCount = g.members.filter(m => (m.className || 'Chung').trim().toUpperCase() === cName).length;
        return sameClassCount === minClassCount && g.members.length < maxPerGroup;
      });

      const fallbackCandidates = targetList.filter(g => {
        const sameClassCount = g.members.filter(m => (m.className || 'Chung').trim().toUpperCase() === cName).length;
        return sameClassCount === minClassCount;
      });

      const candidatesToChoose = bestCandidates.length > 0 ? bestCandidates : (fallbackCandidates.length > 0 ? fallbackCandidates : targetList);

      // Random pick among best candidates
      const chosenGroup = candidatesToChoose[Math.floor(Math.random() * candidatesToChoose.length)];
      chosenGroup.members.push(student);
    }
  }

  // Final sort within each group by rank ascending
  groups.forEach(g => {
    g.members.sort((a, b) => a.rank - b.rank);
  });

  return groups;
}

// Backwards compatibility alias
export const shuffleTop16IntoRound2Groups = shuffleTop18IntoRound2Groups;

/**
 * Helper to extract class name if encoded in student name like "Nguyễn Văn A - 6A1" or "Nguyễn Văn A (6A2)"
 */
function extractClassFromName(fullName: string): string {
  const matchParen = fullName.match(/\(([^)]+)\)$/);
  if (matchParen) return matchParen[1].trim();
  const matchDash = fullName.match(/[-–]\s*([A-Za-z0-9]+)$/);
  if (matchDash) return matchDash[1].trim();
  return '';
}

/**
 * Extracts all products (up to 2) from a team's Round 2 submission.
 * Supports both new 2-product structure (product1, product2, products[])
 * and legacy single submission (title, imageUrl, fileUrl).
 */
export function getTeamProducts(sub?: any): {
  id: string;
  index: number;
  title: string;
  url: string;
  isImage: boolean;
  isAudio: boolean;
  isDrive: boolean;
  description?: string;
}[] {
  if (!sub) return [];
  const list: {
    id: string;
    index: number;
    title: string;
    url: string;
    isImage: boolean;
    isAudio: boolean;
    isDrive: boolean;
    description?: string;
  }[] = [];

  const addProd = (p: any, id: string, index: number) => {
    if (!p) return;
    const url = p.audioUrl || p.imageUrl || p.driveUrl || p.fileUrl || '';
    if (!url && !p.title) return;
    const isAud = Boolean(
      p.mediaType === 'audio' ||
      p.audioUrl ||
      url.startsWith('data:audio') ||
      /\.(mp3|wav|m4a|ogg|aac|webm|flac|wma)$/i.test(url)
    );
    const isImg = !isAud && Boolean(
      p.mediaType === 'image' ||
      p.imageUrl ||
      url.startsWith('data:image') ||
      /\.(png|jpe?g|webp|gif|bmp|svg|heic)$/i.test(url)
    );
    const isDrv = !isAud && !isImg && (url.includes('drive.google.com') || url.includes('docs.google.com'));

    list.push({
      id,
      index,
      title: p.title || `Sản phẩm ${index}`,
      url,
      isImage: isImg,
      isAudio: isAud,
      isDrive: isDrv,
      description: p.description
    });
  };

  if (sub.product1) {
    addProd(sub.product1, 'p1', 1);
  } else if (sub.title || sub.imageUrl || sub.audioUrl || sub.fileUrl) {
    // Legacy single submission
    addProd({
      title: sub.title,
      imageUrl: sub.imageUrl,
      audioUrl: sub.audioUrl,
      driveUrl: sub.fileUrl,
      mediaType: sub.mediaType,
      description: sub.description
    }, 'p1', 1);
  }

  if (sub.product2) {
    addProd(sub.product2, 'p2', 2);
  }

  return list;
}

/**
 * Universal handler to open any product (Image, Audio, Link) in a new tab.
 */
export function openProductInNewTab(url: string, title?: string, e?: React.MouseEvent) {
  if (e) {
    e.stopPropagation();
    e.preventDefault();
  }
  if (!url) return;

  if (url.startsWith('data:image')) {
    const newWin = window.open('', '_blank');
    if (newWin) {
      newWin.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${title || 'Sản phẩm dự thi Vòng 2'}</title>
            <style>
              body { margin: 0; background: #0B0F1E; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; font-family: sans-serif; }
              img { max-width: 95vw; max-height: 90vh; border-radius: 16px; box-shadow: 0 0 50px rgba(0,255,200,0.3); border: 2px solid #10B981; }
              h2 { color: #fff; margin-bottom: 12px; font-weight: 800; font-size: 18px; }
            </style>
          </head>
          <body>
            <h2>${title || 'Sản phẩm dự thi Vòng 2 • Từ dĩa ăn sạch đến thành phố sạch'}</h2>
            <img src="${url}" alt="Sản phẩm dự thi" />
          </body>
        </html>
      `);
      newWin.document.close();
      return;
    }
  }

  if (url.startsWith('data:audio') || /\.(mp3|wav|m4a|ogg|aac|webm|flac)$/i.test(url)) {
    const newWin = window.open('', '_blank');
    if (newWin) {
      newWin.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${title || 'Sản phẩm âm thanh - Vòng 2'}</title>
            <style>
              body { margin: 0; background: #0B0F1E; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; font-family: sans-serif; color: #fff; }
              .card { background: #131B2E; border: 2px solid #8B5CF6; border-radius: 24px; padding: 32px; text-align: center; box-shadow: 0 0 50px rgba(139,92,246,0.3); max-width: 90vw; }
              audio { width: 340px; max-width: 80vw; margin-top: 20px; }
              h2 { margin: 0 0 8px 0; font-size: 20px; }
              p { color: #94A3B8; font-size: 14px; margin: 0; }
            </style>
          </head>
          <body>
            <div class="card">
              <div style="font-size: 48px; margin-bottom: 12px;">🎵</div>
              <h2>${title || 'Sản phẩm âm thanh / Thuyết trình'}</h2>
              <p>Vòng 2 • Từ dĩa ăn sạch đến thành phố sạch</p>
              <audio controls autoplay src="${url}"></audio>
            </div>
          </body>
        </html>
      `);
      newWin.document.close();
      return;
    }
  }

  let targetUrl = url.trim();
  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    targetUrl = 'https://' + targetUrl;
  }
  window.open(targetUrl, '_blank', 'noopener,noreferrer');
}

/**
 * Robustly extracts the Round 2 submissions map from session data,
 * handling both nested maps and dotted root keys.
 */
export function extractSubmissionsMap(sessionData: any): import('../types').Round2SubmissionsMap {
  if (!sessionData) return {};
  const result: import('../types').Round2SubmissionsMap = {};

  // 1. Direct object
  if (sessionData.round2Submissions && typeof sessionData.round2Submissions === 'object') {
    Object.keys(sessionData.round2Submissions).forEach(key => {
      if (sessionData.round2Submissions[key]) {
        result[key] = sessionData.round2Submissions[key];
      }
    });
  }

  // 2. Flattened dotted keys (e.g., "round2Submissions.team-bye-bye-nhua")
  Object.keys(sessionData).forEach(key => {
    if (key.startsWith('round2Submissions.')) {
      const teamId = key.substring('round2Submissions.'.length);
      if (sessionData[key] && !result[teamId]) {
        result[teamId] = sessionData[key];
      }
    }
  });

  return result;
}

/**
 * Robustly extracts the Round 2 judge scores map from session data,
 * handling both nested maps and dotted root keys.
 */
export function extractScoresMap(sessionData: any): import('../types').Round2ScoresMap {
  if (!sessionData) return {};
  const result: import('../types').Round2ScoresMap = {};

  // 1. Direct object
  if (sessionData.round2Scores && typeof sessionData.round2Scores === 'object') {
    Object.keys(sessionData.round2Scores).forEach(teamId => {
      if (sessionData.round2Scores[teamId] && typeof sessionData.round2Scores[teamId] === 'object') {
        result[teamId] = { ...sessionData.round2Scores[teamId] };
      }
    });
  }

  // 2. Flattened dotted keys (e.g. "round2Scores.team-bye-bye-nhua.GK01")
  Object.keys(sessionData).forEach(key => {
    if (key.startsWith('round2Scores.')) {
      const parts = key.split('.');
      if (parts.length === 3) {
        const teamId = parts[1];
        const judgeId = parts[2];
        if (!result[teamId]) result[teamId] = {};
        if (typeof sessionData[key] === 'number') {
          result[teamId][judgeId] = sessionData[key];
        }
      }
    }
  });

  return result;
}

