import { supabase } from './supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

async function getAuthHeader(): Promise<string> {
  // First try refreshing the session to get a fresh access_token
  const { data: { session } } = await supabase.auth.refreshSession();
  if (session?.access_token) {
    return `Bearer ${session.access_token}`;
  }

  // Fallback: try getSession (may still have a valid cached token)
  const { data: { session: cached } } = await supabase.auth.getSession();
  if (cached?.access_token) {
    return `Bearer ${cached.access_token}`;
  }

  throw new Error('Not authenticated. Please log in again.');
}

interface MinimaxCallParams {
  action: 'chat' | 'image' | 'image_edit' | 'tts';
  payload: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

interface GeminiCallParams {
  action: 'chat' | 'image_edit';
  model: string;
  payload: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export async function callMinimax<T = any>(params: MinimaxCallParams): Promise<T> {
  const auth = await getAuthHeader();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/proxy-minimax`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: auth },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Proxy error (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export async function callGemini<T = any>(params: GeminiCallParams): Promise<T> {
  const auth = await getAuthHeader();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/proxy-gemini`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: auth },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Proxy error (${res.status})`);
  }
  return res.json() as Promise<T>;
}

/** Quick connection check — admin only. Pings each provider via the proxy. */
export async function checkProviderConnection(provider: 'minimax' | 'gemini'): Promise<{ ok: boolean; latencyMs: number; message: string }> {
  const start = Date.now();
  try {
    if (provider === 'minimax') {
      await callMinimax({
        action: 'chat',
        payload: {
          model: 'MiniMax-Text-01',
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 5,
        },
      });
      return { ok: true, latencyMs: Date.now() - start, message: 'Connected to MiniMax' };
    }
    await callGemini({
      action: 'chat',
      model: 'gemini-3-flash-preview',
      payload: {
        contents: [{ parts: [{ text: 'ping' }] }],
      },
    });
    return { ok: true, latencyMs: Date.now() - start, message: 'Connected to Gemini' };
  } catch (e: any) {
    return { ok: false, latencyMs: 0, message: e.message || 'Connection failed' };
  }
}
