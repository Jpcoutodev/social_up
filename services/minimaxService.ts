import { VideoScript, Scene, VideoLanguage } from "../types";
import { uploadAudioToStorage, uploadImageToStorage } from "../src/lib/supabase";
import { supabase } from "../src/lib/supabase";
import { getBrandPrompt } from "./geminiService";

const MINIMAX_BASE = "https://api.minimaxi.chat/v1";

const getLanguageInstruction = (lang: VideoLanguage) => {
  switch (lang) {
    case 'pt-BR': return "Portuguese (Brazil)";
    case 'es-ES': return "Spanish";
    case 'en-US': default: return "English (USA)";
  }
};

/** Maps the app language to the correct MiniMax voice_id and language_boost */
const getMinimaxVoiceConfig = (lang: VideoLanguage) => {
  switch (lang) {
    case 'pt-BR':
      return { voice_id: "Portuguese_ConfidentWoman", language_boost: "Portuguese" };
    case 'es-ES':
      return { voice_id: "Spanish_SophiaConfident", language_boost: "Spanish" };
    case 'en-US':
    default:
      return { voice_id: "English_ConfidentWoman", language_boost: "English" };
  }
};

const fetchMinimax = async (endpoint: string, body: any, apiKey: string, signal?: AbortSignal) => {
  const response = await fetch(`${MINIMAX_BASE}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(body),
    signal
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`MiniMax Error (${response.status}): ${errorData.base_resp?.status_msg || errorData.error?.message || response.statusText}`);
  }

  return response.json();
};

export const checkMinimaxConnection = async (apiKey: string): Promise<{ success: boolean; message: string }> => {
  try {
    const res = await fetch(`${MINIMAX_BASE}/text/chatcompletion_v2`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "MiniMax-Text-01",
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 5
      })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.base_resp?.status_msg || `HTTP ${res.status}`);
    }
    return { success: true, message: "Connected to MiniMax (Text-01)" };
  } catch (e: any) {
    return { success: false, message: e.message || "MiniMax connection failed" };
  }
};

export const generateMinimaxScript = async (
  topic: string,
  language: VideoLanguage,
  apiKey: string,
  groupId: string,
  onProgress?: (progress: number, status: string) => void,
  signal?: AbortSignal,
  customVoiceId?: string
): Promise<VideoScript> => {

  const langName = getLanguageInstruction(language);
  const voiceConfig = getMinimaxVoiceConfig(language);

  // Override voice_id if user set a custom one
  if (customVoiceId) {
    voiceConfig.voice_id = customVoiceId;
    console.log(`[MiniMax] Using custom voice_id: "${customVoiceId}"`);
  }

  // 1. Script (MiniMax-Text-01)
  onProgress?.(10, `Writing script in ${langName} with MiniMax-Text-01...`);

  const systemPrompt = `You are a JSON-only API. You MUST respond with a single valid JSON object and NOTHING else. No markdown, no code fences, no prose, no explanations. Your entire response must be parseable by JSON.parse().`;

  const brandPrompt = getBrandPrompt();

  const userPrompt = `Topic: "${topic}"
${brandPrompt ? `\nBRAND GUIDELINES (follow strictly):\n${brandPrompt}\n` : ''}
Create a highly engaging, viral short video script (TikTok/Reels) based on the topic above. 15-30 seconds total.
CRITICAL: Do NOT just literally repeat or narrate the topic as a factual statement. Instead, craft a creative story, an engaging hook, or a natural narrative around the topic. Make it sound like a real person talking naturally (e.g., a vlog, a storytime, or a fun observation).

Keep the main character generic.
The "text" field for narration MUST be written in ${langName}. The "imagePrompt" and "characterDescription" fields MUST be in English.

Respond with ONLY this JSON structure (no markdown, no fences, no extra text):
{
  "characterDescription": "string in English",
  "backgroundMusicMood": "string",
  "scenes": [
    {
      "text": "narration in ${langName}, max 15 words",
      "durationInSeconds": 3,
      "imagePrompt": "visual description in English"
    }
  ]
}`;

  const scriptResponse = await fetchMinimax('/text/chatcompletion_v2', {
    model: "MiniMax-Text-01",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    temperature: 0.6,
    max_tokens: 2048
  }, apiKey, signal);

  const rawContent: string = scriptResponse.choices?.[0]?.message?.content || '';
  console.log('[MiniMax] Raw script response:', rawContent);

  const extractJson = (text: string): string => {
    let s = text.trim();
    // strip markdown fences anywhere
    s = s.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
    // grab the substring from the first { to the last }
    const first = s.indexOf('{');
    const last = s.lastIndexOf('}');
    if (first !== -1 && last !== -1 && last > first) {
      s = s.slice(first, last + 1);
    }
    return s;
  };

  let script: VideoScript;
  try {
    script = JSON.parse(extractJson(rawContent));
  } catch (e) {
    console.error('[MiniMax] JSON parse failed. Raw content:', rawContent);
    throw new Error(`MiniMax returned malformed JSON for the script. First 200 chars: ${rawContent.slice(0, 200)}`);
  }

  if (!script?.scenes || !Array.isArray(script.scenes) || script.scenes.length === 0) {
    throw new Error('MiniMax returned a script without scenes.');
  }

  // 2. Asset generation per scene
  const totalScenes = script.scenes.length;
  const scenesWithAssets: Scene[] = [];

  for (let i = 0; i < totalScenes; i++) {
    if (signal?.aborted) throw new Error("Cancelled by user");

    const scene = script.scenes[i];
    const progressBase = 10;
    const progressChunk = 90 / totalScenes;
    const currentProgress = progressBase + (i * progressChunk);

    onProgress?.(Math.round(currentProgress), `Generating Scene ${i + 1}/${totalScenes} (image-01 & speech-02)...`);

    // A. Image (image-01)
    let imageUrl: string | undefined;
    try {
      const imageResponse = await fetchMinimax('/image_generation', {
        model: "image-01",
        prompt: `Vertical 9:16 aspect ratio, photorealistic cinematic 4k. Main character: ${script.characterDescription}. Action: ${scene.imagePrompt}. High detail, no text overlays.`,
        aspect_ratio: "9:16",
        n: 1,
        response_format: "url"
      }, apiKey, signal);

      let imgItem = imageResponse.data?.image_urls?.[0] || imageResponse.data?.[0]?.url;
      if (imgItem) {
        // Fix Mixed Content: MiniMax returns http:// URLs which are blocked on HTTPS sites
        if (imgItem.startsWith('http://')) {
          imgItem = imgItem.replace('http://', 'https://');
          console.log('[MiniMax] Converted image URL to HTTPS:', imgItem.slice(0, 80) + '...');
        }
        try {
          const imgRes = await fetch(imgItem);
          const imgBlob = await imgRes.blob();
          const reader = new FileReader();
          const base64Image: string = await new Promise((resolve, reject) => {
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(imgBlob);
          });

          const { data: { user } } = await supabase.auth.getUser();
          const timestamp = Date.now();
          const imageFilename = `image_scene${i}_${timestamp}.png`;
          imageUrl = await uploadImageToStorage(base64Image, imageFilename, user?.id);
          console.log('MiniMax image uploaded to Supabase:', imageUrl);
        } catch (uploadError) {
          console.error('Failed to upload MiniMax image, using direct URL:', uploadError);
          imageUrl = imgItem;
        }
      }
    } catch (err) {
      console.error("MiniMax image-01 failed:", err);
    }

    if (signal?.aborted) throw new Error("Cancelled by user");

    // B. Audio (speech-02-hd via t2a_v2 — requires GroupId)
    let audioUrl: string | undefined;
    let finalDuration = scene.durationInSeconds;

    if (groupId) {
      try {
        console.log(`[MiniMax TTS] Scene ${i + 1}: voice_id="${voiceConfig.voice_id}", language_boost="${voiceConfig.language_boost}", text="${scene.text.slice(0, 60)}..."`);
        const ttsRes = await fetch(`${MINIMAX_BASE}/t2a_v2?GroupId=${encodeURIComponent(groupId)}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: "speech-02-hd",
            text: scene.text,
            stream: false,
            language_boost: voiceConfig.language_boost,
            voice_setting: {
              voice_id: voiceConfig.voice_id,
              speed: 1.0,
              vol: 1.0,
              pitch: 0
            },
            audio_setting: {
              sample_rate: 32000,
              bitrate: 128000,
              format: "mp3",
              channel: 1
            }
          }),
          signal
        });

        if (!ttsRes.ok) {
          const e = await ttsRes.json().catch(() => ({}));
          throw new Error(e.base_resp?.status_msg || `TTS HTTP ${ttsRes.status}`);
        }

        const ttsJson = await ttsRes.json();
        
        // Check for API-level error (MiniMax can return HTTP 200 but with error in base_resp)
        if (ttsJson.base_resp && ttsJson.base_resp.status_code !== 0) {
          console.error(`[MiniMax TTS] API error: code=${ttsJson.base_resp.status_code}, msg="${ttsJson.base_resp.status_msg}"`);
          throw new Error(`MiniMax TTS API Error: ${ttsJson.base_resp.status_msg}`);
        }
        
        console.log(`[MiniMax TTS] Response keys: ${Object.keys(ttsJson).join(', ')}`);
        console.log(`[MiniMax TTS] data keys: ${ttsJson.data ? Object.keys(ttsJson.data).join(', ') : 'NO DATA FIELD'}`);
        
        const hexAudio: string | undefined = ttsJson?.data?.audio;
        console.log(`[MiniMax TTS] Audio hex length: ${hexAudio ? hexAudio.length : 'EMPTY/NULL'}`);
        
        if (hexAudio && hexAudio.length > 0) {
          const bytes = new Uint8Array(hexAudio.length / 2);
          for (let b = 0; b < bytes.length; b++) {
            bytes[b] = parseInt(hexAudio.substr(b * 2, 2), 16);
          }
          const blob = new Blob([bytes], { type: 'audio/mpeg' });
          console.log(`[MiniMax TTS] Audio blob size: ${blob.size} bytes`);

          // Calculate actual audio duration so narration is never cut off
          let audioDuration = 0;
          try {
            const tempUrl = URL.createObjectURL(blob);
            const audio = new Audio();
            audioDuration = await new Promise<number>((resolve) => {
              audio.addEventListener('loadedmetadata', () => {
                const dur = isFinite(audio.duration) ? audio.duration : 0;
                resolve(dur);
              });
              audio.addEventListener('error', () => resolve(0));
              // Fallback timeout in case metadata never loads
              setTimeout(() => resolve(0), 5000);
              audio.src = tempUrl;
            });
            URL.revokeObjectURL(tempUrl);
            console.log(`[MiniMax TTS] Measured audio duration: ${audioDuration.toFixed(2)}s (scene script: ${scene.durationInSeconds}s)`);
          } catch (durErr) {
            console.warn('[MiniMax TTS] Could not measure audio duration:', durErr);
          }

          const { data: { user } } = await supabase.auth.getUser();
          const timestamp = Date.now();
          const audioFilename = `audio_scene${i}_${timestamp}.mp3`;

          try {
            audioUrl = await uploadAudioToStorage(blob, audioFilename, user?.id);
            console.log('[MiniMax TTS] Audio uploaded to Supabase:', audioUrl);
          } catch (uploadError) {
            console.error('[MiniMax TTS] Failed to upload audio, using blob URL:', uploadError);
            audioUrl = URL.createObjectURL(blob);
          }

          // Use the LONGEST of: audio duration, script duration, or minimum 2s
          // Add 0.3s buffer so the last word is never clipped
          const effectiveAudioDuration = audioDuration > 0 ? audioDuration + 0.3 : 0;
          finalDuration = Math.max(scene.durationInSeconds, effectiveAudioDuration, 2.0);
          console.log(`[MiniMax TTS] Final scene duration: ${finalDuration.toFixed(2)}s`);
        } else {
          console.warn(`[MiniMax TTS] No audio data received! Full response:`, JSON.stringify(ttsJson).slice(0, 500));
        }
      } catch (err) {
        console.error("MiniMax TTS failed:", err);
      }
    } else {
      console.error('[MiniMax TTS] ❌ GroupId is MISSING — TTS narration will NOT be generated! Configure Group ID in Settings.');
      onProgress?.(Math.round(currentProgress), `⚠️ Scene ${i + 1}: GroupId missing — no narration!`);
    }

    scenesWithAssets.push({
      ...scene,
      imageUrl,
      audioUrl,
      durationInSeconds: finalDuration
    });
  }

  return {
    ...script,
    scenes: scenesWithAssets
  };
};
