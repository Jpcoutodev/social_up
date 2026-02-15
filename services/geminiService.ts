import { GoogleGenAI, Type, Modality } from "@google/genai";
import { VideoScript, Scene, AIProvider, VideoLanguage } from "../types";
import { pcmToWav } from "../utils/audioHelper";
import { generateOpenAIScript } from "./openaiService";
import { uploadAudioToStorage, uploadImageToStorage } from "../src/lib/supabase";
import { supabase } from "../src/lib/supabase";

const LOCAL_STORAGE_KEY_GEMINI = 'gemini_custom_api_key';
const LOCAL_STORAGE_KEY_OPENAI = 'openai_custom_api_key';
const LOCAL_STORAGE_KEY_PROVIDER = 'ai_provider_selection';

// --- KEY & PROVIDER MANAGEMENT ---

export const getProvider = (): AIProvider => {
  return (localStorage.getItem(LOCAL_STORAGE_KEY_PROVIDER) as AIProvider) || 'gemini';
};

export const setProvider = (provider: AIProvider) => {
  localStorage.setItem(LOCAL_STORAGE_KEY_PROVIDER, provider);
};

export const getApiKey = (provider?: AIProvider): string => {
  const currentProvider = provider || getProvider();
  
  if (currentProvider === 'openai') {
    return (localStorage.getItem(LOCAL_STORAGE_KEY_OPENAI) || '').trim();
  }
  
  // Gemini Priority: 1. LocalStorage, 2. Env
  let key = localStorage.getItem(LOCAL_STORAGE_KEY_GEMINI) || process.env.API_KEY || '';
  return key.trim().replace(/^["']|["']$/g, '');
};

export const setApiKey = (provider: AIProvider, key: string) => {
  const cleanKey = key.trim().replace(/^["']|["']$/g, '');
  if (provider === 'openai') {
    if (cleanKey) localStorage.setItem(LOCAL_STORAGE_KEY_OPENAI, cleanKey);
    else localStorage.removeItem(LOCAL_STORAGE_KEY_OPENAI);
  } else {
    if (cleanKey) localStorage.setItem(LOCAL_STORAGE_KEY_GEMINI, cleanKey);
    else localStorage.removeItem(LOCAL_STORAGE_KEY_GEMINI);
  }
};

export const removeApiKey = (provider: AIProvider) => {
  if (provider === 'openai') localStorage.removeItem(LOCAL_STORAGE_KEY_OPENAI);
  else localStorage.removeItem(LOCAL_STORAGE_KEY_GEMINI);
};

// --- GEMINI SPECIFIC HELPERS ---

const getGeminiClient = (): GoogleGenAI => {
  const key = getApiKey('gemini');
  if (!key) throw new Error("Gemini API Key is missing.");
  return new GoogleGenAI({ apiKey: key });
};

// Retry Logic (Shared)
async function withRetry<T>(
  operation: () => Promise<T>, 
  maxRetries: number = 3, 
  initialDelay: number = 2000,
  signal?: AbortSignal
): Promise<T> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    if (signal?.aborted) throw new Error("Cancelled by user");
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      const isQuota = error.message?.includes('429') || error.status === 429;
      if (isQuota && i < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, i);
        console.warn(`[Gemini] Rate Limit (Attempt ${i + 1}). Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

export const checkConnection = async (): Promise<{ success: boolean; latency: number; message: string }> => {
  const provider = getProvider();
  const key = getApiKey(provider);
  
  if (!key) return { success: false, latency: 0, message: `No API Key found for ${provider.toUpperCase()}` };

  const start = Date.now();
  try {
    if (provider === 'openai') {
       // Simple model list check for OpenAI
       const res = await fetch('https://api.openai.com/v1/models', {
         headers: { 'Authorization': `Bearer ${key}` }
       });
       if (!res.ok) throw new Error("Invalid OpenAI Key or Service Down");
       return { success: true, latency: Date.now() - start, message: "Connected to OpenAI (GPT-4o)" };
    } else {
       // Gemini Check
       const ai = new GoogleGenAI({ apiKey: key });
       await withRetry(async () => {
         return ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: 'Ping' });
       }, 2, 1000);
       return { success: true, latency: Date.now() - start, message: "Connected to Gemini 3 Flash" };
    }
  } catch (error: any) {
    return { success: false, latency: 0, message: error.message || "Connection failed" };
  }
};

// --- INTERNAL GEMINI GENERATION LOGIC ---

const generateGeminiImage = async (prompt: string, sceneIndex: number, signal?: AbortSignal): Promise<string | undefined> => {
  const ai = getGeminiClient();
  try {
    const response = await withRetry(async () => {
        return ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ text: prompt }] },
            config: { imageConfig: { aspectRatio: "9:16" } }
        });
    }, 3, 2000, signal);

    for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
            const base64Image = `data:image/png;base64,${part.inlineData.data}`;

            // Upload to Supabase Storage
            const { data: { user } } = await supabase.auth.getUser();
            const timestamp = Date.now();
            const imageFilename = `image_scene${sceneIndex}_${timestamp}.png`;

            try {
                const publicUrl = await uploadImageToStorage(base64Image, imageFilename, user?.id);
                console.log('Gemini image uploaded to Supabase:', publicUrl);
                return publicUrl;
            } catch (uploadError) {
                console.error('Failed to upload Gemini image:', uploadError);
                return base64Image; // Fallback
            }
        }
    }
  } catch (flashError: any) {
    console.warn("Gemini Flash Image failed, trying Pro...", flashError);
    try {
        const response = await withRetry(async () => {
            return ai.models.generateContent({
                model: 'gemini-3-pro-image-preview',
                contents: { parts: [{ text: prompt }] },
                config: { imageConfig: { aspectRatio: "9:16", imageSize: "1K" } },
            });
        }, 2, 3000, signal);
        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
                const base64Image = `data:image/png;base64,${part.inlineData.data}`;

                // Upload to Supabase Storage
                const { data: { user } } = await supabase.auth.getUser();
                const timestamp = Date.now();
                const imageFilename = `image_scene${sceneIndex}_${timestamp}.png`;

                try {
                    const publicUrl = await uploadImageToStorage(base64Image, imageFilename, user?.id);
                    console.log('Gemini Pro image uploaded to Supabase:', publicUrl);
                    return publicUrl;
                } catch (uploadError) {
                    console.error('Failed to upload Gemini Pro image:', uploadError);
                    return base64Image; // Fallback
                }
            }
        }
    } catch (e) { console.error("Gemini Image Gen failed", e); }
  }
  return undefined;
};

const generateGeminiTTS = async (text: string, sceneIndex: number, signal?: AbortSignal) => {
  const ai = getGeminiClient();
  try {
    const response = await withRetry(async () => {
        return ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
            },
        });
    }, 3, 2000, signal);

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      const sampleRate = 24000;
      const duration = atob(base64Audio).length / (sampleRate * 2);
      const wavBlob = pcmToWav(base64Audio, sampleRate);

      // Upload to Supabase Storage
      const { data: { user } } = await supabase.auth.getUser();
      const timestamp = Date.now();
      const audioFilename = `audio_scene${sceneIndex}_${timestamp}.wav`;

      try {
        // Convert blob URL to actual Blob
        const response = await fetch(wavBlob);
        const audioBlob = await response.blob();

        const publicUrl = await uploadAudioToStorage(audioBlob, audioFilename, user?.id);
        console.log('Gemini audio uploaded to Supabase:', publicUrl);
        return { url: publicUrl, duration };
      } catch (uploadError) {
        console.error('Failed to upload Gemini audio:', uploadError);
        return { url: wavBlob, duration }; // Fallback to blob URL
      }
    }
  } catch (e) { console.error("Gemini TTS Failed", e); }
  return undefined;
};

const getLanguageInstruction = (lang: VideoLanguage) => {
  switch (lang) {
    case 'pt-BR': return "Portuguese (Brazil)";
    case 'es-ES': return "Spanish";
    case 'en-US': default: return "English (USA)";
  }
};

// --- MAIN GENERATE FUNCTION (ROUTER) ---

export const generateScript = async (
  topic: string,
  language: VideoLanguage,
  onProgress?: (progress: number, status: string) => void,
  signal?: AbortSignal
): Promise<VideoScript> => {
  
  const provider = getProvider();
  
  // --- ROUTE TO OPENAI ---
  if (provider === 'openai') {
    const key = getApiKey('openai');
    if (!key) throw new Error("OpenAI API Key missing. Please set it in Settings.");
    onProgress?.(5, "Initializing OpenAI (GPT-4o + DALL-E 3)...");
    return generateOpenAIScript(topic, language, key, onProgress, signal);
  }

  // --- ROUTE TO GEMINI (Legacy Logic) ---
  const key = getApiKey('gemini');
  const ai = new GoogleGenAI({ apiKey: key });
  
  onProgress?.(5, `Initializing Gemini (${key.slice(-4)})...`);
  await new Promise(r => setTimeout(r, 800));

  const langName = getLanguageInstruction(language);
  onProgress?.(10, `Writing script in ${langName} with Gemini AI...`);

  const scriptPrompt = `Create a viral short-form video script (TikTok/Reels) about: "${topic}". 15-30s.
  
  CRITICAL: 
  1. Define a generic main character.
  2. The Narration Text ("text") MUST BE IN **${langName}**.
  3. Image Prompts ("imagePrompt") MUST BE IN ENGLISH (for generator compatibility).
  
  Return JSON: { characterDescription, scenes: [{ text, durationInSeconds, imagePrompt }], backgroundMusicMood }`;

  let script: VideoScript;
  try {
    const response = await withRetry(async () => {
        return ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: scriptPrompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                type: Type.OBJECT,
                properties: {
                    characterDescription: { type: Type.STRING },
                    scenes: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                        text: { type: Type.STRING },
                        durationInSeconds: { type: Type.NUMBER },
                        imagePrompt: { type: Type.STRING }
                        },
                        required: ["text", "durationInSeconds", "imagePrompt"]
                    }
                    },
                    backgroundMusicMood: { type: Type.STRING }
                },
                required: ["scenes", "backgroundMusicMood", "characterDescription"]
                }
            }
        });
    }, 3, 2000, signal);

    if (signal?.aborted) throw new Error("Cancelled");
    script = JSON.parse(response.text!) as VideoScript;
  } catch (error) {
    console.error("Script Gen Error", error);
    throw error;
  }

  // Gemini Asset Loop
  const scenesWithAssets: Scene[] = [];
  for (let i = 0; i < script.scenes.length; i++) {
    if (signal?.aborted) throw new Error("Cancelled");
    const scene = script.scenes[i];
    onProgress?.(10 + ((i / script.scenes.length) * 90), `Gemini Asset Gen ${i+1}/${script.scenes.length}...`);

    // We send prompts in English usually (enforced by script prompt), but if they come in mixed, Gemini Vision handles it.
    const imageUrl = await generateGeminiImage(
        `Vertical photo, 4k. Character: ${script.characterDescription}. Action: ${scene.imagePrompt}`, i, signal
    );

    if (signal?.aborted) throw new Error("Cancelled");

    const audioRes = await generateGeminiTTS(scene.text, i, signal);

    scenesWithAssets.push({
        ...scene,
        imageUrl,
        audioUrl: audioRes?.url,
        durationInSeconds: audioRes ? Math.max(scene.durationInSeconds, audioRes.duration + 0.5) : scene.durationInSeconds
    });

    if (i < script.scenes.length - 1) await new Promise(r => setTimeout(r, 1500));
  }

  return { ...script, scenes: scenesWithAssets };
};