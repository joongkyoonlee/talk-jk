-- ============ ROOMS ============
DROP POLICY IF EXISTS "rooms open select" ON public.rooms;
DROP POLICY IF EXISTS "rooms open insert" ON public.rooms;
DROP POLICY IF EXISTS "rooms open update" ON public.rooms;
DROP POLICY IF EXISTS "rooms open delete" ON public.rooms;

CREATE POLICY "rooms readable" ON public.rooms
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "anyone can create a room" ON public.rooms
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    char_length(title) BETWEEN 1 AND 300
    AND char_length(room_name) BETWEEN 1 AND 300
    AND char_length(host_nickname) BETWEEN 1 AND 100
    AND passcode ~ '^[0-9]{4}$'
    AND char_length(coalesce(notice, '')) <= 2000
  );

-- Column level security: passcode must never be readable by clients
REVOKE ALL ON public.rooms FROM anon, authenticated;
GRANT SELECT (id, title, room_name, host_nickname, notice, created_at) ON public.rooms TO anon, authenticated;
GRANT INSERT (title, room_name, host_nickname, passcode, notice) ON public.rooms TO anon, authenticated;
GRANT ALL ON public.rooms TO service_role;

-- ============ MESSAGES ============
DROP POLICY IF EXISTS "messages open select" ON public.messages;
DROP POLICY IF EXISTS "messages open insert" ON public.messages;
DROP POLICY IF EXISTS "messages open update" ON public.messages;
DROP POLICY IF EXISTS "messages open delete" ON public.messages;

CREATE POLICY "messages readable" ON public.messages
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "participants can post messages" ON public.messages
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.rooms r WHERE r.id = room_id)
    AND is_system = false
    AND char_length(coalesce(body, '')) <= 8000
    AND char_length(nickname) <= 100
    AND role IN ('instructor', 'student')
    AND message_type IN ('general', 'announcement')
  );

REVOKE ALL ON public.messages FROM anon, authenticated;
GRANT SELECT, INSERT ON public.messages TO anon, authenticated;
GRANT ALL ON public.messages TO service_role;

-- ============ OPINIONS ============
DROP POLICY IF EXISTS "opinions open select" ON public.opinions;
DROP POLICY IF EXISTS "opinions open insert" ON public.opinions;
DROP POLICY IF EXISTS "opinions open update" ON public.opinions;
DROP POLICY IF EXISTS "opinions open delete" ON public.opinions;

CREATE POLICY "opinions readable" ON public.opinions
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "participants can post opinions" ON public.opinions
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.rooms r WHERE r.id = room_id)
    AND char_length(body) BETWEEN 1 AND 8000
    AND char_length(coalesce(nickname, '')) <= 100
    AND role IN ('instructor', 'student')
  );

REVOKE ALL ON public.opinions FROM anon, authenticated;
GRANT SELECT, INSERT ON public.opinions TO anon, authenticated;
GRANT ALL ON public.opinions TO service_role;

-- ============ POLLS / OPTIONS / VOTES ============
DROP POLICY IF EXISTS "polls open select" ON public.polls;
DROP POLICY IF EXISTS "polls open insert" ON public.polls;
DROP POLICY IF EXISTS "polls open update" ON public.polls;
DROP POLICY IF EXISTS "polls open delete" ON public.polls;
DROP POLICY IF EXISTS "poll_options open select" ON public.poll_options;
DROP POLICY IF EXISTS "poll_options open insert" ON public.poll_options;
DROP POLICY IF EXISTS "poll_options open update" ON public.poll_options;
DROP POLICY IF EXISTS "poll_options open delete" ON public.poll_options;
DROP POLICY IF EXISTS "poll_votes open select" ON public.poll_votes;
DROP POLICY IF EXISTS "poll_votes open insert" ON public.poll_votes;
DROP POLICY IF EXISTS "poll_votes open update" ON public.poll_votes;
DROP POLICY IF EXISTS "poll_votes open delete" ON public.poll_votes;

CREATE POLICY "polls readable" ON public.polls FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "poll_options readable" ON public.poll_options FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "poll_votes readable" ON public.poll_votes FOR SELECT TO anon, authenticated USING (true);

REVOKE ALL ON public.polls FROM anon, authenticated;
REVOKE ALL ON public.poll_options FROM anon, authenticated;
REVOKE ALL ON public.poll_votes FROM anon, authenticated;
GRANT SELECT ON public.polls TO anon, authenticated;
GRANT SELECT ON public.poll_options TO anon, authenticated;
GRANT SELECT ON public.poll_votes TO anon, authenticated;
GRANT ALL ON public.polls TO service_role;
GRANT ALL ON public.poll_options TO service_role;
GRANT ALL ON public.poll_votes TO service_role;

-- ============ PASSCODE-GATED SERVER SIDE OPERATIONS ============
CREATE OR REPLACE FUNCTION public.room_auth(p_room_id uuid, p_passcode text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.rooms r WHERE r.id = p_room_id AND r.passcode = p_passcode);
$$;
REVOKE ALL ON FUNCTION public.room_auth(uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.join_room(p_passcode text)
RETURNS TABLE (id uuid, title text, room_name text, host_nickname text, notice text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, r.title, r.room_name, r.host_nickname, r.notice, r.created_at
  FROM public.rooms r
  WHERE r.passcode = p_passcode
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.update_room_notice(p_room_id uuid, p_passcode text, p_notice text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.room_auth(p_room_id, p_passcode) THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF char_length(coalesce(p_notice, '')) > 2000 THEN RAISE EXCEPTION 'notice too long'; END IF;
  UPDATE public.rooms SET notice = coalesce(p_notice, '') WHERE id = p_room_id;
END; $$;

CREATE OR REPLACE FUNCTION public.delete_room_message(p_room_id uuid, p_passcode text, p_message_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.room_auth(p_room_id, p_passcode) THEN RAISE EXCEPTION 'unauthorized'; END IF;
  DELETE FROM public.messages WHERE id = p_message_id AND room_id = p_room_id;
END; $$;

CREATE OR REPLACE FUNCTION public.create_room_poll(p_room_id uuid, p_passcode text, p_question text, p_options text[])
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_poll_id uuid; v_opt text; v_count int := 0;
BEGIN
  IF NOT public.room_auth(p_room_id, p_passcode) THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF coalesce(char_length(btrim(p_question)), 0) = 0 OR char_length(p_question) > 500 THEN
    RAISE EXCEPTION 'invalid question';
  END IF;
  IF array_length(p_options, 1) IS NULL OR array_length(p_options, 1) < 2 OR array_length(p_options, 1) > 10 THEN
    RAISE EXCEPTION 'invalid options';
  END IF;
  INSERT INTO public.polls (room_id, question, is_closed) VALUES (p_room_id, btrim(p_question), false)
  RETURNING id INTO v_poll_id;
  FOREACH v_opt IN ARRAY p_options LOOP
    IF char_length(btrim(v_opt)) > 0 THEN
      IF char_length(v_opt) > 200 THEN RAISE EXCEPTION 'option too long'; END IF;
      INSERT INTO public.poll_options (poll_id, option_text) VALUES (v_poll_id, btrim(v_opt));
      v_count := v_count + 1;
    END IF;
  END LOOP;
  IF v_count < 2 THEN RAISE EXCEPTION 'invalid options'; END IF;
  RETURN v_poll_id;
END; $$;

CREATE OR REPLACE FUNCTION public.set_poll_closed(p_room_id uuid, p_passcode text, p_poll_id uuid, p_closed boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.room_auth(p_room_id, p_passcode) THEN RAISE EXCEPTION 'unauthorized'; END IF;
  UPDATE public.polls SET is_closed = p_closed WHERE id = p_poll_id AND room_id = p_room_id;
END; $$;

CREATE OR REPLACE FUNCTION public.delete_room_poll(p_room_id uuid, p_passcode text, p_poll_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.room_auth(p_room_id, p_passcode) THEN RAISE EXCEPTION 'unauthorized'; END IF;
  DELETE FROM public.poll_votes WHERE poll_id = p_poll_id;
  DELETE FROM public.poll_options WHERE poll_id = p_poll_id;
  DELETE FROM public.polls WHERE id = p_poll_id AND room_id = p_room_id;
END; $$;

CREATE OR REPLACE FUNCTION public.cast_room_vote(p_room_id uuid, p_passcode text, p_poll_id uuid, p_option_id uuid, p_client_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_closed boolean;
BEGIN
  IF NOT public.room_auth(p_room_id, p_passcode) THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF coalesce(char_length(p_client_id), 0) = 0 OR char_length(p_client_id) > 100 THEN
    RAISE EXCEPTION 'invalid client';
  END IF;
  SELECT p.is_closed INTO v_closed FROM public.polls p WHERE p.id = p_poll_id AND p.room_id = p_room_id;
  IF v_closed IS NULL THEN RAISE EXCEPTION 'poll not found'; END IF;
  IF v_closed THEN RAISE EXCEPTION 'poll closed'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.poll_options o WHERE o.id = p_option_id AND o.poll_id = p_poll_id) THEN
    RAISE EXCEPTION 'invalid option';
  END IF;
  IF EXISTS (SELECT 1 FROM public.poll_votes v WHERE v.poll_id = p_poll_id AND v.voter_client_id = p_client_id) THEN
    UPDATE public.poll_votes SET poll_option_id = p_option_id
    WHERE poll_id = p_poll_id AND voter_client_id = p_client_id;
  ELSE
    INSERT INTO public.poll_votes (poll_id, poll_option_id, voter_client_id)
    VALUES (p_poll_id, p_option_id, p_client_id);
  END IF;
END; $$;

GRANT EXECUTE ON FUNCTION public.join_room(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_room_notice(uuid, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_room_message(uuid, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_room_poll(uuid, text, text, text[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_poll_closed(uuid, text, uuid, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_room_poll(uuid, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cast_room_vote(uuid, text, uuid, uuid, text) TO anon, authenticated;

-- ============ STORAGE ============
-- Buckets stay public for read-through CDN delivery, but clients may no longer
-- list objects, overwrite them, delete them, or upload directly.
DROP POLICY IF EXISTS "room-files public read" ON storage.objects;
DROP POLICY IF EXISTS "room-files open insert" ON storage.objects;
DROP POLICY IF EXISTS "room-files open update" ON storage.objects;
DROP POLICY IF EXISTS "room-files open delete" ON storage.objects;
DROP POLICY IF EXISTS "room-images public read" ON storage.objects;
DROP POLICY IF EXISTS "room-images public insert" ON storage.objects;
DROP POLICY IF EXISTS "room-images public update" ON storage.objects;
DROP POLICY IF EXISTS "room-images public delete" ON storage.objects;

-- ============ REALTIME ============
-- The app only uses postgres_changes (guarded by table RLS); deny anonymous
-- broadcast/presence channel access by default.
DROP POLICY IF EXISTS "deny realtime channel access by default" ON realtime.messages;
CREATE POLICY "deny realtime channel access by default" ON realtime.messages
  FOR SELECT TO anon, authenticated USING (false);
