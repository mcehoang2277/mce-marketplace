import * as SecureStore from 'expo-secure-store';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');

export type Job = {
  id: string;
  title: string;
  description: string;
  category: string;
  startTime: string;
  endTime: string;
  hourlyRate: string | number;
  totalEstimatedVnd: string | number;
  addressText: string;
  lat: number;
  lng: number;
  requiredSkills: string[];
  poster?: { id: string; fullName: string; karmaScore: number };
};

type ApiResponse<T> = { success: boolean } & T;

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error('Chưa cấu hình EXPO_PUBLIC_API_URL cho ứng dụng MCE.');
  }

  const token = await SecureStore.getItemAsync('mce_access_token');
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers
    }
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.message || payload?.message || `API error (${response.status})`);
  }
  return payload as T;
}

export const api = {
  async login(phone: string, password: string) {
    const result = await request<ApiResponse<{ token: string; user: unknown }>>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ phone, password })
    });
    await SecureStore.setItemAsync('mce_access_token', result.token);
    return result.user;
  },

  async register(input: { phone: string; password: string; fullName: string; role: 'WORKER' | 'POSTER' | 'BOTH' }) {
    const result = await request<ApiResponse<{ token: string; user: unknown }>>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(input)
    });
    await SecureStore.setItemAsync('mce_access_token', result.token);
    return result.user;
  },

  async logout() {
    await SecureStore.deleteItemAsync('mce_access_token');
  },

  listJobs() {
    return request<ApiResponse<{ jobs: Job[] }>>('/jobs');
  },

  createJob(input: {
    title: string;
    description: string;
    category: string;
    startTime: string;
    endTime: string;
    hourlyRate: number;
    lat: number;
    lng: number;
    addressText: string;
    requiredSkills?: string[];
  }) {
    return request<ApiResponse<{ job: Job }>>('/jobs', {
      method: 'POST',
      body: JSON.stringify(input)
    });
  },

  applyToJob(jobId: string) {
    return request<ApiResponse<{ application: { id: string; status: string } }>>(`/jobs/${encodeURIComponent(jobId)}/applications`, {
      method: 'POST',
      body: JSON.stringify({})
    });
  }
};
