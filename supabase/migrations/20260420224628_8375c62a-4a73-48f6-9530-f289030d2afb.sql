
create extension if not exists pgcrypto;

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  room_name text not null,
  host_nickname text not null,
  passcode text not null unique,
  notice text default '',
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  nickname text not null,
  role text not null default 'student',
  client_id text,
  body text,
  message_type text not null default 'general',
  image_url text,
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_messages_room_id_created_at on public.messages(room_id, created_at);

create table if not exists public.opinions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  nickname text,
  role text not null default 'student',
  client_id text,
  category text default '질문',
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_opinions_room_id_created_at on public.opinions(room_id, created_at desc);

create table if not exists public.polls (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  question text not null,
  is_closed boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_polls_room_id_created_at on public.polls(room_id, created_at desc);

create table if not exists public.poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  option_text text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_poll_options_poll_id on public.poll_options(poll_id);

create table if not exists public.poll_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  poll_option_id uuid not null references public.poll_options(id) on delete cascade,
  voter_client_id text not null,
  created_at timestamptz not null default now(),
  unique (poll_id, voter_client_id)
);
create index if not exists idx_poll_votes_poll_id on public.poll_votes(poll_id);

alter table public.rooms enable row level security;
alter table public.messages enable row level security;
alter table public.opinions enable row level security;
alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes enable row level security;

do $$
declare
  t text;
  op text;
begin
  foreach t in array array['rooms','messages','opinions','polls','poll_options','poll_votes']
  loop
    foreach op in array array['select','insert','update','delete']
    loop
      execute format('drop policy if exists %I on public.%I', t || ' open ' || op, t);
      if op = 'select' then
        execute format('create policy %I on public.%I for select using (true)', t || ' open ' || op, t);
      elsif op = 'insert' then
        execute format('create policy %I on public.%I for insert with check (true)', t || ' open ' || op, t);
      elsif op = 'update' then
        execute format('create policy %I on public.%I for update using (true) with check (true)', t || ' open ' || op, t);
      else
        execute format('create policy %I on public.%I for delete using (true)', t || ' open ' || op, t);
      end if;
    end loop;
  end loop;
end$$;

alter table public.rooms replica identity full;
alter table public.messages replica identity full;
alter table public.opinions replica identity full;
alter table public.polls replica identity full;
alter table public.poll_options replica identity full;
alter table public.poll_votes replica identity full;

do $$
begin
  begin alter publication supabase_realtime add table public.rooms; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.messages; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.opinions; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.polls; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.poll_options; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.poll_votes; exception when duplicate_object then null; end;
end$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('room-images', 'room-images', true, 20971520, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public = true, file_size_limit = 20971520, allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif'];

drop policy if exists "room-images public read" on storage.objects;
drop policy if exists "room-images public insert" on storage.objects;
drop policy if exists "room-images public update" on storage.objects;
drop policy if exists "room-images public delete" on storage.objects;

create policy "room-images public read" on storage.objects for select using (bucket_id = 'room-images');
create policy "room-images public insert" on storage.objects for insert with check (bucket_id = 'room-images');
create policy "room-images public update" on storage.objects for update using (bucket_id = 'room-images') with check (bucket_id = 'room-images');
create policy "room-images public delete" on storage.objects for delete using (bucket_id = 'room-images');
