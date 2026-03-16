export interface ApiResponse<T = null> {
  success: boolean;
  code: number;
  message: string;
  timestamp: number;
  data: T | null;
}
