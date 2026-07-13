export const getToken = () => localStorage.getItem("server-dashboard-token") ?? "";

export const setToken = (token: string) => {
  localStorage.setItem("server-dashboard-token", token);
};

export const clearToken = () => {
  localStorage.removeItem("server-dashboard-token");
};

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      Authorization: `Bearer ${getToken()}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {})
    }
  });

  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const payload = await response.json();
      detail = payload.detail ?? detail;
    } catch {}
    throw new Error(detail);
  }

  return response.json();
}

export function websocketUrl(path: string) {
  const protocol = location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${location.host}${path}${path.includes("?") ? "&" : "?"}token=${encodeURIComponent(getToken())}`;
}
