-- ============================================
-- Supabase Storage Configuration for Video Rendering
-- ============================================

-- 1. Add video_url column to the social_videos table
ALTER TABLE social_videos ADD COLUMN IF NOT EXISTS video_url TEXT;

-- 2. Create Storage Bucket for rendered videos
-- Note: This needs to be done via Supabase Dashboard > Storage > New Bucket
-- Bucket Name: rendered-videos
-- Public: YES (to allow direct video playback)
-- Allowed MIME types: video/mp4
--
-- OR use the insert below (requires storage permissions):
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'rendered-videos',
  'rendered-videos',
  true,
  524288000, -- 500MB limit per file
  ARRAY['video/mp4']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage Policies
-- ============================================

-- Policy: Public Read Access
-- Allows anyone to view/download videos (necessary for public sharing)
CREATE POLICY "Public read access for rendered videos"
ON storage.objects FOR SELECT
USING (bucket_id = 'rendered-videos');

-- Policy: Authenticated Upload
-- Allows authenticated users to upload videos
CREATE POLICY "Authenticated users can upload videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'rendered-videos');

-- Policy: Users can update their own videos
-- Allows users to update/replace their own videos
CREATE POLICY "Users can update own videos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'rendered-videos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can delete their own videos
-- Allows users to delete their own videos
CREATE POLICY "Users can delete own videos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'rendered-videos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- ============================================
-- Service Role Policy (for n8n backend)
-- ============================================
-- Note: Service role has full access by default
-- This is used by the n8n workflow to upload videos

-- ============================================
-- Verification Queries
-- ============================================
-- Run these to verify the setup:

-- Check if bucket exists:
-- SELECT * FROM storage.buckets WHERE id = 'rendered-videos';

-- Check policies:
-- SELECT * FROM pg_policies WHERE tablename = 'objects' AND policyname LIKE '%video%';

-- List all videos in bucket:
-- SELECT * FROM storage.objects WHERE bucket_id = 'rendered-videos' ORDER BY created_at DESC LIMIT 10;
