export interface ApiError {
  detail: {
    code: string;
    message: string;
    field?: string | null;
    errors?: Array<{ field: string; message: string; type: string }>;
  };
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  created_at: string;
}
