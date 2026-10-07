import { getCustomApiKey, getCustomModel } from '../components/ApiKeySettings';

export interface GeneratedQuestionRaw {
  type: 'MC' | 'TF' | 'SA' | 'ESSAY';
  content: string;
  options?: string[];
  answer: string;
  timeLimit?: number;
  explanation?: string;
}

// Mô hình Gemini ưu tiên: gemini-3.1-flash-lite (tối ưu nhất, phản hồi nhanh và ổn định)
export const CANDIDATE_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
  'gemini-3.8-flash'
];

/**
 * Kiểm tra xem ứng dụng có đang chạy trên máy chủ tĩnh (như Netlify, Vercel, GitHub Pages) không
 */
export function isStaticHosting(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname.toLowerCase();
  return (
    host.includes('netlify.app') ||
    host.includes('vercel.app') ||
    host.includes('github.io') ||
    host.includes('pages.dev')
  );
}

/**
 * Trích xuất mảng JSON câu hỏi từ phản hồi văn bản của AI
 * Xử lý an toàn trường hợp AI trả về markdown ```json ... ``` hoặc văn bản kèm theo
 */
export function extractQuestionsJson(text: string): GeneratedQuestionRaw[] {
  let cleanText = text.trim();
  if (cleanText.startsWith('```json')) {
    cleanText = cleanText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
  } else if (cleanText.startsWith('```')) {
    cleanText = cleanText.replace(/^```\s*/i, '').replace(/\s*```$/i, '');
  }

  // Tìm vị trí mở mảng [ và đóng mảng ]
  const firstBracket = cleanText.indexOf('[');
  const lastBracket = cleanText.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    cleanText = cleanText.substring(firstBracket, lastBracket + 1);
  }

  const parsed = JSON.parse(cleanText);
  if (!Array.isArray(parsed)) {
    throw new Error('Dữ liệu AI trả về không phải là một danh sách câu hỏi hợp lệ.');
  }
  return parsed;
}

/**
 * Gọi trực tiếp Gemini REST API từ Client khi đang chạy trên static hosting (Netlify, Vercel, ...)
 */
async function callGeminiRestClient(contents: any[], apiKey: string, customModel?: string): Promise<string> {
  let lastError: any = null;

  const preferredModel = customModel || getCustomModel() || 'gemini-flash-latest';
  const modelsToTry = [
    preferredModel,
    ...CANDIDATE_MODELS.filter(m => m !== preferredModel)
  ];

  for (const model of modelsToTry) {
    let isTimedOut = false;
    let timeoutId: any = null;
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`;
      
      const controller = new AbortController();
      // Tăng thời gian chờ lên 90 giây để đủ thời gian sinh đề phức tạp (tránh lỗi signal is aborted)
      timeoutId = setTimeout(() => {
        isTimedOut = true;
        try {
          controller.abort(new Error('TIMEOUT_90S'));
        } catch {
          controller.abort();
        }
      }, 90000);

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents,
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.7
          }
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const resText = await res.text();
      let resJson: any = null;
      try {
        resJson = JSON.parse(resText);
      } catch {
        throw new Error(`Phản hồi không hợp lệ từ máy chủ Gemini: ${resText.slice(0, 100)}`);
      }

      if (!res.ok || resJson.error) {
        const errCode = resJson.error?.code || res.status;
        const rawMsg = resJson.error?.message || `Lỗi HTTP ${res.status}`;
        
        if (errCode === 429 || rawMsg.includes('RESOURCE_EXHAUSTED') || rawMsg.toLowerCase().includes('quota')) {
          throw new Error('Khóa API đã hết hạn mức sử dụng miễn phí trong ngày (Quota Exceeded). Vui lòng đổi khóa API khác hoặc thử lại sau.');
        }
        if (errCode === 400 && (rawMsg.includes('API_KEY_INVALID') || rawMsg.includes('API key not valid'))) {
          try {
            localStorage.removeItem('custom_gemini_api_key');
          } catch {}
          throw new Error('Khóa API Gemini cá nhân không đúng hoặc đã hết hạn. Đã tự động xóa khóa không hợp lệ để dùng khóa máy chủ.');
        }
        if (errCode === 403) {
          throw new Error('Khóa API không được cấp phép truy cập dịch vụ này (403 Forbidden).');
        }

        throw new Error(rawMsg);
      }

      const candidateText = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
      if (candidateText) {
        return candidateText;
      }
      throw new Error('Không nhận được nội dung câu hỏi từ mô hình AI.');
    } catch (err: any) {
      if (timeoutId) clearTimeout(timeoutId);
      
      let errMsg = err?.message || String(err);
      if (isTimedOut || err?.name === 'AbortError' || errMsg.includes('aborted') || errMsg.includes('TIMEOUT_90S')) {
        errMsg = 'Quá thời gian phản hồi từ máy chủ Gemini (Timeout). Vui lòng thử lại hoặc giảm bớt số lượng câu hỏi.';
      }

      lastError = new Error(errMsg);
      console.warn(`[Client-AI] Thử model ${model} thất bại:`, errMsg);

      // Nếu lỗi do hết quota hoặc API key sai thì dừng ngay, không thử vô ích model khác
      if (errMsg.includes('Quota Exceeded') || errMsg.includes('API key không đúng') || errMsg.includes('403 Forbidden')) {
        throw lastError;
      }
      continue;
    }
  }

  throw lastError || new Error('Không thể kết nối đến Gemini API. Vui lòng kiểm tra lại kết nối mạng hoặc Khóa API.');
}

/**
 * Tạo đề từ tệp đính kèm (Ảnh, PDF, tài liệu)
 * Hỗ trợ tự động fallback khi host trên Netlify không có backend
 */
export async function generateQuizFromFileService(
  fileData: string,
  mimeType: string,
  instructions: string
): Promise<GeneratedQuestionRaw[]> {
  const customApiKey = getCustomApiKey() || ((import.meta as any).env?.VITE_GEMINI_API_KEY as string | undefined);
  const selectedModel = getCustomModel();
  const base64Data = fileData.includes('base64,') ? fileData.split('base64,')[1] : fileData;

  const onStatic = isStaticHosting();

  // Bước 1: Nếu KHÔNG PHẢI static hosting, thử gọi server backend (/api/generate-quiz-from-file)
  let backendFailed = onStatic;
  if (!onStatic) {
    try {
      const res = await fetch('/api/generate-quiz-from-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileData,
          mimeType,
          instructions,
          model: selectedModel,
          apiKey: customApiKey || undefined
        })
      });

      const contentType = res.headers.get('content-type') || '';
      const resText = await res.text();

      // Kiểm tra nếu response là HTML (ví dụ Netlify rewrite sang index.html <!DOCTYPE)
      if (resText.trim().startsWith('<') || contentType.includes('text/html')) {
        backendFailed = true;
      } else {
        let data: any = null;
        try {
          data = JSON.parse(resText);
        } catch {
          backendFailed = true;
        }

        if (data) {
          if (!res.ok || data.error) {
            throw new Error(data.error || `Lỗi máy chủ (${res.status})`);
          }
          if (Array.isArray(data.questions)) {
            return data.questions;
          }
        }
      }
    } catch (err: any) {
      backendFailed = true;
    }
  }

  // Bước 2: Xử lý khi chạy trên Netlify hoặc máy chủ backend không hoạt động
  if (backendFailed) {
    if (!customApiKey || !customApiKey.trim()) {
      throw new Error(
        'Ứng dụng đang chạy trên trang web tĩnh Netlify (không có máy chủ backend).\n\n' +
        '👉 Để tạo đề bằng AI trực tiếp trên Netlify, vui lòng bấm vào nút "Khóa API Gemini Cá Nhân" ở trên thanh công cụ và nhập mã API Key của bạn (hoàn toàn miễn phí từ Google AI Studio).'
      );
    }

    const prompt = `Bạn là một chuyên gia giáo dục. Hãy phân tích tài liệu đính kèm và tạo ra một bộ đề kiểm tra bám sát chương trình GDPT 2018.
${instructions ? `Lưu ý thêm từ người dùng: ${instructions}` : ''}

Hãy xuất ra một mảng JSON thuần túy (Array) gồm các câu hỏi theo cấu trúc:
[
  {
    "type": "MC" | "TF" | "SA" | "ESSAY",
    "content": "Nội dung câu hỏi (hỗ trợ markdown/công thức)",
    "options": ["Phương án A", "Phương án B", "Phương án C", "Phương án D"], // Bắt buộc đối với MC và TF
    "answer": "A" // Đối với MC: chữ cái 'A', 'B', 'C', hoặc 'D'. Đối với TF: chuỗi JSON mảng 4 giá trị '["Đúng", "Sai", "Đúng", "Sai"]'. Đối với SA/ESSAY: chuỗi đáp án.
  }
]
Lưu ý quan trọng:
- Trắc nghiệm 4 lựa chọn (MC): options phải có đúng 4 phần tử.
- Đúng/Sai (TF): options gồm 4 ý tương ứng a, b, c, d; answer là chuỗi mảng 4 giá trị Đúng/Sai tương ứng ví dụ '["Đúng", "Sai", "Đúng", "Sai"]'.
- Điền khuyết/Trả lời ngắn (SA) & Tự luận (ESSAY): options để rỗng hoặc không cần gửi.`;

    const contents = [
      {
        parts: [
          {
            inlineData: {
              mimeType: mimeType || 'image/jpeg',
              data: base64Data
            }
          },
          {
            text: prompt
          }
        ]
      }
    ];

    const resultText = await callGeminiRestClient(contents, customApiKey, selectedModel);
    return extractQuestionsJson(resultText);
  }

  throw new Error('Không thể hoàn thành yêu cầu tạo đề từ file.');
}

/**
 * Trích xuất nguyên văn toàn bộ các câu hỏi từ tệp PDF đã định dạng theo chuẩn GDPT 2018
 * Dùng cho tính năng "Tạo câu hỏi từ file PDF trong chế độ thủ công"
 */
export async function extractQuestionsFromFormattedPdfService(
  fileData: string,
  mimeType: string,
  customInstructions?: string
): Promise<GeneratedQuestionRaw[]> {
  const prompt = `Bạn là một chuyên gia số hóa đề thi và khảo thí GDPT 2018.
Tệp đính kèm là một tệp PDF đề thi đã được biên soạn và định dạng sẵn các dạng câu hỏi.
${customInstructions ? `Yêu cầu bổ sung của giáo viên: ${customInstructions}` : ''}

NHIỆM VỤ: Hãy đọc toàn bộ tệp PDF và trích xuất TRUNG THỰC, ĐẦY ĐỦ 100% tất cả các câu hỏi vào định dạng JSON mảng câu hỏi để nạp vào form mẫu cho giáo viên:
1. Trắc nghiệm nhiều phương án lựa chọn (type: 'MC'):
   - 'content': Nội dung câu hỏi (chứa công thức KaTeX nếu có, ví dụ $H_2SO_4$, $\\frac{a}{b}$).
   - 'options': Đúng 4 lựa chọn [A, B, C, D] (loại bỏ chữ cái đầu "A.", "B." nếu trùng lặp).
   - 'answer': Đáp án đúng là chữ cái 'A', 'B', 'C' hoặc 'D' (xác định từ đề bài, gạch chân, in đậm hoặc bảng đáp án ở cuối đề nếu có. Nếu không có thì chọn đáp án đúng nhất).
   - 'explanation': Lời giải chi tiết hoặc giải thích (nếu đề có).

2. Trắc nghiệm Đúng - Sai (type: 'TF'):
   - 'content': Đoạn dẫn hoặc nội dung chính của câu hỏi.
   - 'options': Đúng 4 nhận định a, b, c, d.
   - 'answer': Chuỗi JSON mảng 4 giá trị Đúng/Sai tương ứng, ví dụ: '["Đúng", "Sai", "Đúng", "Sai"]'.
   - 'explanation': Lời giải hoặc giải thích từng ý nếu có.

3. Trắc nghiệm Trả lời ngắn / Điền khuyết (type: 'SA'):
   - 'content': Nội dung câu hỏi.
   - 'options': [] (mảng rỗng).
   - 'answer': Đáp án ngắn, số hoặc từ khóa (ví dụ: "4", "Oxi", "12.5").
   - 'explanation': Hướng dẫn giải nếu có.

4. Tự luận (type: 'ESSAY'):
   - 'content': Nội dung câu hỏi tự luận.
   - 'options': [] (mảng rỗng).
   - 'answer': Đáp án mẫu hoặc hướng dẫn chấm.
   - 'explanation': Ghi chú chấm điểm nếu có.

YÊU CẦU ĐỊNH DẠNG ĐẦU RA:
Xuất ra DUY NHẤT một mảng JSON thuần túy (không bọc text giải thích bên ngoài):
[
  {
    "type": "MC",
    "content": "Nội dung câu hỏi...",
    "options": ["Phương án A", "Phương án B", "Phương án C", "Phương án D"],
    "answer": "A",
    "explanation": "Lời giải..."
  }
]`;

  return generateQuizFromFileService(fileData, mimeType, prompt);
}

/**
 * Tạo đề từ yêu cầu văn bản (Prompt GDPT)
 * Hỗ trợ tự động fallback khi host trên Netlify không có backend
 */
export async function generateQuizFromTextService(
  requirements: string,
  mcqCount: number,
  tfCount: number,
  blankCount: number,
  essayCount: number
): Promise<GeneratedQuestionRaw[]> {
  const customApiKey = getCustomApiKey() || ((import.meta as any).env?.VITE_GEMINI_API_KEY as string | undefined);

  const onStatic = isStaticHosting();

  // Bước 1: Nếu không phải static, thử gọi server backend (/api/generate-quiz)
  let backendFailed = onStatic;
  if (!onStatic) {
    try {
      const res = await fetch('/api/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requirements,
          mcqCount,
          tfCount,
          blankCount,
          essayCount,
          apiKey: customApiKey || undefined
        })
      });

      const contentType = res.headers.get('content-type') || '';
      const resText = await res.text();

      if (resText.trim().startsWith('<') || contentType.includes('text/html')) {
        backendFailed = true;
      } else {
        let data: any = null;
        try {
          data = JSON.parse(resText);
        } catch {
          backendFailed = true;
        }

        if (data) {
          if (!res.ok || data.error) {
            throw new Error(data.error || `Lỗi máy chủ (${res.status})`);
          }
          if (Array.isArray(data.questions)) {
            return data.questions;
          }
        }
      }
    } catch (err: any) {
      backendFailed = true;
    }
  }

  // Bước 2: Xử lý khi chạy trên Netlify hoặc máy chủ backend không hoạt động
  if (backendFailed) {
    if (!customApiKey || !customApiKey.trim()) {
      throw new Error(
        'Ứng dụng đang chạy trên trang web tĩnh Netlify (không có máy chủ backend).\n\n' +
        '👉 Để tạo đề bằng AI trực tiếp trên Netlify, vui lòng bấm vào nút "Khóa API Gemini Cá Nhân" ở trên thanh công cụ và nhập mã API Key của bạn (hoàn toàn miễn phí từ Google AI Studio).'
      );
    }

    const prompt = `Bạn là một chuyên gia giáo dục. Hãy tạo một bộ đề kiểm tra dựa trên yêu cầu sau:
Yêu cầu cần đạt: ${requirements}
Bám sát chương trình GDPT 2018, sách giáo khoa KHTN bộ kết nối tri thức.
Số lượng câu hỏi:
- Trắc nghiệm 4 lựa chọn (MC): ${mcqCount}
- Đúng - Sai (TF): ${tfCount}
- Điền khuyết / Trả lời ngắn (SA): ${blankCount}
- Tự luận (ESSAY): ${essayCount}

Hãy xuất ra một mảng JSON thuần túy (Array) gồm các câu hỏi theo cấu trúc:
[
  {
    "type": "MC" | "TF" | "SA" | "ESSAY",
    "content": "Nội dung câu hỏi (hỗ trợ markdown/công thức)",
    "options": ["Phương án A", "Phương án B", "Phương án C", "Phương án D"], // Bắt buộc đối với MC và TF
    "answer": "A" // Đối với MC: chữ cái 'A', 'B', 'C', hoặc 'D'. Đối với TF: chuỗi JSON mảng 4 giá trị '["Đúng", "Sai", "Đúng", "Sai"]'. Đối với SA/ESSAY: chuỗi đáp án.
  }
]
Lưu ý quan trọng:
- Trắc nghiệm 4 lựa chọn: options gồm 4 phần tử.
- Đúng/Sai: options gồm 4 ý tương ứng a, b, c, d; answer là chuỗi mảng 4 giá trị Đúng/Sai tương ứng ví dụ '["Đúng", "Sai", "Đúng", "Sai"]'.
- Điền khuyết/Trả lời ngắn & Tự luận: options để rỗng hoặc không cần gửi.`;

    const contents = [
      {
        parts: [{ text: prompt }]
      }
    ];

    const resultText = await callGeminiRestClient(contents, customApiKey);
    return extractQuestionsJson(resultText);
  }

  throw new Error('Không thể hoàn thành yêu cầu tạo đề AI.');
}

/**
 * Kiểm tra tính hợp lệ của Khóa API Gemini
 */
export async function testGeminiApiKeyService(
  apiKey: string,
  modelToTest?: string
): Promise<{ success: boolean; message: string }> {
  if (!apiKey || !apiKey.trim()) {
    return { success: false, message: 'Vui lòng nhập API Key để kiểm tra!' };
  }

  const model = modelToTest || getCustomModel() || 'gemini-flash-latest';
  const onStatic = isStaticHosting();

  // Thử gọi backend /api/test-api-key trước nếu không phải static
  if (!onStatic) {
    try {
      const res = await fetch('/api/test-api-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKey.trim(), model })
      });

      const resText = await res.text();
      if (!resText.trim().startsWith('<')) {
        const data = JSON.parse(resText);
        if (res.ok && data.success) {
          return { success: true, message: `Khóa API Gemini hoạt động rất tốt với mô hình ${model}!` };
        }
        if (data.error) {
          return { success: false, message: data.error };
        }
      }
    } catch {
      // Nếu lỗi hoặc là HTML (Netlify), kiểm tra trực tiếp qua client
    }
  }

  // Kiểm tra trực tiếp qua Gemini REST API (dành cho Netlify)
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      try { controller.abort(); } catch {}
    }, 15000);

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Xin chào' }] }]
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const data = await res.json();
    if (res.ok && data.candidates?.[0]?.content) {
      return { success: true, message: `Khóa API Gemini hợp lệ và hoạt động bình thường với mô hình ${model}!` };
    }
    const errCode = data.error?.code || res.status;
    const msg = data.error?.message || 'Khóa API không hợp lệ hoặc đã hết hạn.';
    if (errCode === 429) {
      return { success: false, message: 'Khóa API đã hết hạn mức sử dụng (Quota Exceeded). Vui lòng thử lại sau hoặc dùng khóa khác.' };
    }
    return { success: false, message: msg };
  } catch (err: any) {
    if (err.name === 'AbortError' || String(err).includes('aborted')) {
      return { success: false, message: 'Quá thời gian chờ phản hồi khi kiểm tra API Key. Vui lòng kiểm tra lại kết nối mạng.' };
    }
    return { success: false, message: 'Lỗi kiểm tra API Key: ' + err.message };
  }
}
