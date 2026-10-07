import * as XLSX from 'xlsx';
import { db } from '../lib/firebase';
import { doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { StudentRosterItem, SeatingAssignment, SeatingPlan } from '../types';

export const EXAM_HALL_COLS = 6; // 6 Dãy
export const EXAM_HALL_ROWS = 5; // Mỗi dãy 5 HS (5 Bàn)
export const TOTAL_EXAM_SEATS = EXAM_HALL_COLS * EXAM_HALL_ROWS; // 30 HS

export interface GridCoord {
  row: number; // 0 to 4 (Bàn 1 đến 5)
  col: number; // 0 to 5 (Dãy 1 đến 6)
}

/**
 * Format name with abbreviated surname and middle name, keeping main first name large
 * Example: "Nguyễn Gia Bảo" -> initials: "N. G.", mainName: "BẢO", fullAbbreviated: "N. G. BẢO"
 */
export function formatAbbreviatedName(fullName?: string): { initials: string; mainName: string; fullAbbreviated: string } {
  if (!fullName) return { initials: '', mainName: '', fullAbbreviated: '' };
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { initials: '', mainName: '', fullAbbreviated: '' };
  if (parts.length === 1) {
    const single = parts[0].toUpperCase();
    return { initials: '', mainName: single, fullAbbreviated: single };
  }
  const mainName = parts[parts.length - 1].toUpperCase();
  const initials = parts.slice(0, parts.length - 1).map(p => p[0].toUpperCase() + '.').join(' ');
  return {
    initials,
    mainName,
    fullAbbreviated: `${initials} ${mainName}`
  };
}

/**
 * Returns neighbor coordinates (horizontal & vertical adjacent seats)
 */
export function getSeatNeighbors(row: number, col: number): GridCoord[] {
  const neighbors: GridCoord[] = [];
  // Left / Right (Cùng bàn, ngồi kế bên)
  if (col > 0) neighbors.push({ row, col: col - 1 });
  if (col < EXAM_HALL_COLS - 1) neighbors.push({ row, col: col + 1 });
  // Above / Below (Ngồi trước / sau)
  if (row > 0) neighbors.push({ row: row - 1, col });
  if (row < EXAM_HALL_ROWS - 1) neighbors.push({ row: row + 1, col });
  return neighbors;
}

/**
 * Initialize 30 empty seats
 */
export function createEmptySeatingPlan(sessionId?: string): SeatingPlan {
  const seats: SeatingAssignment[] = [];
  let seatIndex = 0;

  for (let r = 0; r < EXAM_HALL_ROWS; r++) {
    for (let c = 0; c < EXAM_HALL_COLS; c++) {
      seats.push({
        seatIndex,
        row: r + 1, // 1-based (Bàn 1 đến 6)
        col: c + 1, // 1-based (Dãy 1 đến 5)
        seatLabel: `Dãy ${c + 1} - Bàn ${r + 1}`,
        student: null,
        conflictWithNeighbor: false
      });
      seatIndex++;
    }
  }

  return {
    sessionId,
    createdAt: Date.now(),
    totalSeats: TOTAL_EXAM_SEATS,
    rows: EXAM_HALL_ROWS,
    cols: EXAM_HALL_COLS,
    seats
  };
}

/**
 * Normalizes class name for reliable comparison (e.g. "6a1" === "6A1")
 */
function normalizeClass(cls?: string): string {
  if (!cls) return 'KHAC';
  return cls.trim().toUpperCase().replace(/\s+/g, '');
}

/**
 * Shuffles array in-place (Fisher-Yates)
 */
function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Solves seating arrangement so that students of the SAME CLASS are not adjacent to each other.
 * Constraint: Horizontal (same row) & Vertical (same col) adjacent seats must NOT have the same class!
 */
export function generateSmartSeatingPlan(
  students: StudentRosterItem[],
  sessionId?: string
): SeatingPlan {
  // Ensure we have at least 30 students
  const candidatePool = shuffleArray(students).slice(0, TOTAL_EXAM_SEATS);

  // Group by normalized class
  const classMap = new Map<string, StudentRosterItem[]>();
  candidatePool.forEach(student => {
    const key = normalizeClass(student.className);
    if (!classMap.has(key)) classMap.set(key, []);
    classMap.get(key)!.push(student);
  });

  // Sort classes by size descending (largest classes assigned first for best constraint satisfaction)
  const sortedClasses = Array.from(classMap.entries()).sort(
    (a, b) => b[1].length - a[1].length
  );

  // Flatten back with largest classes first, but items inside each class shuffled
  const prioritizedStudents: StudentRosterItem[] = [];
  sortedClasses.forEach(([, list]) => {
    prioritizedStudents.push(...shuffleArray(list));
  });

  // Grid representation: 6 rows x 5 cols
  const grid: (StudentRosterItem | null)[][] = Array(EXAM_HALL_ROWS)
    .fill(null)
    .map(() => Array(EXAM_HALL_COLS).fill(null));

  // Checkerboard / serpentine seat order to disperse seats across the room
  const seatOrder: GridCoord[] = [];
  // First pass: alternating checkerboard cells (r + c) % 2 === 0
  for (let r = 0; r < EXAM_HALL_ROWS; r++) {
    for (let c = 0; c < EXAM_HALL_COLS; c++) {
      if ((r + c) % 2 === 0) seatOrder.push({ row: r, col: c });
    }
  }
  // Second pass: remaining checkerboard cells
  for (let r = 0; r < EXAM_HALL_ROWS; r++) {
    for (let c = 0; c < EXAM_HALL_COLS; c++) {
      if ((r + c) % 2 !== 0) seatOrder.push({ row: r, col: c });
    }
  }

  // Backtracking solver
  let solved = false;
  let attempts = 0;
  const maxAttempts = 30000;

  function canPlace(r: number, c: number, student: StudentRosterItem): boolean {
    const studentClass = normalizeClass(student.className);
    const neighbors = getSeatNeighbors(r, c);
    for (const nb of neighbors) {
      const neighborStudent = grid[nb.row][nb.col];
      if (neighborStudent && normalizeClass(neighborStudent.className) === studentClass) {
        return false;
      }
    }
    return true;
  }

  function backtrack(seatIdx: number, remainingStudents: StudentRosterItem[]): boolean {
    attempts++;
    if (attempts > maxAttempts) return false;

    if (seatIdx >= TOTAL_EXAM_SEATS || remainingStudents.length === 0) {
      return true;
    }

    const { row, col } = seatOrder[seatIdx];

    // Try students that do not conflict first
    for (let i = 0; i < remainingStudents.length; i++) {
      const current = remainingStudents[i];
      if (canPlace(row, col, current)) {
        grid[row][col] = current;
        const nextRemaining = [
          ...remainingStudents.slice(0, i),
          ...remainingStudents.slice(i + 1)
        ];

        if (backtrack(seatIdx + 1, nextRemaining)) {
          return true;
        }

        // backtrack
        grid[row][col] = null;
      }
    }

    return false;
  }

  // Attempt 1: Strict 0-conflict backtracking
  solved = backtrack(0, prioritizedStudents);

  // Attempt 2: If strict backtracking reached cutoff (e.g. highly skewed class counts),
  // use randomized greedy heuristic with conflict minimization
  if (!solved) {
    // Reset grid
    for (let r = 0; r < EXAM_HALL_ROWS; r++) {
      for (let c = 0; c < EXAM_HALL_COLS; c++) {
        grid[r][c] = null;
      }
    }

    const pool = shuffleArray(prioritizedStudents);
    for (const pos of seatOrder) {
      let bestStudentIndex = -1;
      let minConflicts = 999;

      for (let i = 0; i < pool.length; i++) {
        const candidate = pool[i];
        const candClass = normalizeClass(candidate.className);
        let conflicts = 0;
        const neighbors = getSeatNeighbors(pos.row, pos.col);
        for (const nb of neighbors) {
          const neighborStudent = grid[nb.row][nb.col];
          if (neighborStudent && normalizeClass(neighborStudent.className) === candClass) {
            conflicts++;
          }
        }

        if (conflicts === 0) {
          bestStudentIndex = i;
          break;
        } else if (conflicts < minConflicts) {
          minConflicts = conflicts;
          bestStudentIndex = i;
        }
      }

      if (bestStudentIndex !== -1) {
        grid[pos.row][pos.col] = pool.splice(bestStudentIndex, 1)[0];
      }
    }
  }

  // Convert grid into SeatingAssignment[] list
  const seats: SeatingAssignment[] = [];
  let seatIndex = 0;

  for (let r = 0; r < EXAM_HALL_ROWS; r++) {
    for (let c = 0; c < EXAM_HALL_COLS; c++) {
      const student = grid[r][c];
      let hasConflict = false;

      // Check conflict for UI visual indicators
      if (student) {
        const studentClass = normalizeClass(student.className);
        const neighbors = getSeatNeighbors(r, c);
        for (const nb of neighbors) {
          const nbStudent = grid[nb.row][nb.col];
          if (nbStudent && normalizeClass(nbStudent.className) === studentClass) {
            hasConflict = true;
            break;
          }
        }
      }

      seats.push({
        seatIndex,
        row: r + 1,
        col: c + 1,
        seatLabel: `Dãy ${c + 1} - Bàn ${r + 1}`,
        student,
        conflictWithNeighbor: hasConflict
      });
      seatIndex++;
    }
  }

  return {
    sessionId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    totalSeats: TOTAL_EXAM_SEATS,
    rows: EXAM_HALL_ROWS,
    cols: EXAM_HALL_COLS,
    seats
  };
}

/**
 * Exports the 30-seat exam room layout to Excel (.xlsx)
 */
export function exportSeatingPlanToExcel(plan: SeatingPlan, quizTitle?: string) {
  const wb = XLSX.utils.book_new();

  // Summary header
  const titleRow = [`SƠ ĐỒ XẾP CHỖ PHÒNG THI - 30 THÍ SINH (6 DÃY x 5 BÀN)`];
  const subRow = [`Kỳ thi / Bài trắc nghiệm: ${quizTitle || 'Vòng 1 - Đấu trường Số'}`];
  const dateRow = [`Thời gian tạo: ${new Date(plan.createdAt).toLocaleString('vi-VN')}`];
  const stageBanner = [`===================== SÂN KHẤU / MÀN HÌNH CHÍNH =====================`];
  const blankRow: string[] = [];

  // Table header
  const tableHeader = ['STT', 'Vị trí ghế', 'Dãy', 'Bàn', 'Mã Học Sinh', 'Họ và Tên', 'Lớp', 'Ghi chú'];

  // Table rows sorted by Dãy then Bàn
  const sortedSeats = [...plan.seats].sort((a, b) => {
    if (a.col !== b.col) return a.col - b.col;
    return a.row - b.row;
  });

  const tableRows = sortedSeats.map((s, idx) => [
    idx + 1,
    s.seatLabel,
    `Dãy ${s.col}`,
    `Bàn ${s.row}`,
    s.student?.studentCode || '(Trống)',
    s.student?.name || '(Chưa xếp)',
    s.student?.className || '-',
    s.student?.notes || ''
  ]);

  // Visual Room Matrix (6 Columns x 5 Rows)
  const matrixHeader = ['SƠ ĐỒ BỐ TRÍ TRỰC QUAN (NHÌN TỪ SÂN KHẤU)'];
  const colHeaders = ['Bàn', 'Dãy 1', 'Dãy 2', 'Dãy 3', 'Dãy 4', 'Dãy 5', 'Dãy 6'];
  const matrixRows: (string | number)[][] = [];

  for (let r = 1; r <= EXAM_HALL_ROWS; r++) {
    const rowCells: (string | number)[] = [`Bàn ${r}`];
    for (let c = 1; c <= EXAM_HALL_COLS; c++) {
      const seat = plan.seats.find(s => s.row === r && s.col === c);
      if (seat?.student) {
        rowCells.push(`${seat.student.studentCode}: ${seat.student.name} (${seat.student.className})`);
      } else {
        rowCells.push('(Trống)');
      }
    }
    matrixRows.push(rowCells);
  }

  const allAoa = [
    titleRow,
    subRow,
    dateRow,
    blankRow,
    matrixHeader,
    stageBanner,
    colHeaders,
    ...matrixRows,
    blankRow,
    [`DANH SÁCH CHI TIẾT 30 THÍ SINH THEO VỊ TRÍ`],
    tableHeader,
    ...tableRows
  ];

  const ws = XLSX.utils.aoa_to_sheet(allAoa);
  ws['!cols'] = [
    { wch: 8 },
    { wch: 18 },
    { wch: 10 },
    { wch: 10 },
    { wch: 14 },
    { wch: 26 },
    { wch: 12 },
    { wch: 25 }
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'SoDoPhongThi');
  XLSX.writeFile(wb, `So_Do_Xep_Cho_30_HS_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * Persists the seating plan to Firestore session
 */
export async function saveSeatingPlanToSession(sessionId: string, plan: SeatingPlan): Promise<void> {
  if (!sessionId) return;
  try {
    await updateDoc(doc(db, 'sessions', sessionId), {
      seatingPlan: plan,
      lastRound2Update: Date.now()
    });
  } catch (e) {
    console.warn('Could not save seating plan to session in Firestore:', e);
  }
}
