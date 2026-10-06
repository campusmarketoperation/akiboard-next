-- =====================================================================
-- AkiBoard: Supabase Auth 移行 + RLS（行レベルセキュリティ）
--
-- Supabase ダッシュボード → SQL Editor に貼り付けて「Run」してください。
-- 実行したら、すぐにこのブランチの変更をデプロイしてください
-- （実行後は旧コードの「店舗コード+パスワード」ログインが動かなくなります）。
-- 何度実行しても壊れないように書いてあります。
-- =====================================================================

-- 1. 店舗と Auth ユーザーを紐づける列 ----------------------------------
alter table public.stores
  add column if not exists owner_id uuid references auth.users(id) on delete set null;

create unique index if not exists stores_owner_id_key on public.stores(owner_id);
create unique index if not exists stores_code_key on public.stores(code);

-- 2. 管理者テーブル -------------------------------------------------------
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- ログイン中ユーザーが所有する店舗コードか
create or replace function public.owns_store(p_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.stores where code = p_code and owner_id = auth.uid()
  );
$$;

-- 3. 既存店舗の引き継ぎ ---------------------------------------------------
-- 旧方式で登録済みの店舗は、同じメールアドレスで新規登録し、
-- メール確認を済ませると自動でその店舗に紐づきます。
create or replace function public.claim_store_by_email()
returns setof public.stores
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  select email into v_email
  from auth.users
  where id = auth.uid() and email_confirmed_at is not null;

  if v_email is null then
    return;
  end if;

  return query
  update public.stores
     set owner_id = auth.uid()
   where owner_id is null
     and lower(email) = lower(v_email)
     and not exists (select 1 from public.stores s2 where s2.owner_id = auth.uid())
  returning *;
end;
$$;

revoke all on function public.claim_store_by_email() from public, anon;
grant execute on function public.claim_store_by_email() to authenticated;

-- 4. 平文パスワード列を削除 -----------------------------------------------
-- これまでの店舗パスワードは誰でも読めた可能性があるため、復元せず破棄します。
alter table public.stores drop column if exists password_hash;

-- 5. RLS: stores ---------------------------------------------------------
alter table public.stores enable row level security;

drop policy if exists "stores_select_own_or_admin" on public.stores;
create policy "stores_select_own_or_admin" on public.stores
  for select to authenticated
  using (owner_id = auth.uid() or public.is_admin());

drop policy if exists "stores_insert_own" on public.stores;
create policy "stores_insert_own" on public.stores
  for insert to authenticated
  with check (owner_id = auth.uid());

drop policy if exists "stores_update_own_or_admin" on public.stores;
create policy "stores_update_own_or_admin" on public.stores
  for update to authenticated
  using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists "stores_delete_admin" on public.stores;
create policy "stores_delete_admin" on public.stores
  for delete to authenticated
  using (public.is_admin());

-- 6. RLS: live_statuses（お客さん画面は誰でも閲覧可） ---------------------
alter table public.live_statuses enable row level security;

drop policy if exists "live_select_public" on public.live_statuses;
create policy "live_select_public" on public.live_statuses
  for select to anon, authenticated
  using (true);

drop policy if exists "live_insert_own" on public.live_statuses;
create policy "live_insert_own" on public.live_statuses
  for insert to authenticated
  with check (public.owns_store(store_code));

drop policy if exists "live_update_own" on public.live_statuses;
create policy "live_update_own" on public.live_statuses
  for update to authenticated
  using (public.owns_store(store_code) or public.is_admin())
  with check (public.owns_store(store_code) or public.is_admin());

drop policy if exists "live_delete_own_or_admin" on public.live_statuses;
create policy "live_delete_own_or_admin" on public.live_statuses
  for delete to authenticated
  using (public.owns_store(store_code) or public.is_admin());

-- 7. RLS: admins（自分が管理者かどうかだけ確認できる） --------------------
alter table public.admins enable row level security;

drop policy if exists "admins_select_self" on public.admins;
create policy "admins_select_self" on public.admins
  for select to authenticated
  using (user_id = auth.uid());

-- 8. Storage: 宣材写真は自分の店舗コードのフォルダにだけアップロード可 ------
drop policy if exists "store_photos_insert_own" on storage.objects;
create policy "store_photos_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'store-photos' and public.owns_store((storage.foldername(name))[1]));

drop policy if exists "store_photos_update_own" on storage.objects;
create policy "store_photos_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'store-photos' and public.owns_store((storage.foldername(name))[1]));

-- =====================================================================
-- 管理者の登録（1回だけ）
--   1) ダッシュボード → Authentication → Users → 「Add user」で
--      管理者用のメールアドレスとパスワードを作成
--   2) 下の行のメールアドレスを書き換えて実行
-- insert into public.admins (user_id)
--   select id from auth.users where email = 'あなたの管理者メール@example.com';
-- =====================================================================
