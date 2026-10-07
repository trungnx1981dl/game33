import { Quiz } from '../types';
import { getAccessToken, googleSignIn } from '../lib/firebase';

const APP_ROOT_FOLDER_NAME = 'KHTN - Đấu trường Tri thức';
const QUIZZES_FOLDER_NAME = 'KHTN - Ngân hàng Bộ Đề Thi';
const SUBMISSIONS_FOLDER_NAME = 'KHTN - Sản phẩm Dự thi Vòng 2';

/**
 * Ensures an active Google access token is available.
 * If not yet cached, attempts to trigger client-side Google sign-in.
 */
export async function ensureDriveAccessToken(): Promise<string> {
  let token = await getAccessToken();
  if (!token) {
    const signInResult = await googleSignIn();
    if (!signInResult || !signInResult.accessToken) {
      throw new Error('Chưa thể kết nối tài khoản Google. Vui lòng cho phép quyền truy cập Google Drive!');
    }
    token = signInResult.accessToken;
  }
  return token;
}

/**
 * Finds or creates a specific folder on Google Drive
 */
export async function getOrCreateDriveFolder(
  folderName: string,
  accessToken: string,
  parentFolderId?: string
): Promise<string> {
  try {
    let query = `name = '${folderName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    if (parentFolderId) {
      query += ` and '${parentFolderId}' in parents`;
    }

    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`;
    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (searchRes.ok) {
      const data = await searchRes.json();
      if (data.files && data.files.length > 0) {
        return data.files[0].id;
      }
    }

    // Folder doesn't exist, create it
    const createBody: Record<string, any> = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder'
    };
    if (parentFolderId) {
      createBody.parents = [parentFolderId];
    }

    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(createBody)
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      throw new Error(`Không thể tạo thư mục '${folderName}': ${errText}`);
    }

    const createdData = await createRes.json();
    return createdData.id;
  } catch (err: any) {
    console.error('getOrCreateDriveFolder error:', err);
    throw err;
  }
}

/**
 * Uploads a text or binary file to Google Drive using multipart upload
 */
export async function uploadFileToDrive(options: {
  name: string;
  mimeType: string;
  content: Blob | string;
  parentFolderId?: string;
  accessToken: string;
  description?: string;
  makePublicReadable?: boolean;
}): Promise<{ fileId: string; name: string; webViewLink?: string; webContentLink?: string }> {
  const { name, mimeType, content, parentFolderId, accessToken, description, makePublicReadable } = options;

  const metadata: Record<string, any> = {
    name,
    mimeType,
    description: description || 'Được tạo bởi ứng dụng KHTN Đấu trường Tri thức'
  };
  if (parentFolderId) {
    metadata.parents = [parentFolderId];
  }

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  let bodyBlob: Blob;
  const metadataBlob = new Blob(
    [`Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}`],
    { type: 'application/json' }
  );

  let mediaBlob: Blob;
  if (typeof content === 'string') {
    mediaBlob = new Blob([content], { type: mimeType });
  } else {
    mediaBlob = content;
  }

  bodyBlob = new Blob([
    delimiter,
    metadataBlob,
    delimiter,
    `Content-Type: ${mimeType}\r\n\r\n`,
    mediaBlob,
    closeDelimiter
  ]);

  const uploadRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink,thumbnailLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body: bodyBlob
    }
  );

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`Tải tệp lên Google Drive thất bại (${uploadRes.status}): ${errText}`);
  }

  const fileData = await uploadRes.json();

  // If requested, set reader permissions so link works for all viewers
  if (makePublicReadable && fileData.id) {
    try {
      await fetch(`https://www.googleapis.com/drive/v3/files/${fileData.id}/permissions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          role: 'reader',
          type: 'anyone'
        })
      });
    } catch (permErr) {
      console.warn('Set public permission warning:', permErr);
    }
  }

  return {
    fileId: fileData.id,
    name: fileData.name,
    webViewLink: fileData.webViewLink,
    webContentLink: fileData.webContentLink
  };
}

/**
 * Saves a single quiz to Google Drive in the QUIZZES folder
 */
export async function saveQuizToGoogleDrive(
  quiz: Quiz,
  accessToken: string
): Promise<{ fileId: string; name: string; webViewLink?: string }> {
  // 1. Get or create root folder & quizzes folder
  const rootId = await getOrCreateDriveFolder(APP_ROOT_FOLDER_NAME, accessToken);
  const quizFolderId = await getOrCreateDriveFolder(QUIZZES_FOLDER_NAME, accessToken, rootId);

  // 2. Prepare JSON content
  const cleanTitle = (quiz.title || 'Bo_De_Thi').replace(/[\\/:*?"<>|]/g, '_');
  const fileName = `DeThi_${cleanTitle}_${Date.now()}.json`;
  const jsonContent = JSON.stringify(quiz, null, 2);

  // 3. Upload file
  const result = await uploadFileToDrive({
    name: fileName,
    mimeType: 'application/json',
    content: jsonContent,
    parentFolderId: quizFolderId,
    accessToken,
    description: `Bộ đề "${quiz.title}" (${quiz.questions?.length || 0} câu) lưu từ KHTN Đấu trường`,
    makePublicReadable: true
  });

  return result;
}

/**
 * Lists all quiz backup files stored in Google Drive
 */
export async function listQuizzesFromGoogleDrive(
  accessToken: string
): Promise<Array<{ id: string; name: string; modifiedTime: string; size?: string; webViewLink?: string }>> {
  try {
    const rootId = await getOrCreateDriveFolder(APP_ROOT_FOLDER_NAME, accessToken);
    const quizFolderId = await getOrCreateDriveFolder(QUIZZES_FOLDER_NAME, accessToken, rootId);

    const query = `'${quizFolderId}' in parents and mimeType = 'application/json' and trashed = false`;
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&orderBy=modifiedTime desc&fields=files(id,name,modifiedTime,size,webViewLink)`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Không thể lấy danh sách đề thi: ${err}`);
    }

    const data = await res.json();
    return data.files || [];
  } catch (err: any) {
    console.error('listQuizzesFromGoogleDrive error:', err);
    throw err;
  }
}

/**
 * Downloads and parses a Quiz JSON file from Google Drive
 */
export async function downloadQuizFromGoogleDrive(
  fileId: string,
  accessToken: string
): Promise<Quiz> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!res.ok) {
    throw new Error(`Không thể tải tệp từ Google Drive (Mã lỗi ${res.status})`);
  }

  const json = await res.json();
  if (!json || !Array.isArray(json.questions)) {
    throw new Error('Tệp không đúng định dạng bộ đề thi KHTN');
  }

  return json as Quiz;
}

/**
 * Saves all products of Round 2 into a dedicated Google Drive folder
 */
export async function saveSubmissionsBackupToGoogleDrive(
  sessionId: string,
  submissions: Record<string, any>,
  accessToken: string
): Promise<{ folderId: string; uploadedCount: number; webViewLink?: string }> {
  const rootId = await getOrCreateDriveFolder(APP_ROOT_FOLDER_NAME, accessToken);
  const submissionsRootId = await getOrCreateDriveFolder(SUBMISSIONS_FOLDER_NAME, accessToken, rootId);
  const sessionFolderId = await getOrCreateDriveFolder(`Phien_Thi_${sessionId}`, accessToken, submissionsRootId);

  let uploadedCount = 0;

  // 1. Upload summary JSON file
  const summaryJson = JSON.stringify(submissions, null, 2);
  await uploadFileToDrive({
    name: `TongHop_BaiNop_${sessionId}.json`,
    mimeType: 'application/json',
    content: summaryJson,
    parentFolderId: sessionFolderId,
    accessToken,
    makePublicReadable: true
  });
  uploadedCount++;

  // 2. Upload individual media images if available in submissions
  const teamIds = Object.keys(submissions);
  for (const teamId of teamIds) {
    const sub = submissions[teamId];
    if (!sub) continue;

    const teamFolderId = await getOrCreateDriveFolder(`Nhom_${teamId}`, accessToken, sessionFolderId);

    // If sub has products array or product1/product2 with base64 data
    const prods = sub.products || [sub.product1, sub.product2].filter(Boolean);
    for (let i = 0; i < prods.length; i++) {
      const p = prods[i];
      if (!p) continue;

      const mediaUrl = p.imageUrl || p.audioUrl || sub.imageUrl || sub.audioUrl;
      if (mediaUrl && mediaUrl.startsWith('data:')) {
        const matches = mediaUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
          const mime = matches[1];
          const rawBase64 = matches[2];
          const byteChars = atob(rawBase64);
          const byteNumbers = new Array(byteChars.length);
          for (let b = 0; b < byteChars.length; b++) {
            byteNumbers[b] = byteChars.charCodeAt(b);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: mime });

          const ext = mime.includes('png') ? 'png' : mime.includes('audio') ? 'mp3' : 'jpg';
          const fileName = `SP_${i + 1}_${(p.title || 'SanPham').replace(/[\\/:*?"<>|]/g, '_')}.${ext}`;

          await uploadFileToDrive({
            name: fileName,
            mimeType: mime,
            content: blob,
            parentFolderId: teamFolderId,
            accessToken,
            description: p.description || '',
            makePublicReadable: true
          });
          uploadedCount++;
        }
      }
    }
  }

  // Get link to the session folder
  const folderInfoRes = await fetch(`https://www.googleapis.com/drive/v3/files/${sessionFolderId}?fields=webViewLink`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const folderInfo = folderInfoRes.ok ? await folderInfoRes.json() : {};

  return {
    folderId: sessionFolderId,
    uploadedCount,
    webViewLink: folderInfo.webViewLink
  };
}

/**
 * Client-Side Smart Image Compressor
 * Resizes and compresses image data using HTML5 Canvas to 1280px HD
 * Reduces 5MB-10MB camera shots to ~150-300KB for lightning-fast loading across all devices
 */
export async function compressImageToOptimizedBase64(
  fileOrBase64: File | string,
  maxDimension = 1280,
  quality = 0.82
): Promise<{ base64: string; sizeInBytes: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return reject(new Error('Canvas 2D context not available'));
      }

      // Smooth scaling
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      const compressed = canvas.toDataURL('image/jpeg', quality);
      const approxSize = Math.round((compressed.length * 3) / 4);

      resolve({
        base64: compressed,
        sizeInBytes: approxSize,
        width,
        height
      });
    };

    img.onerror = () => {
      reject(new Error('Không thể tải dữ liệu ảnh để nén'));
    };

    if (typeof fileOrBase64 === 'string') {
      img.src = fileOrBase64;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(fileOrBase64);
    }
  });
}
