-- Remove direct table access to rooms (passcode column protection)
DROP POLICY IF EXISTS "rooms readable" ON public.rooms;
DROP POLICY IF EXISTS "anyone can create a room" ON public.rooms;

REVOKE ALL ON public.rooms FROM anon, authenticated;
GRANT ALL ON public.rooms TO service_role;

-- Safe room fetch: requires passcode, never returns it
CREATE OR REPLACE FUNCTION public.get_room(p_room_id uuid, p_passcode text)
RETURNS TABLE(id uuid, title text, room_name text, host_nickname text, notice text, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id, r.title, r.room_name, r.host_nickname, r.notice, r.created_at
  FROM public.rooms r
  WHERE r.id = p_room_id AND r.passcode = p_passcode;
$$;

-- Room creation via function only
CREATE OR REPLACE FUNCTION public.create_room(p_title text, p_room_name text, p_host_nickname text)
RETURNS TABLE(id uuid, title text, room_name text, host_nickname text, notice text, created_at timestamptz, passcode text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pass text;
BEGIN
  IF char_length(coalesce(p_title,'')) < 1 OR char_length(p_title) > 300
     OR char_length(coalesce(p_room_name,'')) < 1 OR char_length(p_room_name) > 300
     OR char_length(coalesce(p_host_nickname,'')) < 1 OR char_length(p_host_nickname) > 100 THEN
    RAISE EXCEPTION 'invalid input';
  END IF;

  v_pass := lpad((floor(random() * 10000))::int::text, 4, '0');

  INSERT INTO public.rooms (title, room_name, host_nickname, passcode, notice)
  VALUES (p_title, p_room_name, p_host_nickname, v_pass, '')
  RETURNING rooms.id, rooms.title, rooms.room_name, rooms.host_nickname, rooms.notice, rooms.created_at, rooms.passcode
  INTO id, title, room_name, host_nickname, notice, created_at, passcode;

  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_room(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_room(text, text, text) TO anon, authenticated;