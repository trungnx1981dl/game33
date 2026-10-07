import { Question } from '../types';

const TTS_PREF_KEY = 'khtn_auto_tts_enabled';
const TTS_GENDER_KEY = 'khtn_tts_voice_gender';
const TTS_RATE_KEY = 'khtn_tts_voice_rate';
const TTS_VOICE_URI_KEY = 'khtn_tts_voice_uri';

export type TtsGender = 'female' | 'male';

export interface TtsSettings {
  enabled: boolean;
  gender: TtsGender;
  rate: number;
  voiceUri: string;
}

// Global reference to prevent Chrome garbage-collection bug with SpeechSynthesisUtterance
let activeUtterance: SpeechSynthesisUtterance | null = null;

/**
 * Checks if SpeechSynthesis is supported
 */
export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/**
 * Get saved preference for Auto TTS
 */
export function getAutoTtsPreference(): boolean {
  if (typeof window === 'undefined') return true;
  const saved = localStorage.getItem(TTS_PREF_KEY);
  return saved === null ? true : saved === 'true';
}

/**
 * Save preference for Auto TTS
 */
export function setAutoTtsPreference(enabled: boolean) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TTS_PREF_KEY, String(enabled));
}

/**
 * Get preferred voice gender: 'female' (default) or 'male'
 */
export function getTtsGenderPreference(): TtsGender {
  if (typeof window === 'undefined') return 'female';
  const saved = localStorage.getItem(TTS_GENDER_KEY);
  return (saved === 'male' || saved === 'female') ? saved : 'female';
}

/**
 * Save preferred voice gender
 */
export function setTtsGenderPreference(gender: TtsGender) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TTS_GENDER_KEY, gender);
}

/**
 * Get preferred speech rate (0.8 - 1.2, default 1.0)
 */
export function getTtsRatePreference(): number {
  if (typeof window === 'undefined') return 1.0;
  const saved = localStorage.getItem(TTS_RATE_KEY);
  if (!saved) return 1.0;
  const val = parseFloat(saved);
  return isNaN(val) ? 1.0 : Math.max(0.7, Math.min(1.5, val));
}

/**
 * Save preferred speech rate
 */
export function setTtsRatePreference(rate: number) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TTS_RATE_KEY, String(rate));
}

/**
 * Get preferred specific voice URI
 */
export function getTtsVoiceUriPreference(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(TTS_VOICE_URI_KEY) || '';
}

/**
 * Save preferred specific voice URI
 */
export function setTtsVoiceUriPreference(uri: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TTS_VOICE_URI_KEY, uri);
}

/**
 * Get all available system voices
 */
export function getAvailableVoices(): SpeechSynthesisVoice[] {
  if (!isSpeechSupported()) return [];
  return window.speechSynthesis.getVoices();
}

/**
 * Returns available Vietnamese voices (or voices supporting vi / VIE)
 */
export function getVietnameseVoices(): SpeechSynthesisVoice[] {
  const voices = getAvailableVoices();
  return voices.filter(v => v.lang.toLowerCase().startsWith('vi') || v.lang.toUpperCase().includes('VIE'));
}

/**
 * Checks if a voice is considered Female by name/characteristics
 */
export function isFemaleVoice(voice: SpeechSynthesisVoice): boolean {
  const name = voice.name.toLowerCase();
  // Known female voices in Windows/Edge, macOS/iOS, Chrome, Android
  return /hoaimy|hoài my|linh|mai|lan|ngoc|ngọc|vic|female|nữ|nu|samantha|victoria|zira|karen|catherine|yuna|hương|huong|thảo|thao/i.test(name) ||
    (voice.name.includes('Google') && !/male|nam/i.test(name));
}

/**
 * Selects the optimal voice according to gender preference ('female' by default)
 */
export function selectBestVoice(preferredGender: TtsGender = 'female', preferredVoiceUri?: string): { voice: SpeechSynthesisVoice | null; pitch: number } {
  const voices = getAvailableVoices();
  if (voices.length === 0) {
    return { voice: null, pitch: preferredGender === 'female' ? 1.18 : 0.9 };
  }

  // 1. If explicit voiceUri requested and found, use it
  const targetUri = preferredVoiceUri || getTtsVoiceUriPreference();
  if (targetUri) {
    const found = voices.find(v => v.voiceURI === targetUri);
    if (found) {
      const isKnownFemale = isFemaleVoice(found);
      const pitch = preferredGender === 'female' ? (isKnownFemale ? 1.08 : 1.18) : 0.9;
      return { voice: found, pitch };
    }
  }

  const viVoices = getVietnameseVoices();

  if (preferredGender === 'female') {
    // 2. Look for Vietnamese female voices
    // Order: HoaiMy (Natural/Online) -> Linh -> Mai -> other Vietnamese female -> any Vietnamese non-male -> any Vietnamese
    const naturalFemale = viVoices.find(v => /hoaimy|hoài my/i.test(v.name));
    if (naturalFemale) return { voice: naturalFemale, pitch: 1.05 };

    const appleFemale = viVoices.find(v => /linh|mai|lan/i.test(v.name));
    if (appleFemale) return { voice: appleFemale, pitch: 1.05 };

    const genericFemale = viVoices.find(v => isFemaleVoice(v));
    if (genericFemale) return { voice: genericFemale, pitch: 1.1 };

    // Any Vietnamese voice that is not explicitly named "Nam" or "Male"
    const nonMaleVi = viVoices.find(v => !/nam|male/i.test(v.name));
    if (nonMaleVi) return { voice: nonMaleVi, pitch: 1.18 };

    // Fallback to any Vietnamese voice with pitch shifted up to sound feminine
    if (viVoices.length > 0) {
      return { voice: viVoices[0], pitch: 1.2 };
    }

    // Fallback: any voice on device with high pitch
    return { voice: voices[0] || null, pitch: 1.2 };
  } else {
    // Male Voice preference
    const naturalMale = viVoices.find(v => /namminh|nam minh/i.test(v.name));
    if (naturalMale) return { voice: naturalMale, pitch: 0.95 };

    const maleVi = viVoices.find(v => /nam|male/i.test(v.name));
    if (maleVi) return { voice: maleVi, pitch: 0.95 };

    if (viVoices.length > 0) return { voice: viVoices[0], pitch: 0.88 };

    return { voice: voices[0] || null, pitch: 0.88 };
  }
}

/**
 * Cleans KaTeX and LaTeX markup for natural Vietnamese speech
 */
export function cleanTextForSpeech(text: string): string {
  if (!text) return '';

  return text
    // Replace math fractions \frac{a}{b} -> a phần b
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1 phần $2')
    // Remove inline math symbols
    .replace(/\$\$([\s\S]*?)\$\$/g, '$1')
    .replace(/\$([^$]+)\$/g, '$1')
    .replace(/\\\(|\\\)/g, '')
    .replace(/\\\[|\\\]/g, '')
    // Common chemical / physics formulas
    .replace(/CO_2|CO2/gi, 'C O hai')
    .replace(/H_2O|H2O/gi, 'H hai O')
    .replace(/O_2|O2/gi, 'O hai')
    .replace(/N_2|N2/gi, 'N hai')
    .replace(/CH_4|CH4/gi, 'C H bốn')
    .replace(/m\/s\^2/gi, 'mét trên giây bình phương')
    .replace(/m\/s/gi, 'mét trên giây')
    .replace(/km\/h/gi, 'ki-lô-mét trên giờ')
    .replace(/°C/gi, 'độ C')
    // Remove extra Markdown tags (*, _, #)
    .replace(/[*_#`~]/g, ' ')
    // Normalize spaces
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Formats a full question and its options into readable Vietnamese speech text
 */
export function buildQuestionSpeechScript(question: Question, questionNumber: number): string {
  const parts: string[] = [];

  // 1. Question Title & Content
  const cleanContent = cleanTextForSpeech(question.content);
  parts.push(`Câu ${questionNumber}: ${cleanContent}`);

  // 2. Options
  if (question.type === 'MC' && question.options && question.options.length > 0) {
    const letters = ['A', 'B', 'C', 'D'];
    question.options.forEach((opt, idx) => {
      const letter = letters[idx] || `${idx + 1}`;
      const cleanOpt = cleanTextForSpeech(opt);
      parts.push(`Đáp án ${letter}: ${cleanOpt}.`);
    });
  } else if (question.type === 'TF' && question.options && question.options.length > 0) {
    const subLabels = ['a', 'b', 'c', 'd'];
    question.options.forEach((opt, idx) => {
      const label = subLabels[idx] || `${idx + 1}`;
      const cleanOpt = cleanTextForSpeech(opt);
      parts.push(`Ý ${label}: ${cleanOpt}.`);
    });
  }

  return parts.join(' ');
}

/**
 * Speaks the given text using the selected Vietnamese voice (Female by default)
 */
export function speakText(
  text: string, 
  options?: { 
    gender?: TtsGender; 
    voiceUri?: string; 
    rate?: number; 
    onEnd?: () => void;
  }
): SpeechSynthesisUtterance | null {
  if (!isSpeechSupported()) return null;

  try {
    window.speechSynthesis.cancel();

    if (!text.trim()) return null;

    const gender = options?.gender || getTtsGenderPreference();
    const rate = options?.rate ?? getTtsRatePreference();
    const { voice, pitch } = selectBestVoice(gender, options?.voiceUri);

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'vi-VN';
    utterance.rate = rate;
    utterance.pitch = pitch;

    if (voice) {
      utterance.voice = voice;
    }

    utterance.onend = () => {
      activeUtterance = null;
      if (options?.onEnd) options.onEnd();
    };

    utterance.onerror = (e) => {
      activeUtterance = null;
      if (options?.onEnd) options.onEnd();
    };

    activeUtterance = utterance;
    window.speechSynthesis.speak(utterance);
    return utterance;
  } catch (e) {
    console.warn('Speech synthesis error:', e);
    return null;
  }
}

/**
 * Tests speaking with current voice settings (Female voice preview)
 */
export function testVoice(gender: TtsGender = 'female', voiceUri?: string, onEnd?: () => void) {
  const sample = gender === 'female'
    ? 'Xin chào quý thầy cô và các em học sinh! Đây là giọng đọc nữ cho đấu trường tri thức: Từ dĩa ăn sạch đến thành phố sạch.'
    : 'Xin chào! Đây là giọng đọc nam cho đấu trường tri thức: Từ dĩa ăn sạch đến thành phố sạch.';
  
  return speakText(sample, { gender, voiceUri, onEnd });
}

/**
 * Cancels any ongoing speech
 */
export function cancelSpeech() {
  if (isSpeechSupported()) {
    try {
      window.speechSynthesis.cancel();
      activeUtterance = null;
    } catch (e) {
      // ignore
    }
  }
}
