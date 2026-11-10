-- Estoque RC - Migration 4: custo unitário com 6 casas (a planilha tem custos como R$ 0,183272)
drop view if exists public.v_product_stock cascade;
alter table public.stock_movements alter column total_cost drop expression;
alter table public.stock_movements alter column unit_cost type numeric(18,6);
alter table public.products alter column initial_unit_cost type numeric(18,6);

create or replace function public.stock_movements_total()
returns trigger language plpgsql as $$
begin
new.total_cost := abs(new.quantity) * coalesce(new.unit_cost, 0);
return new;
end $$;
-- "zz" garante que roda depois da validação (que define o custo da saída)
drop trigger if exists trg_zz_stock_movements_total on public.stock_movements;
create trigger trg_zz_stock_movements_total before insert or update of quantity, unit_cost on public.stock_movements
for each row execute function public.stock_movements_total();

-- recria as visões dependentes (mesma definição da migration 2)
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

create or replace view public.v_totals with (security_invoker = true) as
select count(*) filter (where active) as products,
coalesce(sum(balance) filter (where active), 0) as qty_in_stock,
coalesce(sum(stock_value) filter (where active), 0) as stock_value,
coalesce(sum(total_spent), 0) as total_spent,
count(*) filter (where active and below_min) as below_min,
count(*) filter (where active and not below_min) as above_min
from public.v_product_stock;

select 'OK - migration 4' as resultado,
(select round(sum(total_cost), 2) from public.stock_movements where type = 'ENTRADA') as entradas_rs,
(select round(sum(total_cost), 2) from public.stock_movements where type = 'SAIDA') as saidas_rs,
(select count(*) from public.v_product_stock) as produtos_na_visao;
