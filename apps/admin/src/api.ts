const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:4000';

let token: string | null = localStorage.getItem('sl_admin_token');

export function setToken(next: string | null) {
  token = next;
  if (next) localStorage.setItem('sl_admin_token', next);
  else localStorage.removeItem('sl_admin_token');
}

export function getToken() {
  return token;
}

export class ApiError extends Error {
  status: number;
  body: any;
  constructor(status: number, body: any) {
    super(typeof body?.error === 'string' ? body.error : 'Request failed');
    this.status = status;
    this.body = body;
  }
}

async function request(path: string, options: RequestInit = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(options.headers as any) };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await res.json() : null;

  if (!res.ok) throw new ApiError(res.status, body);
  return body;
}

export const api = {
  get: (path: string) => request(path),
  post: (path: string, data?: unknown) => request(path, { method: 'POST', body: data ? JSON.stringify(data) : undefined })
};

export function friendlyError(err: unknown): string {
  if (err instanceof ApiError) {
    if (typeof err.body?.error === 'string') return err.body.error;
    return `Something went wrong (${err.status})`;
  }
  return 'Something went wrong. Please try again.';
}
