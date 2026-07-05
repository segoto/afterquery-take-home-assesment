// The minimal user shape returned to clients
export interface AuthUser {
  id: string;
  email: string;
}

// Shape of the JWT payload (what is signed into the token)
export interface JwtPayload {
  sub: string; // user id
  email: string;
  exp?: number;
  iat?: number;
}

// Standard success/error API response shapes
export interface ApiSuccessResponse<T> {
  data: T;
}

export interface ApiErrorResponse {
  error: string;
}

// Auth-specific response types
export type SignupResponse = AuthUser;
export type LoginResponse = AuthUser;
export type MeResponse = AuthUser;

export interface LogoutResponse {
  success: true;
}

export interface ForgotPasswordResponse {
  token: string | null;
}

export interface ResetPasswordResponse {
  success: true;
}

// Interview-room types

export type Seniority = 'JUNIOR' | 'MID' | 'SENIOR';
export type QuestionType = 'TECHNICAL' | 'BEHAVIORAL' | 'SITUATIONAL';

export interface Job {
  id: string;
  slug: string;
  title: string;
  description: string;
  questionPack: unknown | null;
  seniority: Seniority;
}

export type SessionStatus = 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED';

export type Speaker = 'AI' | 'USER';

export interface TranscriptTurn {
  id: string;
  speaker: Speaker;
  content: string;
  createdAt: string | Date;
}

export interface SessionListItem {
  id: string;
  status: SessionStatus;
  startedAt: string; // ISO 8601
  endedAt: string | null; // ISO 8601
  job: {
    id: string;
    title: string;
  };
  turnCount: number;
  evaluationScore: number | null;
}

export interface PatchSessionResponse {
  id: string;
  status: 'ABANDONED';
}

export type InterviewPhase =
  | 'session_creating'
  | 'session_error'
  | 'awaiting_recording'
  | 'recording'
  | 'processing'
  | 'api_error'
  | 'complete';

export interface InterviewRoomState {
  phase: InterviewPhase;
  sessionId: string | null;
  currentQuestion: string;
  turns: TranscriptTurn[];
  turnNumber: number;
  errorMessage: string | null;
  interimTranscript: string;
  retryCount: number;
}

export type InterviewRoomAction =
  | { type: 'SESSION_CREATED'; sessionId: string }
  | { type: 'SESSION_ERROR'; message: string }
  | { type: 'RECORDING_STARTED' }
  | { type: 'INTERIM_TRANSCRIPT'; text: string }
  | { type: 'FINAL_TRANSCRIPT'; transcript: string; currentQuestion: string }
  | { type: 'TURN_SAVED'; nextQuestion: string; isComplete: boolean }
  | { type: 'API_ERROR'; message: string }
  | { type: 'RETRY_SESSION' }
  | { type: 'RETRY_TURN' };

export interface PostSessionResponse {
  id: string;
}

export interface PostInterviewResponse {
  nextQuestion: string;
  isComplete: boolean;
}
