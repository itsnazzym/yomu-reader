-- Keep direct table writes revoked; authenticate and serialize writes inside this RPC.
create or replace function public.save_yomu_vault(
  p_record_key text, p_nonce text, p_ciphertext text,
  p_schema_version smallint, p_expected_revision bigint
) returns table(applied boolean, revision bigint)
language plpgsql security definer set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  current_revision bigint;
  affected integer;
begin
  if owner_id is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_record_key is null or p_record_key !~ '^[A-Za-z0-9_-]{32,128}$'
    or p_nonce is null or p_nonce !~ '^[A-Za-z0-9_-]{32}$'
    or p_ciphertext is null or length(p_ciphertext) not between 22 and 5592500
    or p_ciphertext !~ '^[A-Za-z0-9_-]+$'
    or p_schema_version is distinct from 1
    or p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'Invalid encrypted vault' using errcode = '22023';
  end if;

  if p_expected_revision = 0 then
    insert into public.sync_records(user_id, kind, record_key, nonce, ciphertext, schema_version, revision)
    values (owner_id, 'vault', p_record_key, p_nonce, p_ciphertext, p_schema_version, 1)
    on conflict (user_id, kind, record_key) do nothing;
    get diagnostics affected = row_count;
    if affected = 1 then return query select true, 1::bigint; return; end if;
  end if;

  select r.revision into current_revision from public.sync_records r
    where r.user_id = owner_id and r.kind = 'vault' and r.record_key = p_record_key for update;
  if not found then return query select false, 0::bigint; return; end if;
  if current_revision <> p_expected_revision then
    return query select false, current_revision; return;
  end if;
  update public.sync_records r
    set nonce = p_nonce, ciphertext = p_ciphertext, schema_version = p_schema_version,
        revision = current_revision + 1, updated_at = now()
    where r.user_id = owner_id and r.kind = 'vault' and r.record_key = p_record_key;
  return query select true, current_revision + 1;
end;
$$;

revoke all on function public.save_yomu_vault(text, text, text, smallint, bigint) from public, anon;
grant execute on function public.save_yomu_vault(text, text, text, smallint, bigint) to authenticated;
