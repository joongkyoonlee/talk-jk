CREATE OR REPLACE FUNCTION public.get_room_messages(p_room_id uuid, p_passcode text)
RETURNS SETOF public.messages LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.room_auth(p_room_id, p_passcode) THEN RAISE EXCEPTION 'unauthorized'; END IF;
  RETURN QUERY SELECT * FROM public.messages m WHERE m.room_id = p_room_id ORDER BY m.created_at ASC;
END; $$;

CREATE OR REPLACE FUNCTION public.get_room_opinions(p_room_id uuid, p_passcode text)
RETURNS SETOF public.opinions LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.room_auth(p_room_id, p_passcode) THEN RAISE EXCEPTION 'unauthorized'; END IF;
  RETURN QUERY SELECT * FROM public.opinions o WHERE o.room_id = p_room_id ORDER BY o.created_at DESC;
END; $$;

CREATE OR REPLACE FUNCTION public.get_room_poll_votes(p_room_id uuid, p_passcode text)
RETURNS SETOF public.poll_votes LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.room_auth(p_room_id, p_passcode) THEN RAISE EXCEPTION 'unauthorized'; END IF;
  RETURN QUERY SELECT v.* FROM public.poll_votes v JOIN public.polls p ON p.id = v.poll_id WHERE p.room_id = p_room_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.get_room_messages(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_room_opinions(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_room_poll_votes(uuid, text) TO anon, authenticated;

DROP POLICY IF EXISTS "messages readable" ON public.messages;
DROP POLICY IF EXISTS "opinions readable" ON public.opinions;
DROP POLICY IF EXISTS "poll_votes readable" ON public.poll_votes;