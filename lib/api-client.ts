export class ApiClientError extends Error {}

export async function apiFetch<T = any>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    const headers = new Headers(init?.headers);
    const isFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;
    if (!isFormData && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    res = await fetch(path, {
      ...init,
      headers,
      credentials: "include",
    });
  } catch {
    throw new ApiClientError("مفيش اتصال بالإنترنت، حاول تاني");
  }

  if (res.status === 401 && typeof window !== "undefined" && !path.includes("/auth/")) {
    window.location.href = "/login";
    throw new ApiClientError("لازم تسجل دخول تاني");
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiClientError(data.error ?? `خطأ (${res.status})`);
  }
  return data as T;
}

export const apiPost = <T = any>(path: string, body?: unknown) =>
  apiFetch<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined });

export const apiPostForm = <T = any>(path: string, body: FormData) =>
  apiFetch<T>(path, { method: "POST", body });

export const apiPatch = <T = any>(path: string, body?: unknown) =>
  apiFetch<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined });

export const apiPut = <T = any>(path: string, body?: unknown) =>
  apiFetch<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined });

/**
 * The server's own message for a failed query, when there is one — e.g. the actual
 * "مالكش صلاحية..." (forbidden) text for a 403, instead of `ErrorState`'s generic
 * "connection error" default. A permission revoked mid-shift then reads as what it
 * is, not as a network blip, without every polling board re-deriving this itself.
 */
export function errorMessage(error: unknown): string | undefined {
  return error instanceof ApiClientError ? error.message : undefined;
}
