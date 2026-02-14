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

export type SocialProfile = {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
  updated_at: string;
};

export type SocialPost = {
  id: string;
  user_id: string;
  content: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
  author?: SocialProfile;
  likes_count?: number;
  comments_count?: number;
  user_has_liked?: boolean;
};

export type SocialComment = {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  author?: SocialProfile;
};

export type SocialLike = {
  id: string;
  post_id: string;
  user_id: string;
  created_at: string;
};