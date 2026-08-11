-- 1. Remove passcode column exposure via direct table SELECT
REVOKE SELECT ON public.rooms FROM anon, authenticated;
GRANT SELECT (id, title, room_name, host_nickname, notice, created_at) ON public.rooms TO anon, authenticated;
GRANT INSERT (title, room_name, host_nickname, passcode, notice) ON public.rooms TO anon, authenticated;
GRANT ALL ON public.rooms TO service_role;

-- 2. Lock down storage.objects for the room buckets
DROP POLICY IF EXISTS "room buckets public read" ON storage.objects;
DROP POLICY IF EXISTS "room buckets service write" ON storage.objects;
DROP POLICY IF EXISTS "room buckets service update" ON storage.objects;
DROP POLICY IF EXISTS "room buckets service delete" ON storage.objects;

CREATE POLICY "room buckets public read"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id IN ('room-images', 'room-files'));

CREATE POLICY "room buckets service write"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id IN ('room-images', 'room-files'));

CREATE POLICY "room buckets service update"
ON storage.objects FOR UPDATE
TO service_role
USING (bucket_id IN ('room-images', 'room-files'))
WITH CHECK (bucket_id IN ('room-images', 'room-files'));

CREATE POLICY "room buckets service delete"
ON storage.objects FOR DELETE
TO service_role
USING (bucket_id IN ('room-images', 'room-files'));