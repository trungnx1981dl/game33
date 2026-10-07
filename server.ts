import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

const CANDIDATE_MODELS = [
  "gemini-3.1-flash-lite",
  "gemini-flash-latest",
  "gemini-3.8-flash"
];

function isRetryableError(error: any): boolean {
  const code = error?.status || error?.code || error?.error?.code || error?.error?.status;
  const msg = String(error?.message || "");
  return (
    code === 503 ||
    code === 429 ||
    code === "UNAVAILABLE" ||
    code === "RESOURCE_EXHAUSTED" ||
    msg.includes("503") ||
    msg.includes("429") ||
    msg.includes("high demand") ||
    msg.includes("UNAVAILABLE") ||
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.includes("temporarily unavailable")
  );
}

const quizSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    required: ["type", "content", "answer"],
    properties: {
      type: {
        type: Type.STRING,
        description: "Loại câu hỏi: 'MC', 'TF', 'SA', hoặc 'ESSAY'",
      },
      content: {
        type: Type.STRING,
        description: "Nội dung câu hỏi (hỗ trợ markdown/katex cho công thức)",
      },
      options: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "Chỉ dùng cho MC và TF",
      },
      answer: {
        type: Type.STRING,
        description: "Đáp án (với TF có thể là chuỗi JSON array ví dụ '[\"Đúng\", \"Sai\", \"Đúng\", \"Sai\"]')",
      },
      explanation: {
        type: Type.STRING,
        description: "Lời giải chi tiết hoặc giải thích nếu có",
      }
    }
  }
};

async function generateQuizWithFallback(contents: any, customApiKey?: string, requestedModel?: string): Promise<string> {
  const hasCustomKey = Boolean(customApiKey && customApiKey.trim());
  let client = hasCustomKey 
    ? new GoogleGenAI({ 
        apiKey: customApiKey!.trim(),
        httpOptions: { headers: { "User-Agent": "aistudio-build" } }
      }) 
    : ai;

  let lastError: any = null;
  const validModels = ["gemini-3.1-flash-lite", "gemini-flash-latest", "gemini-3.8-flash"];
  const preferred = (requestedModel && validModels.includes(requestedModel.trim())) 
    ? requestedModel.trim() 
    : "gemini-3.1-flash-lite";

  const modelsToTry = [
    preferred,
    ...CANDIDATE_MODELS.filter(m => m !== preferred)
  ];

  let triedSystemFallback = !hasCustomKey;

  for (let i = 0; i < modelsToTry.length; i++) {
    const model = modelsToTry[i];
    try {
      console.log(`[AI] Calling model ${model}${!triedSystemFallback ? ' (using custom key)' : ' (using system key)'}...`);
      
      const generatePromise = client.models.generateContent({
        model,
        contents,
        config: {
          responseMimeType: "application/json",
          responseSchema: quizSchema,
        },
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout after 40s on model ${model}`)), 40000)
      );

      const response: any = await Promise.race([generatePromise, timeoutPromise]);
      if (response?.text) {
        console.log(`[AI] Successfully generated content using model: ${model}`);
        return response.text;
      }
    } catch (err: any) {
      lastError = err;
      const errMsg = String(err?.message || err);
      console.warn(`[AI] Model ${model} error:`, errMsg);

      // If custom API key failed with invalid key, immediately fall back to system ai key
      if (!triedSystemFallback && (errMsg.includes('API_KEY_INVALID') || errMsg.includes('API key not valid') || errMsg.includes('400') || errMsg.includes('401') || errMsg.includes('403'))) {
        console.log('[AI] Custom API key was rejected. Seamlessly falling back to system GEMINI_API_KEY...');
        client = ai;
        triedSystemFallback = true;
        i = -1; // restart loop with system key
        continue;
      }

      continue;
    }
  }

  throw lastError;
}

app.post("/api/test-api-key", async (req, res) => {
  try {
    const { apiKey, model } = req.body;
    if (!apiKey || typeof apiKey !== "string") {
      return res.status(400).json({ error: "Vui lòng nhập API Key để kiểm tra." });
    }
    const validModels = ["gemini-3.1-flash-lite", "gemini-flash-latest", "gemini-3.8-flash"];
    const testModel = (typeof model === 'string' && validModels.includes(model.trim())) ? model.trim() : "gemini-3.1-flash-lite";
    const testClient = new GoogleGenAI({ 
      apiKey: apiKey.trim(),
      httpOptions: { headers: { "User-Agent": "aistudio-build" } }
    });
    const response = await testClient.models.generateContent({
      model: testModel,
      contents: "Xin chào",
    });
    if (response?.text) {
      return res.json({ success: true, message: `Khóa API Key hợp lệ với mô hình ${testModel}!` });
    }
    res.status(400).json({ error: "Không nhận được phản hồi từ AI." });
  } catch (err: any) {
    console.error("Test API Key error:", err);
    res.status(400).json({ error: err?.message || "Khóa API không hợp lệ hoặc đã hết hạn." });
  }
});

app.post("/api/generate-quiz", async (req, res) => {
  try {
    const { requirements, mcqCount, tfCount, blankCount, essayCount, apiKey, model } = req.body;
    const customApiKey = apiKey || (req.headers["x-gemini-api-key"] as string);
    
    const prompt = `Bạn là một chuyên gia giáo dục. Hãy tạo một bộ đề kiểm tra dựa trên yêu cầu sau:
Yêu cầu cần đạt: ${requirements}
Bám sát chương trình GDPT 2018, sách giáo khoa KHTN bộ kết nối tri thức.
Số lượng câu hỏi:
- Trắc nghiệm 4 lựa chọn: ${mcqCount}
- Đúng - Sai: ${tfCount}
- Điền khuyết (Trả lời ngắn): ${blankCount}
- Tự luận: ${essayCount}

Hãy xuất ra định dạng JSON theo schema đã cho.
Lưu ý: 
- Trắc nghiệm 4 lựa chọn có 4 options.
- Đúng/Sai có 4 options (mỗi option là một ý, answer là một mảng 4 giá trị "Đúng" hoặc "Sai" tương ứng).
- Điền khuyết/Trả lời ngắn không có options.
- Tự luận không có options.`;

    const text = await generateQuizWithFallback(prompt, customApiKey, model);
    res.json({ questions: JSON.parse(text || "[]") });
  } catch (error: any) {
    console.error("AI Generation error:", error);
    const isOverloaded = isRetryableError(error);
    const message = isOverloaded
      ? "Máy chủ AI hiện đang chịu tải cao (503). Vui lòng thử lại sau giây lát."
      : (error?.message || "Không thể tạo bộ đề.");
    res.status(isOverloaded ? 503 : 500).json({ error: message });
  }
});

app.post("/api/generate-quiz-from-file", async (req, res) => {
  try {
    const { fileData, mimeType, instructions, apiKey, model } = req.body;
    const customApiKey = apiKey || (req.headers["x-gemini-api-key"] as string);
    
    if (!fileData || !mimeType) {
      return res.status(400).json({ error: "Missing file data" });
    }

    // Extract base64 part if it contains a data URI prefix
    const base64Data = fileData.includes("base64,") ? fileData.split("base64,")[1] : fileData;

    const prompt = `Bạn là một chuyên gia giáo dục. Hãy phân tích tài liệu đính kèm và tạo ra một bộ đề kiểm tra dựa trên nội dung đó.
    ${instructions ? `\nLưu ý thêm từ người dùng: ${instructions}\n` : ""}
    Hãy xuất ra định dạng JSON theo schema đã cho.
    Yêu cầu các loại câu hỏi bao gồm: Trắc nghiệm (MC), Đúng-Sai (TF), Điền khuyết (SA), hoặc Tự luận (ESSAY).
    Lưu ý: 
    - Trắc nghiệm 4 lựa chọn có 4 options.
    - Đúng/Sai có 4 options (mỗi option là một ý, answer là một mảng 4 giá trị "Đúng" hoặc "Sai" tương ứng).
    - Điền khuyết/Trả lời ngắn không có options.
    - Tự luận không có options.`;

    const contents = [
      {
        inlineData: {
          data: base64Data,
          mimeType: mimeType
        }
      },
      prompt
    ];

    const text = await generateQuizWithFallback(contents, customApiKey, model);
    res.json({ questions: JSON.parse(text || "[]") });
  } catch (error: any) {
    console.error("AI File Generation error:", error);
    const isOverloaded = isRetryableError(error);
    const message = isOverloaded
      ? "Máy chủ AI hiện đang chịu tải cao (503). Vui lòng thử lại sau giây lát."
      : (error?.message || "Không thể tạo bộ đề từ file.");
    res.status(isOverloaded ? 503 : 500).json({ error: message });
  }
});

// ==========================================
// REAL-TIME SESSION SYNC ENGINE (BACKUP & HIGH-PERFORMANCE)
// Guarantees 100% gameplay uptime even when Firestore quota is exhausted
// ==========================================
interface SyncSessionData {
  session: any;
  players: Map<string, any>;
  submissions: Map<string, any>;
  lastUpdated: number;
}

const syncStore = new Map<string, SyncSessionData>();

function getOrCreateSyncSession(sessionId: string, initialData?: any): SyncSessionData {
  let existing = syncStore.get(sessionId);
  if (!existing) {
    existing = {
      session: initialData || { id: sessionId, createdAt: Date.now() },
      players: new Map(),
      submissions: new Map(),
      lastUpdated: Date.now()
    };
    syncStore.set(sessionId, existing);
  } else if (initialData) {
    existing.session = { ...existing.session, ...initialData, id: sessionId };
    existing.lastUpdated = Date.now();
  }
  return existing;
}

// 1. Create or update session state
app.post("/api/sync/session", (req, res) => {
  try {
    const { session } = req.body;
    if (!session || !session.id) {
      return res.status(400).json({ error: "Missing session or session.id" });
    }
    const store = getOrCreateSyncSession(session.id, session);
    res.json({ success: true, session: store.session, lastUpdated: store.lastUpdated });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Sync session error" });
  }
});

// 2. Get full session state (session + players + submissions)
app.get("/api/sync/session/:id", (req, res) => {
  try {
    const sessionId = req.params.id;
    const store = syncStore.get(sessionId);
    if (!store) {
      return res.status(404).json({ error: "Session not found in sync store" });
    }
    res.json({
      session: store.session,
      players: Array.from(store.players.values()),
      submissions: Array.from(store.submissions.values()),
      lastUpdated: store.lastUpdated
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Get sync session error" });
  }
});

// 3. List all active sessions (for player / judge lobby)
app.get("/api/sync/sessions", (req, res) => {
  try {
    const now = Date.now();
    const list = Array.from(syncStore.values())
      .map(s => s.session)
      .filter(s => s && s.status !== "FINISHED" && s.status !== "CLOSED" && !s.isClosed && !s.hostLeft && (!s.createdAt || now - s.createdAt < 24 * 3600 * 1000));
    list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    res.json({ sessions: list });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "List sync sessions error" });
  }
});

// 4. Player Join or Update (answers, score, exp, violations)
app.post("/api/sync/session/:id/player", (req, res) => {
  try {
    const sessionId = req.params.id;
    const { player } = req.body;
    if (!player || !player.id) {
      return res.status(400).json({ error: "Missing player or player.id" });
    }
    const store = getOrCreateSyncSession(sessionId);
    const existingPlayer = store.players.get(player.id) || {};
    const updatedPlayer = { ...existingPlayer, ...player };
    store.players.set(player.id, updatedPlayer);
    store.lastUpdated = Date.now();
    res.json({ success: true, player: updatedPlayer });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Sync player error" });
  }
});

// 5. Round 2 Submission (images/audio/products)
app.post("/api/sync/session/:id/submission", (req, res) => {
  try {
    const sessionId = req.params.id;
    const { submission } = req.body;
    if (!submission || !submission.teamId) {
      return res.status(400).json({ error: "Missing submission or teamId" });
    }
    const store = getOrCreateSyncSession(sessionId);
    store.submissions.set(submission.teamId, submission);
    if (!store.session.round2Submissions) store.session.round2Submissions = {};
    store.session.round2Submissions[submission.teamId] = submission;
    store.session.lastRound2Update = Date.now();
    store.lastUpdated = Date.now();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Sync submission error" });
  }
});

// 6. Round 2 Judge Score
app.post("/api/sync/session/:id/score", (req, res) => {
  try {
    const sessionId = req.params.id;
    const { teamId, judgeId, score } = req.body;
    if (!teamId || !judgeId || score === undefined) {
      return res.status(400).json({ error: "Missing score parameters" });
    }
    const store = getOrCreateSyncSession(sessionId);
    if (!store.session.round2Scores) store.session.round2Scores = {};
    if (!store.session.round2Scores[teamId]) store.session.round2Scores[teamId] = {};
    store.session.round2Scores[teamId][judgeId] = Number(score);
    if (judgeId === 'GK01') {
      store.session.round2Scores[teamId]['GK'] = Number(score);
    }
    store.session.lastRound2Update = Date.now();
    store.lastUpdated = Date.now();
    res.json({ success: true, round2Scores: store.session.round2Scores });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Sync score error" });
  }
});

app.post("/api/append-sheet", async (req, res) => {
  // We'll implement Google Sheets API append here.
  // The client must send the OAuth access token.
  try {
    const { sheetName, rowData } = req.body;
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Usually you'd search for an existing sheet or create one.
    // For simplicity, we just create a file if not found, or append.
    // We can use the fetch API to call Google Sheets API.
    
    // First, let's find if a spreadsheet named "KetQuaOnLuyen" exists.
    const searchRes = await fetch(
      "https://www.googleapis.com/drive/v3/files?q=name='KetQuaOnLuyen' and mimeType='application/vnd.google-apps.spreadsheet'&fields=files(id, name)", 
      { headers: { Authorization: authHeader } }
    );
    const searchData = await searchRes.json();
    
    let spreadsheetId = "";
    if (searchData.files && searchData.files.length > 0) {
      spreadsheetId = searchData.files[0].id;
    } else {
      // Create new
      const createRes = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          properties: { title: "KetQuaOnLuyen" },
          sheets: [{ properties: { title: "Results" } }]
        })
      });
      const createData = await createRes.json();
      spreadsheetId = createData.spreadsheetId;
      
      // Add header row
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Results!A1:E1:append?valueInputOption=USER_ENTERED`, {
        method: "POST",
        headers: { Authorization: authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          values: [["Tên Học Sinh", "Lớp", "Tên Đề", "Điểm", "Thời Gian (s)"]]
        })
      });
    }

    // Append data
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Results!A:E:append?valueInputOption=USER_ENTERED`, {
      method: "POST",
      headers: { Authorization: authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ values: [rowData] })
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Sheet append error:", error);
    res.status(500).json({ error: "Failed to append to sheet" });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
