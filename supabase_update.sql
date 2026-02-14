-- 1. Add video_url column to the table
ALTER TABLE social_videos ADD COLUMN IF NOT EXISTS video_url TEXT;

-- 2. Create a Storage Bucket for videos (if not exists)
-- Note: You might need to do this via Supabase Dashboard > Storage > Create Bucket "videos"
-- Make sure to set it as "Public" if you want to share links easily.

-- 3. Policy to allow uploads (Adjust as needed for security)
-- Allow authenticated users to upload to 'videos' bucket
-- CREATE POLICY "Allow Uploads" ON storage.objects FOR INSERT WITH CHECK ( bucket_id = 'videos' );
