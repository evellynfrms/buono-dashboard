-- BUONO DASHBOARD | Banco de dados Supabase
-- Execute este arquivo no SQL Editor do seu projeto Supabase.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text,
  email text,
  created_at timestamptz not null default now()
);

create table if not exists public.lancamentos (
  id uuid primary key default gen_random_uuid(),
  data date not null default current_date,
  paciente text not null,
  oportunidade numeric(14,2) not null default 0 check (oportunidade >= 0),
  fechado numeric(14,2) not null default 0 check (fechado >= 0),
  entrada numeric(14,2) not null default 0 check (entrada >= 0),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint valores_validos check (fechado <= oportunidade and entrada <= fechado)
);

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id),
  acao text not null,
  registro_id uuid,
  detalhes jsonb,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.lancamentos enable row level security;
alter table public.audit_log enable row level security;

drop policy if exists "profiles_authenticated_all" on public.profiles;
create policy "profiles_authenticated_all" on public.profiles for all to authenticated using (true) with check (true);

drop policy if exists "lancamentos_authenticated_all" on public.lancamentos;
create policy "lancamentos_authenticated_all" on public.lancamentos for all to authenticated using (true) with check (true);

drop policy if exists "audit_authenticated_read" on public.audit_log;
create policy "audit_authenticated_read" on public.audit_log for select to authenticated using (true);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id,nome,email)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome','Usuário'), new.email)
  on conflict (id) do update set nome=excluded.nome, email=excluded.email;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.log_lancamento()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log(user_id,acao,registro_id,detalhes)
    values (auth.uid(),'CRIAR',new.id,to_jsonb(new));
    return new;
  elsif tg_op = 'UPDATE' then
    insert into public.audit_log(user_id,acao,registro_id,detalhes)
    values (auth.uid(),'EDITAR',new.id,jsonb_build_object('antes',to_jsonb(old),'depois',to_jsonb(new)));
    return new;
  elsif tg_op = 'DELETE' then
    insert into public.audit_log(user_id,acao,registro_id,detalhes)
    values (auth.uid(),'EXCLUIR',old.id,to_jsonb(old));
    return old;
  end if;
  return null;
end; $$;

drop trigger if exists audit_lancamento_changes on public.lancamentos;
create trigger audit_lancamento_changes
after insert or update or delete on public.lancamentos
for each row execute procedure public.log_lancamento();

-- Realtime
alter publication supabase_realtime add table public.lancamentos;
alter publication supabase_realtime add table public.profiles;
