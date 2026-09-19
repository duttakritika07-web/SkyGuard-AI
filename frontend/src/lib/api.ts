export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000';

export interface HealthResponse {
  status: string;
  project: string;
  model_ready: boolean;
  database: string;
}

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(
      `SkyGuard API request failed (${response.status})`
    );
  }

  return response.json() as Promise<T>;
}

export const skyguardApi = {
  health: () => request<HealthResponse>('/health'),
};