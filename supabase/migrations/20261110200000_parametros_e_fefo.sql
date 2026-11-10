-- Estoque RC - Migration 6: parâmetros configuráveis, FEFO e validades vindas do inventário da planilha

-- 1) Tabela de parâmetros (editável pelo admin na tela Configurações)
create table if not exists public.app_settings (
key text primary key,
value jsonb not null,
label text not null,
description text,
grp text not null default 'Geral',
kind text not null default 'number' check (kind in ('number', 'boolean', 'text', 'choice')),
options jsonb,
sort int not null default 0,
updated_at timestamptz not null default now(),
updated_by uuid default auth.uid()
);
alter table public.app_settings enable row level security;
drop policy if exists "settings leitura" on public.app_settings;
create policy "settings leitura" on public.app_settings for select to authenticated using (public.current_user_role() is not null);
drop policy if exists "settings admin" on public.app_settings;
create policy "settings admin" on public.app_settings for update to authenticated
using (public.has_role(array['admin']::public.user_role[])) with check (public.has_role(array['admin']::public.user_role[]));
drop trigger if exists trg_audit_app_settings on public.app_settings;
create trigger trg_audit_app_settings after update on public.app_settings for each row execute function public.audit_trigger();
drop trigger if exists trg_touch_app_settings on public.app_settings;
create trigger trg_touch_app_settings before update on public.app_settings for each row execute function public.touch_updated_at();

insert into public.app_settings (key, value, label, description, grp, kind, options, sort) values
('nome_instituicao', '"Instituto RC Odontologia"', 'Nome da instituição', 'Aparece em relatórios e exportações.', 'Geral', 'text', null, 1),
('codigo_prefixo', '"IRC"', 'Prefixo do código de produto', 'Ex.: IRC gera IRC0400.', 'Geral', 'text', null, 2),
('codigo_inicio', '400', 'Próximo código mínimo', 'Número mínimo do próximo código automático.', 'Geral', 'number', null, 3),
('estoque_minimo_padrao', '1', 'Estoque mínimo padrão', 'Valor sugerido ao cadastrar um produto novo.', 'Estoque', 'number', null, 10),
('status_quase_pct', '25', '"Quase sem estoque" abaixo de (% do mínimo)', 'Planilha: 25%.', 'Estoque', 'number', null, 11),
('status_baixo_pct', '120', '"Estoque baixo" abaixo de (% do mínimo)', 'Planilha: 120%.', 'Estoque', 'number', null, 12),
('status_moderado_pct', '200', '"Estoque moderado" abaixo de (% do mínimo)', 'Planilha: 200%. Acima disso: confortável.', 'Estoque', 'number', null, 13),
('compra_multiplicador', '2', 'Sugestão de compra: repor até (× mínimo)', 'Usado quando o produto não tem estoque máximo.', 'Estoque', 'number', null, 14),
('permitir_saldo_negativo', 'false', 'Permitir saída sem saldo', 'Desligado = o sistema bloqueia.', 'Estoque', 'boolean', null, 15),
('custo_saida', '"medio"', 'Custo das saídas', 'Como valorizar cada saída.', 'Estoque', 'choice', '[{"v":"medio","l":"Custo médio"},{"v":"primeira_entrada","l":"Custo da 1ª entrada (como na planilha)"}]', 16),
('fefo_modo', '"avisar"', 'Vence primeiro, sai primeiro (FEFO)', 'O que fazer quando escolhem um lote que não é o que vence primeiro.', 'Validade', 'choice', '[{"v":"avisar","l":"Avisar"},{"v":"bloquear","l":"Bloquear"},{"v":"livre","l":"Livre"}]', 20),
('bloquear_vencido', 'true', 'Bloquear saída de lote vencido', 'Lote vencido só sai por ajuste de perda.', 'Validade', 'boolean', null, 21),
('validade_critica_dias', '30', 'Alerta crítico: vence em até (dias)', 'Vermelho.', 'Validade', 'number', null, 22),
('validade_atencao_dias', '60', 'Atenção: vence em até (dias)', 'Laranja.', 'Validade', 'number', null, 23),
('validade_aviso_dias', '90', 'Aviso: vence em até (dias)', 'Amarelo.', 'Validade', 'number', null, 24),
('validade_minima_entrada_dias', '0', 'Avisar entrada com validade menor que (dias)', '0 = não avisar.', 'Validade', 'number', null, 25),
('sem_giro_dias', '60', 'Itens sem saída há mais de (dias)', 'Padrão do relatório de itens parados.', 'Relatórios', 'number', null, 30),
('abc_a_pct', '80', 'Curva ABC: classe A até (% dos gastos)', '', 'Relatórios', 'number', null, 31),
('abc_b_pct', '95', 'Curva ABC: classe B até (% dos gastos)', '', 'Relatórios', 'number', null, 32)
on conflict (key) do nothing;

create or replace function public.setting_num(p_key text, p_default numeric)
returns numeric language sql stable security definer set search_path = public as $$
select coalesce((select (value #>> '{}')::numeric from public.app_settings where key = p_key), p_default)
$$;
create or replace function public.setting_text(p_key text, p_default text)
returns text language sql stable security definer set search_path = public as $$
select coalesce((select value #>> '{}' from public.app_settings where key = p_key), p_default)
$$;
create or replace function public.setting_bool(p_key text, p_default boolean)
returns boolean language sql stable security definer set search_path = public as $$
select coalesce((select (value #>> '{}')::boolean from public.app_settings where key = p_key), p_default)
$$;

-- 2) Regras lendo os parâmetros
create or replace function public.stock_status(p_balance numeric, p_min numeric)
returns text language sql stable as $$
select case
when p_balance <= 0 then 'Sem estoque'
when coalesce(p_min, 0) = 0 then 'Sem mínimo definido'
when p_balance / p_min < public.setting_num('status_quase_pct', 25) / 100 then 'Quase sem estoque'
when p_balance / p_min < public.setting_num('status_baixo_pct', 120) / 100 then 'Estoque baixo'
when p_balance / p_min < public.setting_num('status_moderado_pct', 200) / 100 then 'Estoque moderado'
else 'Estoque confortável'
end
$$;

create or replace function public.next_product_code()
returns text language plpgsql volatile as $$
declare v_prefix text := public.setting_text('codigo_prefixo', 'IRC'); v_max int;
begin
select max(substring(code from length(v_prefix) + 1)::int) into v_max
from public.products where code ~ ('^' || v_prefix || '[0-9]+$');
return v_prefix || lpad((greatest(coalesce(v_max, 0), public.setting_num('codigo_inicio', 400)::int - 1) + 1)::text, 4, '0');
end $$;

create or replace function public.stock_movements_validate()
returns trigger language plpgsql as $$
declare
v_lot public.lots;
v_balance numeric;
v_lot_bal numeric;
v_first record;
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
raise exception 'Número de lote é obrigatório para os processos que exigem lote.';
end if;
if new.unit_cost is null then
raise exception 'Informe o custo unitário da entrada.';
end if;
end if;
if new.type = 'SAIDA' then
if not public.setting_bool('permitir_saldo_negativo', false) then
select coalesce(sum(public.movement_signed_qty(type, quantity)), 0) into v_balance
from public.stock_movements where product_id = new.product_id;
if v_balance < new.quantity then
raise exception 'Saldo insuficiente: disponível %, solicitado %.', v_balance, new.quantity;
end if;
end if;
if public.product_requires_lot(new.product_id) and new.lot_id is null then
raise exception 'Selecione o lote utilizado (obrigatório para este processo).';
end if;
if new.lot_id is not null then
select coalesce(sum(public.movement_signed_qty(type, quantity)), 0) into v_lot_bal
from public.stock_movements where lot_id = new.lot_id;
if v_lot_bal < new.quantity and not public.setting_bool('permitir_saldo_negativo', false) then
raise exception 'Saldo insuficiente no lote: disponível %, solicitado %.', v_lot_bal, new.quantity;
end if;
if v_lot.expiry_date is not null and v_lot.expiry_date < current_date and public.setting_bool('bloquear_vencido', true) then
raise exception 'Lote vencido em %. Use um ajuste de perda para baixá-lo.', to_char(v_lot.expiry_date, 'DD/MM/YYYY');
end if;
if public.setting_text('fefo_modo', 'avisar') = 'bloquear' then
select l.lot_id, l.expiry_date into v_first from public.v_lot_stock l
where l.product_id = new.product_id and l.balance > 0 and l.expiry_date is not null and l.expiry_date >= current_date
order by l.expiry_date limit 1;
if v_first.lot_id is not null and v_lot.expiry_date is not null and v_lot.expiry_date > v_first.expiry_date then
raise exception 'Use primeiro o lote que vence em % (regra FEFO).', to_char(v_first.expiry_date, 'DD/MM/YYYY');
end if;
end if;
end if;
if new.unit_cost is null then
if public.setting_text('custo_saida', 'medio') = 'primeira_entrada' then
select initial_unit_cost into new.unit_cost from public.products where id = new.product_id;
end if;
if new.unit_cost is null then
select case when sum(quantity) > 0 then sum(total_cost) / sum(quantity) else 0 end into new.unit_cost
from public.stock_movements where product_id = new.product_id and type = 'ENTRADA';
end if;
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

-- 3) Lotes com prioridade FEFO e faixa de vencimento
drop view if exists public.v_lot_stock cascade;
create view public.v_lot_stock with (security_invoker = true) as
with b as (
select lt.id as lot_id, lt.product_id, p.code, p.name, lt.lot_number, lt.expiry_date, lt.is_legacy, lt.created_at,
coalesce(sum(public.movement_signed_qty(m.type, m.quantity)), 0) as balance,
case when lt.expiry_date is null then null else lt.expiry_date - current_date end as days_to_expiry,
min(m.occurred_at) filter (where m.type = 'ENTRADA') as entry_date
from public.lots lt
join public.products p on p.id = lt.product_id
left join public.stock_movements m on m.lot_id = lt.id
group by lt.id, p.code, p.name
)
select b.*,
case when b.balance <= 0 then null
else row_number() over (partition by b.product_id, (b.balance > 0)
order by (b.days_to_expiry is not null and b.days_to_expiry < 0), b.expiry_date nulls last, b.entry_date nulls last, b.created_at) end as fefo_rank,
case when b.expiry_date is null then 'sem_validade'
when b.days_to_expiry < 0 then 'vencido'
when b.days_to_expiry <= public.setting_num('validade_critica_dias', 30) then 'critico'
when b.days_to_expiry <= public.setting_num('validade_atencao_dias', 60) then 'atencao'
when b.days_to_expiry <= public.setting_num('validade_aviso_dias', 90) then 'aviso'
else 'ok' end as expiry_status,
b.balance * coalesce((select case when sum(quantity) > 0 then sum(total_cost) / sum(quantity) end
from public.stock_movements x where x.product_id = b.product_id and x.type = 'ENTRADA'), 0) as value
from b;

-- 4) Inventário geral com próxima validade e parâmetros (recria v_product_stock)
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
lt as (
select product_id, min(expiry_date) filter (where balance > 0) as next_expiry,
count(*) filter (where balance > 0) as lots_with_balance,
coalesce(sum(balance) filter (where balance > 0 and expiry_date is null), 0) as qty_without_expiry,
coalesce(sum(balance) filter (where balance > 0 and expiry_status = 'vencido'), 0) as qty_expired
from public.v_lot_stock group by product_id
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
p.barcode, p.manufacturer_ref, p.preferred_supplier_id,
lt.next_expiry, coalesce(lt.lots_with_balance, 0) as lots_with_balance,
coalesce(lt.qty_without_expiry, 0) as qty_without_expiry, coalesce(lt.qty_expired, 0) as qty_expired
from public.products p
left join m on m.product_id = p.id
left join loc on loc.product_id = p.id
left join lt on lt.product_id = p.id
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
case when b.min_stock > 0 then b.exits_qty / b.min_stock else 0 end as turnover,
b.total_spent / tot.spent as pct_spent,
b.balance / tot.qty as pct_stock,
case when b.total_spent <= 0 then 'C'
when (abc.cum_spent - b.total_spent) / tot.spent < public.setting_num('abc_a_pct', 80) / 100 then 'A'
when (abc.cum_spent - b.total_spent) / tot.spent < public.setting_num('abc_b_pct', 95) / 100 then 'B'
else 'C' end as abc_class,
case when b.max_stock is not null and b.max_stock > b.balance then b.max_stock - b.balance
when b.balance < b.min_stock then greatest(b.min_stock * public.setting_num('compra_multiplicador', 2) - b.balance, 0)
else 0 end as suggested_purchase,
(select string_agg(pr.name, '/' order by pr.name) from public.product_processes pp
join public.processes pr on pr.id = pp.process_id where pp.product_id = b.product_id) as processes,
public.product_requires_lot(b.product_id) as requires_lot,
public.product_requires_expiry(b.product_id) as requires_expiry
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

-- resumo de vencimentos para o painel
create or replace view public.v_expiry_summary with (security_invoker = true) as
select expiry_status, count(*) as lots, count(distinct product_id) as products, coalesce(sum(balance), 0) as qty, coalesce(sum(value), 0) as value
from public.v_lot_stock where balance > 0 group by expiry_status;

-- 5) Validades do inventário da planilha -> lotes "saldo importado"
-- p = [{ "code": "IRC0001", "validades": [{"date": "2027-05-31", "qty": null}, ...] }, ...]
create or replace function public.aplicar_validades(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
x jsonb; v jsonb; v_prod uuid; v_legacy uuid; v_bal numeric; v_left numeric; v_q numeric; v_date date;
v_target uuid; v_cnt int; n_upd int := 0; n_split int := 0; n_skip int := 0; v_issues jsonb := '[]'::jsonb; v_batch uuid;
begin
if not public.has_role(array['admin']::public.user_role[]) then
raise exception 'Apenas administradores podem aplicar validades.';
end if;
select id into v_batch from public.import_batches where status = 'imported' order by imported_at desc nulls last limit 1;
for x in select * from jsonb_array_elements(coalesce(p, '[]'::jsonb)) loop
v_prod := null; v_legacy := null; v_bal := null; v_target := null;
select id into v_prod from public.products where code = x->>'code';
if v_prod is null then n_skip := n_skip + 1; v_issues := v_issues || jsonb_build_object('code', x->>'code', 'msg', 'produto não encontrado'); continue; end if;
select l.lot_id, l.balance into v_legacy, v_bal from public.v_lot_stock l where l.product_id = v_prod and l.is_legacy order by l.balance desc limit 1;
if v_legacy is null or v_bal <= 0 then n_skip := n_skip + 1; continue; end if;
select count(*) into v_cnt from jsonb_array_elements(x->'validades');
if v_cnt = 0 then continue; end if;
v_left := v_bal;
-- várias validades com quantidade: separa em lotes (ajuste de saída do saldo importado + ajuste de entrada no lote novo)
if v_cnt > 1 and not exists (select 1 from jsonb_array_elements(x->'validades') e where e->>'qty' is null) then
for v in select * from jsonb_array_elements(x->'validades') e order by (e->>'date') loop
v_q := least((v->>'qty')::numeric, v_left);
v_date := (v->>'date')::date;
if v_q <= 0 then continue; end if;
v_target := null;
select id into v_target from public.lots where product_id = v_prod and lot_number is null and expiry_date = v_date and not is_legacy;
if v_target is null then
insert into public.lots (product_id, expiry_date, is_legacy) values (v_prod, v_date, false) returning id into v_target;
end if;
insert into public.stock_movements (type, product_id, lot_id, quantity, reason, import_batch_id, occurred_at)
values ('AJUSTE', v_prod, v_legacy, -v_q, 'Distribuição de validade (inventário da planilha)', v_batch, current_date),
('AJUSTE', v_prod, v_target, v_q, 'Distribuição de validade (inventário da planilha)', v_batch, current_date);
v_left := v_left - v_q;
end loop;
n_split := n_split + 1;
if v_left > 0 then v_issues := v_issues || jsonb_build_object('code', x->>'code', 'msg', v_left || ' un. continuam sem validade (quantidades informadas menores que o saldo)'); end if;
else
-- uma validade (ou várias sem quantidade -> a mais próxima, por segurança)
v_target := null;
select min((e->>'date')::date) into v_date from jsonb_array_elements(x->'validades') e;
if v_cnt > 1 then v_issues := v_issues || jsonb_build_object('code', x->>'code', 'msg', 'várias validades sem quantidade: aplicada a mais próxima'); end if;
select id into v_target from public.lots where product_id = v_prod and lot_number is null and expiry_date = v_date and id <> v_legacy;
if v_target is not null then
update public.stock_movements set lot_id = v_target where lot_id = v_legacy;
delete from public.lots where id = v_legacy;
else
update public.lots set expiry_date = v_date where id = v_legacy;
end if;
n_upd := n_upd + 1;
end if;
end loop;
return jsonb_build_object('atualizados', n_upd, 'separados', n_split, 'ignorados', n_skip, 'avisos', v_issues);
end $$;
revoke all on function public.aplicar_validades(jsonb) from public, anon;
grant execute on function public.aplicar_validades(jsonb) to authenticated;

-- importação completa também aplica as validades
create or replace function public.import_planilha_completa(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_res jsonb; v_val jsonb;
begin
v_res := public.import_planilha(p);
v_val := public.aplicar_validades(coalesce(p->'validades', '[]'::jsonb));
return v_res || jsonb_build_object('validades', v_val);
end $$;
revoke all on function public.import_planilha_completa(jsonb) from public, anon;
grant execute on function public.import_planilha_completa(jsonb) to authenticated;

select 'OK - migration 6' as resultado, (select count(*) from public.app_settings) as parametros,
(select count(*) from public.v_lot_stock) as lotes, public.next_product_code() as proximo_codigo;
