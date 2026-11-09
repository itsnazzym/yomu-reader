-- Disposable integration database only. Never apply this file to a live project.
create schema auth;
create role anon nologin;
create role authenticated nologin;
grant usage on schema auth, public to anon, authenticated;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
insert into auth.users values ('11111111-1111-4111-8111-111111111111'), ('22222222-2222-4222-8222-222222222222');
