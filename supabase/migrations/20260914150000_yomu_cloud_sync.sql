-- Yomu Cloud: one encrypted vault record per authenticated user.
-- The mobile client never receives a service-role key; RLS is mandatory.
create schema if not exists yomu;

create table if not exists public.sync_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind = 'vault'),
  record_key text not null check (char_length(record_key) between 32 and 128),
  nonce text not null,
  ciphertext text not null,
  schema_version smallint not null default 1,
  revision bigint not null default 1,
  updated_at timestamptz not null default now(),
  primary key (user_id, kind, record_key)
);

alter table public.sync_records enable row level security;
revoke all on table public.sync_records from anon, authenticated;
grant select on table public.sync_records to authenticated;

create policy "Yomu users read only their vault"
  on public.sync_records for select to authenticated
  using ((select auth.uid()) = user_id);

-- Writes go through the function below so a stale mobile client cannot erase
-- a newer vault without first pulling it and merging locally.
create or replace function public.save_yomu_vault(
  p_record_key text,
  p_nonce text,
  p_ciphertext text,
  p_schema_version smallint,
  p_expected_revision bigint
) returns table(applied boolean, revision bigint)
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_revision bigint;
  next_revision bigint;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if length(p_nonce) < 16 or length(p_ciphertext) < 16 then raise exception 'Invalid encrypted vault'; end if;

  select r.revision into current_revision
  from public.sync_records r
  where r.user_id = auth.uid() and r.kind = 'vault' and r.record_key = p_record_key
  for update;

  if not found then
    if p_expected_revision <> 0 then return query select false, 0::bigint; return; end if;
    insert into public.sync_records(user_id, kind, record_key, nonce, ciphertext, schema_version, revision)
    values (auth.uid(), 'vault', p_record_key, p_nonce, p_ciphertext, p_schema_version, 1);
    return query select true, 1::bigint;
    return;
  end if;

  if current_revision <> p_expected_revision then
    return query select false, current_revision;
    return;
  end if;

  next_revision := current_revision + 1;
  update public.sync_records
  set nonce = p_nonce, ciphertext = p_ciphertext, schema_version = p_schema_version,
      revision = next_revision, updated_at = now()
  where user_id = auth.uid() and kind = 'vault' and record_key = p_record_key;
  return query select true, next_revision;
end;
$$;

revoke all on function public.save_yomu_vault(text, text, text, smallint, bigint) from public;
grant execute on function public.save_yomu_vault(text, text, text, smallint, bigint) to authenticated;
