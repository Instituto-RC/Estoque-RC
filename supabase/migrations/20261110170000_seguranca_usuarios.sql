-- Estoque RC - Migration 3: novos usuários entram inativos; só o admin libera acesso e define o perfil
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_first boolean;
begin
select not exists (select 1 from public.profiles) into v_first;
insert into public.profiles (id, full_name, email, role, active)
values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), new.email,
case when v_first then 'admin'::public.user_role else 'leitura'::public.user_role end,
v_first)
on conflict (id) do nothing;
return new;
end $$;

-- admin pode ler todos os perfis (inclusive inativos) para liberar acesso
drop policy if exists "perfil admin le todos" on public.profiles;
create policy "perfil admin le todos" on public.profiles for select to authenticated
using (public.has_role(array['admin']::public.user_role[]));

-- impede que o último admin se rebaixe/desative
create or replace function public.profiles_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
if old.role = 'admin' and (new.role <> 'admin' or not new.active) then
if (select count(*) from public.profiles where role = 'admin' and active and id <> old.id) = 0 then
raise exception 'É preciso manter pelo menos um administrador ativo.';
end if;
end if;
return new;
end $$;
drop trigger if exists trg_profiles_guard on public.profiles;
create trigger trg_profiles_guard before update on public.profiles for each row execute function public.profiles_guard();

select 'OK - migration 3' as resultado, (select string_agg(email || ':' || role || ':' || active, ', ') from public.profiles) as perfis;
