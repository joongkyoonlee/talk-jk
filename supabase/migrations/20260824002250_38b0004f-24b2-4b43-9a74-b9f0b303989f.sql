CREATE OR REPLACE FUNCTION public.room_exists(p_room_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.rooms r WHERE r.id = p_room_id);
$$;

GRANT EXECUTE ON FUNCTION public.room_exists(uuid) TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "participants can post messages" ON public.messages;
CREATE POLICY "participants can post messages"
ON public.messages
FOR INSERT
TO anon, authenticated
WITH CHECK (
  public.room_exists(room_id)
  AND is_system = false
  AND char_length(COALESCE(body, '')) <= 8000
  AND char_length(nickname) <= 100
  AND role = ANY (ARRAY['instructor','student'])
  AND message_type = ANY (ARRAY['general','announcement'])
);

DROP POLICY IF EXISTS "participants can post opinions" ON public.opinions;
CREATE POLICY "participants can post opinions"
ON public.opinions
FOR INSERT
TO anon, authenticated
WITH CHECK (
  public.room_exists(room_id)
  AND char_length(body) >= 1
  AND char_length(body) <= 8000
  AND char_length(COALESCE(nickname, '')) <= 100
  AND role = ANY (ARRAY['instructor','student'])
);