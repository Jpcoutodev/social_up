-- ============================================
-- Create bucket for video assets (audio files)
-- ============================================

-- Create the bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('video-assets', 'video-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: Public read access for audio files
CREATE POLICY "Public read access for video assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'video-assets');

-- Policy: Authenticated users can upload audio files
CREATE POLICY "Authenticated users can upload video assets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'video-assets'
  AND auth.role() = 'authenticated'
);

-- Policy: Users can delete their own audio files
CREATE POLICY "Users can delete their own video assets"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'video-assets'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
