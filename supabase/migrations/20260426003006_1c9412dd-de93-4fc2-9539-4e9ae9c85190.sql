-- Function to seed default "진행 체크" poll for a room
CREATE OR REPLACE FUNCTION public.seed_default_polls_for_room(_room_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  poll1_id uuid;
  poll2_id uuid;
BEGIN
  -- Skip if already has a poll
  IF EXISTS (SELECT 1 FROM public.polls WHERE room_id = _room_id) THEN
    RETURN;
  END IF;

  -- Poll 1: 이해도 체크
  INSERT INTO public.polls (room_id, question, is_closed)
  VALUES (_room_id, '잘 따라오고 있나요?', false)
  RETURNING id INTO poll1_id;

  INSERT INTO public.poll_options (poll_id, option_text) VALUES
    (poll1_id, '이해했어요!'),
    (poll1_id, '천천히요'),
    (poll1_id, '못 따라가요');

  -- Poll 2: 진도 속도
  INSERT INTO public.polls (room_id, question, is_closed)
  VALUES (_room_id, '강의 속도는 어떤가요?', false)
  RETURNING id INTO poll2_id;

  INSERT INTO public.poll_options (poll_id, option_text) VALUES
    (poll2_id, '딱 좋아요'),
    (poll2_id, '조금 빨라요'),
    (poll2_id, '조금 느려요');
END;
$$;

-- Trigger function on rooms insert
CREATE OR REPLACE FUNCTION public.on_room_created_seed_polls()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.seed_default_polls_for_room(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_default_polls ON public.rooms;
CREATE TRIGGER trg_seed_default_polls
AFTER INSERT ON public.rooms
FOR EACH ROW EXECUTE FUNCTION public.on_room_created_seed_polls();

-- Backfill: seed for existing rooms that have no polls yet
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id FROM public.rooms LOOP
    PERFORM public.seed_default_polls_for_room(r.id);
  END LOOP;
END $$;