DROP TRIGGER IF EXISTS trg_seed_default_polls ON public.rooms;
DROP FUNCTION IF EXISTS public.on_room_created_seed_polls();
DROP FUNCTION IF EXISTS public.seed_default_polls_for_room(uuid);