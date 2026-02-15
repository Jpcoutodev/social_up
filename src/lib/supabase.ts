import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ============================================
// Video Storage Helpers
// ============================================

/**
 * Upload a video file to Supabase Storage
 * @param file - Buffer or Blob containing the video data
 * @param filename - Name for the video file (e.g., "my_video_123.mp4")
 * @param userId - Optional user ID to organize videos in folders
 * @returns Promise with the public URL of the uploaded video
 */
export async function uploadVideoToStorage(
  file: Buffer | Blob,
  filename: string,
  userId?: string
): Promise<string> {
  // Organize videos by user ID if provided
  const filePath = userId ? `${userId}/${filename}` : filename;

  const { data, error } = await supabase.storage
    .from('rendered-videos')
    .upload(filePath, file, {
      contentType: 'video/mp4',
      upsert: false, // Don't overwrite existing files
      cacheControl: '3600', // Cache for 1 hour
    });

  if (error) {
    console.error('Upload error:', error);
    throw new Error(`Failed to upload video: ${error.message}`);
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('rendered-videos')
    .getPublicUrl(data.path);

  return publicUrl;
}

/**
 * Delete a video from Supabase Storage
 * @param filePath - Path to the file in storage (e.g., "userId/video.mp4")
 * @returns Promise<void>
 */
export async function deleteVideoFromStorage(filePath: string): Promise<void> {
  const { error } = await supabase.storage
    .from('rendered-videos')
    .remove([filePath]);

  if (error) {
    console.error('Delete error:', error);
    throw new Error(`Failed to delete video: ${error.message}`);
  }
}

/**
 * Get a signed URL for a private video (if needed in future)
 * @param filePath - Path to the file in storage
 * @param expiresIn - Seconds until the URL expires (default: 1 hour)
 * @returns Promise with the signed URL
 */
export async function getSignedVideoUrl(
  filePath: string,
  expiresIn: number = 3600
): Promise<string> {
  const { data, error } = await supabase.storage
    .from('rendered-videos')
    .createSignedUrl(filePath, expiresIn);

  if (error) {
    console.error('Signed URL error:', error);
    throw new Error(`Failed to create signed URL: ${error.message}`);
  }

  return data.signedUrl;
}

/**
 * List all videos for a user
 * @param userId - User ID to list videos for
 * @returns Promise with array of video file objects
 */
export async function listUserVideos(userId: string) {
  const { data, error } = await supabase.storage
    .from('rendered-videos')
    .list(userId, {
      limit: 100,
      offset: 0,
      sortBy: { column: 'created_at', order: 'desc' },
    });

  if (error) {
    console.error('List error:', error);
    throw new Error(`Failed to list videos: ${error.message}`);
  }

  return data;
}

// ============================================
// Audio Storage Helpers
// ============================================

/**
 * Upload an audio file to Supabase Storage
 * @param file - Blob containing the audio data
 * @param filename - Name for the audio file (e.g., "audio_123.mp3")
 * @param userId - Optional user ID to organize audios in folders
 * @returns Promise with the public URL of the uploaded audio
 */
export async function uploadAudioToStorage(
  file: Blob,
  filename: string,
  userId?: string
): Promise<string> {
  // Organize audios by user ID if provided
  const filePath = userId ? `${userId}/${filename}` : filename;

  const { data, error } = await supabase.storage
    .from('video-assets')
    .upload(filePath, file, {
      contentType: 'audio/mpeg',
      upsert: false,
      cacheControl: '3600',
    });

  if (error) {
    console.error('Audio upload error:', error);
    throw new Error(`Failed to upload audio: ${error.message}`);
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('video-assets')
    .getPublicUrl(data.path);

  return publicUrl;
}

/**
 * Upload an image file to Supabase Storage
 * @param base64Data - Base64 encoded image data (with or without data: prefix)
 * @param filename - Name for the image file (e.g., "image_123.png")
 * @param userId - Optional user ID to organize images in folders
 * @returns Promise with the public URL of the uploaded image
 */
export async function uploadImageToStorage(
  base64Data: string,
  filename: string,
  userId?: string
): Promise<string> {
  // Remove data:image/png;base64, prefix if present
  const base64String = base64Data.replace(/^data:image\/\w+;base64,/, '');

  // Convert base64 to blob
  const byteCharacters = atob(base64String);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: 'image/png' });

  // Organize images by user ID if provided
  const filePath = userId ? `${userId}/${filename}` : filename;

  const { data, error } = await supabase.storage
    .from('video-assets')
    .upload(filePath, blob, {
      contentType: 'image/png',
      upsert: false,
      cacheControl: '3600',
    });

  if (error) {
    console.error('Image upload error:', error);
    throw new Error(`Failed to upload image: ${error.message}`);
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('video-assets')
    .getPublicUrl(data.path);

  return publicUrl;
}
