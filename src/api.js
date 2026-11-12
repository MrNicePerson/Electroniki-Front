
/**
 * Frontend API client for ElectroHub SaaS.
 * Uses HTTP-only session cookies and in-memory auth header fallback.
 * Never stores secrets or passwords in localStorage.
 */

let inMemoryToken = null;

// API base URL from Vite environment variables.
// Production: https://electoniki-b.onrender.com/api
// Development fallback: /api
const API_BASE_URL = (
  import.meta.env.VITE_API_URL || '/api'
).replace(/\/+$/, '');

export function setSessionToken(token) {
  inMemoryToken = token || null;
}

export async function apiRequest(
  path,
  { method = 'GET', body, signal } = {}
) {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (inMemoryToken) {
    headers.Authorization = `Bearer ${inMemoryToken}`;
  }

  // Normalize the API path to avoid missing or duplicate slashes.
  const normalizedPath = path.startsWith('/')
    ? path
    : `/${path}`;

  const requestUrl = `${API_BASE_URL}${normalizedPath}`;

  const res = await fetch(requestUrl, {
    method,
    headers,
    credentials: 'include',
    signal,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let data = null;

  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const err = new Error(
      data?.error || `Request failed (${res.status})`
    );

    err.status = res.status;
    err.data = data;

    throw err;
  }

  return data;
}

export const money = (v) =>
  'Rs. ' + Math.round(Number(v) || 0).toLocaleString('en-PK');

export const num = (v) => Math.max(0, Number(v) || 0);