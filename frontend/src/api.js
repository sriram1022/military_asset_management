const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export async function api(path, { token, ...options } = {}) {
    const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
            ...(options.body ? { "Content-Type": "application/json" } : {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...options.headers
        }
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
        if (response.status === 401 && token) window.dispatchEvent(new Event("fieldstock:unauthorized"));
        throw new Error(result.message || "Something went wrong");
    }
    return result;
}