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

  async hasSession() {
    return Boolean(await SecureStore.getItemAsync('mce_access_token'));
  },

  me() {
    return request<ApiResponse<{ user: { id: string; name: string; phone: string; role: string; karmaScore: number; isKycVerified: boolean; isPhoneVerified: boolean; skills: string[]; avatarUrl: string | null; walletBalanceVnd: number } }>>('/auth/me');
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


  async updateProfile(input: { fullName?: string; skills?: string[]; desiredMinRate?: number | null; avatarUrl?: string | null }) {
    return request<ApiResponse<{ user: unknown }>>('/auth/me', {
      method: 'PATCH',
      body: JSON.stringify(input)
    });
  },

  createVietQrPayment(jobId: string) {
    return request<ApiResponse<{ payment: {
      paymentId: string; referenceCode: string; amountVnd: number; transferContent: string;
      qrImageUrl: string; bankCode: string; accountNumber: string; accountName: string; status: string;
    }; notice: string }>>('/vietqr', {
      method: 'POST',
      body: JSON.stringify({ jobId })
    });
  },

  paymentStatus(paymentId: string) {
    return request<ApiResponse<{ payment: { id: string; jobId: string | null; referenceCode: string; amount: number; status: string; paidAt: string | null } }>>(
      `/vietqr/${encodeURIComponent(paymentId)}`
    );
  },

  wallet() {
    return request<ApiResponse<{ wallet: {
      availableBalanceVnd: number; lockedBalanceVnd: number; totalDepositedVnd: number;
      totalWithdrawnVnd: number; updatedAt: string | null;
    } }>>('/wallet');
  },

  walletTransactions() {
    return request<ApiResponse<{ transactions: Array<{
      id: string; type: string; amountVnd: number; balanceBeforeVnd: number;
      balanceAfterVnd: number; referenceId: string | null; description: string; createdAt: string;
    }> }>>('/wallet/transactions');
  },

  myActiveJobs() {
    return request<ApiResponse<{ jobs: Array<Job & {
      status: string; workerId: string | null; posterId: string;
      checkEvents: Array<{ eventType: 'CHECK_IN' | 'CHECK_OUT'; recordedAt: string }>;
    }> }>>('/jobs/mine/active');
  },

  checkIn(jobId: string, location: { lat: number; lng: number; accuracyMeters: number }) {
    return request<ApiResponse<{ jobStatus: string }>>(`/jobs/${encodeURIComponent(jobId)}/check-in`, {
      method: 'POST',
      body: JSON.stringify(location)
    });
  },

  checkOut(jobId: string, location: { lat: number; lng: number; accuracyMeters: number }) {
    return request<ApiResponse<{ jobStatus: string }>>(`/jobs/${encodeURIComponent(jobId)}/check-out`, {
      method: 'POST',
      body: JSON.stringify(location)
    });
  },

  approveCompletion(jobId: string) {
    return request<ApiResponse<{ result: { status: string; netWorkerPayout: number } }>>(
      `/jobs/${encodeURIComponent(jobId)}/approve-completion`,
      { method: 'POST', body: JSON.stringify({}) }
    );
  },

  submitReview(jobId: string, rating: number, comment?: string) {
    return request<ApiResponse<{ review: unknown }>>(`/jobs/${encodeURIComponent(jobId)}/reviews`, {
      method: 'POST',
      body: JSON.stringify({ rating, comment })
    });
  },

  applyToJob(jobId: string) {
    return request<ApiResponse<{ application: { id: string; status: string } }>>(`/jobs/${encodeURIComponent(jobId)}/applications`, {
      method: 'POST',
      body: JSON.stringify({})
    });
  }
};
