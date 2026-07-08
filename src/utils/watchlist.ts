/**
 * 自选股操作封装（后端 /api/watchlist）
 */
const API_BASE = import.meta.env.VITE_API_BASE || '';

export interface WatchItem {
  code: string;
  name: string;
  price?: number | null;
  change_pct?: number | null;
}

export async function getWatchlist(token: string): Promise<WatchItem[]> {
  try {
    const res = await fetch(`${API_BASE}/api/watchlist`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) return await res.json();
  } catch {
    // ignore
  }
  return [];
}

export async function addToWatchlist(code: string, name: string, token: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/watchlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ code, name }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function removeFromWatchlist(code: string, token: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/watchlist/${code}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}
