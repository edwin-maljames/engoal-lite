const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

type TokenStore = {
  accessToken: string | null;
  setAccessToken: (token: string | null) => void;
  refreshToken: () => Promise<string>;
  onAuthFailure: () => void;
};

let tokenStore: TokenStore | null = null;

export function initializeApiClient(store: TokenStore): void {
  tokenStore = store;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${path}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (tokenStore?.accessToken) {
    headers["Authorization"] = `Bearer ${tokenStore.accessToken}`;
  }

  let response = await fetch(url, { ...options, headers });

  // Attempt token refresh on 401
  if (response.status === 401 && tokenStore) {
    try {
      const newToken = await tokenStore.refreshToken();
      tokenStore.setAccessToken(newToken);
      headers["Authorization"] = `Bearer ${newToken}`;
      response = await fetch(url, { ...options, headers });
    } catch {
      tokenStore.onAuthFailure();
      throw new AuthError("Session expired. Please log in again.");
    }
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({})) as {
      detail?: { code?: string; message?: string };
    };
    const message =
      errorBody.detail?.message || `Request failed with status ${response.status}`;
    const code = errorBody.detail?.code;
    throw new ApiError(response.status, message, code);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const apiClient = {
  get: <T>(path: string, params?: Record<string, string | undefined>): Promise<T> => {
    const filteredParams = params
      ? Object.fromEntries(
          Object.entries(params).filter(([, v]) => v !== undefined),
        )
      : undefined;
    const queryString =
      filteredParams && Object.keys(filteredParams).length > 0
        ? `?${new URLSearchParams(filteredParams as Record<string, string>).toString()}`
        : "";
    return request<T>(`${path}${queryString}`);
  },
  post: <T>(path: string, data?: unknown): Promise<T> =>
    request<T>(path, { method: "POST", body: JSON.stringify(data) }),
  put: <T>(path: string, data?: unknown): Promise<T> =>
    request<T>(path, { method: "PUT", body: JSON.stringify(data) }),
  patch: <T>(path: string, data?: unknown): Promise<T> =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(data) }),
  delete: <T = void>(path: string): Promise<T> =>
    request<T>(path, { method: "DELETE" }),
};
