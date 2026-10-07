import React, { useState, useEffect } from 'react';
import { KeyRound, Check, X, ExternalLink, Loader2, ShieldCheck, Cpu, Sparkles } from 'lucide-react';
import { testGeminiApiKeyService } from '../services/aiQuizService';

export const API_KEY_STORAGE_KEY = 'custom_gemini_api_key';
export const CUSTOM_MODEL_STORAGE_KEY = 'custom_gemini_model';
export const DEFAULT_GEMINI_MODEL = 'gemini-3.1-flash-lite';

export const AVAILABLE_MODELS = [
  {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash-Lite',
    badge: 'Mặc định khuyên dùng',
    desc: 'Tốc độ phản hồi tức thì, độ ổn định cao nhất cho nhận diện PDF & sinh đề thi GDPT 2018'
  },
  {
    id: 'gemini-flash-latest',
    name: 'Gemini Flash',
    badge: 'Chuẩn hoá cao',
    desc: 'Mô hình chuẩn phân tích chuyên sâu nội dung câu hỏi'
  },
  {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    badge: 'Mới nhất',
    desc: 'Mô hình thế hệ 3.8 Flash đa năng'
  }
];

export function getCustomApiKey(): string {
  try {
    return localStorage.getItem(API_KEY_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function setCustomApiKey(key: string) {
  try {
    if (!key.trim()) {
      localStorage.removeItem(API_KEY_STORAGE_KEY);
    } else {
      localStorage.setItem(API_KEY_STORAGE_KEY, key.trim());
    }
  } catch (e) {
    console.error('Failed to set API key in localStorage', e);
  }
}

export function getCustomModel(): string {
  try {
    return localStorage.getItem(CUSTOM_MODEL_STORAGE_KEY) || DEFAULT_GEMINI_MODEL;
  } catch {
    return DEFAULT_GEMINI_MODEL;
  }
}

export function setCustomModel(model: string) {
  try {
    localStorage.setItem(CUSTOM_MODEL_STORAGE_KEY, model);
  } catch (e) {
    console.error('Failed to set model in localStorage', e);
  }
}

interface ApiKeySettingsProps {
  onKeyChange?: (key: string) => void;
}

export default function ApiKeySettings({ onKeyChange }: ApiKeySettingsProps) {
  const [apiKey, setApiKey] = useState('');
  const [savedKey, setSavedKey] = useState('');
  const [selectedModel, setSelectedModel] = useState(DEFAULT_GEMINI_MODEL);
  const [showKey, setShowKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    const existing = getCustomApiKey();
    setApiKey(existing);
    setSavedKey(existing);
    setSelectedModel(getCustomModel());
  }, []);

  const handleSave = () => {
    const trimmed = apiKey.trim();
    setCustomApiKey(trimmed);
    setSavedKey(trimmed);
    setCustomModel(selectedModel);
    if (onKeyChange) onKeyChange(trimmed);
    setTestResult({
      success: true,
      message: trimmed ? `Đã lưu khóa API và chọn mô hình ${selectedModel} thành công!` : `Đã chọn mô hình ${selectedModel} với khóa hệ thống.`
    });
  };

  const handleClear = () => {
    setApiKey('');
    setCustomApiKey('');
    setSavedKey('');
    if (onKeyChange) onKeyChange('');
    setTestResult({
      success: true,
      message: 'Đã chuyển về sử dụng khóa mặc định của hệ thống.'
    });
  };

  const handleSelectModel = (modelId: string) => {
    setSelectedModel(modelId);
    setCustomModel(modelId);
  };

  const handleTest = async () => {
    const keyToTest = apiKey.trim();
    if (!keyToTest) {
      setTestResult({ success: false, message: 'Vui lòng nhập API Key để kiểm tra!' });
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await testGeminiApiKeyService(keyToTest, selectedModel);
      setTestResult(result);
    } catch (e: any) {
      setTestResult({ success: false, message: 'Lỗi kiểm tra: ' + e.message });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 rounded-3xl shadow-xl border border-slate-700/60 mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-700/80">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-teal-500/20 text-teal-400 rounded-2xl border border-teal-500/30">
            <KeyRound className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-white flex flex-wrap items-center gap-2">
              Khóa API & Mô Hình Gemini
              <span className="px-2.5 py-0.5 text-xs font-semibold bg-teal-500/20 text-teal-300 border border-teal-500/30 rounded-full flex items-center gap-1">
                <Cpu className="w-3.5 h-3.5" /> Mô hình: {selectedModel}
              </span>
              {savedKey ? (
                <span className="px-2.5 py-0.5 text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> Key đang kích hoạt
                </span>
              ) : (
                <span className="px-2.5 py-0.5 text-xs font-semibold bg-slate-700 text-slate-300 rounded-full">
                  Mặc định hệ thống
                </span>
              )}
            </h3>
            <p className="text-sm text-slate-300">
              Sử dụng mô hình <strong className="text-teal-300 font-semibold">Gemini 3.5 Flash</strong> để phân tích tệp PDF và tạo câu hỏi tự động chuẩn xác nhất.
            </p>
          </div>
        </div>

        <a
          href="https://aistudio.google.com/apikey"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 hover:text-teal-200 border border-teal-500/30 rounded-xl text-xs font-medium transition-all w-fit"
        >
          Lấy API Key Miễn Phí <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      <div className="mt-4 space-y-4">
        {/* Model Selection Tabs */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
            Chọn Mô Hình Gemini Sử Dụng:
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            {AVAILABLE_MODELS.map(m => {
              const isSelected = selectedModel === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleSelectModel(m.id)}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-teal-500/15 border-teal-400 text-white shadow-sm ring-1 ring-teal-400/40'
                      : 'bg-slate-950/40 border-slate-700/60 text-slate-300 hover:border-slate-600 hover:bg-slate-900/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="font-bold text-sm text-white flex items-center gap-1.5">
                      {isSelected && <Sparkles className="w-3.5 h-3.5 text-teal-400" />}
                      {m.name}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                      isSelected
                        ? 'bg-teal-400 text-slate-950 font-bold'
                        : 'bg-slate-800 text-slate-400'
                    }`}>
                      {m.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">{m.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* API Key Input */}
        <div className="flex flex-col sm:flex-row gap-3 pt-1">
          <div className="relative flex-1">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Dán mã API Key (ví dụ: AIzaSy...)"
              className="w-full px-4 py-3 bg-slate-950/70 border border-slate-700 rounded-xl text-white font-mono text-sm placeholder:text-slate-500 focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-500/20"
            />
            {apiKey && (
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white px-2 py-1"
              >
                {showKey ? 'Ẩn' : 'Hiện'}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleTest}
              disabled={isTesting || !apiKey.trim()}
              className="px-4 py-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors flex items-center gap-2"
            >
              {isTesting ? <Loader2 className="w-4 h-4 animate-spin text-teal-400" /> : null}
              Kiểm tra
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-3 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-sm rounded-xl transition-all shadow-md shadow-teal-500/20 flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" /> Lưu Cài Đặt
            </button>
            {savedKey && (
              <button
                onClick={handleClear}
                title="Xóa khóa cá nhân"
                className="p-3 bg-slate-800 hover:bg-red-500/20 hover:text-red-300 text-slate-400 border border-slate-700 rounded-xl transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {testResult && (
          <div
            className={`p-3 rounded-xl text-sm flex items-center gap-2 ${
              testResult.success
                ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-200'
                : 'bg-rose-500/20 border border-rose-500/40 text-rose-200'
            }`}
          >
            {testResult.success ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
            {testResult.message}
          </div>
        )}

        <p className="text-xs text-slate-400 leading-relaxed">
          💡 <strong className="text-slate-300">Ghi chú:</strong> Hệ thống tự động kích hoạt mô hình <strong className="text-teal-300">Gemini 3.1 Flash-Lite</strong> (`gemini-3.1-flash-lite`) cho việc nhận diện đề từ file PDF và tạo câu hỏi tự động. Khóa API cá nhân được lưu an toàn trực tiếp trên trình duyệt của bạn.
        </p>
      </div>
    </div>
  );
}
