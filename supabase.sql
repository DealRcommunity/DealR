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
