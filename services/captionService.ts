import { getBrandPrompt } from './geminiService';
import { callMinimax, callGemini } from '../src/lib/aiProxy';
import { uploadImageToStorage } from '../src/lib/supabase';
import { supabase } from '../src/lib/supabase';

// ============================================================
// Types
// ============================================================

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

export type CaptionPosition = 'bottom' | 'middle' | 'top';
export type ProductImageType = 'person' | 'product';

// ============================================================
// JSON helpers
// ============================================================

function extractJson(raw: string): any {
  let s = raw.trim().replace(/```json\s*/gi, '').replace(/```/g, '').trim();
  const first = s.indexOf('{');
  const last = s.lastIndexOf('}');
  if (first !== -1 && last > first) s = s.slice(first, last + 1);
  return JSON.parse(s);
}

const SYSTEM_JSON = 'You are a JSON-only API. Respond with a single valid JSON object. No markdown, no code fences, no extra text.';

async function minimaxChat(systemPrompt: string, userPrompt: string, metadata?: Record<string, unknown>): Promise<string> {
  const data = await callMinimax({
    action: 'chat',
    payload: {
      model: 'MiniMax-Text-01',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.6,
      max_tokens: 4096,
    },
    metadata,
  });
  return data.choices?.[0]?.message?.content || '';
}

// ============================================================
// Caption generation (always MiniMax)
// ============================================================

export async function generateSingleCaption(topic: string, platform: string): Promise<SingleCaptionResult> {
  const platformName = platform === 'instagram' ? 'Instagram' : 'TikTok';
  const brandPrompt = getBrandPrompt();

  const userPrompt = `You are a social media expert. Based on the topic below, generate:
1. A highly engaging caption for a single ${platformName} post image.
2. An image prompt describing the ideal visual for this post.
3. 10-15 relevant hashtags.

Topic: "${topic}"
${brandPrompt ? `\nBRAND GUIDELINES (follow strictly):\n${brandPrompt}\n` : ''}
CRITICAL: Both the caption and the image prompt MUST be in Portuguese (Brazil).
Return JSON: { "caption": "...", "imagePrompt": "...", "hashtags": "..." }`;

  const raw = await minimaxChat(SYSTEM_JSON, userPrompt, { feature: 'single_caption', topic: topic.slice(0, 80) });
  return extractJson(raw) as SingleCaptionResult;
}

export async function generateCarouselCaptions(topic: string, platform: string, slideCount: number): Promise<CarouselResult> {
  const platformName = platform === 'instagram' ? 'Instagram' : 'TikTok';
  const brandPrompt = getBrandPrompt();

  const userPrompt = `You are a social media carousel expert. Create a ${slideCount}-slide carousel for ${platformName}.

Topic: "${topic}"
${brandPrompt ? `\nBRAND GUIDELINES (follow strictly):\n${brandPrompt}\n` : ''}
For each slide generate: slideNumber (1-${slideCount}), caption (concise, impactful), imagePrompt.
Also generate: title (catchy), hashtags (10-15).

CRITICAL: Captions, title, and image prompts MUST be in Portuguese (Brazil).
First slide = strong hook. Last slide = call-to-action.

Return JSON: { "title": "...", "slides": [{ "slideNumber": 1, "caption": "...", "imagePrompt": "..." }], "hashtags": "..." }`;

  const raw = await minimaxChat(SYSTEM_JSON, userPrompt, { feature: 'carousel_captions', topic: topic.slice(0, 80), slide_count: slideCount });
  return extractJson(raw) as CarouselResult;
}

export async function suggestTopic(platform: string, mode: 'image' | 'carousel'): Promise<string> {
  const platformName = platform === 'instagram' ? 'Instagram' : 'TikTok';
  const brandPrompt = getBrandPrompt();
  const contentType = mode === 'image' ? 'a single image post' : 'a carousel post';

  const userPrompt = `You are a social media strategist. Suggest ONE creative and trending topic idea for ${contentType} on ${platformName}.
${brandPrompt ? `\nBRAND CONTEXT:\n${brandPrompt}\n` : ''}
The suggestion should be specific, actionable, and likely to go viral. Return ONLY a JSON: { "topic": "..." }
The topic MUST be in Portuguese (Brazil).`;

  const raw = await minimaxChat(SYSTEM_JSON, userPrompt, { feature: 'suggest_topic' });
  return extractJson(raw).topic;
}

export function getProviderLabel(): string {
  return 'MiniMax T01';
}

// ============================================================
// Image utilities
// ============================================================

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function uploadImage(imageData: string, index: number): Promise<string> {
  if (imageData.startsWith('http://') || imageData.startsWith('https://')) {
    return imageData;
  }
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const filename = `post_image_${index}_${Date.now()}.png`;
    return await uploadImageToStorage(imageData, filename, user?.id);
  } catch {
    console.warn('Upload failed, using base64 fallback');
    return imageData;
  }
}

async function uploadProductReference(base64DataUrl: string): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  const filename = `product_ref_${Date.now()}.png`;
  return await uploadImageToStorage(base64DataUrl, filename, user?.id);
}

function getAspectMinimax(platform: string): string {
  return platform === 'tiktok' ? '9:16' : '3:4';
}

function getAspectGemini(platform: string): string {
  return platform === 'tiktok' ? '9:16' : '3:4';
}

// ============================================================
// MiniMax image generation (no reference)
// ============================================================

async function minimaxGenerateImage(prompt: string, aspectRatio: string, metadata?: Record<string, unknown>): Promise<string> {
  const data = await callMinimax({
    action: 'image',
    payload: {
      model: 'image-01',
      prompt,
      aspect_ratio: aspectRatio,
      n: 1,
    },
    metadata,
  });

  let imgUrl: string | undefined = data.data?.image_urls?.[0] || data.data?.[0]?.url;
  if (!imgUrl) throw new Error('MiniMax returned no image URL');
  if (imgUrl.startsWith('http://')) imgUrl = imgUrl.replace('http://', 'https://');

  return await downloadImageViaProxy(imgUrl);
}

// ============================================================
// MiniMax image edit with subject_reference (for Person)
// ============================================================

async function minimaxEditWithSubject(prompt: string, productImageUrl: string, aspectRatio: string, metadata?: Record<string, unknown>): Promise<string> {
  const data = await callMinimax({
    action: 'image_edit',
    payload: {
      model: 'image-01',
      prompt,
      aspect_ratio: aspectRatio,
      n: 1,
      subject_reference: [
        { type: 'character', image_file: productImageUrl },
      ],
    },
    metadata,
  });

  let imgUrl: string | undefined = data.data?.image_urls?.[0] || data.data?.[0]?.url;
  if (!imgUrl) throw new Error('MiniMax returned no image URL for subject reference edit');
  if (imgUrl.startsWith('http://')) imgUrl = imgUrl.replace('http://', 'https://');

  return await downloadImageViaProxy(imgUrl);
}

// ============================================================
// Gemini multimodal image (for Product)
// ============================================================

async function geminiEditWithProduct(prompt: string, productImageDataUrl: string, aspectRatio: string, metadata?: Record<string, unknown>): Promise<string> {
  // Strip data URL prefix to get pure base64 + mime
  const match = productImageDataUrl.match(/^data:(image\/[^;]+);base64,(.+)$/);
  if (!match) throw new Error('Product image must be a base64 data URL');
  const [, mimeType, base64Data] = match;

  const payload = {
    contents: [
      {
        parts: [
          { text: prompt },
          { inlineData: { mimeType, data: base64Data } },
        ],
      },
    ],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageSizeOptions: { aspectRatio },
    },
  };

  // Try Flash first, fallback to Pro
  let data: any;
  try {
    data = await callGemini({
      action: 'image_edit',
      model: 'gemini-2.0-flash-exp',
      payload,
      metadata: { ...metadata, model_attempt: 'flash' },
    });
  } catch (flashErr) {
    console.warn('[Gemini] Flash image failed, trying Pro...', flashErr);
    data = await callGemini({
      action: 'image_edit',
      model: 'gemini-2.0-flash-exp',
      payload,
      metadata: { ...metadata, model_attempt: 'pro_fallback' },
    });
  }

  for (const part of data?.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  throw new Error('Gemini returned no image');
}

// ============================================================
// CORS proxy for downloading external image URLs
// ============================================================

async function downloadImageViaProxy(imgUrl: string): Promise<string> {
  // 1) Local dev proxy
  try {
    const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(imgUrl)}`;
    const imgRes = await fetch(proxyUrl);
    if (!imgRes.ok) throw new Error(`Proxy returned ${imgRes.status}`);
    const blob = await imgRes.blob();
    return await blobToDataUrl(blob);
  } catch {
    // fall through
  }

  // 2) Supabase Edge Function proxy-image
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const fnUrl = `${supabaseUrl}/functions/v1/proxy-image`;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY;

    const proxyRes = await fetch(fnUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ url: imgUrl }),
    });
    if (!proxyRes.ok) throw new Error(`Edge Function error ${proxyRes.status}`);
    const blob = await proxyRes.blob();
    return await blobToDataUrl(blob);
  } catch (e) {
    console.warn('[downloadImageViaProxy] All proxies failed, returning raw URL:', e);
    return imgUrl;
  }
}

// ============================================================
// Canvas text overlay
// ============================================================

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

export async function overlayTextOnImage(imageSrc: string, caption: string, fontScale: number = 1.0, position: CaptionPosition = 'bottom'): Promise<string> {
  const cleanCaption = caption.replace(/#\S+/g, '').replace(/\n{2,}/g, '\n').trim();
  if (!cleanCaption) return imageSrc;

  const img = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);

  const w = canvas.width;
  const h = canvas.height;
  const padding = w * 0.06;
  const fontSize = Math.max(18, Math.round(w * 0.055 * fontScale));

  ctx.font = `bold ${fontSize}px "Inter", "Segoe UI", "Helvetica Neue", Arial, sans-serif`;
  const maxWidth = w - padding * 2;
  const lines = wrapText(ctx, cleanCaption, maxWidth);
  const lineHeight = fontSize * 1.35;
  const totalTextHeight = lines.length * lineHeight;

  let startY: number;
  const gradientHeight = Math.max(h * 0.45, totalTextHeight + padding * 3);

  if (position === 'top') {
    const grad = ctx.createLinearGradient(0, 0, 0, gradientHeight);
    grad.addColorStop(0, 'rgba(0,0,0,0.85)');
    grad.addColorStop(0.6, 'rgba(0,0,0,0.4)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, gradientHeight);
    startY = padding;
  } else if (position === 'middle') {
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
    const grad = ctx.createLinearGradient(0, h - gradientHeight, 0, h);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.4, 'rgba(0,0,0,0.4)');
    grad.addColorStop(1, 'rgba(0,0,0,0.85)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, h - gradientHeight, w, gradientHeight);
    startY = h - totalTextHeight - padding;
  }

  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${fontSize}px "Inter", "Segoe UI", "Helvetica Neue", Arial, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;

  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], padding, startY + i * lineHeight);
  }

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;

  return canvas.toDataURL('image/png');
}

// ============================================================
// Public API — basic post images (no product reference)
// ============================================================

export async function generatePostImage(
  imagePrompt: string,
  platform: string,
  caption: string,
  onProgress?: (status: string) => void
): Promise<{ imageUrl: string; imageWithTextUrl: string }> {
  const fullPrompt = `High quality, professional social media post. ${imagePrompt}. Clean design, modern aesthetic, no text overlays.`;

  onProgress?.('Gerando imagem...');
  const rawImage = await minimaxGenerateImage(fullPrompt, getAspectMinimax(platform), { feature: 'post_image' });

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
  const results: { imageUrl: string; imageWithTextUrl: string }[] = [];

  for (let i = 0; i < slides.length; i++) {
    onProgress?.(i + 1, slides.length);
    const fullPrompt = `High quality, professional carousel slide ${i + 1}. ${slides[i].imagePrompt}. Clean design, modern aesthetic, cohesive style, no text overlays.`;
    const rawImage = await minimaxGenerateImage(fullPrompt, getAspectMinimax(platform), { feature: 'carousel_image', slide_index: i });
    const withTextBase64 = await overlayTextOnImage(rawImage, slides[i].caption);

    const [imageUrl, imageWithTextUrl] = await Promise.all([
      uploadImage(rawImage, i * 2),
      uploadImage(withTextBase64, i * 2 + 1),
    ]);
    results.push({ imageUrl, imageWithTextUrl });
    if (i < slides.length - 1) await new Promise(r => setTimeout(r, 1000));
  }

  return results;
}

export async function generateSingleCarouselImage(
  slide: { imagePrompt: string; caption: string },
  slideIndex: number,
  platform: string,
  onProgress?: (status: string) => void
): Promise<{ imageUrl: string; imageWithTextUrl: string }> {
  const fullPrompt = `High quality, professional carousel slide ${slideIndex + 1}. ${slide.imagePrompt}. Clean design, modern aesthetic, cohesive style, no text overlays.`;

  onProgress?.('Gerando imagem...');
  const rawImage = await minimaxGenerateImage(fullPrompt, getAspectMinimax(platform), { feature: 'carousel_single', slide_index: slideIndex });

  onProgress?.('Adicionando legenda...');
  const withTextBase64 = await overlayTextOnImage(rawImage, slide.caption);

  onProgress?.('Enviando...');
  const [imageUrl, imageWithTextUrl] = await Promise.all([
    uploadImage(rawImage, slideIndex * 2),
    uploadImage(withTextBase64, slideIndex * 2 + 1),
  ]);

  return { imageUrl, imageWithTextUrl };
}

// ============================================================
// Public API — Product Promotion
// imageType:
//   - 'person'  → MiniMax subject_reference (preserves person/face)
//   - 'product' → Gemini multimodal (preserves product object)
// ============================================================

export async function generateProductPromoImage(
  productImageDataUrl: string,
  prompt: string,
  platform: string,
  caption: string,
  imageType: ProductImageType,
  onProgress?: (status: string) => void
): Promise<{ imageUrl: string; imageWithTextUrl: string }> {

  let rawImage: string;

  if (imageType === 'person') {
    // MiniMax needs a public URL for the reference image
    onProgress?.('Enviando imagem de referência...');
    const productUrl = await uploadProductReference(productImageDataUrl);

    const fullPrompt = `IMPORTANT: Preserve the person's face, identity, and key features from the reference image exactly. Scene: ${prompt}. Professional social media photo, high quality, modern aesthetic, clean composition, no text overlays.`;

    onProgress?.('Gerando imagem com IA (MiniMax — pessoa)...');
    rawImage = await minimaxEditWithSubject(fullPrompt, productUrl, getAspectMinimax(platform), { feature: 'product_promo_person' });
  } else {
    // Gemini accepts the image inline (no upload needed)
    const fullPrompt = `Use the EXACT product shown in the reference image — preserve its shape, color, design, brand, and all visual details. Do NOT redesign or replace the product. Compose a professional social media product photo. Scene: ${prompt}. High quality, modern aesthetic, clean composition, no text overlays.`;

    onProgress?.('Gerando imagem com IA (Gemini — produto)...');
    rawImage = await geminiEditWithProduct(fullPrompt, productImageDataUrl, getAspectGemini(platform), { feature: 'product_promo_product' });
  }

  onProgress?.('Adicionando legenda...');
  const withTextBase64 = await overlayTextOnImage(rawImage, caption);

  onProgress?.('Salvando...');
  const [imageUrl, imageWithTextUrl] = await Promise.all([
    uploadImage(rawImage, 0),
    uploadImage(withTextBase64, 1),
  ]);

  return { imageUrl, imageWithTextUrl };
}

export async function generateProductPromoCarousel(
  productImages: string[],
  prompts: { prompt: string; caption: string }[],
  platform: string,
  imageType: ProductImageType,
  onProgress?: (current: number, total: number) => void
): Promise<{ imageUrl: string; imageWithTextUrl: string }[]> {
  const results: { imageUrl: string; imageWithTextUrl: string }[] = [];

  // Pre-upload product images only if MiniMax (Pessoa) — Gemini works with base64 inline
  const productUrls: string[] = [];
  if (imageType === 'person') {
    for (const img of productImages) {
      productUrls.push(await uploadProductReference(img));
    }
  }

  for (let i = 0; i < prompts.length; i++) {
    onProgress?.(i + 1, prompts.length);

    const refIndex = i % productImages.length;
    let rawImage: string;

    if (imageType === 'person') {
      const refUrl = productUrls[refIndex];
      const fullPrompt = `IMPORTANT: Preserve the person's face, identity, and features from the reference image. Slide ${i + 1}: ${prompts[i].prompt}. Professional product promotion, high quality, modern, cohesive style, no text overlays.`;
      rawImage = await minimaxEditWithSubject(fullPrompt, refUrl, getAspectMinimax(platform), { feature: 'product_promo_person_carousel', slide_index: i });
    } else {
      const productImg = productImages[refIndex];
      const fullPrompt = `Use the EXACT product shown in the reference image — preserve its shape, color, design, brand, and all details. Do NOT redesign or replace it. Slide ${i + 1}: ${prompts[i].prompt}. Professional product promotion, high quality, modern, cohesive style, no text overlays.`;
      rawImage = await geminiEditWithProduct(fullPrompt, productImg, getAspectGemini(platform), { feature: 'product_promo_product_carousel', slide_index: i });
    }

    const withTextBase64 = await overlayTextOnImage(rawImage, prompts[i].caption);

    const [imageUrl, imageWithTextUrl] = await Promise.all([
      uploadImage(rawImage, i * 2),
      uploadImage(withTextBase64, i * 2 + 1),
    ]);

    results.push({ imageUrl, imageWithTextUrl });
    if (i < prompts.length - 1) await new Promise(r => setTimeout(r, 1000));
  }

  return results;
}
