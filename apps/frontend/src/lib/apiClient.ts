/**
 * API Client for Express Backend
 *
 * This client handles all HTTP requests to the Express backend.
 * It includes authentication token handling via Supabase.
 */

import { supabase } from '@/lib/supabaseClient';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

interface ApiError {
  message: string;
  status: number;
  details?: unknown;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

/**
 * Get auth token from Supabase session
 */
async function getAuthToken(): Promise<string | null> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
    return data.session?.access_token ?? null;
  } catch (err) {
    console.error('Unexpected error getting auth token:', err);
    return null;
  }
}

/**
 * Build headers for API requests
 */
async function buildHeaders(includeAuth = true): Promise<HeadersInit> {
  const headers: HeadersInit = {};

  if (includeAuth) {
    const token = await getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  return headers;
}

/** Default request timeout: 30 seconds */
const DEFAULT_TIMEOUT = 30_000;

/** Extra options beyond standard RequestInit */
interface ApiFetchOptions extends RequestInit {
  /** Request timeout in milliseconds. Defaults to 30 000ms. */
  timeout?: number;
}

/**
 * Generic fetch wrapper with error handling and timeout support
 */
async function apiFetch<T>(
  endpoint: string,
  options: ApiFetchOptions = {}
): Promise<ApiResponse<T>> {
  const { timeout = DEFAULT_TIMEOUT, ...fetchOptions } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const url = `${API_URL}${endpoint}`;
    const headers = await buildHeaders();

    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
      headers: {
        ...headers,
        ...fetchOptions.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      // Handle 401 Unauthorized - token might be expired
      if (response.status === 401) {
        // Try to refresh the session
        const { error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
          console.error('Session refresh failed:', refreshError);
        }
      }

      return {
        success: false,
        error: {
          message: data.message || 'An error occurred',
          status: response.status,
          details: data,
        },
      };
    }

    return {
      success: true,
      data,
    };
  } catch (error) {
    // Provide a clear message for timeout vs generic network errors
    if (error instanceof DOMException && error.name === 'AbortError') {
      return {
        success: false,
        error: {
          message: 'Request timed out. The server is still processing — please check back shortly.',
          status: 0,
          details: error,
        },
      };
    }

    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Network error occurred',
        status: 0,
        details: error,
      },
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * POST request with JSON body
 */
export async function post<T>(
  endpoint: string,
  body: unknown,
  options?: { timeout?: number }
): Promise<ApiResponse<T>> {
  return apiFetch<T>(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    ...options,
  });
}

/**
 * POST request with FormData (for file uploads)
 */
export async function postFormData<T>(
  endpoint: string,
  formData: FormData
): Promise<ApiResponse<T>> {
  return apiFetch<T>(endpoint, {
    method: 'POST',
    // Don't set Content-Type - browser will set it with boundary
    body: formData,
  });
}

/**
 * GET request
 */
export async function get<T>(endpoint: string): Promise<ApiResponse<T>> {
  return apiFetch<T>(endpoint, {
    method: 'GET',
  });
}

/**
 * PUT request with JSON body
 */
export async function put<T>(endpoint: string, body: unknown): Promise<ApiResponse<T>> {
  return apiFetch<T>(endpoint, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

/**
 * DELETE request
 */
export async function del<T>(endpoint: string): Promise<ApiResponse<T>> {
  return apiFetch<T>(endpoint, {
    method: 'DELETE',
  });
}

/**
 * PATCH request with JSON body
 */
export async function patch<T>(endpoint: string, body: unknown): Promise<ApiResponse<T>> {
  return apiFetch<T>(endpoint, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

/**
 * Parsed Server-Sent Event.
 */
export interface SseEvent<T = unknown> {
  event: string;
  data: T;
}

/**
 * POST request that consumes a text/event-stream response.
 *
 * Invokes `onEvent` for each SSE message as it arrives. Returns when the
 * server closes the stream. Abort via the provided signal to cancel mid-flight.
 */
export async function postStream(
  endpoint: string,
  body: unknown,
  onEvent: (event: SseEvent) => void,
  options: { signal?: AbortSignal } = {}
): Promise<{ success: boolean; error?: ApiError }> {
  try {
    const url = `${API_URL}${endpoint}`;
    const headers = await buildHeaders();

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(body),
      signal: options.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      if (response.status === 401) {
        await supabase.auth.refreshSession().catch(() => {});
      }
      return {
        success: false,
        error: {
          message: text || 'Stream request failed',
          status: response.status,
        },
      };
    }

    if (!response.body) {
      return {
        success: false,
        error: { message: 'Response has no body', status: 0 },
      };
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // SSE messages are separated by blank lines
      let sep: number;
      while ((sep = buffer.indexOf('\n\n')) !== -1) {
        const raw = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);

        let eventName = 'message';
        const dataLines: string[] = [];
        for (const line of raw.split('\n')) {
          if (line.startsWith('event:')) {
            eventName = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            dataLines.push(line.slice(5).trim());
          }
        }
        if (dataLines.length === 0) continue;

        let parsed: unknown = dataLines.join('\n');
        try {
          parsed = JSON.parse(dataLines.join('\n'));
        } catch {
          // Leave as string if not valid JSON
        }

        onEvent({ event: eventName, data: parsed });
      }
    }

    return { success: true };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return {
        success: false,
        error: { message: 'Stream cancelled', status: 0 },
      };
    }
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Stream error',
        status: 0,
      },
    };
  }
}

export const apiClient = {
  get,
  post,
  put,
  patch,
  delete: del,
  postFormData,
  postStream,
};
