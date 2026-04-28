import { VideoScript, Scene, VideoLanguage } from "../types";
import { uploadAudioToStorage, uploadImageToStorage } from "../src/lib/supabase";
import { supabase } from "../src/lib/supabase";
import { callMinimax } from "../src/lib/aiProxy";

const getLanguageInstruction = (lang: VideoLanguage) => {
  switch (lang) {
    case 'pt-BR': return "Portuguese (Brazil)";
    case 'es-ES': return "Spanish";
    case 'en-US': default: return "English (USA)";
  }
};

const extractJson = (text: string): string => {
  let s = text.trim().replace(/```json\s*/gi, '').replace(/```/g, '').trim();
  const first = s.indexOf('{');
  const last = s.lastIndexOf('}');
  if (first !== -1 && last > first) s = s.slice(first, last + 1);
  return s;
};

export const generateMinimaxScript = async (
  topic: string,
  language: VideoLanguage,
  onProgress?: (progress: number, status: string) => void,
  signal?: AbortSignal
): Promise<VideoScript> => {

  const langName = getLanguageInstruction(language);

  // 1. Script
  onProgress?.(10, `Writing script in ${langName} with MiniMax-Text-01...`);

  const systemPrompt = `You are a JSON-only API. You MUST respond with a single valid JSON object and NOTHING else. No markdown, no code fences, no prose, no explanations. Your entire response must be parseable by JSON.parse().`;

  const userPrompt = `Create a viral short video script (TikTok/Reels) about: "${topic}". 15-30 seconds total. Keep the main character generic.

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

  if (signal?.aborted) throw new Error("Cancelled by user");

  const scriptResponse = await callMinimax({
    action: 'chat',
    payload: {
      model: "MiniMax-Text-01",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.6,
      max_tokens: 2048
    },
    metadata: { feature: 'video_script', topic: topic.slice(0, 80) }
  });

  const rawContent: string = scriptResponse.choices?.[0]?.message?.content || '';
  console.log('[MiniMax] Raw script response:', rawContent);

  let script: VideoScript;
  try {
    script = JSON.parse(extractJson(rawContent));
  } catch {
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
      const imageResponse = await callMinimax({
        action: 'image',
        payload: {
          model: "image-01",
          prompt: `Vertical 9:16 aspect ratio, photorealistic cinematic 4k. Main character: ${script.characterDescription}. Action: ${scene.imagePrompt}. High detail, no text overlays.`,
          aspect_ratio: "9:16",
          n: 1,
          response_format: "url"
        },
        metadata: { feature: 'video_scene_image', scene_index: i }
      });

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
        } catch (uploadError) {
          console.error('Failed to upload MiniMax image, using direct URL:', uploadError);
          imageUrl = imgItem;
        }
      }
    } catch (err) {
      console.error("MiniMax image-01 failed:", err);
    }

    if (signal?.aborted) throw new Error("Cancelled by user");

    // B. Audio (speech-02-hd)
    let audioUrl: string | undefined;
    let finalDuration = scene.durationInSeconds;

    try {
      const ttsJson = await callMinimax({
        action: 'tts',
        payload: {
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
        },
        metadata: { feature: 'video_scene_tts', scene_index: i }
      });

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
        } catch (uploadError) {
          console.error('Failed to upload MiniMax audio:', uploadError);
          audioUrl = URL.createObjectURL(blob);
        }
        finalDuration = Math.max(scene.durationInSeconds, 2.0);
      }
    } catch (err) {
      console.error("MiniMax TTS failed:", err);
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
