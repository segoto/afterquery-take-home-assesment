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
