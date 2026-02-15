import { VideoScript, Scene, VideoLanguage } from "../types";
import { uploadAudioToStorage } from "../src/lib/supabase";
import { supabase } from "../src/lib/supabase";

// Helper to handle Fetch with AbortSignal
const fetchOpenAI = async (endpoint: string, body: any, apiKey: string, signal?: AbortSignal) => {
  const response = await fetch(`https://api.openai.com/v1${endpoint}`, {
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
    throw new Error(`OpenAI Error (${response.status}): ${errorData.error?.message || response.statusText}`);
  }

  return response.json();
};

const getLanguageInstruction = (lang: VideoLanguage) => {
  switch (lang) {
    case 'pt-BR': return "Portuguese (Brazil)";
    case 'es-ES': return "Spanish";
    case 'en-US': default: return "English (USA)";
  }
};

export const generateOpenAIScript = async (
  topic: string,
  language: VideoLanguage,
  apiKey: string,
  onProgress?: (progress: number, status: string) => void,
  signal?: AbortSignal
): Promise<VideoScript> => {
  
  const langName = getLanguageInstruction(language);

  // 1. Script Generation (GPT-4o)
  onProgress?.(10, `Writing script in ${langName} with GPT-4o...`);

  const systemPrompt = `You are an expert viral video scripter for TikTok/Reels.
  Output strictly in JSON format.
  
  CRITICAL LANGUAGE REQUIREMENT:
  The "text" field for narration MUST be written in **${langName}**.
  
  Structure requirements:
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

  const userPrompt = `Create a viral short video script about: "${topic}". 15-30 seconds total. Keep character generic.`;

  const scriptResponse = await fetchOpenAI('/chat/completions', {
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    response_format: { type: "json_object" }
  }, apiKey, signal);

  const scriptContent = scriptResponse.choices[0].message.content;
  const script: VideoScript = JSON.parse(scriptContent);

  // 2. Asset Generation
  const totalScenes = script.scenes.length;
  const scenesWithAssets: Scene[] = [];

  for (let i = 0; i < totalScenes; i++) {
    if (signal?.aborted) throw new Error("Cancelled by user");
    
    const scene = script.scenes[i];
    const progressBase = 10;
    const progressChunk = 90 / totalScenes;
    const currentProgress = progressBase + (i * progressChunk);
    
    onProgress?.(Math.round(currentProgress), `Generating Scene ${i + 1}/${totalScenes} (DALL-E 3 & TTS)...`);

    // A. Image Generation (DALL-E 3)
    let imageUrl: string | undefined;
    try {
      // DALL-E 3 specifically requests 1024x1792 for vertical images
      const imageResponse = await fetchOpenAI('/images/generations', {
        model: "dall-e-3",
        prompt: `Vertical aspect ratio 9:16. Photorealistic, cinematic 4k lighting. Main Character: ${script.characterDescription}. Action: ${scene.imagePrompt}. High detail, no text overlays.`,
        n: 1,
        size: "1024x1792", 
        response_format: "b64_json",
        quality: "standard" // 'hd' is more expensive, standard is usually fine for video background
      }, apiKey, signal);
      
      if (imageResponse.data?.[0]?.b64_json) {
        imageUrl = `data:image/png;base64,${imageResponse.data[0].b64_json}`;
      }
    } catch (err) {
      console.error("DALL-E 3 failed:", err);
      // Fallback or empty image handled by UI
    }

    if (signal?.aborted) throw new Error("Cancelled by user");

    // B. Audio Generation (TTS-1)
    let audioUrl: string | undefined;
    let finalDuration = scene.durationInSeconds;

    try {
        const ttsResponse = await fetch(`https://api.openai.com/v1/audio/speech`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "tts-1",
                input: scene.text,
                voice: "onyx" // Deep, narration voice
            }),
            signal
        });

        if (ttsResponse.ok) {
            const arrayBuffer = await ttsResponse.arrayBuffer();
            const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' });

            // Upload audio to Supabase Storage instead of creating blob URL
            const { data: { user } } = await supabase.auth.getUser();
            const timestamp = Date.now();
            const audioFilename = `audio_scene${i}_${timestamp}.mp3`;

            try {
                audioUrl = await uploadAudioToStorage(blob, audioFilename, user?.id);
                console.log('Audio uploaded to Supabase:', audioUrl);
            } catch (uploadError) {
                console.error('Failed to upload audio to Supabase:', uploadError);
                // Fallback to blob URL if upload fails
                audioUrl = URL.createObjectURL(blob);
                console.warn('Using blob URL as fallback (will not work for server-side rendering)');
            }

            // OpenAI TTS-1 speed is roughly consistent but we fallback to script estimation if needed
            // Ideally we'd decode the MP3 duration here but that requires AudioContext which is async/browser specific
            // We use a safe padding strategy
            finalDuration = Math.max(scene.durationInSeconds, 2.0);
        }
    } catch (err) {
        console.error("OpenAI TTS failed:", err);
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