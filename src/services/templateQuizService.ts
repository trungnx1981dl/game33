import * as XLSX from 'xlsx';
import { Question, QuestionType } from '../types';

export interface ParseTemplateResult {
  questions: Question[];
  total: number;
  mcCount: number;
  tfCount: number;
  saCount: number;
  essayCount: number;
  warnings: string[];
}

/**
 * Mẫu dữ liệu ban đầu chuẩn GDPT 2018 (môn KHTN)
 */
const SAMPLE_DATA = [
  {
    'STT': 1,
    'Loại câu hỏi': 'MC',
    'Nội dung câu hỏi': 'Hạt nhân nguyên tử được cấu tạo bởi những loại hạt nào sau đây?',
    'Phương án A (Ý a)': 'Proton và electron',
    'Phương án B (Ý b)': 'Proton và neutron',
    'Phương án C (Ý c)': 'Neutron và electron',
    'Phương án D (Ý d)': 'Chỉ gồm proton',
    'Đáp án đúng': 'B',
    'Thời gian (giây)': 30
  },
  {
    'STT': 2,
    'Loại câu hỏi': 'MC',
    'Nội dung câu hỏi': 'Đơn vị đo tốc độ chuyển động trong hệ SI chuẩn là gì?',
    'Phương án A (Ý a)': 'km/h',
    'Phương án B (Ý b)': 'm/min',
    'Phương án C (Ý c)': 'm/s',
    'Phương án D (Ý d)': 'cm/s',
    'Đáp án đúng': 'C',
    'Thời gian (giây)': 30
  },
  {
    'STT': 3,
    'Loại câu hỏi': 'MC',
    'Nội dung câu hỏi': 'Công thức hóa học của khí Carbon dioxide là gì?',
    'Phương án A (Ý a)': '$CO$',
    'Phương án B (Ý b)': '$CO_2$',
    'Phương án C (Ý c)': '$SO_2$',
    'Phương án D (Ý d)': '$CH_4$',
    'Đáp án đúng': 'B',
    'Thời gian (giây)': 30
  },
  {
    'STT': 4,
    'Loại câu hỏi': 'TF',
    'Nội dung câu hỏi': 'Khi nói về phản ứng quang hợp ở thực vật, các nhận định sau đây là đúng hay sai?',
    'Phương án A (Ý a)': 'Quang hợp diễn ra chủ yếu ở bào quan lục lạp của lá cây.',
    'Phương án B (Ý b)': 'Sản phẩm của quang hợp là $CO_2$ và nước ($H_2O$).',
    'Phương án C (Ý c)': 'Khí $O_2$ được giải phóng ra môi trường trong quá trình quang hợp.',
    'Phương án D (Ý d)': 'Quang hợp chỉ cần nhiệt độ cao, không cần năng lượng ánh sáng mặt trời.',
    'Đáp án đúng': 'Đúng, Sai, Đúng, Sai',
    'Thời gian (giây)': 60
  },
  {
    'STT': 5,
    'Loại câu hỏi': 'SA',
    'Nội dung câu hỏi': 'Một ô tô chuyển động thẳng đều đi được quãng đường $s = 120\\text{ km}$ trong thời gian $t = 2\\text{ giờ}$. Tính tốc độ của ô tô theo đơn vị $\\text{km/h}$?',
    'Phương án A (Ý a)': '',
    'Phương án B (Ý b)': '',
    'Phương án C (Ý c)': '',
    'Phương án D (Ý d)': '',
    'Đáp án đúng': '60',
    'Thời gian (giây)': 45
  },
  {
    'STT': 6,
    'Loại câu hỏi': 'ESSAY',
    'Nội dung câu hỏi': 'Vì sao cần phân loại rác thải tại nguồn để bảo vệ môi trường và phát triển bền vững?',
    'Phương án A (Ý a)': '',
    'Phương án B (Ý b)': '',
    'Phương án C (Ý c)': '',
    'Phương án D (Ý d)': '',
    'Đáp án đúng': 'Giúp tái chế rác hữu cơ, giảm thiểu ô nhiễm đất và nước, tiết kiệm chi phí xử lý chôn lấp.',
    'Thời gian (giây)': 60
  }
];

const GUIDE_DATA = [
  { 'Quy tắc': 'Loại câu hỏi (Cột 2)', 'Hướng dẫn chi tiết': 'Nhập "MC" (Trắc nghiệm 4 lựa chọn), "TF" (Đúng - Sai 4 ý), "SA" (Trả lời ngắn/Điền khuyết) hoặc "ESSAY" (Tự luận).' },
  { 'Quy tắc': 'Nội dung câu hỏi (Cột 3)', 'Hướng dẫn chi tiết': 'Nhập nội dung đề bài. Có thể gõ công thức toán/lý/hóa trong dấu $...$ (VD: $H_2O$, $v = s/t$).' },
  { 'Quy tắc': 'Phương án A, B, C, D (Cột 4-7)', 'Hướng dẫn chi tiết': 'Với câu MC: điền 4 đáp án. Với câu TF: điền 4 ý a, b, c, d tương ứng. Với SA/ESSAY: để trống.' },
  { 'Quy tắc': 'Đáp án đúng (Cột 8)', 'Hướng dẫn chi tiết': 'Với MC: điền chữ cái A, B, C hoặc D. Với TF: điền "Đúng, Sai, Đúng, Sai" (hoặc "Đ, S, Đ, S"). Với SA/ESSAY: điền đáp án ngắn.' },
  { 'Quy tắc': 'Thời gian (Cột 9)', 'Hướng dẫn chi tiết': 'Thời gian làm bài tính bằng giây (VD: 30, 45, 60).' }
];

/**
 * Xuất file mẫu Excel (.xlsx) chuẩn hóa
 */
export function exportTemplateExcel(filename = 'Mau_De_Thi_KHTN_GDPT.xlsx') {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Mẫu nhập đề
  const wsData = XLSX.utils.json_to_sheet(SAMPLE_DATA);
  // Cài đặt độ rộng cột cho đẹp
  wsData['!cols'] = [
    { wch: 6 },  // STT
    { wch: 14 }, // Loại
    { wch: 45 }, // Nội dung
    { wch: 25 }, // A
    { wch: 25 }, // B
    { wch: 25 }, // C
    { wch: 25 }, // D
    { wch: 25 }, // Đáp án
    { wch: 16 }  // Thời gian
  ];
  XLSX.utils.book_append_sheet(wb, wsData, 'Mau_Nhap_De');

  // Sheet 2: Hướng dẫn
  const wsGuide = XLSX.utils.json_to_sheet(GUIDE_DATA);
  wsGuide['!cols'] = [
    { wch: 25 },
    { wch: 80 }
  ];
  XLSX.utils.book_append_sheet(wb, wsGuide, 'Huong_Dan');

  XLSX.writeFile(wb, filename);
}

/**
 * Xuất file mẫu CSV (hỗ trợ tiếng Việt UTF-8)
 */
export function exportTemplateCsv(filename = 'Mau_De_Thi_KHTN_GDPT.csv') {
  const wsData = XLSX.utils.json_to_sheet(SAMPLE_DATA);
  const csvOutput = XLSX.utils.sheet_to_csv(wsData);
  // Add UTF-8 BOM so Excel opens Vietnamese characters correctly
  const blob = new Blob(['\uFEFF' + csvOutput], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Chuẩn hóa tên cột để nhận dạng linh hoạt
 */
function normalizeKey(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Nhận dạng và phân loại câu hỏi từ tệp mẫu tải lên (Excel .xlsx, .xls, .csv, v.v.)
 */
export async function parseQuizFromTemplateFile(file: File): Promise<ParseTemplateResult> {
  const arrayBuffer = await file.arrayBuffer();
  const wb = XLSX.read(arrayBuffer, { type: 'array' });

  // Chọn sheet đầu tiên hoặc sheet có tên chứa 'mau' / 'de'
  const sheetName = wb.SheetNames.find(name => {
    const norm = name.toLowerCase();
    return norm.includes('mau') || norm.includes('de') || norm.includes('quiz');
  }) || wb.SheetNames[0];

  const ws = wb.Sheets[sheetName];
  if (!ws) {
    throw new Error('Tệp không chứa trang tính (sheet) nào hợp lệ.');
  }

  const rawRows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
  if (rawRows.length === 0) {
    throw new Error('Trang tính không có dữ liệu. Vui lòng kiểm tra lại file của bạn.');
  }

  const questions: Question[] = [];
  const warnings: string[] = [];
  let mcCount = 0;
  let tfCount = 0;
  let saCount = 0;
  let essayCount = 0;

  rawRows.forEach((row, index) => {
    // Map properties dynamically
    let typeVal = '';
    let contentVal = '';
    let optA = '';
    let optB = '';
    let optC = '';
    let optD = '';
    let answerVal = '';
    let timeVal = 0;

    for (const rawKey of Object.keys(row)) {
      const k = normalizeKey(rawKey);
      const val = String(row[rawKey] || '').trim();

      if (k.includes('loai') || k.includes('type') || k.includes('dang')) {
        typeVal = val;
      } else if (k.includes('noidung') || k.includes('content') || k.includes('cauhoi') || k.includes('debai')) {
        contentVal = val;
      } else if (k.includes('phuongana') || k.includes('luachona') || k.includes('ya') || k.includes('optiona') || k === 'a' || k === 'paa') {
        optA = val;
      } else if (k.includes('phuonganb') || k.includes('luachonb') || k.includes('yb') || k.includes('optionb') || k === 'b' || k === 'pab') {
        optB = val;
      } else if (k.includes('phuonganc') || k.includes('luachonc') || k.includes('yc') || k.includes('optionc') || k === 'c' || k === 'pac') {
        optC = val;
      } else if (k.includes('phuongand') || k.includes('luachond') || k.includes('yd') || k.includes('optiond') || k === 'd' || k === 'pad') {
        optD = val;
      } else if (k.includes('dapan') || k.includes('answer') || k.includes('correct')) {
        answerVal = val;
      } else if (k.includes('thoigian') || k.includes('time')) {
        const parsed = parseInt(val, 10);
        if (!isNaN(parsed) && parsed > 0) timeVal = parsed;
      }
    }

    // Bỏ qua dòng trống nếu không có nội dung
    if (!contentVal) {
      return;
    }

    // Tự động phân loại QuestionType
    let detectedType: QuestionType = 'MC';
    const normType = typeVal.toLowerCase();

    if (normType.includes('tf') || normType.includes('dung') || normType.includes('sai') || normType.includes('đúng')) {
      detectedType = 'TF';
    } else if (normType.includes('sa') || normType.includes('ngan') || normType.includes('ngắn') || normType.includes('dien') || normType.includes('điền')) {
      detectedType = 'SA';
    } else if (normType.includes('essay') || normType.includes('luan') || normType.includes('luận')) {
      detectedType = 'ESSAY';
    } else if (normType.includes('mc') || normType.includes('trac') || normType.includes('nghiem')) {
      detectedType = 'MC';
    } else {
      // Heuristic thông minh nếu cột loại câu hỏi bị để trống:
      if (answerVal.includes('Đúng') || answerVal.includes('Sai') || answerVal.includes('Đ,') || answerVal.includes('S,')) {
        detectedType = 'TF';
      } else if (optA && optB) {
        detectedType = 'MC';
      } else {
        detectedType = 'SA';
      }
    }

    // Xử lý các options và đáp án theo từng loại
    let finalOptions: string[] = [];
    let finalAnswer = answerVal;
    let defaultTime = timeVal || (detectedType === 'MC' ? 30 : 60);

    if (detectedType === 'MC') {
      finalOptions = [optA, optB, optC, optD].map(o => o.trim());
      // Chuẩn hóa đáp án MC thành chữ cái 'A', 'B', 'C', 'D'
      const upperAns = answerVal.toUpperCase();
      if (['A', 'B', 'C', 'D'].includes(upperAns)) {
        finalAnswer = upperAns;
      } else {
        // Tìm xem đáp án có khớp với nội dung phương án nào không
        const matchIdx = finalOptions.findIndex(opt => opt && opt.toLowerCase() === answerVal.toLowerCase());
        if (matchIdx !== -1) {
          finalAnswer = ['A', 'B', 'C', 'D'][matchIdx];
        } else {
          // Lấy ký tự chữ cái đầu tiên nếu có (vd: "A. Proton" -> "A")
          const firstLetter = answerVal.trim().charAt(0).toUpperCase();
          if (['A', 'B', 'C', 'D'].includes(firstLetter)) {
            finalAnswer = firstLetter;
          } else {
            finalAnswer = 'A'; // Mặc định A nếu không xác định
            warnings.push(`Dòng ${index + 2}: Chưa xác định rõ đáp án MC, đã đặt tạm là A.`);
          }
        }
      }
      mcCount++;
    } else if (detectedType === 'TF') {
      finalOptions = [
        optA || 'Ý a',
        optB || 'Ý b',
        optC || 'Ý c',
        optD || 'Ý d'
      ].map(o => o.trim());

      // Chuẩn hóa đáp án TF thành JSON mảng 4 giá trị Đúng/Sai
      let tfItems: string[] = [];
      if (answerVal.includes(',')) {
        tfItems = answerVal.split(',').map(s => s.trim());
      } else if (answerVal.includes(';')) {
        tfItems = answerVal.split(';').map(s => s.trim());
      } else if (answerVal.includes(' ')) {
        tfItems = answerVal.split(/\s+/).map(s => s.trim());
      }

      const normalizedTF = [0, 1, 2, 3].map(i => {
        const item = (tfItems[i] || '').toLowerCase();
        if (item.includes('đ') || item.includes('d') || item.includes('true') || item.includes('t')) {
          return 'Đúng';
        }
        return 'Sai';
      });

      finalAnswer = JSON.stringify(normalizedTF);
      tfCount++;
    } else if (detectedType === 'SA') {
      saCount++;
    } else {
      essayCount++;
    }

    questions.push({
      id: `q-tpl-${Date.now()}-${index}`,
      type: detectedType,
      content: contentVal,
      options: (detectedType === 'MC' || detectedType === 'TF') ? finalOptions : [],
      answer: finalAnswer,
      timeLimit: defaultTime
    });
  });

  if (questions.length === 0) {
    throw new Error('Không trích xuất được câu hỏi nào từ file. Vui lòng kiểm tra định dạng và dữ liệu.');
  }

  return {
    questions,
    total: questions.length,
    mcCount,
    tfCount,
    saCount,
    essayCount,
    warnings
  };
}

/**
 * Xuất bảng xếp hạng và điểm số của toàn bộ học sinh ra file Excel (.xlsx)
 */
export function exportLeaderboardExcel(
  quizTitle: string,
  players: { name: string; score?: number; correctCount?: number; totalTimeSpent?: number }[],
  totalQuestions: number
) {
  const data = players.map((p, index) => {
    const correct = p.correctCount ?? 0;
    const score = Number((p.score ?? 0).toFixed(2));
    const time = p.totalTimeSpent ?? 0;
    const accuracy = totalQuestions > 0 ? `${Math.round((correct / totalQuestions) * 100)}%` : '0%';
    let classification = 'Đạt';
    if (score >= 9) classification = 'Xuất sắc';
    else if (score >= 8) classification = 'Giỏi';
    else if (score >= 6.5) classification = 'Khá';

    return {
      'Hạng': index + 1,
      'Họ và tên học sinh': p.name,
      'Số câu đúng': `${correct} / ${totalQuestions}`,
      'Điểm số (Thang 10)': score,
      'Tổng thời gian (giây)': `${time}s`,
      'Tỷ lệ đúng': accuracy,
      'Xếp loại': classification
    };
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);

  ws['!cols'] = [
    { wch: 8 },  // Hạng
    { wch: 30 }, // Họ tên
    { wch: 16 }, // Số câu đúng
    { wch: 20 }, // Điểm số
    { wch: 24 }, // Thời gian
    { wch: 14 }, // Tỷ lệ đúng
    { wch: 16 }  // Xếp loại
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Bang_Xep_Hang');
  const safeTitle = (quizTitle || 'Bai_Kiem_Tra').replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1E00-\u1EFF]/g, '_');
  XLSX.writeFile(wb, `Bang_Diem_${safeTitle}.xlsx`);
}
