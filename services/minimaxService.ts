import { VideoScript, Scene, VideoLanguage } from "../types";
import { uploadAudioToStorage, uploadImageToStorage } from "../src/lib/supabase";
import { supabase } from "../src/lib/supabase";

const MINIMAX_BASE = "https://api.minimaxi.chat/v1";

const getLanguageInstruction = (lang: VideoLanguage) => {
  switch (lang) {
    case 'pt-BR': return "Portuguese (Brazil)";
    case 'es-ES': return "Spanish";
    case 'en-US': default: return "English (USA)";
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
  signal?: AbortSignal
): Promise<VideoScript> => {

  const langName = getLanguageInstruction(language);

  // 1. Script (MiniMax-Text-01)
  onProgress?.(10, `Writing script in ${langName} with MiniMax-Text-01...`);

  const systemPrompt = `You are an expert viral video scripter for TikTok/Reels.
Output strictly valid JSON with no markdown fences.

CRITICAL LANGUAGE REQUIREMENT:
The "text" field for narration MUST be written in **${langName}**.

Structure:
{
  "characterDescription": "string (in English for image gen compatibility)",
  "backgroundMusicMood": "string",
  "scenes": [
    {
      "text": "string (First person narration in ${langName}, max 15 words)",
      "durationInSeconds": number (min 2),
      "imagePrompt": "string (Visual description in English)"
    }
  ]
}`;

  const userPrompt = `Create a viral short video script about: "${topic}". 15-30 seconds total. Keep character generic. Return ONLY the JSON object.`;

  const scriptResponse = await fetchMinimax('/text/chatcompletion_v2', {
    model: "MiniMax-Text-01",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    response_format: { type: "json_object" },
    temperature: 0.8,
    max_tokens: 2048
  }, apiKey, signal);

  const rawContent: string = scriptResponse.choices?.[0]?.message?.content || '';
  const cleaned = rawContent.replace(/^```json\s*|\s*```$/g, '').trim();

  let script: VideoScript;
  try {
    script = JSON.parse(cleaned);
  } catch {
    throw new Error('MiniMax returned malformed JSON for the script.');
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

      const imgItem = imageResponse.data?.image_urls?.[0] || imageResponse.data?.[0]?.url;
      if (imgItem) {
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
            voice_setting: {
              voice_id: "male-qn-qingse",
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
        const hexAudio: string | undefined = ttsJson?.data?.audio;
        if (hexAudio) {
          const bytes = new Uint8Array(hexAudio.length / 2);
          for (let b = 0; b < bytes.length; b++) {
            bytes[b] = parseInt(hexAudio.substr(b * 2, 2), 16);
          }
          const blob = new Blob([bytes], { type: 'audio/mpeg' });

          const { data: { user } } = await supabase.auth.getUser();
          const timestamp = Date.now();
          const audioFilename = `audio_scene${i}_${timestamp}.mp3`;

          try {
            audioUrl = await uploadAudioToStorage(blob, audioFilename, user?.id);
            console.log('MiniMax audio uploaded to Supabase:', audioUrl);
          } catch (uploadError) {
            console.error('Failed to upload MiniMax audio:', uploadError);
            audioUrl = URL.createObjectURL(blob);
          }
          finalDuration = Math.max(scene.durationInSeconds, 2.0);
        }
      } catch (err) {
        console.error("MiniMax TTS failed:", err);
      }
    } else {
      console.warn('MiniMax: GroupId is missing — skipping TTS for this scene.');
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
