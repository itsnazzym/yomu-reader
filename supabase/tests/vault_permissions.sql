select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
set role authenticated;
do $$
declare result record;
begin
  select * into result from public.save_yomu_vault(repeat('a',43), repeat('b',32), repeat('c',22), 1::smallint, 0::bigint);
  if not result.applied or result.revision <> 1 then raise exception 'first write rejected'; end if;
  select * into result from public.save_yomu_vault(repeat('a',43), repeat('b',32), repeat('c',22), 1::smallint, 0::bigint);
  if result.applied or result.revision <> 1 then raise exception 'duplicate creation overwrote vault'; end if;
  select * into result from public.save_yomu_vault(repeat('a',43), repeat('b',32), repeat('d',22), 1::smallint, 1::bigint);
  if not result.applied or result.revision <> 2 then raise exception 'valid update rejected'; end if;
  select * into result from public.save_yomu_vault(repeat('a',43), repeat('b',32), repeat('e',22), 1::smallint, 1::bigint);
  if result.applied or result.revision <> 2 then raise exception 'stale revision accepted'; end if;
  begin
    insert into public.sync_records(user_id,kind,record_key,nonce,ciphertext) values (auth.uid(),'vault',repeat('x',43),repeat('b',32),repeat('c',22));
    raise exception 'direct insert was allowed';
  exception when insufficient_privilege then null; end;
  begin
    update public.sync_records set ciphertext=repeat('z',22) where user_id=auth.uid();
    raise exception 'direct update was allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform public.save_yomu_vault(repeat('a',43), 'invalid', repeat('c',22), 1::smallint, 2::bigint);
    raise exception 'invalid nonce accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.save_yomu_vault(repeat('a',43), repeat('b',32), repeat('c',5592501), 1::smallint, 2::bigint);
    raise exception 'oversized vault accepted';
  exception when invalid_parameter_value then null; end;
end $$;

reset role;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', false);
set role authenticated;
do $$
declare result record;
begin
  if exists(select 1 from public.sync_records) then raise exception 'another user vault was visible'; end if;
  select * into result from public.save_yomu_vault(repeat('a',43), repeat('b',32), repeat('c',22), 1::smallint, 2::bigint);
  if result.applied or result.revision <> 0 then raise exception 'another user vault was overwritten'; end if;
end $$;

reset role;
select set_config('request.jwt.claim.sub', '', false);
set role authenticated;
do $$ begin
  begin
    perform public.save_yomu_vault(repeat('a',43),repeat('b',32),repeat('c',22),1::smallint,0::bigint);
    raise exception 'missing identity accepted';
  exception when invalid_authorization_specification then null; end;
end $$;
reset role;
set role anon;
do $$ begin
  begin
    perform public.save_yomu_vault(repeat('a',43),repeat('b',32),repeat('c',22),1::smallint,0::bigint);
    raise exception 'anonymous write accepted';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
