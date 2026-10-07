import * as XLSX from 'xlsx';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { StudentRosterItem } from '../types';

const ROSTER_LOCAL_KEY = 'khtn_student_roster_cache';
const ROSTER_DOC_PATH = 'settings/studentRoster';

// Starter default roster across 5 classes (30 students total for 5x6 exam hall)
export const DEFAULT_SAMPLE_ROSTER: StudentRosterItem[] = [
  { studentCode: 'HS01', name: 'Nguyễn Gia Bảo', className: '6A1', notes: 'Đội viên gương mẫu' },
  { studentCode: 'HS02', name: 'Trần Quỳnh Anh', className: '6A1', notes: 'Chi đội trưởng' },
  { studentCode: 'HS03', name: 'Lê Minh Khôi', className: '6A1', notes: 'Thành viên CLB Khoa học' },
  { studentCode: 'HS04', name: 'Phạm Phương Linh', className: '6A1', notes: 'Giải Nhất Hùng biện' },
  { studentCode: 'HS05', name: 'Hoàng Nhật Nam', className: '6A2', notes: 'Trưởng ban Môi trường' },
  { studentCode: 'HS06', name: 'Vũ Thảo Nguyên', className: '6A2', notes: 'Chi đội phó' },
  { studentCode: 'HS07', name: 'Đặng Tuấn Kiệt', className: '6A2', notes: 'Thành viên ban STEM' },
  { studentCode: 'HS08', name: 'Bùi Bảo Ngọc', className: '6A2', notes: 'Học sinh xuất sắc' },
  { studentCode: 'HS09', name: 'Đỗ Quang Huy', className: '6A3', notes: 'Đại sứ Xanh' },
  { studentCode: 'HS10', name: 'Ngô Khánh Huyền', className: '6A3', notes: 'Tổ trưởng tổ 1' },
  { studentCode: 'HS11', name: 'Dương Đức Anh', className: '6A3', notes: 'Hăng hái phát biểu' },
  { studentCode: 'HS12', name: 'Lý Mai Phương', className: '6A3', notes: 'Trưởng nhóm Thí nghiệm' },
  { studentCode: 'HS13', name: 'Phan Hoàng Long', className: '6A4', notes: 'Thành viên CLB Robotics' },
  { studentCode: 'HS14', name: 'Chu Hà My', className: '6A4', notes: 'Chi đội trưởng 6A4' },
  { studentCode: 'HS15', name: 'Tạ Minh Triết', className: '6A4', notes: 'Giải Nhì Tin học trẻ' },
  { studentCode: 'HS16', name: 'Đinh Tuệ Nhi', className: '6A4', notes: 'Tuyên truyền viên Xanh' },
  { studentCode: 'HS17', name: 'Võ Minh Quân', className: '6A1', notes: 'Đội viên' },
  { studentCode: 'HS18', name: 'Nguyễn Thục Quyên', className: '6A2', notes: 'Đội viên' },
  { studentCode: 'HS19', name: 'Trịnh Tiến Dũng', className: '6A3', notes: 'Đội viên' },
  { studentCode: 'HS20', name: 'Lê Thùy Dương', className: '6A4', notes: 'Đội viên' },
  { studentCode: 'HS21', name: 'Đặng Tuấn Anh', className: '6A1', notes: 'Tổ trưởng tổ 2' },
  { studentCode: 'HS22', name: 'Phan Thu Trang', className: '6A2', notes: 'Thành viên CLB Sinh học' },
  { studentCode: 'HS23', name: 'Bùi Minh Đức', className: '6A3', notes: 'Giải Ba Sáng tạo trẻ' },
  { studentCode: 'HS24', name: 'Trần Hải Đăng', className: '6A4', notes: 'Đội viên tích cực' },
  { studentCode: 'HS25', name: 'Vũ Hoàng Yến', className: '6A5', notes: 'Chi đội trưởng 6A5' },
  { studentCode: 'HS26', name: 'Lâm Gia Huy', className: '6A5', notes: 'Đại sứ Môi trường' },
  { studentCode: 'HS27', name: 'Cao Ngọc Diệp', className: '6A5', notes: 'Thành viên CLB Hóa học' },
  { studentCode: 'HS28', name: 'Mai Thế Bảo', className: '6A5', notes: 'Tài năng Khoa học' },
  { studentCode: 'HS29', name: 'Nguyễn Tấn Phát', className: '6A5', notes: 'Đội viên' },
  { studentCode: 'HS30', name: 'Dương Thảo Linh', className: '6A5', notes: 'Học sinh giỏi toàn diện' }
];

/**
 * Returns a list of exactly 30 students for the 30-seat exam room.
 * Uses provided roster or supplements with sample roster if needed.
 */
export function ensure30Students(customRoster?: StudentRosterItem[]): StudentRosterItem[] {
  const current = customRoster && customRoster.length > 0 ? customRoster : DEFAULT_SAMPLE_ROSTER;
  if (current.length >= 30) {
    return current.slice(0, 30);
  }
  // Fill up to 30 from DEFAULT_SAMPLE_ROSTER without repeating student codes
  const result = [...current];
  const existingCodes = new Set(result.map(s => s.studentCode.trim().toUpperCase()));
  for (const item of DEFAULT_SAMPLE_ROSTER) {
    if (result.length >= 30) break;
    const code = item.studentCode.trim().toUpperCase();
    if (!existingCodes.has(code)) {
      result.push(item);
      existingCodes.add(code);
    }
  }
  // If still less than 30, generate numbered items
  let counter = 1;
  while (result.length < 30) {
    const code = `HS${(result.length + 1).toString().padStart(2, '0')}`;
    const cls = `6A${((result.length % 5) + 1)}`;
    result.push({
      studentCode: code,
      name: `Thí sinh dự bị ${result.length + 1}`,
      className: cls,
      notes: 'Thí sinh bổ sung'
    });
    counter++;
  }
  return result.slice(0, 30);
}

/**
 * Normalizes header string to recognize columns flexibly
 */
function normalizeHeader(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Parse rows into StudentRosterItem[]
 */
export function processRawRows(rows: any[][]): StudentRosterItem[] {
  if (!rows || rows.length < 2) return [];

  // 1. Detect header row
  let headerRowIndex = 0;
  let codeCol = -1;
  let nameCol = -1;
  let classCol = -1;
  let notesCol = -1;

  for (let r = 0; r < Math.min(10, rows.length); r++) {
    const row = rows[r];
    if (!Array.isArray(row)) continue;

    for (let c = 0; c < row.length; c++) {
      const val = normalizeHeader(String(row[c] || ''));
      if (
        val.includes('mahs') ||
        val.includes('mahocsinh') ||
        val.includes('sbd') ||
        val.includes('maso') ||
        val === 'ma' ||
        val === 'code' ||
        val === 'id'
      ) {
        codeCol = c;
      } else if (
        val.includes('hovaten') ||
        val.includes('hoten') ||
        val.includes('tenhocsinh') ||
        val.includes('fullname') ||
        val === 'ten' ||
        val === 'name'
      ) {
        nameCol = c;
      } else if (
        val.includes('lop') ||
        val.includes('chidoi') ||
        val.includes('class') ||
        val === 'phong'
      ) {
        classCol = c;
      } else if (val.includes('ghichu') || val.includes('note') || val.includes('vai tro')) {
        notesCol = c;
      }
    }

    if (codeCol !== -1 && nameCol !== -1) {
      headerRowIndex = r;
      break;
    }
  }

  // Fallback defaults if standard headers weren't found
  if (codeCol === -1 || nameCol === -1) {
    // Assume Col 0 is Code or STT, Col 1 is Code/Name, Col 2 is Name/Class
    if (rows[0].length >= 3) {
      codeCol = 0;
      nameCol = 1;
      classCol = 2;
    } else if (rows[0].length >= 2) {
      codeCol = 0;
      nameCol = 1;
    }
  }

  const result: StudentRosterItem[] = [];
  const seenCodes = new Set<string>();

  for (let r = headerRowIndex + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!Array.isArray(row) || row.length === 0) continue;

    const rawCode = String(row[codeCol] ?? '').trim();
    const rawName = String(row[nameCol] ?? '').trim();
    const rawClass = classCol !== -1 ? String(row[classCol] ?? '').trim() : '';
    const rawNotes = notesCol !== -1 ? String(row[notesCol] ?? '').trim() : '';

    if (!rawCode || !rawName) continue;
    // Skip if looks like a repeated header
    if (rawCode.toLowerCase() === 'mã hs' || rawName.toLowerCase() === 'họ và tên') continue;

    const cleanCode = rawCode.toUpperCase().replace(/\s+/g, '');
    if (seenCodes.has(cleanCode)) continue;
    seenCodes.add(cleanCode);

    result.push({
      id: `std-${cleanCode}-${Date.now()}-${r}`,
      studentCode: cleanCode,
      name: rawName,
      className: rawClass || 'Chung',
      notes: rawNotes
    });
  }

  return result;
}

/**
 * Import roster from Excel (.xlsx, .xls, .csv)
 */
export async function importRosterFromExcel(file: File): Promise<StudentRosterItem[]> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const jsonData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
  const roster = processRawRows(jsonData);
  if (roster.length === 0) {
    throw new Error('Không tìm thấy danh sách học sinh hợp lệ trong file Excel. Vui lòng kiểm tra các cột: Mã HS, Họ và tên, Lớp.');
  }
  return roster;
}

/**
 * Import roster from Word (.docx) or Text file (.txt)
 */
export async function importRosterFromWord(file: File): Promise<StudentRosterItem[]> {
  const fileName = file.name.toLowerCase();

  // If plain text or tab/csv
  if (fileName.endsWith('.txt') || fileName.endsWith('.csv')) {
    const text = await file.text();
    return parseRosterFromText(text);
  }

  // If .docx: parse document.xml table cells
  try {
    const arrayBuffer = await file.arrayBuffer();
    // Word files are ZIP files. Let's see if we can read entries or parse text
    // We can use native Decompression or parse tables from text content
    const textDecoder = new TextDecoder('utf-8', { fatal: false });
    const contentStr = textDecoder.decode(arrayBuffer);

    // Check if docx xml contains <w:tr> and <w:tc>
    if (contentStr.includes('<w:tr')) {
      const rows: string[][] = [];
      const trRegex = /<w:tr[^>]*>([\s\S]*?)<\/w:tr>/g;
      let trMatch: RegExpExecArray | null;

      while ((trMatch = trRegex.exec(contentStr)) !== null) {
        const rowXml = trMatch[1];
        const cells: string[] = [];
        const tcRegex = /<w:tc[^>]*>([\s\S]*?)<\/w:tc>/g;
        let tcMatch: RegExpExecArray | null;

        while ((tcMatch = tcRegex.exec(rowXml)) !== null) {
          const cellXml = tcMatch[1];
          // Extract text from <w:t> tags
          const textPieces: string[] = [];
          const tRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
          let tMatch: RegExpExecArray | null;
          while ((tMatch = tRegex.exec(cellXml)) !== null) {
            textPieces.push(tMatch[1]);
          }
          cells.push(textPieces.join('').trim());
        }
        if (cells.length > 0) {
          rows.push(cells);
        }
      }

      if (rows.length >= 2) {
        const roster = processRawRows(rows);
        if (roster.length > 0) return roster;
      }
    }
  } catch (e) {
    console.warn('Could not parse docx via xml unpack, attempting plain text extraction:', e);
  }

  // Fallback: read text lines
  const text = await file.text();
  return parseRosterFromText(text);
}

/**
 * Parse roster from copied text (from Word table or Excel or text box)
 * Supports formats like:
 * HS01 \t Nguyễn Văn An \t 6A1
 * HS02, Trần Quỳnh Anh, 6A2
 * 1. HS03 - Lê Minh Khôi - 6A3
 */
export function parseRosterFromText(text: string): StudentRosterItem[] {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const rows: string[][] = [];

  for (const line of lines) {
    // If tab-delimited
    if (line.includes('\t')) {
      rows.push(line.split('\t').map(c => c.trim()));
      continue;
    }
    // If comma or semicolon delimited
    if (line.includes(',') || line.includes(';')) {
      const sep = line.includes(';') ? ';' : ',';
      rows.push(line.split(sep).map(c => c.trim()));
      continue;
    }
    // If dash or colon delimited e.g. "HS01 - Nguyễn Văn An - 6A1"
    if (line.includes(' - ') || line.includes(' – ')) {
      rows.push(line.split(/\s*[-–]\s*/).map(c => c.trim()));
      continue;
    }
    // If space delimited with first token being code e.g. "HS01 Nguyễn Văn An 6A1"
    const tokens = line.split(/\s+/);
    if (tokens.length >= 3 && /^[A-Za-z0-9_-]{2,10}$/.test(tokens[0])) {
      const code = tokens[0];
      const cls = tokens[tokens.length - 1];
      const name = tokens.slice(1, -1).join(' ');
      rows.push([code, name, cls]);
      continue;
    }
  }

  const processed = processRawRows(rows);
  if (processed.length > 0) return processed;

  // Simple direct line-by-line fallback
  const result: StudentRosterItem[] = [];
  const seenCodes = new Set<string>();

  lines.forEach((line, i) => {
    const parts = line.split(/[\t,|;]+/).map(p => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const code = parts[0].toUpperCase().replace(/\s+/g, '');
      const name = parts[1];
      const cls = parts[2] || 'Chung';
      if (code && name && !seenCodes.has(code) && code !== 'MÃHS' && code !== 'STT') {
        seenCodes.add(code);
        result.push({
          id: `std-${code}-${Date.now()}-${i}`,
          studentCode: code,
          name,
          className: cls
        });
      }
    }
  });

  return result;
}

/**
 * Downloads a standardized sample Excel template
 */
export function downloadSampleRosterExcel() {
  const sampleData = [
    ['Mã HS', 'Họ và tên', 'Lớp', 'Ghi chú'],
    ['HS01', 'Nguyễn Gia Bảo', '6A1', 'Đội viên gương mẫu'],
    ['HS02', 'Trần Quỳnh Anh', '6A1', 'Chi đội trưởng'],
    ['HS03', 'Lê Minh Khôi', '6A1', 'Thành viên CLB STEM'],
    ['HS04', 'Phạm Phương Linh', '6A1', 'Giải Nhất Hùng biện'],
    ['HS05', 'Hoàng Nhật Nam', '6A2', 'Trưởng ban Môi trường'],
    ['HS06', 'Vũ Thảo Nguyên', '6A2', 'Chi đội phó'],
    ['HS07', 'Đặng Tuấn Kiệt', '6A2', 'Thành viên ban STEM'],
    ['HS08', 'Bùi Bảo Ngọc', '6A2', 'Học sinh xuất sắc'],
    ['HS09', 'Đỗ Quang Huy', '6A3', 'Đại sứ Xanh'],
    ['HS10', 'Ngô Khánh Huyền', '6A3', 'Tổ trưởng tổ 1'],
    ['HS11', 'Dương Đức Anh', '6A3', 'Hăng hái phát biểu'],
    ['HS12', 'Lý Mai Phương', '6A3', 'Trưởng nhóm Thí nghiệm'],
    ['HS13', 'Phan Hoàng Long', '6A4', 'Thành viên CLB Robotics'],
    ['HS14', 'Chu Hà My', '6A4', 'Chi đội trưởng 6A4'],
    ['HS15', 'Tạ Minh Triết', '6A4', 'Giải Nhì Tin học trẻ'],
    ['HS16', 'Đinh Tuệ Nhi', '6A4', 'Tuyên truyền viên Xanh']
  ];

  const ws = XLSX.utils.aoa_to_sheet(sampleData);
  // Column widths
  ws['!cols'] = [{ wch: 12 }, { wch: 25 }, { wch: 12 }, { wch: 30 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'DanhSachHocSinh');

  XLSX.writeFile(wb, 'Mau_Danh_Sach_Hoc_Sinh_KHTN.xlsx');
}

/**
 * Save roster to local storage & Firestore settings
 */
export async function saveRoster(roster: StudentRosterItem[]): Promise<void> {
  try {
    localStorage.setItem(ROSTER_LOCAL_KEY, JSON.stringify(roster));
  } catch (e) {
    console.error('Failed to save roster to localStorage:', e);
  }

  try {
    await setDoc(doc(db, ROSTER_DOC_PATH), {
      items: roster,
      updatedAt: Date.now()
    }, { merge: true });
  } catch (e) {
    console.warn('Firestore write for roster failed or offline:', e);
  }
}

/**
 * Load roster from Firestore or LocalStorage or default
 */
export async function loadRoster(): Promise<StudentRosterItem[]> {
  // 1. Try Firestore
  try {
    const snap = await getDoc(doc(db, ROSTER_DOC_PATH));
    if (snap.exists() && snap.data()?.items?.length > 0) {
      const items = snap.data().items as StudentRosterItem[];
      localStorage.setItem(ROSTER_LOCAL_KEY, JSON.stringify(items));
      return items;
    }
  } catch (e) {
    console.warn('Could not load roster from Firestore, falling back to local cache:', e);
  }

  // 2. Try LocalStorage
  try {
    const cached = localStorage.getItem(ROSTER_LOCAL_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('LocalStorage roster parse error:', e);
  }

  // 3. Fallback to sample roster
  return DEFAULT_SAMPLE_ROSTER;
}

/**
 * Find student by studentCode in roster
 */
export function findStudentInRoster(studentCode: string, roster: StudentRosterItem[]): StudentRosterItem | null {
  if (!studentCode || !roster || roster.length === 0) return null;
  const clean = studentCode.trim().toUpperCase().replace(/\s+/g, '');
  return roster.find(s => s.studentCode.trim().toUpperCase().replace(/\s+/g, '') === clean) || null;
}
