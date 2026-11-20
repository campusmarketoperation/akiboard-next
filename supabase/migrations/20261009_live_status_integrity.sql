-- =====================================================================
-- AkiBoard: 空席情報（live_statuses）の改ざん防止
--
-- 問題: 店舗画面は live_statuses に店名・写真・地図URL・位置・公開期限を
--       ブラウザから直接書き込んでいます。RLS は「自分の店舗コードか」しか
--       見ていないため、登録した人なら誰でも
--         - 他店の名前・写真・地図リンクを名乗った空席情報を出す
--         - expires_at を 2099 年などにして掲載を出しっぱなしにする
--       ことができました。
--
-- 対策: DB のトリガーで、
--         1) 店名・エリア・ジャンル・地図URL・緯度経度・写真は stores の値で上書き
--         2) 公開期限は「今から最大3時間」に丸める
--       アプリ側の変更は不要です（通常の操作では同じ値が入るため）。
--
-- Supabase ダッシュボード → SQL Editor に貼り付けて「Run」してください。
-- 何度実行しても壊れないように書いてあります。
-- =====================================================================

create or replace function public.live_statuses_enforce_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.stores%rowtype;
begin
  select * into s from public.stores where code = new.store_code;
  if not found then
    raise exception 'store_code % は存在しません', new.store_code
      using errcode = '23503';
  end if;

  -- 表示用の店舗情報は必ず stores（本人が管理する店舗情報）から取る
  new.store_name := s.name;
  new.area       := s.area;
  new.genre      := s.genre;
  new.map_url    := coalesce(s.map_url, '');
  new.lat        := s.lat;
  new.lng        := s.lng;
  new.photo_url  := s.photo_url;

  -- 公開期限は最大 3 時間先まで（店舗画面は 1 時間単位で延長する）
  if new.expires_at is null or new.expires_at > now() + interval '3 hours' then
    new.expires_at := now() + interval '3 hours';
  end if;

  return new;
end;
$$;

revoke all on function public.live_statuses_enforce_integrity() from public, anon, authenticated;

-- 既に期限が不自然に先になっている掲載を 3 時間以内に丸める（トリガー作成前に実行）
update public.live_statuses
   set expires_at = now() + interval '3 hours'
 where expires_at > now() + interval '3 hours';

drop trigger if exists live_statuses_enforce_integrity on public.live_statuses;
create trigger live_statuses_enforce_integrity
  before insert or update on public.live_statuses
  for each row execute function public.live_statuses_enforce_integrity();
