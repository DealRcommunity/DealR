-- Dealr : base de données à créer une seule fois
-- Supabase > SQL Editor > New query > collez tout ce fichier > Run

-- 0. Administrateurs (gestion des litiges)
--    La liste est modifiable uniquement ici, dans l'éditeur SQL de Supabase : aucun membre
--    ne peut se déclarer administrateur depuis le site.
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;  -- aucune règle : illisible depuis le site

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.admins where user_id = auth.uid()) $$;
grant execute on function public.is_admin() to authenticated;

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

-- Les participants d'une conversation ne peuvent jamais être remplacés
create or replace function public.conversations_guard() returns trigger
language plpgsql as $$
begin
  if new.id <> old.id or new.user_a <> old.user_a or new.user_b <> old.user_b then
    raise exception 'Les participants d''une conversation ne peuvent pas changer';
  end if;
  return new;
end $$;

drop trigger if exists conversations_guard on public.conversations;
create trigger conversations_guard before update on public.conversations
  for each row execute function public.conversations_guard();

create table if not exists public.messages (
  id text primary key,
  conv text not null references public.conversations(id) on delete cascade,
  sender uuid not null references auth.users(id) on delete cascade,
  text text not null check (char_length(text) between 1 and 2000),
  kind text not null default 'text' check (kind in ('text', 'deal', 'event', 'admin')),
  deal text,
  created_at timestamptz not null default now()
);
alter table public.messages add column if not exists kind text not null default 'text';
alter table public.messages add column if not exists deal text;
alter table public.messages drop constraint if exists messages_kind_check;
alter table public.messages add constraint messages_kind_check check (kind in ('text', 'deal', 'event', 'admin'));
alter table public.messages enable row level security;

drop policy if exists "Lire les messages de ses conversations" on public.messages;
create policy "Lire les messages de ses conversations"
  on public.messages for select to authenticated
  using (exists (select 1 from public.conversations c where c.id = conv and auth.uid() in (c.user_a, c.user_b)));

drop policy if exists "Écrire dans ses conversations" on public.messages;
create policy "Écrire dans ses conversations"
  on public.messages for insert to authenticated
  with check (sender = auth.uid() and kind <> 'admin'
              and exists (select 1 from public.conversations c where c.id = conv and auth.uid() in (c.user_a, c.user_b)));

-- 4. Deals : proposés par un participant, acceptés par l'autre,
--    puis paiement bloqué au coffre jusqu'à la validation de la livraison
create table if not exists public.deals (
  id text primary key,
  conv text not null references public.conversations(id) on delete cascade,
  proposer uuid not null references auth.users(id) on delete cascade,
  payer uuid not null references auth.users(id) on delete cascade,
  payee uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 140),
  amount numeric(10, 2) not null check (amount >= 1 and amount <= 100000),
  deadline date,
  details text check (char_length(details) <= 1000),
  status text not null default 'proposed'
    check (status in ('proposed', 'accepted', 'declined', 'cancelled', 'countered', 'funded', 'delivered', 'released', 'disputed', 'refunded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  accepted_at timestamptz,
  funded_at timestamptz,
  delivered_at timestamptz,
  released_at timestamptz,
  disputed_at timestamptz,
  refunded_at timestamptz,
  check (payer <> payee),
  check (proposer in (payer, payee))
);
alter table public.deals add column if not exists disputed_at timestamptz;
alter table public.deals add column if not exists refunded_at timestamptz;
alter table public.deals drop constraint if exists deals_status_check;
alter table public.deals add constraint deals_status_check
  check (status in ('proposed', 'accepted', 'declined', 'cancelled', 'countered', 'funded', 'delivered', 'released', 'disputed', 'refunded'));
alter table public.deals enable row level security;

drop policy if exists "Voir les deals de ses conversations" on public.deals;
create policy "Voir les deals de ses conversations"
  on public.deals for select to authenticated
  using (exists (select 1 from public.conversations c where c.id = conv and auth.uid() in (c.user_a, c.user_b)));

drop policy if exists "Proposer un deal" on public.deals;
create policy "Proposer un deal"
  on public.deals for insert to authenticated
  with check (
    proposer = auth.uid() and status = 'proposed'
    and exists (select 1 from public.conversations c
                where c.id = conv and payer in (c.user_a, c.user_b) and payee in (c.user_a, c.user_b))
  );

drop policy if exists "Faire avancer un deal" on public.deals;
create policy "Faire avancer un deal"
  on public.deals for update to authenticated
  using (auth.uid() in (payer, payee)) with check (auth.uid() in (payer, payee));

-- Seul le statut peut changer, et uniquement dans l'ordre prévu, par la bonne personne.
-- IMPORTANT pour la version réelle : le passage à 'funded' (argent au coffre) devra être fait
-- par le serveur une fois le paiement confirmé par le prestataire de paiement (ex. webhook Stripe),
-- et non par le navigateur du client. Ici, le paiement est simulé.
create or replace function public.deals_guard() returns trigger
language plpgsql as $$
declare me uuid := auth.uid();
begin
  if new.id <> old.id or new.conv <> old.conv or new.proposer <> old.proposer
     or new.payer <> old.payer or new.payee <> old.payee or new.title <> old.title
     or new.amount <> old.amount or new.deadline is distinct from old.deadline
     or new.details is distinct from old.details or new.created_at <> old.created_at then
    raise exception 'Seul le statut d''un deal peut changer';
  end if;
  if new.status = old.status then
    return new;
  end if;
  if me is not null and not (
       (old.status = 'proposed'  and new.status in ('accepted', 'declined', 'countered') and me <> old.proposer)
    or (old.status = 'proposed'  and new.status = 'cancelled' and me = old.proposer)
    or (old.status = 'accepted'  and new.status = 'cancelled')
    or (old.status = 'accepted'  and new.status = 'funded'    and me = old.payer)
    or (old.status = 'funded'    and new.status = 'delivered' and me = old.payee)
    or (old.status in ('funded', 'delivered') and new.status = 'disputed' and me = old.payer)
    or (old.status = 'delivered' and new.status = 'released'  and me = old.payer)
    or (old.status = 'disputed'  and new.status in ('released', 'refunded') and public.is_admin())
  ) then
    raise exception 'Changement de statut non autorisé';
  end if;
  new.updated_at := now();
  if new.status = 'accepted'  then new.accepted_at  := now(); end if;
  if new.status = 'funded'    then new.funded_at    := now(); end if;
  if new.status = 'delivered' then new.delivered_at := now(); end if;
  if new.status = 'released'  then new.released_at  := now(); end if;
  if new.status = 'disputed'  then new.disputed_at  := now(); end if;
  if new.status = 'refunded'  then new.refunded_at  := now(); end if;
  return new;
end $$;

drop trigger if exists deals_guard on public.deals;
create trigger deals_guard before update on public.deals
  for each row execute function public.deals_guard();

-- 5. Accès de l'équipe Dealr (administrateurs) pour traiter les litiges
drop policy if exists "Admins : voir les conversations" on public.conversations;
create policy "Admins : voir les conversations"
  on public.conversations for select to authenticated using (public.is_admin());

drop policy if exists "Admins : mettre à jour les conversations" on public.conversations;
create policy "Admins : mettre à jour les conversations"
  on public.conversations for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins : lire les messages" on public.messages;
create policy "Admins : lire les messages"
  on public.messages for select to authenticated using (public.is_admin());

drop policy if exists "Admins : écrire au nom de l'équipe Dealr" on public.messages;
create policy "Admins : écrire au nom de l'équipe Dealr"
  on public.messages for insert to authenticated
  with check (public.is_admin() and sender = auth.uid() and kind = 'admin');

drop policy if exists "Admins : voir les deals" on public.deals;
create policy "Admins : voir les deals"
  on public.deals for select to authenticated using (public.is_admin());

drop policy if exists "Admins : trancher un litige" on public.deals;
create policy "Admins : trancher un litige"
  on public.deals for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- 6. Vous désigner administrateur.
--    Créez d'abord votre compte sur le site, puis exécutez (ou ré-exécutez) cette ligne
--    en remplaçant l'adresse si besoin :
insert into public.admins (user_id)
  select id from auth.users where email = 'alexisguillory091@gmail.com'
  on conflict do nothing;
