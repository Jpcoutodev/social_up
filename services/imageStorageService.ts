// Image/Carousel storage tracking via localStorage

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

const STORAGE_KEY = 'socialup_saved_images';

function getAll(): SavedImage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveAll(items: SavedImage[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function getSavedImages(): SavedImage[] {
  return getAll().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function saveImage(item: Omit<SavedImage, 'id' | 'createdAt'>): SavedImage {
  const newItem: SavedImage = {
    ...item,
    id: `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };
  const all = getAll();
  all.push(newItem);
  saveAll(all);
  return newItem;
}

export function deleteImage(id: string): void {
  const all = getAll().filter(item => item.id !== id);
  saveAll(all);
}

export function getImageById(id: string): SavedImage | undefined {
  return getAll().find(item => item.id === id);
}
