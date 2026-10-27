-- Dealr : base de données à créer une seule fois
-- Supabase > SQL Editor > New query > collez tout ce fichier > Run

-- 1. Profils des prestataires
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

drop policy if exists "Profils visibles par tous" on public.profiles;
create policy "Profils visibles par tous"
  on public.profiles for select using (true);

drop policy if exists "Créer son propre profil" on public.profiles;
create policy "Créer son propre profil"
  on public.profiles for insert to authenticated with check (auth.uid() = id);

drop policy if exists "Modifier son propre profil" on public.profiles;
create policy "Modifier son propre profil"
  on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Supprimer son propre profil" on public.profiles;
create policy "Supprimer son propre profil"
  on public.profiles for delete to authenticated using (auth.uid() = id);

-- 2. Devis et factures (privés : seul leur auteur peut les voir)
create table if not exists public.documents (
  id bigint generated always as identity primary key,
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  num text not null,
  type text not null check (type in ('devis', 'facture')),
  client text,
  ttc numeric,
  data jsonb not null,
  created_at timestamptz not null default now(),
  unique (owner, num)
);
alter table public.documents enable row level security;

drop policy if exists "Documents privés" on public.documents;
create policy "Documents privés"
  on public.documents for all to authenticated
  using (auth.uid() = owner) with check (auth.uid() = owner);

-- 3. Messagerie (visible uniquement par les deux participants)
create table if not exists public.conversations (
  id text primary key,
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  a_snap jsonb,
  b_snap jsonb,
  last_text text,
  last_sender uuid,
  read_a boolean not null default true,
  read_b boolean not null default true,
  updated_at timestamptz not null default now(),
  check (user_a < user_b)
);
alter table public.conversations enable row level security;

drop policy if exists "Voir ses conversations" on public.conversations;
create policy "Voir ses conversations"
  on public.conversations for select to authenticated using (auth.uid() in (user_a, user_b));

drop policy if exists "Créer ses conversations" on public.conversations;
create policy "Créer ses conversations"
  on public.conversations for insert to authenticated with check (auth.uid() in (user_a, user_b));

drop policy if exists "Mettre à jour ses conversations" on public.conversations;
create policy "Mettre à jour ses conversations"
  on public.conversations for update to authenticated
  using (auth.uid() in (user_a, user_b)) with check (auth.uid() in (user_a, user_b));

create table if not exists public.messages (
  id text primary key,
  conv text not null references public.conversations(id) on delete cascade,
  sender uuid not null references auth.users(id) on delete cascade,
  text text not null check (char_length(text) between 1 and 2000),
  created_at timestamptz not null default now()
);
alter table public.messages enable row level security;

drop policy if exists "Lire les messages de ses conversations" on public.messages;
create policy "Lire les messages de ses conversations"
  on public.messages for select to authenticated
  using (exists (select 1 from public.conversations c where c.id = conv and auth.uid() in (c.user_a, c.user_b)));

drop policy if exists "Écrire dans ses conversations" on public.messages;
create policy "Écrire dans ses conversations"
  on public.messages for insert to authenticated
  with check (sender = auth.uid() and exists (select 1 from public.conversations c where c.id = conv and auth.uid() in (c.user_a, c.user_b)));
