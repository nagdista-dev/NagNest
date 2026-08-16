import type { AppData } from '../types'

const API_BASE = import.meta.env.VITE_API_BASE ?? ''
const TOKEN_KEY = 'nagnest:auth-token:v1'

export interface AuthUser {
  id: string
  name: string
  email: string
}

export interface AuthResponse {
  token: string
  user: AuthUser
  data?: AppData
}

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setStoredToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const headers = new Headers(options.headers)
  headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new ApiError(body?.error ?? 'Request failed', res.status)
  }
  return body as T
}

export function signup(input: {
  name: string
  email: string
  password: string
}): Promise<AuthResponse> {
  return request<AuthResponse>('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function login(input: {
  email: string
  password: string
}): Promise<AuthResponse> {
  return request<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function getMe(token: string): Promise<{ user: AuthUser; data: AppData }> {
  return request('/api/auth/me', {}, token)
}

export function getAccountData(token: string): Promise<{ data: AppData }> {
  return request('/api/data', {}, token)
}

export function saveAccountData(token: string, data: AppData): Promise<{ data: AppData }> {
  return request(
    '/api/data',
    {
      method: 'PUT',
      body: JSON.stringify({ data }),
    },
    token,
  )
}
