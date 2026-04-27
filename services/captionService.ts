import { GoogleGenAI, Type } from '@google/genai';
import { getApiKey, getProvider, getBrandPrompt } from './geminiService';
import { AIProvider } from '../types';

const MINIMAX_BASE = 'https://api.minimaxi.chat/v1';

interface SingleCaptionResult {
  caption: string;
  imagePrompt: string;
  hashtags: string;
}

interface CarouselResult {
  title: string;
  slides: { slideNumber: number; caption: string; imagePrompt: string }[];
  hashtags: string;
}

// --- GEMINI ---
async function geminiGenerate(prompt: string): Promise<string> {
  const key = getApiKey('gemini');
  if (!key) throw new Error('Gemini API Key missing. Configure in Settings.');
  const ai = new GoogleGenAI({ apiKey: key });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: { responseMimeType: 'application/json' },
  });
  return response.text!;
}

// --- OPENAI ---
async function openaiGenerate(systemPrompt: string, userPrompt: string): Promise<string> {
  const key = getApiKey('openai');
  if (!key) throw new Error('OpenAI API Key missing. Configure in Settings.');
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`OpenAI Error (${res.status}): ${err.error?.message || res.statusText}`);
  }
  const data = await res.json();
  return data.choices[0].message.content;
}

// --- MINIMAX ---
async function minimaxGenerate(systemPrompt: string, userPrompt: string): Promise<string> {
  const key = getApiKey('minimax');
  if (!key) throw new Error('MiniMax API Key missing. Configure in Settings.');
  const res = await fetch(`${MINIMAX_BASE}/text/chatcompletion_v2`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: 'MiniMax-Text-01',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.6,
      max_tokens: 4096,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`MiniMax Error (${res.status}): ${err.base_resp?.status_msg || res.statusText}`);
  }
  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content || '';
  // Strip markdown fences
  let s = raw.trim().replace(/```json\s*/gi, '').replace(/```/g, '').trim();
  const first = s.indexOf('{');
  const last = s.lastIndexOf('}');
  if (first !== -1 && last > first) s = s.slice(first, last + 1);
  return s;
}

// --- Unified helpers ---
function extractJson(raw: string): any {
  let s = raw.trim().replace(/```json\s*/gi, '').replace(/```/g, '').trim();
  const first = s.indexOf('{');
  const last = s.lastIndexOf('}');
  if (first !== -1 && last > first) s = s.slice(first, last + 1);
  return JSON.parse(s);
}

const SYSTEM_JSON = 'You are a JSON-only API. Respond with a single valid JSON object. No markdown, no code fences, no extra text.';

// --- PUBLIC API ---

export async function generateSingleCaption(topic: string, platform: string): Promise<SingleCaptionResult> {
  const provider = getProvider();
  const platformName = platform === 'instagram' ? 'Instagram' : 'TikTok';
  const brandPrompt = getBrandPrompt();

  const userPrompt = `You are a social media expert. Based on the topic below, generate:
1. A highly engaging caption for a single ${platformName} post image.
2. An image prompt (in English) describing the ideal visual for this post.
3. 10-15 relevant hashtags.

Topic: "${topic}"
${brandPrompt ? `\nBRAND GUIDELINES (follow strictly):\n${brandPrompt}\n` : ''}
CRITICAL: The caption MUST be in Portuguese (Brazil). The image prompt MUST be in English.
Return JSON: { "caption": "...", "imagePrompt": "...", "hashtags": "..." }`;

  let raw: string;
  if (provider === 'openai') {
    raw = await openaiGenerate(SYSTEM_JSON, userPrompt);
  } else if (provider === 'minimax') {
    raw = await minimaxGenerate(SYSTEM_JSON, userPrompt);
  } else {
    raw = await geminiGenerate(userPrompt);
  }

  return extractJson(raw) as SingleCaptionResult;
}

export async function generateCarouselCaptions(topic: string, platform: string, slideCount: number): Promise<CarouselResult> {
  const provider = getProvider();
  const platformName = platform === 'instagram' ? 'Instagram' : 'TikTok';
  const brandPrompt = getBrandPrompt();

  const userPrompt = `You are a social media carousel expert. Create a ${slideCount}-slide carousel for ${platformName}.

Topic: "${topic}"
${brandPrompt ? `\nBRAND GUIDELINES (follow strictly):\n${brandPrompt}\n` : ''}
For each slide generate: slideNumber (1-${slideCount}), caption (concise, impactful), imagePrompt (English).
Also generate: title (catchy), hashtags (10-15).

CRITICAL: Captions and title in Portuguese (Brazil). Image prompts in English.
First slide = strong hook. Last slide = call-to-action.

Return JSON: { "title": "...", "slides": [{ "slideNumber": 1, "caption": "...", "imagePrompt": "..." }], "hashtags": "..." }`;

  let raw: string;
  if (provider === 'openai') {
    raw = await openaiGenerate(SYSTEM_JSON, userPrompt);
  } else if (provider === 'minimax') {
    raw = await minimaxGenerate(SYSTEM_JSON, userPrompt);
  } else {
    raw = await geminiGenerate(userPrompt);
  }

  return extractJson(raw) as CarouselResult;
}

export async function suggestTopic(platform: string, mode: 'image' | 'carousel'): Promise<string> {
  const provider = getProvider();
  const platformName = platform === 'instagram' ? 'Instagram' : 'TikTok';
  const brandPrompt = getBrandPrompt();
  const contentType = mode === 'image' ? 'a single image post' : 'a carousel post';

  const userPrompt = `You are a social media strategist. Suggest ONE creative and trending topic idea for ${contentType} on ${platformName}.
${brandPrompt ? `\nBRAND CONTEXT:\n${brandPrompt}\n` : ''}
The suggestion should be specific, actionable, and likely to go viral. Return ONLY a JSON: { "topic": "..." }
The topic MUST be in Portuguese (Brazil).`;

  let raw: string;
  if (provider === 'openai') {
    raw = await openaiGenerate(SYSTEM_JSON, userPrompt);
  } else if (provider === 'minimax') {
    raw = await minimaxGenerate(SYSTEM_JSON, userPrompt);
  } else {
    raw = await geminiGenerate(userPrompt);
  }

  const result = extractJson(raw);
  return result.topic;
}

// --- IMAGE GENERATION ---

import { uploadImageToStorage } from '../src/lib/supabase';
import { supabase } from '../src/lib/supabase';

async function geminiGenerateImage(prompt: string, aspectRatio: string): Promise<string> {
  const key = getApiKey('gemini');
  if (!key) throw new Error('Gemini API Key missing.');
  const ai = new GoogleGenAI({ apiKey: key });

  // Try flash first, fallback to pro
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: prompt }] },
      config: { imageConfig: { aspectRatio: aspectRatio as any } },
    });
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
  } catch (e) {
    console.warn('Gemini Flash Image failed, trying Pro...', e);
  }

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: { parts: [{ text: prompt }] },
    config: { imageConfig: { aspectRatio: aspectRatio as any, imageSize: '1K' } },
  });
  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
  }
  throw new Error('Gemini failed to generate image');
}

async function openaiGenerateImage(prompt: string, size: string): Promise<string> {
  const key = getApiKey('openai');
  if (!key) throw new Error('OpenAI API Key missing.');
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size,
      response_format: 'b64_json',
      quality: 'standard',
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`DALL-E Error: ${err.error?.message || res.statusText}`);
  }
  const data = await res.json();
  if (data.data?.[0]?.b64_json) return `data:image/png;base64,${data.data[0].b64_json}`;
  throw new Error('DALL-E returned no image');
}

async function minimaxGenerateImage(prompt: string, aspectRatio: string): Promise<string> {
  const key = getApiKey('minimax');
  if (!key) throw new Error('MiniMax API Key missing. Configure in Settings.');

  console.log('[MiniMax Image] Generating with aspect_ratio:', aspectRatio, 'prompt:', prompt.slice(0, 80));

  const res = await fetch(`${MINIMAX_BASE}/image_generation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: 'image-01',
      prompt,
      aspect_ratio: aspectRatio,
      n: 1,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err.base_resp?.status_msg || err.error?.message || res.statusText;
    console.error('[MiniMax Image] API Error:', res.status, msg, err);
    throw new Error(`MiniMax Image Error (${res.status}): ${msg}`);
  }
  const data = await res.json();
  console.log('[MiniMax Image] Response keys:', Object.keys(data), 'data keys:', data.data ? Object.keys(data.data) : 'N/A');

  let imgUrl = data.data?.image_urls?.[0] || data.data?.[0]?.url;
  if (!imgUrl) {
    console.error('[MiniMax Image] No image URL found in response:', JSON.stringify(data).slice(0, 300));
    throw new Error('MiniMax returned no image URL in response');
  }

  // Fix mixed content
  if (imgUrl.startsWith('http://')) imgUrl = imgUrl.replace('http://', 'https://');
  console.log('[MiniMax Image] Got URL:', imgUrl.slice(0, 80));

  // Strategy: try local dev proxy first, then Supabase Edge Function for production
  // 1) Try local CORS proxy (works in dev)
  try {
    const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(imgUrl)}`;
    const imgRes = await fetch(proxyUrl);
    if (!imgRes.ok) throw new Error(`Proxy returned ${imgRes.status}`);
    const blob = await imgRes.blob();
    return await blobToDataUrl(blob);
  } catch (proxyErr) {
    console.warn('[MiniMax] Local proxy unavailable, trying Supabase Edge Function...', proxyErr);
  }

  // 2) Use Supabase Edge Function as CORS proxy (works in production)
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const fnUrl = `${supabaseUrl}/functions/v1/proxy-image`;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY;

    const proxyRes = await fetch(fnUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ url: imgUrl }),
    });

    if (!proxyRes.ok) {
      const errText = await proxyRes.text().catch(() => '');
      throw new Error(`Edge Function error (${proxyRes.status}): ${errText}`);
    }

    const blob = await proxyRes.blob();
    console.log('[MiniMax] Downloaded via Supabase Edge Function, size:', blob.size);
    return await blobToDataUrl(blob);
  } catch (edgeErr) {
    console.warn('[MiniMax] Edge Function failed, returning raw URL:', edgeErr);
    return imgUrl;
  }
}

/** Convert a Blob to a base64 data URL */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function uploadImage(imageData: string, index: number): Promise<string> {
  // If it's already a remote URL (not base64), return as-is
  if (imageData.startsWith('http://') || imageData.startsWith('https://')) {
    return imageData;
  }
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const filename = `post_image_${index}_${Date.now()}.png`;
    const publicUrl = await uploadImageToStorage(imageData, filename, user?.id);
    return publicUrl;
  } catch (e) {
    console.warn('Upload failed, using base64 fallback');
    return imageData;
  }
}

function getAspectConfig(platform: string): { gemini: string; openai: string; minimax: string } {
  if (platform === 'tiktok') return { gemini: '9:16', openai: '1024x1792', minimax: '9:16' };
  return { gemini: '3:4', openai: '1024x1792', minimax: '3:4' }; // Instagram portrait
}

// --- CANVAS TEXT OVERLAY ---

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

export type CaptionPosition = 'bottom' | 'middle' | 'top';

export async function overlayTextOnImage(imageSrc: string, caption: string, fontScale: number = 1.0, position: CaptionPosition = 'bottom'): Promise<string> {
  // Strip hashtags — only show the clean description on the image
  const cleanCaption = caption
    .replace(/#\S+/g, '')       // remove #hashtags
    .replace(/\n{2,}/g, '\n')   // collapse empty lines
    .trim();

  if (!cleanCaption) return imageSrc; // nothing to overlay

  const img = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d')!;

  // Draw original image
  ctx.drawImage(img, 0, 0);

  const w = canvas.width;
  const h = canvas.height;
  const padding = w * 0.06;
  const fontSize = Math.max(18, Math.round(w * 0.055 * fontScale));

  // Text settings (needed early for line wrapping measurement)
  ctx.font = `bold ${fontSize}px "Inter", "Segoe UI", "Helvetica Neue", Arial, sans-serif`;
  const maxWidth = w - padding * 2;
  const lines = wrapText(ctx, cleanCaption, maxWidth);
  const lineHeight = fontSize * 1.35;
  const totalTextHeight = lines.length * lineHeight;

  // Calculate startY and gradient based on position
  let startY: number;
  const gradientHeight = Math.max(h * 0.45, totalTextHeight + padding * 3);

  if (position === 'top') {
    // Gradient on top
    const grad = ctx.createLinearGradient(0, 0, 0, gradientHeight);
    grad.addColorStop(0, 'rgba(0,0,0,0.85)');
    grad.addColorStop(0.6, 'rgba(0,0,0,0.4)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, gradientHeight);
    startY = padding;
  } else if (position === 'middle') {
    // Gradient band in center
    const bandTop = (h - gradientHeight) / 2;
    const grad = ctx.createLinearGradient(0, bandTop, 0, bandTop + gradientHeight);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.2, 'rgba(0,0,0,0.6)');
    grad.addColorStop(0.8, 'rgba(0,0,0,0.6)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, bandTop, w, gradientHeight);
    startY = (h - totalTextHeight) / 2;
  } else {
    // Bottom (default)
    const grad = ctx.createLinearGradient(0, h - gradientHeight, 0, h);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.4, 'rgba(0,0,0,0.4)');
    grad.addColorStop(1, 'rgba(0,0,0,0.85)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, h - gradientHeight, w, gradientHeight);
    startY = h - totalTextHeight - padding;
  }

  // Text rendering
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${fontSize}px "Inter", "Segoe UI", "Helvetica Neue", Arial, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  // Shadow for readability
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;

  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], padding, startY + i * lineHeight);
  }

  // Reset shadow
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;

  return canvas.toDataURL('image/png');
}

// --- PUBLIC API ---

export async function generatePostImage(
  imagePrompt: string,
  platform: string,
  caption: string,
  onProgress?: (status: string) => void
): Promise<{ imageUrl: string; imageWithTextUrl: string }> {
  const provider = getProvider();
  const aspect = getAspectConfig(platform);
  const fullPrompt = `High quality, professional social media post. ${imagePrompt}. Clean design, modern aesthetic, no text overlays.`;

  onProgress?.('Gerando imagem...');

  let rawImage: string;
  if (provider === 'openai') {
    rawImage = await openaiGenerateImage(fullPrompt, aspect.openai);
  } else if (provider === 'minimax') {
    rawImage = await minimaxGenerateImage(fullPrompt, aspect.minimax);
  } else {
    rawImage = await geminiGenerateImage(fullPrompt, aspect.gemini);
  }

  // Overlay text on the raw base64 BEFORE uploading (avoids CORS)
  onProgress?.('Adicionando legenda...');
  const withTextBase64 = await overlayTextOnImage(rawImage, caption);

  onProgress?.('Enviando...');
  const [imageUrl, imageWithTextUrl] = await Promise.all([
    uploadImage(rawImage, 0),
    uploadImage(withTextBase64, 1),
  ]);

  return { imageUrl, imageWithTextUrl };
}

export async function generateCarouselImagesFromSlides(
  slides: { imagePrompt: string; caption: string }[],
  platform: string,
  onProgress?: (current: number, total: number) => void
): Promise<{ imageUrl: string; imageWithTextUrl: string }[]> {
  const provider = getProvider();
  const aspect = getAspectConfig(platform);
  const results: { imageUrl: string; imageWithTextUrl: string }[] = [];

  for (let i = 0; i < slides.length; i++) {
    onProgress?.(i + 1, slides.length);
    const fullPrompt = `High quality, professional carousel slide ${i + 1}. ${slides[i].imagePrompt}. Clean design, modern aesthetic, cohesive style, no text overlays.`;

    let rawImage: string;
    if (provider === 'openai') {
      rawImage = await openaiGenerateImage(fullPrompt, aspect.openai);
    } else if (provider === 'minimax') {
      rawImage = await minimaxGenerateImage(fullPrompt, aspect.minimax);
    } else {
      rawImage = await geminiGenerateImage(fullPrompt, aspect.gemini);
    }

    // Overlay text on raw base64 BEFORE uploading (avoids CORS)
    const withTextBase64 = await overlayTextOnImage(rawImage, slides[i].caption);

    const [imageUrl, imageWithTextUrl] = await Promise.all([
      uploadImage(rawImage, i * 2),
      uploadImage(withTextBase64, i * 2 + 1),
    ]);

    results.push({ imageUrl, imageWithTextUrl });

    // Small delay between requests to avoid rate limits
    if (i < slides.length - 1) await new Promise(r => setTimeout(r, 1000));
  }

  return results;
}

export function getProviderLabel(provider: AIProvider): string {
  switch (provider) {
    case 'openai': return 'GPT-4o';
    case 'minimax': return 'MiniMax T01';
    default: return 'GEMINI AI';
  }
}

