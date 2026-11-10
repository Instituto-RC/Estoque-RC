-- Estoque RC - Migration 2: ajustes da auditoria da planilha + importador
-- 1) Regra: só IMPLANTE e HOF exigem lote; todos exigem validade
update public.processes set requires_lot = false where name = 'CIRURGIA';
update public.processes set requires_lot = true where name in ('IMPLANTE', 'HOF');

-- 2) Status: igual à planilha; quando não há mínimo cadastrado a planilha deixa em branco -> "Sem mínimo definido"
create or replace function public.stock_status(p_balance numeric, p_min numeric)
returns text language sql immutable as $$
select case
when p_balance <= 0 then 'Sem estoque'
when coalesce(p_min, 0) = 0 then 'Sem mínimo definido'
when p_balance / p_min < 0.25 then 'Quase sem estoque'
when p_balance / p_min < 1.2 then 'Estoque baixo'
when p_balance / p_min < 2 then 'Estoque moderado'
else 'Estoque confortável'
end
$$;

-- 3) Mensagens de validação atualizadas
create or replace function public.stock_movements_validate()
returns trigger language plpgsql as $$
declare
v_lot public.lots;
v_balance numeric;
v_lot_bal numeric;
begin
if new.import_batch_id is not null then
return new;
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
raise exception 'Número de lote é obrigatório para produtos de IMPLANTE e HOF.';
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
raise exception 'Selecione o lote utilizado (obrigatório para IMPLANTE e HOF).';
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
if new.unit_cost is null then
select case when sum(quantity) > 0 then sum(total_cost) / sum(quantity) else 0 end into new.unit_cost
from public.stock_movements where product_id = new.product_id and type = 'ENTRADA';
end if;
end if;
if new.type = 'AJUSTE' and coalesce(btrim(new.reason), '') = '' then
raise exception 'Informe o motivo do ajuste (perda, avaria, vencido, contagem...).';
end if;
if new.type = 'AJUSTE' and new.unit_cost is null then
select case when sum(quantity) > 0 then sum(total_cost) / sum(quantity) else 0 end into new.unit_cost
from public.stock_movements where product_id = new.product_id and type = 'ENTRADA';
end if;
return new;
end $$;

-- 4) Visão de inventário geral (INVE_GERA) - mesmos indicadores da planilha
drop view if exists public.v_product_stock cascade;
create view public.v_product_stock with (security_invoker = true) as
with m as (
select product_id,
sum(case when type = 'ENTRADA' then quantity else 0 end) as entries_qty,
sum(case when type = 'SAIDA' then quantity else 0 end) as exits_qty,
sum(case when type = 'AJUSTE' then quantity else 0 end) as adjust_qty,
sum(case when type = 'ENTRADA' then total_cost else 0 end) as entries_value,
sum(case when type = 'SAIDA' then total_cost else 0 end) as exits_value,
sum(case when type = 'AJUSTE' then sign(quantity) * total_cost else 0 end) as adjust_value,
min(occurred_at) filter (where type = 'ENTRADA') as first_entry_at,
max(occurred_at) filter (where type = 'ENTRADA') as last_entry_at,
max(occurred_at) filter (where type = 'SAIDA') as last_exit_at,
max(occurred_at) as last_movement_at
from public.stock_movements
group by product_id
),
loc as (
select distinct on (product_id) product_id, location_id
from public.stock_movements
where type = 'ENTRADA' and location_id is not null
order by product_id, occurred_at, created_at, legacy_row
),
base as (
select p.id as product_id, p.code, p.name, u.code as unit, p.min_stock, p.max_stock,
coalesce(p.default_location_id, loc.location_id) as location_id,
coalesce(m.entries_qty, 0) as entries_qty,
coalesce(m.exits_qty, 0) as exits_qty,
coalesce(m.adjust_qty, 0) as adjust_qty,
coalesce(m.entries_qty, 0) - coalesce(m.exits_qty, 0) + coalesce(m.adjust_qty, 0) as balance,
coalesce(m.entries_value, 0) as total_spent,
coalesce(m.exits_value, 0) as exits_value,
case when coalesce(m.entries_qty, 0) > 0 then m.entries_value / m.entries_qty else coalesce(p.initial_unit_cost, 0) end as avg_cost,
coalesce(m.entries_value, 0) - coalesce(m.exits_value, 0) + coalesce(m.adjust_value, 0) as stock_value,
m.first_entry_at, m.last_entry_at, m.last_exit_at, m.last_movement_at,
p.initial_unit_cost, p.photo_path, p.needs_review, p.review_notes, p.active, p.registered_at,
p.barcode, p.manufacturer_ref, p.preferred_supplier_id
from public.products p
left join m on m.product_id = p.id
left join loc on loc.product_id = p.id
left join public.units u on u.id = p.unit_id
),
tot as (
select nullif(sum(total_spent), 0) as spent, nullif(sum(balance), 0) as qty from base where active
),
abc as (
select product_id,
sum(total_spent) over (order by total_spent desc, code rows between unbounded preceding and current row) as cum_spent
from base where active
)
select b.*,
l.name as location_name,
public.stock_status(b.balance, b.min_stock) as status,
(b.balance < b.min_stock) as below_min,
-- Giro conforme a planilha (INVE_GERA!O): saídas ÷ estoque mínimo
case when b.min_stock > 0 then b.exits_qty / b.min_stock else 0 end as turnover,
b.total_spent / tot.spent as pct_spent,
b.balance / tot.qty as pct_stock,
case when b.total_spent <= 0 then 'C'
when (abc.cum_spent - b.total_spent) / tot.spent < 0.80 then 'A'
when (abc.cum_spent - b.total_spent) / tot.spent < 0.95 then 'B'
else 'C' end as abc_class,
case when b.max_stock is not null and b.max_stock > b.balance then b.max_stock - b.balance
when b.balance < b.min_stock then greatest(b.min_stock * 2 - b.balance, 0)
else 0 end as suggested_purchase,
(select string_agg(pr.name, '/' order by pr.name) from public.product_processes pp
join public.processes pr on pr.id = pp.process_id where pp.product_id = b.product_id) as processes,
public.product_requires_lot(b.product_id) as requires_lot
from base b
cross join tot
left join abc on abc.product_id = b.product_id
left join public.locations l on l.id = b.location_id;

-- 5) Inventário por centro de distribuição (INVE_CENT)
create or replace view public.v_center_stock with (security_invoker = true) as
select m.center_id, c.name as center_name, p.id as product_id, p.code, p.name, p.min_stock,
sum(case when m.type = 'ENTRADA' then m.quantity else 0 end) as entries_qty,
sum(case when m.type = 'SAIDA' then m.quantity else 0 end) as exits_qty,
sum(public.movement_signed_qty(m.type, m.quantity)) as balance,
public.stock_status(sum(public.movement_signed_qty(m.type, m.quantity)), p.min_stock) as status,
sum(case when m.type = 'ENTRADA' then m.total_cost else 0 end) as total_spent,
min(lt.expiry_date) filter (where lt.expiry_date is not null) as next_expiry
from public.stock_movements m
join public.products p on p.id = m.product_id
left join public.distribution_centers c on c.id = m.center_id
left join public.lots lt on lt.id = m.lot_id
group by m.center_id, c.name, p.id;

-- 6) Análise mensal por produto (RELA_ANA / DASH_INDI)
create or replace view public.v_product_monthly with (security_invoker = true) as
select product_id, center_id, date_trunc('month', occurred_at)::date as month,
sum(case when type = 'ENTRADA' then quantity else 0 end) as entries_qty,
sum(case when type = 'SAIDA' then quantity else 0 end) as exits_qty,
sum(case when type = 'ENTRADA' then total_cost else 0 end) as entries_value,
sum(case when type = 'SAIDA' then total_cost else 0 end) as exits_value
from public.stock_movements
group by 1, 2, 3;

-- 7) Totais gerais (RELA_GERA)
create or replace view public.v_totals with (security_invoker = true) as
select count(*) filter (where active) as products,
coalesce(sum(balance) filter (where active), 0) as qty_in_stock,
coalesce(sum(stock_value) filter (where active), 0) as stock_value,
coalesce(sum(total_spent), 0) as total_spent,
count(*) filter (where active and below_min) as below_min,
count(*) filter (where active and not below_min) as above_min
from public.v_product_stock;

-- recria visões que dependiam de v_product_stock (nenhuma) e monthly com acumulado
create or replace view public.v_monthly_movements with (security_invoker = true) as
select date_trunc('month', occurred_at)::date as month,
sum(case when type = 'ENTRADA' then quantity else 0 end) as entries_qty,
sum(case when type = 'SAIDA' then quantity else 0 end) as exits_qty,
sum(case when type = 'ENTRADA' then total_cost else 0 end) as entries_value,
sum(case when type = 'SAIDA' then total_cost else 0 end) as exits_value
from public.stock_movements
group by 1;

-- 8) Importação da planilha (transação única, só admin)
create or replace function public.import_planilha(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
v_batch uuid;
v_manual int;
v_center uuid;
v_res jsonb;
begin
if not public.has_role(array['admin']::public.user_role[]) then
raise exception 'Apenas administradores podem importar a planilha.';
end if;
select count(*) into v_manual from public.stock_movements where import_batch_id is null;
if v_manual > 0 then
raise exception 'Já existem % movimentações lançadas pelo sistema. A carga da planilha só pode ser feita antes do uso oficial.', v_manual;
end if;

-- reimportação: substitui a carga anterior
delete from public.stock_movements where import_batch_id is not null;
delete from public.lots where is_legacy;
update public.import_batches set status = 'cancelled' where status = 'imported';

insert into public.import_batches (file_name, status, summary, issues, imported_at)
values (coalesce(p->>'file_name', 'planilha.xlsx'), 'imported', coalesce(p->'summary', '{}'::jsonb), coalesce(p->'issues', '[]'::jsonb), now())
returning id into v_batch;

insert into public.units (code, name)
select x->>'code', coalesce(x->>'name', x->>'code') from jsonb_array_elements(coalesce(p->'units', '[]')) x
on conflict (code) do nothing;

insert into public.processes (name, requires_lot, requires_expiry)
select x->>'name', coalesce((x->>'requires_lot')::boolean, false), true from jsonb_array_elements(coalesce(p->'processes', '[]')) x
on conflict (name) do nothing;

insert into public.distribution_centers (name, address, responsible, phone)
select x->>'name', x->>'address', x->>'responsible', x->>'phone' from jsonb_array_elements(coalesce(p->'centers', '[]')) x
on conflict (name) do update set address = coalesce(excluded.address, distribution_centers.address),
responsible = coalesce(excluded.responsible, distribution_centers.responsible), phone = coalesce(excluded.phone, distribution_centers.phone);

select id into v_center from public.distribution_centers order by created_at limit 1;

insert into public.locations (name, notes, center_id)
select x->>'name', x->>'notes', v_center from jsonb_array_elements(coalesce(p->'locations', '[]')) x
where not exists (select 1 from public.locations l where upper(l.name) = upper(x->>'name'));

insert into public.suppliers (name, email, phone, notes)
select x->>'name', x->>'email', x->>'phone', x->>'notes' from jsonb_array_elements(coalesce(p->'suppliers', '[]')) x
on conflict (name) do update set email = coalesce(excluded.email, suppliers.email),
phone = coalesce(excluded.phone, suppliers.phone), notes = coalesce(excluded.notes, suppliers.notes);

insert into public.professionals (name, email, phone)
select x->>'name', x->>'email', x->>'phone' from jsonb_array_elements(coalesce(p->'professionals', '[]')) x
on conflict (name) do update set email = coalesce(excluded.email, professionals.email), phone = coalesce(excluded.phone, professionals.phone);

insert into public.destinations (name)
select x #>> '{}' from jsonb_array_elements(coalesce(p->'destinations', '[]')) x
on conflict (name) do nothing;

-- produtos (upsert pelo código IRC)
insert into public.products (code, name, unit_id, min_stock, initial_unit_cost, registered_at, needs_review, review_notes, default_location_id)
select x->>'code', x->>'name',
(select id from public.units u where u.code = x->>'unit'),
coalesce((x->>'min_stock')::numeric, 0),
(x->>'cost')::numeric,
coalesce((x->>'registered_at')::date, current_date),
coalesce((x->>'needs_review')::boolean, false),
nullif(x->>'review_notes', ''),
(select id from public.locations l where upper(l.name) = upper(x->>'location') limit 1)
from jsonb_array_elements(coalesce(p->'products', '[]')) x
on conflict (code) do update set name = excluded.name, unit_id = excluded.unit_id, min_stock = excluded.min_stock,
initial_unit_cost = excluded.initial_unit_cost, registered_at = excluded.registered_at, needs_review = excluded.needs_review,
review_notes = excluded.review_notes, default_location_id = excluded.default_location_id;

delete from public.product_processes pp using public.products pr
where pp.product_id = pr.id and pr.code in (select x->>'code' from jsonb_array_elements(coalesce(p->'products', '[]')) x);

insert into public.product_processes (product_id, process_id)
select distinct pr.id, ps.id
from jsonb_array_elements(coalesce(p->'products', '[]')) x
cross join lateral jsonb_array_elements_text(coalesce(x->'processes', '[]')) proc(name)
join public.products pr on pr.code = x->>'code'
join public.processes ps on ps.name = proc.name
on conflict do nothing;

-- lote "saldo importado" por produto (sem número/validade - completar no inventário)
insert into public.lots (product_id, lot_number, expiry_date, is_legacy)
select pr.id, null, null, true from public.products pr
where pr.code in (select x->>'product_code' from jsonb_array_elements(coalesce(p->'entries', '[]')) x
union select x->>'product_code' from jsonb_array_elements(coalesce(p->'exits', '[]')) x)
and not exists (select 1 from public.lots l where l.product_id = pr.id and l.is_legacy);

-- entradas
insert into public.stock_movements (type, product_id, lot_id, quantity, unit_cost, supplier_id, invoice_number, location_id, center_id,
responsible_name, occurred_at, import_batch_id, legacy_row)
select 'ENTRADA', pr.id, lt.id, (x->>'qty')::numeric, (x->>'unit_cost')::numeric,
(select id from public.suppliers s where s.name = x->>'supplier'),
nullif(x->>'invoice', ''),
(select id from public.locations l where upper(l.name) = upper(x->>'location') limit 1),
coalesce((select id from public.distribution_centers c where c.name = x->>'center'), v_center),
nullif(x->>'responsible', ''), (x->>'date')::date, v_batch, (x->>'row')::int
from jsonb_array_elements(coalesce(p->'entries', '[]')) x
join public.products pr on pr.code = x->>'product_code'
left join public.lots lt on lt.product_id = pr.id and lt.is_legacy;

-- saídas
insert into public.stock_movements (type, product_id, lot_id, quantity, unit_cost, center_id, destination_id,
responsible_name, occurred_at, import_batch_id, legacy_row)
select 'SAIDA', pr.id, lt.id, (x->>'qty')::numeric, (x->>'unit_cost')::numeric,
coalesce((select id from public.distribution_centers c where c.name = x->>'center'), v_center),
(select id from public.destinations d where d.name = x->>'destination'),
nullif(x->>'responsible', ''), (x->>'date')::date, v_batch, (x->>'row')::int
from jsonb_array_elements(coalesce(p->'exits', '[]')) x
join public.products pr on pr.code = x->>'product_code'
left join public.lots lt on lt.product_id = pr.id and lt.is_legacy;

select jsonb_build_object(
'batch_id', v_batch,
'products', (select count(*) from public.products),
'suppliers', (select count(*) from public.suppliers),
'locations', (select count(*) from public.locations),
'entries', (select count(*) from public.stock_movements where import_batch_id = v_batch and type = 'ENTRADA'),
'exits', (select count(*) from public.stock_movements where import_batch_id = v_batch and type = 'SAIDA'),
'entries_qty', (select coalesce(sum(quantity), 0) from public.stock_movements where import_batch_id = v_batch and type = 'ENTRADA'),
'exits_qty', (select coalesce(sum(quantity), 0) from public.stock_movements where import_batch_id = v_batch and type = 'SAIDA'),
'entries_value', (select coalesce(sum(total_cost), 0) from public.stock_movements where import_batch_id = v_batch and type = 'ENTRADA'),
'exits_value', (select coalesce(sum(total_cost), 0) from public.stock_movements where import_batch_id = v_batch and type = 'SAIDA')
) into v_res;

update public.import_batches set summary = summary || jsonb_build_object('db_result', v_res) where id = v_batch;
return v_res;
end $$;

revoke all on function public.import_planilha(jsonb) from public, anon;
grant execute on function public.import_planilha(jsonb) to authenticated;

select 'OK - migration 2' as resultado,
(select string_agg(name || '=' || requires_lot, ', ' order by name) from public.processes) as lote_por_processo;
