-- Add file attachment columns to messages
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS file_url TEXT,
  ADD COLUMN IF NOT EXISTS file_name TEXT,
  ADD COLUMN IF NOT EXISTS file_size BIGINT,
  ADD COLUMN IF NOT EXISTS file_mime TEXT;

-- Create public bucket for general file attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('room-files', 'room-files', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for room-files (public read, open upload/delete to match existing app model)
CREATE POLICY "room-files public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'room-files');

CREATE POLICY "room-files open insert"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'room-files');

CREATE POLICY "room-files open update"
ON storage.objects FOR UPDATE
USING (bucket_id = 'room-files');

CREATE POLICY "room-files open delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'room-files');