-- =====================================================================
-- Estoque RC - Instituto RC Odontologia
-- Schema inicial (Fase 0)
-- =====================================================================

create extension if not exists pgcrypto;
create extension if not exists unaccent;

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
do $$ begin
  create type public.user_role as enum ('admin', 'almoxarife', 'profissional', 'leitura');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.movement_type as enum ('ENTRADA', 'SAIDA', 'AJUSTE', 'TRANSFERENCIA');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- Perfis de usuário
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null default '',
  email       text,
  phone       text,
  role        public.user_role not null default 'leitura',
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Cria o perfil automaticamente quando o usuário é convidado/criado.
-- O primeiro usuário do sistema vira admin.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_role public.user_role;
begin
  if not exists (select 1 from public.profiles) then
    v_role := 'admin';
  else
    v_role := coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'leitura');
  end if;
  insert into public.profiles (id, full_name, email, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), new.email, v_role)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.current_user_role()
returns public.user_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and active
$$;

create or replace function public.has_role(roles public.user_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.current_user_role() = any(roles), false)
$$;

-- ---------------------------------------------------------------------
-- Cadastros auxiliares
-- ---------------------------------------------------------------------
create table if not exists public.units (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,            -- UNID, ML, L, CX, PC, PCT
  name        text not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Processos / categorias. As regras de lote e validade ficam aqui.
create table if not exists public.processes (
  id               uuid primary key default gen_random_uuid(),
  name             text not null unique,       -- IMPLANTE, HOF, CIRURGIA ...
  requires_lot     boolean not null default false,
  requires_expiry  boolean not null default true,
  active           boolean not null default true,
  created_at       timestamptz not null default now()
);

create table if not exists public.distribution_centers (
  id           uuid primary key default gen_random_uuid(),
  name         text not null unique,
  address      text,
  responsible  text,
  phone        text,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

create table if not exists public.locations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  notes       text,
  center_id   uuid references public.distribution_centers(id),
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (name, center_id)
);

create table if not exists public.destinations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,             -- CLÍNICA, CONSULTÓRIO DR. RAFAEL, DEVOLUÇÃO ...
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.suppliers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  cnpj        text,
  email       text,
  phone       text,
  whatsapp    text,
  contact     text,
  notes       text,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.professionals (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  email       text,
  phone       text,
  profile_id  uuid references public.profiles(id),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Produtos
-- ---------------------------------------------------------------------
create table if not exists public.products (
  id                     uuid primary key default gen_random_uuid(),
  code                   text unique,                 -- IRC0001 (gerado automaticamente)
  name                   text not null,
  description            text,
  unit_id                uuid references public.units(id),
  min_stock              numeric(12,2) not null default 0 check (min_stock >= 0),
  max_stock              numeric(12,2) check (max_stock is null or max_stock >= 0),
  initial_unit_cost      numeric(14,4) check (initial_unit_cost is null or initial_unit_cost >= 0),
  default_location_id    uuid references public.locations(id),
  preferred_supplier_id  uuid references public.suppliers(id),
  barcode                text,
  manufacturer_ref       text,
  photo_path             text,
  needs_review           boolean not null default false,  -- marcado pela importação
  review_notes           text,
  active                 boolean not null default true,
  registered_at          date not null default current_date,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index if not exists products_name_idx on public.products (lower(name));
create index if not exists products_barcode_idx on public.products (barcode) where barcode is not null;

create table if not exists public.product_processes (
  product_id  uuid not null references public.products(id) on delete cascade,
  process_id  uuid not null references public.processes(id),
  primary key (product_id, process_id)
);

-- Código IRC sequencial automático
create or replace function public.next_product_code()
returns text language sql volatile as $$
  select 'IRC' || lpad((coalesce(max(substring(code from 4)::int), 0) + 1)::text, 4, '0')
  from public.products where code ~ '^IRC[0-9]+$'
$$;

create or replace function public.products_before_insert()
returns trigger language plpgsql as $$
begin
  if new.code is null or btrim(new.code) = '' then
    perform pg_advisory_xact_lock(hashtext('products_code'));
    new.code := public.next_product_code();
  end if;
  new.name := btrim(regexp_replace(new.name, '\s+', ' ', 'g'));
  return new;
end $$;

drop trigger if exists trg_products_before_insert on public.products;
create trigger trg_products_before_insert
  before insert on public.products
  for each row execute function public.products_before_insert();

-- Regras do produto, derivadas dos processos
create or replace function public.product_requires_lot(p_product uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from public.product_processes pp
    join public.processes pr on pr.id = pp.process_id
    where pp.product_id = p_product and pr.requires_lot
  )
$$;

create or replace function public.product_requires_expiry(p_product uuid)
returns boolean language sql stable as $$
  -- Regra do Instituto: validade obrigatória para todos os produtos.
  -- Só deixa de ser exigida se TODOS os processos do produto a dispensarem.
  select coalesce(bool_or(pr.requires_expiry), true)
  from public.product_processes pp
  join public.processes pr on pr.id = pp.process_id
  where pp.product_id = p_product
$$;

-- ---------------------------------------------------------------------
-- Lotes
-- ---------------------------------------------------------------------
create table if not exists public.lots (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references public.products(id) on delete cascade,
  lot_number   text,                      -- obrigatório para IMPLANTE / HOF
  expiry_date  date,                      -- obrigatório para entradas novas
  supplier_id  uuid references public.suppliers(id),
  is_legacy    boolean not null default false,  -- saldo importado da planilha (sem lote)
  created_at   timestamptz not null default now()
);
create unique index if not exists lots_unique_idx
  on public.lots (product_id, coalesce(lot_number, ''), coalesce(expiry_date, '1900-01-01'::date));
create index if not exists lots_expiry_idx on public.lots (expiry_date);

-- ---------------------------------------------------------------------
-- Importações
-- ---------------------------------------------------------------------
create table if not exists public.import_batches (
  id            uuid primary key default gen_random_uuid(),
  file_name     text not null,
  file_path     text,
  status        text not null default 'preview' check (status in ('preview', 'imported', 'failed', 'cancelled')),
  summary       jsonb not null default '{}'::jsonb,
  issues        jsonb not null default '[]'::jsonb,
  created_by    uuid references public.profiles(id) default auth.uid(),
  created_at    timestamptz not null default now(),
  imported_at   timestamptz
);

-- ---------------------------------------------------------------------
-- Movimentações (entradas, saídas, ajustes, transferências)
-- ---------------------------------------------------------------------
create table if not exists public.stock_movements (
  id                   uuid primary key default gen_random_uuid(),
  type                 public.movement_type not null,
  product_id           uuid not null references public.products(id),
  lot_id               uuid references public.lots(id),
  quantity             numeric(12,2) not null check (quantity <> 0),
  unit_cost            numeric(14,4) check (unit_cost is null or unit_cost >= 0),
  total_cost           numeric(16,4) generated always as (abs(quantity) * coalesce(unit_cost, 0)) stored,
  supplier_id          uuid references public.suppliers(id),
  invoice_number       text,
  invoice_photo_path   text,
  location_id          uuid references public.locations(id),
  to_location_id       uuid references public.locations(id),   -- transferências
  center_id            uuid references public.distribution_centers(id),
  destination_id       uuid references public.destinations(id),
  process_id           uuid references public.processes(id),
  responsible_name     text,                -- nome do responsável (histórico da planilha)
  reason               text,                -- motivo de ajuste / observação
  occurred_at          date not null default current_date,
  import_batch_id      uuid references public.import_batches(id) on delete cascade,
  legacy_row           int,                 -- linha de origem na planilha
  created_by           uuid references public.profiles(id) default auth.uid(),
  created_at           timestamptz not null default now(),
  constraint chk_entry_positive check (type <> 'ENTRADA' or quantity > 0),
  constraint chk_exit_positive  check (type <> 'SAIDA' or quantity > 0),
  constraint chk_transfer_loc   check (type <> 'TRANSFERENCIA' or (location_id is not null and to_location_id is not null))
);
create index if not exists mov_product_idx on public.stock_movements (product_id);
create index if not exists mov_lot_idx on public.stock_movements (lot_id);
create index if not exists mov_date_idx on public.stock_movements (occurred_at);
create index if not exists mov_type_idx on public.stock_movements (type);

-- Efeito da movimentação no saldo: entrada +, saída -, ajuste com sinal, transferência 0 no total
create or replace function public.movement_signed_qty(t public.movement_type, q numeric)
returns numeric language sql immutable as $$
  select case t when 'ENTRADA' then q when 'SAIDA' then -q when 'AJUSTE' then q else 0 end
$$;

-- Validações de negócio (não se aplicam a registros importados da planilha)
create or replace function public.stock_movements_validate()
returns trigger language plpgsql as $$
declare
  v_lot        public.lots;
  v_balance    numeric;
  v_lot_bal    numeric;
begin
  if new.import_batch_id is not null then
    return new;   -- histórico da planilha entra como está
  end if;

  if new.lot_id is not null then
    select * into v_lot from public.lots where id = new.lot_id;
    if v_lot.product_id <> new.product_id then
      raise exception 'O lote informado não pertence a este produto.';
    end if;
  end if;

  if new.type = 'ENTRADA' then
    if public.product_requires_expiry(new.product_id) and (new.lot_id is null or v_lot.expiry_date is null) then
      raise exception 'Validade é obrigatória para a entrada deste produto.';
    end if;
    if public.product_requires_lot(new.product_id) and (new.lot_id is null or coalesce(btrim(v_lot.lot_number), '') = '') then
      raise exception 'Número de lote é obrigatório para produtos de IMPLANTE, HOF e CIRURGIA.';
    end if;
    if new.unit_cost is null then
      raise exception 'Informe o custo unitário da entrada.';
    end if;
  end if;

  if new.type = 'SAIDA' then
    select coalesce(sum(public.movement_signed_qty(type, quantity)), 0) into v_balance
      from public.stock_movements where product_id = new.product_id;
    if v_balance < new.quantity then
      raise exception 'Saldo insuficiente: disponível %, solicitado %.', v_balance, new.quantity;
    end if;
    if public.product_requires_lot(new.product_id) and new.lot_id is null then
      raise exception 'Selecione o lote utilizado (obrigatório para IMPLANTE, HOF e CIRURGIA).';
    end if;
    if new.lot_id is not null then
      select coalesce(sum(public.movement_signed_qty(type, quantity)), 0) into v_lot_bal
        from public.stock_movements where lot_id = new.lot_id;
      if v_lot_bal < new.quantity then
        raise exception 'Saldo insuficiente no lote: disponível %, solicitado %.', v_lot_bal, new.quantity;
      end if;
      if v_lot.expiry_date is not null and v_lot.expiry_date < current_date then
        raise exception 'Lote vencido em %. Use um ajuste de perda para baixá-lo.', to_char(v_lot.expiry_date, 'DD/MM/YYYY');
      end if;
    end if;
    -- custo da saída = custo médio do produto no momento
    if new.unit_cost is null then
      select case when sum(quantity) > 0 then sum(total_cost) / sum(quantity) else 0 end into new.unit_cost
        from public.stock_movements where product_id = new.product_id and type = 'ENTRADA';
    end if;
  end if;

  if new.type = 'AJUSTE' and coalesce(btrim(new.reason), '') = '' then
    raise exception 'Informe o motivo do ajuste (perda, avaria, vencido, contagem...).';
  end if;

  return new;
end $$;

drop trigger if exists trg_stock_movements_validate on public.stock_movements;
create trigger trg_stock_movements_validate
  before insert on public.stock_movements
  for each row execute function public.stock_movements_validate();

-- ---------------------------------------------------------------------
-- Inventário físico (contagem)
-- ---------------------------------------------------------------------
create table if not exists public.inventory_counts (
  id           uuid primary key default gen_random_uuid(),
  location_id  uuid references public.locations(id),
  status       text not null default 'aberta' check (status in ('aberta', 'finalizada', 'cancelada')),
  notes        text,
  created_by   uuid references public.profiles(id) default auth.uid(),
  created_at   timestamptz not null default now(),
  finished_at  timestamptz
);

create table if not exists public.inventory_count_items (
  id              uuid primary key default gen_random_uuid(),
  count_id        uuid not null references public.inventory_counts(id) on delete cascade,
  product_id      uuid not null references public.products(id),
  lot_id          uuid references public.lots(id),
  expected_qty    numeric(12,2) not null default 0,
  counted_qty     numeric(12,2),
  adjustment_id   uuid references public.stock_movements(id),
  unique (count_id, product_id, lot_id)
);

-- ---------------------------------------------------------------------
-- Auditoria
-- ---------------------------------------------------------------------
create table if not exists public.audit_log (
  id          bigserial primary key,
  table_name  text not null,
  record_id   text,
  action      text not null,
  old_data    jsonb,
  new_data    jsonb,
  user_id     uuid default auth.uid(),
  created_at  timestamptz not null default now()
);

create or replace function public.audit_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_log (table_name, record_id, action, old_data, new_data)
  values (
    tg_table_name,
    coalesce((case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end)->>'id', null),
    tg_op,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end $$;

-- updated_at automático
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array['products', 'suppliers', 'profiles'] loop
    execute format('drop trigger if exists trg_touch_%1$s on public.%1$s', t);
    execute format('create trigger trg_touch_%1$s before update on public.%1$s for each row execute function public.touch_updated_at()', t);
  end loop;
  -- auditoria de alterações manuais (a carga da planilha é registrada em import_batches)
  foreach t in array array['products', 'suppliers', 'locations', 'distribution_centers', 'destinations',
                           'processes', 'units', 'professionals', 'lots', 'profiles'] loop
    execute format('drop trigger if exists trg_audit_%1$s on public.%1$s', t);
    execute format('create trigger trg_audit_%1$s after insert or update or delete on public.%1$s for each row execute function public.audit_trigger()', t);
  end loop;
end $$;

-- auditoria de movimentações apenas fora de importação (evita milhares de linhas na carga)
create or replace function public.audit_movements()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and new.import_batch_id is not null then
    return new;
  end if;
  insert into public.audit_log (table_name, record_id, action, old_data, new_data)
  values ('stock_movements',
          case when tg_op = 'DELETE' then old.id::text else new.id::text end,
          tg_op,
          case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
          case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end);
  return coalesce(new, old);
end $$;

drop trigger if exists trg_audit_stock_movements on public.stock_movements;
create trigger trg_audit_stock_movements
  after insert or update or delete on public.stock_movements
  for each row execute function public.audit_movements();

-- ---------------------------------------------------------------------
-- Visões de estoque (substituem INVE_GERA / INVE_CENT / RELA_GERA)
-- ---------------------------------------------------------------------

-- Regra de status idêntica à planilha
create or replace function public.stock_status(p_balance numeric, p_min numeric)
returns text language sql immutable as $$
  select case
    when p_balance <= 0 then 'Sem estoque'
    when coalesce(p_min, 0) = 0 then 'Estoque confortável'
    when p_balance / p_min < 0.25 then 'Quase sem estoque'
    when p_balance / p_min < 1.2  then 'Estoque baixo'
    when p_balance / p_min < 2    then 'Estoque moderado'
    else 'Estoque confortável'
  end
$$;

create or replace view public.v_product_stock with (security_invoker = true) as
with m as (
  select product_id,
         sum(case when type = 'ENTRADA' then quantity else 0 end)               as entries_qty,
         sum(case when type = 'SAIDA' then quantity else 0 end)                 as exits_qty,
         sum(case when type = 'AJUSTE' then quantity else 0 end)                as adjust_qty,
         sum(case when type = 'ENTRADA' then total_cost else 0 end)             as entries_value,
         sum(case when type = 'SAIDA' then total_cost else 0 end)               as exits_value,
         max(occurred_at) filter (where type = 'SAIDA')                         as last_exit_at,
         max(occurred_at)                                                       as last_movement_at
  from public.stock_movements
  group by product_id
),
loc as (
  select distinct on (product_id) product_id, location_id
  from public.stock_movements
  where type = 'ENTRADA' and location_id is not null
  order by product_id, occurred_at desc, created_at desc
)
select p.id                                   as product_id,
       p.code,
       p.name,
       u.code                                 as unit,
       p.min_stock,
       p.max_stock,
       coalesce(p.default_location_id, loc.location_id) as location_id,
       l.name                                 as location_name,
       coalesce(m.entries_qty, 0)             as entries_qty,
       coalesce(m.exits_qty, 0)               as exits_qty,
       coalesce(m.adjust_qty, 0)              as adjust_qty,
       coalesce(m.entries_qty, 0) - coalesce(m.exits_qty, 0) + coalesce(m.adjust_qty, 0) as balance,
       coalesce(m.entries_value, 0)           as total_spent,
       case when coalesce(m.entries_qty, 0) > 0 then m.entries_value / m.entries_qty
            else coalesce(p.initial_unit_cost, 0) end                                as avg_cost,
       (coalesce(m.entries_qty, 0) - coalesce(m.exits_qty, 0) + coalesce(m.adjust_qty, 0))
         * case when coalesce(m.entries_qty, 0) > 0 then m.entries_value / m.entries_qty
                else coalesce(p.initial_unit_cost, 0) end                            as stock_value,
       case when coalesce(m.entries_qty, 0) > 0 then m.exits_qty / m.entries_qty else 0 end as turnover,
       public.stock_status(coalesce(m.entries_qty, 0) - coalesce(m.exits_qty, 0) + coalesce(m.adjust_qty, 0), p.min_stock) as status,
       m.last_exit_at,
       m.last_movement_at,
       (select string_agg(pr.name, '/' order by pr.name) from public.product_processes pp
          join public.processes pr on pr.id = pp.process_id where pp.product_id = p.id) as processes,
       public.product_requires_lot(p.id)      as requires_lot,
       p.photo_path,
       p.needs_review,
       p.active
from public.products p
left join m   on m.product_id = p.id
left join loc on loc.product_id = p.id
left join public.units u on u.id = p.unit_id
left join public.locations l on l.id = coalesce(p.default_location_id, loc.location_id);

create or replace view public.v_lot_stock with (security_invoker = true) as
select lt.id as lot_id, lt.product_id, p.code, p.name, lt.lot_number, lt.expiry_date, lt.is_legacy,
       coalesce(sum(public.movement_signed_qty(m.type, m.quantity)), 0) as balance,
       case when lt.expiry_date is null then null else lt.expiry_date - current_date end as days_to_expiry
from public.lots lt
join public.products p on p.id = lt.product_id
left join public.stock_movements m on m.lot_id = lt.id
group by lt.id, p.code, p.name;

create or replace view public.v_monthly_movements with (security_invoker = true) as
select date_trunc('month', occurred_at)::date as month,
       sum(case when type = 'ENTRADA' then quantity else 0 end)   as entries_qty,
       sum(case when type = 'SAIDA' then quantity else 0 end)     as exits_qty,
       sum(case when type = 'ENTRADA' then total_cost else 0 end) as entries_value,
       sum(case when type = 'SAIDA' then total_cost else 0 end)   as exits_value
from public.stock_movements
group by 1;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['profiles', 'units', 'processes', 'distribution_centers', 'locations', 'destinations',
                           'suppliers', 'professionals', 'products', 'product_processes', 'lots', 'import_batches',
                           'stock_movements', 'inventory_counts', 'inventory_count_items', 'audit_log'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "leitura autenticada" on public.%I', t);
    execute format('create policy "leitura autenticada" on public.%I for select to authenticated using (public.current_user_role() is not null)', t);
  end loop;

  -- Cadastros: admin e almoxarife escrevem
  foreach t in array array['units', 'processes', 'distribution_centers', 'locations', 'destinations',
                           'suppliers', 'professionals', 'products', 'product_processes', 'lots',
                           'inventory_counts', 'inventory_count_items'] loop
    execute format('drop policy if exists "escrita estoque" on public.%I', t);
    execute format($p$create policy "escrita estoque" on public.%I for all to authenticated
                     using (public.has_role(array['admin','almoxarife']::public.user_role[]))
                     with check (public.has_role(array['admin','almoxarife']::public.user_role[]))$p$, t);
  end loop;
end $$;

-- Movimentações
drop policy if exists "mov insert" on public.stock_movements;
create policy "mov insert" on public.stock_movements for insert to authenticated
  with check (
    public.has_role(array['admin','almoxarife']::public.user_role[])
    or (public.has_role(array['profissional']::public.user_role[]) and type = 'SAIDA')
  );
drop policy if exists "mov update" on public.stock_movements;
create policy "mov update" on public.stock_movements for update to authenticated
  using (public.has_role(array['admin']::public.user_role[]))
  with check (public.has_role(array['admin']::public.user_role[]));
drop policy if exists "mov delete" on public.stock_movements;
create policy "mov delete" on public.stock_movements for delete to authenticated
  using (public.has_role(array['admin']::public.user_role[]));

-- Importações: só admin
drop policy if exists "import admin" on public.import_batches;
create policy "import admin" on public.import_batches for all to authenticated
  using (public.has_role(array['admin']::public.user_role[]))
  with check (public.has_role(array['admin']::public.user_role[]));

-- Perfis: o próprio usuário edita nome/telefone; admin gerencia todos
drop policy if exists "perfil proprio" on public.profiles;
create policy "perfil proprio" on public.profiles for update to authenticated
  using (id = auth.uid() or public.has_role(array['admin']::public.user_role[]))
  with check (
    public.has_role(array['admin']::public.user_role[])
    or (id = auth.uid() and role = public.current_user_role())
  );
drop policy if exists "perfil leitura propria" on public.profiles;
create policy "perfil leitura propria" on public.profiles for select to authenticated
  using (id = auth.uid());

-- Auditoria: só admin lê
drop policy if exists "leitura autenticada" on public.audit_log;
create policy "auditoria admin" on public.audit_log for select to authenticated
  using (public.has_role(array['admin']::public.user_role[]));

-- ---------------------------------------------------------------------
-- Storage: fotos de produtos e notas fiscais
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-photos', 'product-photos', false, 5242880, array['image/jpeg','image/png','image/webp','image/heic']),
       ('invoices', 'invoices', false, 10485760, array['image/jpeg','image/png','image/webp','image/heic','application/pdf']),
       ('imports', 'imports', false, 20971520, array['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/csv'])
on conflict (id) do nothing;

drop policy if exists "storage leitura" on storage.objects;
create policy "storage leitura" on storage.objects for select to authenticated
  using (bucket_id in ('product-photos', 'invoices', 'imports') and public.current_user_role() is not null);

drop policy if exists "storage escrita" on storage.objects;
create policy "storage escrita" on storage.objects for insert to authenticated
  with check (
    (bucket_id in ('product-photos', 'invoices') and public.has_role(array['admin','almoxarife']::public.user_role[]))
    or (bucket_id = 'imports' and public.has_role(array['admin']::public.user_role[]))
  );

drop policy if exists "storage alteracao" on storage.objects;
create policy "storage alteracao" on storage.objects for update to authenticated
  using (bucket_id in ('product-photos', 'invoices') and public.has_role(array['admin','almoxarife']::public.user_role[]));

drop policy if exists "storage exclusao" on storage.objects;
create policy "storage exclusao" on storage.objects for delete to authenticated
  using (bucket_id in ('product-photos', 'invoices', 'imports') and public.has_role(array['admin']::public.user_role[]));

-- ---------------------------------------------------------------------
-- Dados iniciais (vindos da planilha)
-- ---------------------------------------------------------------------
insert into public.units (code, name) values
  ('UNID', 'Unidade'), ('ML', 'Mililitro'), ('L', 'Litro'),
  ('CX', 'Caixa'), ('PC', 'Peça'), ('PCT', 'Pacote')
on conflict (code) do nothing;

insert into public.processes (name, requires_lot, requires_expiry) values
  ('IMPLANTE', true, true),
  ('HOF', true, true),
  ('CIRURGIA', false, true),
  ('DENTISTICA', false, true),
  ('ESTERILIZAÇÃO', false, true),
  ('PROTESE', false, true),
  ('GERAL', false, true)
on conflict (name) do update set requires_lot = excluded.requires_lot, requires_expiry = excluded.requires_expiry;

insert into public.destinations (name) values
  ('CLÍNICA'), ('CONSULTÓRIO DR. RAFAEL'), ('CLÍNICA/DR. GUSTAVO'), ('DEVOLUÇÃO')
on conflict (name) do nothing;
