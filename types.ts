export type AIProvider = 'gemini' | 'openai';

export type VideoLanguage = 'pt-BR' | 'en-US' | 'es-ES';

export interface Scene {
  text: string;
  durationInSeconds: number;
  imagePrompt: string; // Specific visual description for this scene
  imageUrl?: string;   // The generated base64 image
  audioUrl?: string;   // The generated voiceover audio
}

export interface VideoScript {
  characterDescription: string; // Description of the recurring character
  scenes: Scene[];
  backgroundMusicMood: string;
}

export interface VideoCompositionProps {
  script: VideoScript;
}