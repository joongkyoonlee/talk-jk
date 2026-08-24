GRANT EXECUTE ON FUNCTION public.create_room_poll(uuid, text, text, text[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cast_room_vote(uuid, text, uuid, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_poll_closed(uuid, text, uuid, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_room_poll(uuid, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_room_message(uuid, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_room_notice(uuid, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.join_room(text) TO anon, authenticated;