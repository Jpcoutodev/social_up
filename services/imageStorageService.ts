import { supabase } from '../src/lib/supabase';

export interface SavedImage {
  id: string;
  type: 'image' | 'carousel';
  createdAt: string;
  platform: string;
  topic: string;
  caption: string;
  hashtags: string;
  imageUrl: string;           // clean version
  imageWithTextUrl: string;   // with caption overlay
  // carousel-specific
  title?: string;
  slides?: {
    caption: string;
    imageUrl: string;
    imageWithTextUrl: string;
  }[];
}

export async function getSavedImages(): Promise<SavedImage[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('social_images')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching images:', error);
    return [];
  }

  // Map db snake_case to frontend camelCase
  return (data || []).map(row => ({
    id: row.id,
    type: row.type as 'image' | 'carousel',
    createdAt: row.created_at,
    platform: row.platform,
    topic: row.topic,
    caption: row.caption,
    hashtags: row.hashtags || '',
    imageUrl: row.image_url,
    imageWithTextUrl: row.image_with_text_url,
    title: row.title,
    slides: row.slides || undefined,
  }));
}

export async function saveImage(item: Omit<SavedImage, 'id' | 'createdAt'>): Promise<SavedImage> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const insertData = {
    user_id: user.id,
    type: item.type,
    platform: item.platform,
    topic: item.topic,
    caption: item.caption,
    hashtags: item.hashtags,
    image_url: item.imageUrl,
    image_with_text_url: item.imageWithTextUrl,
    title: item.title,
    slides: item.slides,
  };

  const { data, error } = await supabase
    .from('social_images')
    .insert([insertData])
    .select()
    .single();

  if (error) {
    console.error('Error saving image:', error);
    throw new Error('Failed to save image');
  }

  return {
    id: data.id,
    type: data.type as 'image' | 'carousel',
    createdAt: data.created_at,
    platform: data.platform,
    topic: data.topic,
    caption: data.caption,
    hashtags: data.hashtags || '',
    imageUrl: data.image_url,
    imageWithTextUrl: data.image_with_text_url,
    title: data.title,
    slides: data.slides,
  };
}

export async function deleteImage(id: string): Promise<void> {
  const { error } = await supabase
    .from('social_images')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting image:', error);
    throw new Error('Failed to delete image');
  }
}

export async function getImageById(id: string): Promise<SavedImage | undefined> {
  const { data, error } = await supabase
    .from('social_images')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return undefined;

  return {
    id: data.id,
    type: data.type as 'image' | 'carousel',
    createdAt: data.created_at,
    platform: data.platform,
    topic: data.topic,
    caption: data.caption,
    hashtags: data.hashtags || '',
    imageUrl: data.image_url,
    imageWithTextUrl: data.image_with_text_url,
    title: data.title,
    slides: data.slides,
  };
}
