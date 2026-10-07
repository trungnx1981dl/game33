export type User = {
  uid: string;
  email: string;
  role: 'admin' | 'user';
  name?: string;
};

export type QuestionType = 'MC' | 'TF' | 'SA' | 'ESSAY';

export type Question = {
  id: string;
  type: QuestionType;
  content: string; // supports KaTeX
  options?: string[]; // for MC and TF (TF has 4 options)
  answer: string;
  timeLimit: number;
  explanation?: string;
  audioUrl?: string; // Optional audio URL for this question
};

export type Quiz = {
  id: string;
  title: string;
  subject?: string;
  description?: string;
  createdBy: string;
  createdAt: number;
  questions: Question[];
};

export type SessionStatus = 'WAITING' | 'ACTIVE' | 'FINISHED' | 'ROUND2' | 'CLOSED';

export type GameMode = 'TEACHER_CONTROL' | 'EXAM_AUTO';

export type StationTheme = {
  id: number;
  name: string;
  tag: string;
  icon: string;
  colorName: string;
  primaryColor: string;
  secondaryColor: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
};

export type SessionAnnouncement = {
  message: string;
  type?: 'info' | 'star' | 'steal' | 'defense' | 'warning';
  timestamp: number;
};

export type StudentRosterItem = {
  id?: string;
  studentCode: string;
  name: string;
  className: string;
  notes?: string;
};

export type Round2Member = {
  id: string;
  studentCode?: string;
  name: string;
  className?: string;
  exp: number;
  score: number;
  rank: number;
};

export type Round2Group = {
  id: string;
  name: string; // 'Team Bye Bye Nhựa' | 'Trạm Zero-Waste' | 'Team Góc Xanh' | 'Team Tái Sinh'
  icon: string;
  themeColor: string;
  accentBg: string;
  borderColor: string;
  textColor: string;
  slogan: string;
  members: Round2Member[];
};

export type Round2Product = {
  title: string;
  driveUrl?: string; // Legacy
  imageUrl?: string; // Base64 or direct image URL
  audioUrl?: string; // Base64 or direct audio URL
  mediaType?: 'image' | 'audio';
  fileName?: string;
  fileSize?: number;
  description?: string;
  submittedAt?: number;
  submittedBy?: string;
};

export type Round2Submission = {
  teamId: string;
  teamName: string;
  title: string;
  description?: string;
  imageUrl?: string;
  audioUrl?: string;
  fileUrl?: string;
  mediaType?: 'image' | 'audio';
  product1?: Round2Product; // Sản phẩm 1
  product2?: Round2Product; // Sản phẩm 2
  products?: Round2Product[]; // Danh sách tối đa 2 sản phẩm
  submittedBy?: string;
  submittedAt: number;
};

export type Round2JudgeScores = Record<string, number>; // { GK01: 95, GK02: 88, ... }
export type Round2SubmissionsMap = Record<string, Round2Submission>; // teamId -> Round2Submission
export type Round2ScoresMap = Record<string, Round2JudgeScores>; // teamId -> { [judgeId]: score }

export type JudgeSlot = {
  judgeId: string;
  name?: string;
  deviceId: string;
  claimedAt: number;
  lastActiveAt?: number;
};
export type JudgeSlotsMap = Record<string, JudgeSlot>;

export type SeatingAssignment = {
  seatIndex: number; // 0 to 29 (Vị trí 1 đến 30)
  row: number; // 1 to 6 (Hàng/Bàn 1 đến 6)
  col: number; // 1 to 5 (Dãy 1 đến 5)
  seatLabel: string; // e.g. "Dãy 1 - Ghế 1" hoặc "D1-G1"
  student?: StudentRosterItem | null;
  conflictWithNeighbor?: boolean;
};

export type SeatingPlan = {
  id?: string;
  sessionId?: string;
  createdAt: number;
  updatedAt?: number;
  totalSeats: number; // 30
  rows: number; // 6
  cols: number; // 5 (5 dãy, mỗi dãy 6 HS)
  seats: SeatingAssignment[];
};

export type GameSession = {
  id: string;
  pin?: string;
  quizId: string;
  hostId: string;
  status: SessionStatus;
  gameMode?: GameMode; // 'TEACHER_CONTROL' | 'EXAM_AUTO'
  currentQuestionIndex: number;
  questionStartTime?: number;
  createdAt: number;
  questions?: Question[];
  autoTransitionSeconds?: number;
  isAutoShowingAnswer?: boolean;
  showAnswer?: boolean;
  showExplanation?: boolean;
  isQuestionOpen?: boolean; // GV controls opening question for all devices
  announcement?: SessionAnnouncement | null;
  round2Groups?: Round2Group[];
  currentRound?: number;
  round2Submissions?: Round2SubmissionsMap;
  round2Scores?: Round2ScoresMap;
  lastRound2Update?: number;
  roster?: StudentRosterItem[];
  judgeSlots?: JudgeSlotsMap;
  seatingPlan?: SeatingPlan | null;
  isClosed?: boolean;
  hostLeft?: boolean;
  endedAt?: number;
};

export type Player = {
  id: string;
  sessionId: string;
  name: string;
  studentCode?: string;
  className?: string;
  score: number;
  answers: Record<string, any>; // questionId -> answer
  correctCount?: number;
  totalTimeSpent?: number; // total time in seconds
  lastAnswerTime?: number;
  exp?: number;
  level?: number;
  streak?: number;
  activePowerUp?: 'DOUBLE_POINTS' | 'FREEZE_OPTION' | 'SHIELD' | null;
  usedPowerUps?: string[];
  hiddenOptionIndex?: number; // option eliminated by power-up
  tabViolations?: number;
  isDisqualified?: boolean;
  disqualifiedReason?: string;
  // Special power-up tracking (Single-use per match)
  usedStarOfHope?: boolean;
  usedSteal?: boolean;
  usedDefense?: boolean;
  usedWagerExp?: boolean;
  currentRoundStarOfHope?: boolean;
  currentRoundStealTargetId?: string;
  currentRoundStealTargetName?: string;
  currentRoundDefense?: boolean;
  currentRoundWagerExp?: number;
};

export type PracticeResult = {
  id: string;
  quizId: string;
  playerName: string;
  playerClass: string;
  score: number;
  timeSpent: number;
  createdAt: number;
  practiceMode?: 'PRACTICE' | 'EXAM';
  tabViolations?: number;
  isDisqualified?: boolean;
};
