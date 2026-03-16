export interface ApiSuccess<T = unknown> {
  success: true;
  code: number;
  message: string;
  data: T | null;
  timestamp: number;
}

export interface ApiError {
  success: false;
  code: number;
  message: string;
  error_code: string | null;
  details: string | null;
  timestamp: number;
}

export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiError;
