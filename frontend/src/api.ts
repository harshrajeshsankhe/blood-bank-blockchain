const API = import.meta.env.VITE_API_URL || "http://localhost:4000";

async function request(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem("bloodchain_token");
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });
  if (!response.ok) throw new Error((await response.json()).error || "Request failed");
  return response.json();
}

export const api = {
  login: (email: string, password: string) =>
    request("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  dashboard: () => request("/api/dashboard"),
  units: () => request("/api/blood-units"),
  createUnit: (data: unknown) =>
    request("/api/blood-units", { method: "POST", body: JSON.stringify(data) }),
  requests: () => request("/api/requests"),
  createRequest: (data: unknown) =>
    request("/api/requests", { method: "POST", body: JSON.stringify(data) }),
  deliveries: () => request("/api/deliveries"),
  delivery: (id: string) => request(`/api/deliveries/${id}`),
  createDelivery: (data: unknown) =>
    request("/api/deliveries", { method: "POST", body: JSON.stringify(data) }),
  deliveryStatus: (id: string, status: string) =>
    request(`/api/deliveries/${id}/status`, { method: "POST", body: JSON.stringify({ status }) }),
  verify: (id: string) => request(`/api/blockchain/verify/${id}`)
};
