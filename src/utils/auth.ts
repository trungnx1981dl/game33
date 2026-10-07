export const DEFAULT_TEACHER_CODE = 'gv123';
export const DEFAULT_ADMIN_CODE = 'admin123';

export function getStoredTeacherCode(): string {
  return localStorage.getItem('khtn_teacher_passcode') || DEFAULT_TEACHER_CODE;
}

export function saveTeacherCode(newCode: string): void {
  localStorage.setItem('khtn_teacher_passcode', newCode.trim());
}

export function getStoredAdminCode(): string {
  return localStorage.getItem('khtn_admin_passcode') || DEFAULT_ADMIN_CODE;
}

export function verifyTeacherPassword(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) return false;

  const currentTeacherCode = getStoredTeacherCode();
  const currentAdminCode = getStoredAdminCode();

  // Match teacher passcode
  if (trimmed === currentTeacherCode) return true;
  // Match admin passcode (Admin has master privilege)
  if (trimmed === currentAdminCode) return true;

  // Fallback defaults for seamless convenience
  if (trimmed.toLowerCase() === 'gv123' || trimmed.toLowerCase() === 'giaovien' || trimmed === '123456' || trimmed.toLowerCase() === 'admin123') {
    return true;
  }

  return false;
}

export function isTeacherAuthenticated(): boolean {
  return sessionStorage.getItem('khtn_teacher_session_auth') === 'true';
}

export function setTeacherAuthenticated(auth: boolean): void {
  if (auth) {
    sessionStorage.setItem('khtn_teacher_session_auth', 'true');
  } else {
    sessionStorage.removeItem('khtn_teacher_session_auth');
  }
}

export function verifyAdminPassword(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) return false;

  const currentAdminCode = getStoredAdminCode();
  return (
    trimmed === currentAdminCode ||
    (currentAdminCode === DEFAULT_ADMIN_CODE && (trimmed.toLowerCase() === 'admin' || trimmed === DEFAULT_ADMIN_CODE))
  );
}

export function isAdminAuthenticated(): boolean {
  return sessionStorage.getItem('khtn_admin_session_auth') === 'true';
}

export function setAdminAuthenticated(auth: boolean): void {
  if (auth) {
    sessionStorage.setItem('khtn_admin_session_auth', 'true');
  } else {
    sessionStorage.removeItem('khtn_admin_session_auth');
  }
}
