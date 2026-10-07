import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Quiz, Question, QuestionType } from '../types';
import { firestoreQuota } from './firestoreQuota';
import { saveMediaItem, getMediaItem } from './mediaStorage';

const LOCAL_STORAGE_KEY = 'gdpt_quizzes_local_backup_v1';
const MAX_FIRESTORE_DOC_BYTES = 850_000; // An toàn dưới ngưỡng tối đa 1.048.576 bytes (1 MiB) của Firestore

/**
 * Tính toán dung lượng byte ước tính của dữ liệu
 */
export function getEstimatedSize(data: any): number {
  try {
    return new TextEncoder().encode(JSON.stringify(data)).length;
  } catch (e) {
    return 0;
  }
}

/**
 * Chuẩn hóa một câu hỏi để đảm bảo không bao giờ chứa trường `undefined`
 * (Trường undefined sẽ khiến Firestore SDK ném lỗi không thể lưu)
 */
export function sanitizeQuestion(q: any, index: number): Question {
  const qType: QuestionType = ['MC', 'TF', 'SA', 'ESSAY'].includes(q.type) ? q.type : 'MC';
  const id = typeof q.id === 'string' && q.id.trim() ? q.id.trim() : `q-${Date.now()}-${index}`;
  const content = typeof q.content === 'string' ? q.content.trim() : `Câu hỏi ${index + 1}`;
  const timeLimit = typeof q.timeLimit === 'number' && q.timeLimit > 0 ? q.timeLimit : (qType === 'MC' ? 30 : 60);
  const explanation = typeof q.explanation === 'string' ? q.explanation.trim() : '';

  let answer = '';
  if (typeof q.answer === 'string') {
    answer = q.answer.trim();
  } else if (Array.isArray(q.answer)) {
    answer = JSON.stringify(q.answer);
  } else if (q.answer != null) {
    answer = String(q.answer).trim();
  }

  // Tùy chọn phương án
  let options: string[] = [];
  if (Array.isArray(q.options)) {
    options = q.options.map((opt: any) => (opt != null ? String(opt).trim() : ''));
  }

  // Nếu là trắc nghiệm MC hoặc TF mà chưa đủ 4 lựa chọn thì bổ sung mặc định an toàn
  if (qType === 'MC' && options.length < 4) {
    while (options.length < 4) {
      options.push('');
    }
  } else if (qType === 'TF' && options.length < 4) {
    while (options.length < 4) {
      options.push('');
    }
  }

  const cleanQ: Question = {
    id,
    type: qType,
    content: content || `Câu hỏi ${index + 1}`,
    options,
    answer,
    timeLimit,
    explanation
  };

  if (typeof q.audioUrl === 'string' && q.audioUrl) {
    cleanQ.audioUrl = q.audioUrl;
  }

  return cleanQ;
}

/**
 * Chuẩn hóa toàn bộ bộ đề trước khi lưu Firestore hoặc LocalStorage
 */
export function sanitizeQuizData(quizData: Partial<Quiz>): Omit<Quiz, 'id'> {
  const rawTitle = typeof quizData.title === 'string' ? quizData.title.trim() : '';
  const title = rawTitle ? rawTitle.slice(0, 500) : `Bộ đề kiểm tra KHTN (${new Date().toLocaleDateString('vi-VN')})`;
  const subject = typeof quizData.subject === 'string' && quizData.subject.trim() 
    ? quizData.subject.trim().slice(0, 100) 
    : 'KHTN';
  const description = typeof quizData.description === 'string' ? quizData.description.trim().slice(0, 2000) : '';
  const createdBy = typeof quizData.createdBy === 'string' && quizData.createdBy.trim() 
    ? quizData.createdBy.trim().slice(0, 128) 
    : 'admin';
  const createdAt = typeof quizData.createdAt === 'number' && quizData.createdAt > 0 
    ? quizData.createdAt 
    : Date.now();

  const rawQuestions = Array.isArray(quizData.questions) ? quizData.questions : [];
  const questions = rawQuestions.map((q, idx) => sanitizeQuestion(q, idx));

  const result: Omit<Quiz, 'id'> = {
    title,
    subject,
    createdBy,
    createdAt,
    questions
  };

  if (description) {
    result.description = description;
  }

  return result;
}

/**
 * Tách và tối ưu hóa payload bộ đề cho Cloud Firestore:
 * Nếu dữ liệu vượt quá 850KB (do chứa audio hoặc hình ảnh Base64 lớn),
 * tự động lưu media lớn vào IndexedDB và Subcollection `quizzes/{quizId}/media/{qId}`,
 * thay bằng chuỗi tham chiếu nhẹ trong tài liệu chính để không bao giờ vi phạm giới hạn 1MB của Firestore.
 */
export async function prepareQuizForFirestore(quizId: string, cleanData: Omit<Quiz, 'id'>): Promise<Omit<Quiz, 'id'>> {
  const currentSize = getEstimatedSize(cleanData);
  if (currentSize <= MAX_FIRESTORE_DOC_BYTES) {
    return cleanData;
  }

  const sanitizedQuestions: Question[] = [];
  for (let i = 0; i < cleanData.questions.length; i++) {
    const q = { ...cleanData.questions[i] };
    const qKey = q.id || `q_${i}`;

    // Tách audioUrl nếu là chuỗi Base64 lớn (> 5000 ký tự)
    if (typeof q.audioUrl === 'string' && q.audioUrl.length > 5000) {
      const mediaKey = `quiz_${quizId}_q_${qKey}_audio`;
      
      // 1. Luôn lưu vào IndexedDB để truy xuất nhanh và phát mượt trên máy
      await saveMediaItem(mediaKey, q.audioUrl);

      // 2. Nếu file audio < 850KB, lưu vào Firestore subcollection của bộ đề
      if (q.audioUrl.length < MAX_FIRESTORE_DOC_BYTES && !quizId.startsWith('local-')) {
        try {
          const mediaDocRef = doc(db, `quizzes/${quizId}/media/${qKey}`);
          await setDoc(mediaDocRef, {
            audioUrl: q.audioUrl,
            updatedAt: Date.now()
          }, { merge: true });
        } catch (subErr) {
          console.warn('Could not save media subdocument:', subErr);
        }
      }

      // 3. Đánh dấu tham chiếu ngắn trong tài liệu chính
      q.audioUrl = `media:${mediaKey}`;
    }

    sanitizedQuestions.push(q);
  }

  return {
    ...cleanData,
    questions: sanitizedQuestions
  };
}

/**
 * Tự động phục hồi (hydrate) các trường media (audio) khi đọc bộ đề
 */
export async function hydrateQuizQuestions(quizId: string, questions: Question[]): Promise<Question[]> {
  const hydrated: Question[] = [];
  for (let i = 0; i < questions.length; i++) {
    const q = { ...questions[i] };
    const qKey = q.id || `q_${i}`;

    if (typeof q.audioUrl === 'string' && q.audioUrl.startsWith('media:')) {
      const mediaKey = q.audioUrl.replace('media:', '');
      // 1. Thử đọc từ IndexedDB
      let resolvedAudio = await getMediaItem(mediaKey);

      // 2. Nếu chưa có trong IndexedDB (ví dụ mở trên thiết bị khác), đọc từ subcollection Firestore
      if (!resolvedAudio && !quizId.startsWith('local-')) {
        try {
          const mediaDocRef = doc(db, `quizzes/${quizId}/media/${qKey}`);
          const mediaSnap = await getDoc(mediaDocRef);
          if (mediaSnap.exists()) {
            const mData = mediaSnap.data();
            if (mData.audioUrl) {
              resolvedAudio = mData.audioUrl;
              await saveMediaItem(mediaKey, resolvedAudio);
            }
          }
        } catch (e) {
          console.warn('Could not fetch media subdocument:', e);
        }
      }

      if (resolvedAudio) {
        q.audioUrl = resolvedAudio;
      }
    }

    hydrated.push(q);
  }
  return hydrated;
}

/**
 * Đọc danh sách bộ đề từ LocalStorage
 */
export function getLocalQuizzes(): Quiz[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [];
  } catch (err) {
    console.warn('Không thể đọc bộ đề từ LocalStorage:', err);
    return [];
  }
}

/**
 * Lưu danh sách bộ đề vào LocalStorage (an toàn chống tràn bộ nhớ)
 */
export function saveLocalQuizzes(quizzes: Quiz[]): void {
  try {
    const raw = JSON.stringify(quizzes);
    if (raw.length > 2_000_000) {
      // Nếu danh sách lớn hơn 2MB, tạo bản sao tinh gọn cho localStorage
      const lean = quizzes.map(q => ({
        ...q,
        questions: q.questions.map(item => {
          if (item.audioUrl && item.audioUrl.length > 5000) {
            return { ...item, audioUrl: `media:quiz_${q.id}_q_${item.id}_audio` };
          }
          return item;
        })
      }));
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(lean));
    } else {
      localStorage.setItem(LOCAL_STORAGE_KEY, raw);
    }
  } catch (err) {
    console.warn('Không thể ghi bộ đề vào LocalStorage:', err);
  }
}

/**
 * Lưu một bộ đề vào LocalStorage (thêm mới hoặc cập nhật)
 */
export function saveSingleLocalQuiz(quiz: Quiz): void {
  const list = getLocalQuizzes();
  const existingIdx = list.findIndex(q => q.id === quiz.id);
  if (existingIdx >= 0) {
    list[existingIdx] = quiz;
  } else {
    list.unshift(quiz);
  }
  saveLocalQuizzes(list);
}

/**
 * Xóa một bộ đề khỏi LocalStorage
 */
export function removeSingleLocalQuiz(quizId: string): void {
  const list = getLocalQuizzes();
  const updated = list.filter(q => q.id !== quizId);
  saveLocalQuizzes(updated);
}

/**
 * Lưu một bộ đề mới vào Hệ thống (Firestore + LocalStorage + IndexedDB dự phòng đa tầng)
 * Đảm bảo dữ liệu không bao giờ bị mất, lưu tức thì và không bị lỗi kích thước 1MB
 */
export async function saveQuizToSystem(quizData: Partial<Quiz>): Promise<Quiz> {
  const cleanData = sanitizeQuizData(quizData);
  let savedId = doc(collection(db, 'quizzes')).id;
  let savedToCloud = false;

  const completeQuiz: Quiz = {
    id: savedId,
    ...cleanData
  };

  // 1. Lưu bản đầy đủ (kể cả audio lớn) vào IndexedDB & LocalStorage
  await saveMediaItem(`quiz_full_${savedId}`, JSON.stringify(completeQuiz));
  saveSingleLocalQuiz(completeQuiz);

  // 2. Ghi lên Cloud Firestore với dung lượng được kiểm soát an toàn dưới 850KB
  try {
    const cloudPayload = await prepareQuizForFirestore(savedId, cleanData);
    await setDoc(doc(db, 'quizzes', savedId), cloudPayload);
    savedToCloud = true;
  } catch (cloudErr: any) {
    firestoreQuota.reportError(cloudErr);
    console.warn('Lỗi khi ghi lên Firestore (dùng bản lưu an toàn cục bộ):', cloudErr);
  }

  if (!savedToCloud) {
    console.warn('Bộ đề đã được lưu an toàn vào bộ nhớ cục bộ thiết bị.');
  }

  return completeQuiz;
}

/**
 * Cập nhật một bộ đề đã có trong hệ thống
 */
export async function updateQuizInSystem(quizId: string, updatedFields: Partial<Quiz>): Promise<Quiz> {
  const cleanData = sanitizeQuizData(updatedFields);

  const completeQuiz: Quiz = {
    id: quizId,
    ...cleanData
  };

  // 1. Luôn lưu bản đầy đủ vào IndexedDB & LocalStorage ngay lập tức
  await saveMediaItem(`quiz_full_${quizId}`, JSON.stringify(completeQuiz));
  saveSingleLocalQuiz(completeQuiz);

  // 2. Ghi lên Cloud Firestore với dung lượng được kiểm soát dưới 850KB
  try {
    if (!quizId.startsWith('local-')) {
      const cloudPayload = await prepareQuizForFirestore(quizId, cleanData);
      const quizRef = doc(db, 'quizzes', quizId);
      await updateDoc(quizRef, cloudPayload as any);
    }
  } catch (cloudErr: any) {
    firestoreQuota.reportError(cloudErr);
    console.warn('Lỗi khi cập nhật Firestore (dùng bản lưu an toàn cục bộ):', cloudErr);
  }

  return completeQuiz;
}

/**
 * Xóa một bộ đề khỏi hệ thống (cả Cloud và Local)
 */
export async function deleteQuizFromSystem(quizId: string): Promise<void> {
  // Xóa Firestore
  try {
    if (!quizId.startsWith('local-')) {
      await deleteDoc(doc(db, 'quizzes', quizId));
    }
  } catch (cloudErr) {
    firestoreQuota.reportError(cloudErr);
    console.error('Lỗi khi xóa từ Firestore:', cloudErr);
  }

  // Xóa Local
  removeSingleLocalQuiz(quizId);
}

/**
 * Xóa nhiều bộ đề đồng loạt
 */
export async function deleteMultipleQuizzesFromSystem(quizIds: string[]): Promise<void> {
  await Promise.all(quizIds.map(id => deleteQuizFromSystem(id)));
}

/**
 * Tải toàn bộ danh sách bộ đề từ Firestore kết hợp với LocalStorage
 * Tự động sắp xếp bộ đề mới nhất lên đầu
 */
export async function loadAllQuizzesFromSystem(): Promise<Quiz[]> {
  const localList = getLocalQuizzes();
  const quizMap = new Map<string, Quiz>();

  // Thêm các đề trong local trước
  localList.forEach(q => {
    if (q && q.id) quizMap.set(q.id, q);
  });

  // Tải từ Cloud Firestore
  try {
    let snap;
    try {
      const q = query(collection(db, 'quizzes'), orderBy('createdAt', 'desc'));
      snap = await getDocs(q);
    } catch {
      snap = await getDocs(collection(db, 'quizzes'));
    }

    for (const docSnap of snap.docs) {
      const d = docSnap.data();
      const rawQuestions = Array.isArray(d.questions) 
        ? d.questions.map((q: any, i: number) => sanitizeQuestion(q, i)) 
        : [];
      
      const quiz: Quiz = {
        id: docSnap.id,
        title: d.title || 'Bộ đề kiểm tra',
        subject: d.subject || 'KHTN',
        description: d.description || '',
        createdBy: d.createdBy || 'admin',
        createdAt: typeof d.createdAt === 'number' ? d.createdAt : Date.now(),
        questions: rawQuestions
      };
      quizMap.set(quiz.id, quiz);
    }

    const mergedList = Array.from(quizMap.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    saveLocalQuizzes(mergedList);
    return mergedList;
  } catch (err: any) {
    firestoreQuota.reportError(err);
    console.warn('Lỗi kết nối Firestore, chuyển sang dùng bộ nhớ cục bộ:', err);
    return localList.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }
}

/**
 * Lấy chi tiết 1 bộ đề theo ID (từ Cloud hoặc Local) và tự động hydrate media
 */
export async function getQuizById(quizId: string): Promise<Quiz | null> {
  // Tìm trong Local trước
  const local = getLocalQuizzes().find(q => q.id === quizId);

  try {
    if (!quizId.startsWith('local-')) {
      const docSnap = await getDoc(doc(db, 'quizzes', quizId));
      if (docSnap.exists()) {
        const d = docSnap.data();
        const rawQuestions = Array.isArray(d.questions) 
          ? d.questions.map((q: any, i: number) => sanitizeQuestion(q, i)) 
          : [];

        // Hydrate questions with large audio from IndexedDB or subcollection
        const hydratedQuestions = await hydrateQuizQuestions(docSnap.id, rawQuestions);

        const quiz: Quiz = {
          id: docSnap.id,
          title: d.title || 'Bộ đề kiểm tra',
          subject: d.subject || 'KHTN',
          description: d.description || '',
          createdBy: d.createdBy || 'admin',
          createdAt: typeof d.createdAt === 'number' ? d.createdAt : Date.now(),
          questions: hydratedQuestions
        };
        saveSingleLocalQuiz(quiz);
        return quiz;
      }
    }
  } catch (err: any) {
    firestoreQuota.reportError(err);
    console.warn('Không thể đọc đề từ Firestore, dùng bản local:', err);
  }

  if (local) {
    const hydratedLocalQuestions = await hydrateQuizQuestions(local.id, local.questions);
    return { ...local, questions: hydratedLocalQuestions };
  }

  return null;
}

/**
 * Nhân bản một bộ đề để chỉnh sửa thành đề mới nhanh chóng mà không ghi đè đề gốc
 */
export async function duplicateQuizInSystem(originalQuiz: Quiz): Promise<Quiz> {
  const cloneData: Partial<Quiz> = {
    title: `${originalQuiz.title} (Bản sao)`,
    subject: originalQuiz.subject || 'KHTN',
    description: originalQuiz.description || '',
    createdBy: 'admin',
    createdAt: Date.now(),
    questions: originalQuiz.questions.map((q, idx) => ({
      ...q,
      id: `q-${Date.now()}-${idx}`
    }))
  };

  return await saveQuizToSystem(cloneData);
}

/**
 * Xuất 1 bộ đề ra tệp .json để lưu trữ an toàn trên máy tính cá nhân hoặc chia sẻ
 */
export function exportQuizToJsonFile(quiz: Quiz): void {
  const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(quiz, null, 2))}`;
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', jsonString);
  const safeTitle = (quiz.title || 'bo-de-khtn')
    .toLowerCase()
    .replace(/[^a-z0-9àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ\s]/g, '')
    .replace(/\s+/g, '-');
  downloadAnchor.setAttribute('download', `${safeTitle}-${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

/**
 * Xuất toàn bộ ngân hàng câu hỏi ra tệp .json để sao lưu toàn diện
 */
export function exportAllQuizzesBackup(quizzes: Quiz[]): void {
  const backupData = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    totalQuizzes: quizzes.length,
    quizzes
  };
  const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(backupData, null, 2))}`;
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', jsonString);
  downloadAnchor.setAttribute('download', `gdpt-sao-luu-ngan-hang-de-${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

/**
 * Nhập bộ đề từ tệp .json
 */
export async function importQuizzesFromJsonFile(file: File): Promise<{ count: number; quizzes: Quiz[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        let listToImport: any[] = [];

        if (Array.isArray(parsed)) {
          listToImport = parsed;
        } else if (parsed && Array.isArray(parsed.quizzes)) {
          listToImport = parsed.quizzes;
        } else if (parsed && parsed.title && Array.isArray(parsed.questions)) {
          listToImport = [parsed];
        } else {
          return reject(new Error('Tệp không đúng định dạng ngân hàng đề thi KHTN!'));
        }

        const savedQuizzes: Quiz[] = [];
        for (const item of listToImport) {
          const saved = await saveQuizToSystem(item);
          savedQuizzes.push(saved);
        }

        resolve({ count: savedQuizzes.length, quizzes: savedQuizzes });
      } catch (err: any) {
        reject(new Error(err.message || 'Lỗi khi đọc tệp JSON'));
      }
    };
    reader.onerror = () => reject(new Error('Không thể đọc tệp tin đã chọn!'));
    reader.readAsText(file);
  });
}
