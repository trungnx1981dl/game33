import { GameSession, Quiz } from '../types';
import { getOrCreateDriveFolder } from './googleDriveService';

const APP_ROOT_FOLDER_NAME = 'KHTN - Đấu trường Tri thức';
const REPORTS_FOLDER_NAME = 'KHTN - Báo cáo Bảng điểm Google Sheets';

/**
 * Creates a new Google Spreadsheet in Drive
 */
export async function createGoogleSpreadsheet(
  title: string,
  accessToken: string,
  parentFolderId?: string
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  // 1. Create Spreadsheet via Google Sheets API v4
  const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      properties: {
        title
      }
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Không thể khởi tạo Google Sheet (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const spreadsheetId = data.spreadsheetId;
  const spreadsheetUrl = data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  // 2. Move file into desired Google Drive folder if specified
  if (parentFolderId && spreadsheetId) {
    try {
      await fetch(
        `https://www.googleapis.com/drive/v3/files/${spreadsheetId}?addParents=${parentFolderId}&fields=id,parents`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${accessToken}` }
        }
      );
    } catch (moveErr) {
      console.warn('Move spreadsheet to folder warning:', moveErr);
    }
  }

  return { spreadsheetId, spreadsheetUrl };
}

/**
 * Updates values in a specific range of Google Sheet
 */
export async function updateSheetValues(
  spreadsheetId: string,
  range: string,
  values: any[][],
  accessToken: string
): Promise<void> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
    range
  )}?valueInputOption=USER_ENTERED`;

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      range,
      majorDimension: 'ROWS',
      values
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Cập nhật dữ liệu Google Sheet thất bại: ${errText}`);
  }
}

/**
 * Adds sheets and applies formatting batch updates
 */
export async function batchUpdateSpreadsheet(
  spreadsheetId: string,
  requests: any[],
  accessToken: string
): Promise<void> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ requests })
  });

  if (!res.ok) {
    const err = await res.text();
    console.warn('Batch update spreadsheet warning:', err);
  }
}

/**
 * Exports complete competition session (Round 1 + Round 2 + Rankings) to Google Sheets
 */
export async function exportSessionToGoogleSheets(
  session: GameSession,
  accessToken: string
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  // 1. Locate Drive folder
  const rootId = await getOrCreateDriveFolder(APP_ROOT_FOLDER_NAME, accessToken);
  const reportsFolderId = await getOrCreateDriveFolder(REPORTS_FOLDER_NAME, accessToken, rootId);

  // 2. Prepare title
  const dateStr = new Date().toLocaleDateString('vi-VN').replace(/\//g, '-');
  const sheetTitle = `Bảng_Điểm_KHTN_Phòng_${session.id}_${dateStr}`;

  // 3. Create Spreadsheet
  const { spreadsheetId, spreadsheetUrl } = await createGoogleSpreadsheet(
    sheetTitle,
    accessToken,
    reportsFolderId
  );

  // 4. Build Round 1 data
  const r1Rows: any[][] = [
    ['BÁO CÁO TỔNG HỢP KẾT QUẢ ĐẤU TRƯỜNG TRI THỨC KHTN'],
    [`Mã phòng thi: ${session.id}`, `Bộ đề: ${session.quiz?.title || 'Đề thi KHTN'}`, `Thời gian xuất: ${new Date().toLocaleString('vi-VN')}`],
    [],
    ['=== BẢNG ĐIỂM VÒNG 1 (TRẮC NGHIỆM CÁ NHÂN & VỊ TRÍ BÀN THI) ==='],
    ['STT', 'Mã Học Sinh', 'Họ và Tên', 'Lớp', 'Vị trí Bàn', 'Điểm Số V1', 'Số Câu Đúng', 'Thời Gian Hoàn Thành (giây)', 'Trạng Thái']
  ];

  const players = Object.values(session.players || {}).sort((a: any, b: any) => (b.score || 0) - (a.score || 0));
  players.forEach((p: any, idx: number) => {
    r1Rows.push([
      idx + 1,
      p.studentCode || p.id || '',
      p.name || 'Thí sinh',
      p.className || '',
      p.seatNumber || p.seatLabel || `Bàn ${idx + 1}`,
      p.score || 0,
      p.correctAnswers || 0,
      p.totalTimeSpent ? Math.round(p.totalTimeSpent) : '-',
      p.isLocked ? 'Bị khóa' : p.isOnline !== false ? 'Hoàn thành' : 'Vắng'
    ]);
  });

  // 5. Build Round 2 data (Teams, GK01-GK05, Total, Ranking)
  const r2Rows: any[][] = [
    [],
    ['=== BẢNG ĐIỂM VÒNG 2 (SẢN PHẨM SÁNG TẠO & HỘI ĐỒNG GIÁM KHẢO) ==='],
    ['STT', 'Mã Đội', 'Tên Đội', 'Tên Sản Phẩm Dự Thi', 'Điểm GK01', 'Điểm GK02', 'Điểm GK03', 'Điểm GK04', 'Điểm GK05', 'Tổng Điểm Vòng 2', 'Xếp Hạng V2']
  ];

  const round2Scores = session.round2Scores || {};
  const round2Submissions = session.round2Submissions || {};

  const teamConfigs = [
    { id: 'TEAM_1', name: 'Đội 1: Lực Lượng Siêu Phàm' },
    { id: 'TEAM_2', name: 'Đội 2: Chiến Binh Sinh Học' },
    { id: 'TEAM_3', name: 'Đội 3: Phù Thủy Hóa Học' },
    { id: 'TEAM_4', name: 'Đội 4: Nhà Du Hành Vũ Trụ' },
    { id: 'TEAM_5', name: 'Đội 5: Bậc Thầy Năng Lượng' },
    { id: 'TEAM_6', name: 'Đội 6: Tia Chớp Nguyên Tử' },
  ];

  const teamResults = teamConfigs.map(tc => {
    const scores = round2Scores[tc.id] || {};
    const gk1 = scores.GK01 ?? 0;
    const gk2 = scores.GK02 ?? 0;
    const gk3 = scores.GK03 ?? 0;
    const gk4 = scores.GK04 ?? 0;
    const gk5 = scores.GK05 ?? 0;
    const total = scores.total ?? (gk1 + gk2 + gk3 + gk4 + gk5);

    const sub = round2Submissions[tc.id];
    let prodTitle = 'Chưa nộp';
    if (sub) {
      if (sub.products && sub.products.length > 0) {
        prodTitle = sub.products.map((p: any) => p.title).join(' + ');
      } else if (sub.product1) {
        prodTitle = sub.product1.title + (sub.product2 ? ` + ${sub.product2.title}` : '');
      } else if (sub.title) {
        prodTitle = sub.title;
      }
    }

    return {
      id: tc.id,
      name: tc.name,
      prodTitle,
      gk1,
      gk2,
      gk3,
      gk4,
      gk5,
      total
    };
  });

  // Sort by total descending for ranking
  teamResults.sort((a, b) => b.total - a.total);

  teamResults.forEach((tr, idx) => {
    r2Rows.push([
      idx + 1,
      tr.id,
      tr.name,
      tr.prodTitle,
      tr.gk1,
      tr.gk2,
      tr.gk3,
      tr.gk4,
      tr.gk5,
      tr.total,
      `Hạng ${idx + 1}`
    ]);
  });

  // 6. Push all values to Sheet1
  const allRows = [...r1Rows, ...r2Rows];
  await updateSheetValues(spreadsheetId, 'Sheet1!A1', allRows, accessToken);

  return { spreadsheetId, spreadsheetUrl };
}

/**
 * Exports a Quiz into a structured Google Sheet for teachers to edit or archive
 */
export async function exportQuizToGoogleSheets(
  quiz: Quiz,
  accessToken: string
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  const rootId = await getOrCreateDriveFolder(APP_ROOT_FOLDER_NAME, accessToken);
  const title = `DeThi_KHTN_${(quiz.title || 'Bo_De').replace(/[\\/:*?"<>|]/g, '_')}`;

  const { spreadsheetId, spreadsheetUrl } = await createGoogleSpreadsheet(
    title,
    accessToken,
    rootId
  );

  const rows: any[][] = [
    ['BỘ ĐỀ THI KHOA HỌC TỰ NHIÊN - ĐẤU TRƯỜNG TRI THỨC'],
    [`Tiêu đề: ${quiz.title || ''}`, `Mô tả: ${quiz.description || ''}`, `Số câu hỏi: ${quiz.questions?.length || 0}`],
    [],
    ['STT', 'Câu Hỏi', 'Phương Án A', 'Phương Án B', 'Phương Án C', 'Phương Án D', 'Đáp Án Đúng', 'Thời Gian (s)', 'Điểm', 'Giải Thích']
  ];

  (quiz.questions || []).forEach((q: any, i: number) => {
    const opts = q.options || [];
    rows.push([
      i + 1,
      q.question || '',
      opts[0] || '',
      opts[1] || '',
      opts[2] || '',
      opts[3] || '',
      q.correctAnswer ?? '',
      q.timeLimit || 20,
      q.points || 10,
      q.explanation || ''
    ]);
  });

  await updateSheetValues(spreadsheetId, 'Sheet1!A1', rows, accessToken);
  return { spreadsheetId, spreadsheetUrl };
}
