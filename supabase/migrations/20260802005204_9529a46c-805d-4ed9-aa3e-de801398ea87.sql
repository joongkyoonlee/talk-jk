-- Remove blanket PUBLIC execute rights from all SECURITY DEFINER functions
REVOKE ALL ON FUNCTION public.room_auth(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.join_room(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_room_notice(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_room_message(uuid, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_room_poll(uuid, text, text, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_poll_closed(uuid, text, uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_room_poll(uuid, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cast_room_vote(uuid, text, uuid, uuid, text) FROM PUBLIC;

-- Internal helper: trusted server code only
GRANT EXECUTE ON FUNCTION public.room_auth(uuid, text) TO service_role;

-- Explicit grants for the passcode-guarded room actions the app must call
GRANT EXECUTE ON FUNCTION public.join_room(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_room_notice(uuid, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_room_message(uuid, text, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_room_poll(uuid, text, text, text[]) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_poll_closed(uuid, text, uuid, boolean) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_room_poll(uuid, text, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cast_room_vote(uuid, text, uuid, uuid, text) TO anon, authenticated, service_role;