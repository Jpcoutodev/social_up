// Thin facade kept for backward compat with existing imports.
// All AI calls now go through Supabase Edge Functions (proxy-minimax / proxy-gemini).
// Provider is fixed: video + captions → MiniMax; product promo (Produto) → Gemini.

import { VideoScript, VideoLanguage } from "../types";
import { generateMinimaxScript } from "./minimaxService";

// --- Brand prompt (legitimate user preference, not a secret) ---
const LOCAL_STORAGE_KEY_BRAND_PROMPT = 'brand_prompt';

export const getBrandPrompt = (): string => {
  return (localStorage.getItem(LOCAL_STORAGE_KEY_BRAND_PROMPT) || '').trim();
};

export const setBrandPrompt = (prompt: string) => {
  const clean = prompt.trim();
  if (clean) localStorage.setItem(LOCAL_STORAGE_KEY_BRAND_PROMPT, clean);
  else localStorage.removeItem(LOCAL_STORAGE_KEY_BRAND_PROMPT);
};

// --- Main video script generator (always MiniMax now) ---
export const generateScript = async (
  topic: string,
  language: VideoLanguage,
  onProgress?: (progress: number, status: string) => void,
  signal?: AbortSignal
): Promise<VideoScript> => {
  onProgress?.(5, "Initializing MiniMax (Text-01 + image-01 + speech-02)...");
  return generateMinimaxScript(topic, language, onProgress, signal);
};
