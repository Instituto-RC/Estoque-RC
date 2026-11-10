-- Testes da migration 6 (FEFO, parâmetros, validade por processo).
-- Rodar no SQL Editor do Supabase: o bloco termina com erro proposital e TUDO é desfeito.
-- Resultado em 10/11/2026: 17 ok, 0 falhas.
do $$
declare
r text := ''; ok int := 0; fail int := 0;
p_imp uuid; p_cir uuid; p_ger uuid;
l_sem_lote uuid; l_a uuid; l_b uuid; l_cir uuid; l_venc uuid;
v_cost numeric; v_total numeric; v_code text; v_rank int; v_st text;
begin
select pr.id into p_imp from products pr join product_processes pp on pp.product_id = pr.id join processes ps on ps.id = pp.process_id where ps.name = 'IMPLANTE' and pr.min_stock > 0 limit 1;
select pr.id into p_cir from products pr join product_processes pp on pp.product_id = pr.id join processes ps on ps.id = pp.process_id where ps.name = 'CIRURGIA'
and not exists (select 1 from product_processes x join processes y on y.id = x.process_id where x.product_id = pr.id and y.requires_lot) limit 1;
select pr.id into p_ger from products pr join product_processes pp on pp.product_id = pr.id join processes ps on ps.id = pp.process_id where ps.name = 'GERAL'
and not exists (select 1 from product_processes x join processes y on y.id = x.process_id where x.product_id = pr.id and y.requires_lot) limit 1;

insert into lots (product_id, lot_number, expiry_date) values (p_imp, null, current_date + 365) returning id into l_sem_lote;
begin insert into stock_movements (type, product_id, lot_id, quantity, unit_cost) values ('ENTRADA', p_imp, l_sem_lote, 1, 10);
fail := fail + 1; r := r || E'\nFALHOU T1'; exception when others then ok := ok + 1; r := r || E'\nOK T1 IMPLANTE sem lote bloqueado'; end;

insert into lots (product_id, lot_number, expiry_date) values (p_imp, 'TESTE-A', current_date + 100) returning id into l_a;
insert into lots (product_id, lot_number, expiry_date) values (p_imp, 'TESTE-B', current_date + 400) returning id into l_b;
begin
insert into stock_movements (type, product_id, lot_id, quantity, unit_cost) values ('ENTRADA', p_imp, l_b, 5, 100);
insert into stock_movements (type, product_id, lot_id, quantity, unit_cost) values ('ENTRADA', p_imp, l_a, 5, 100);
ok := ok + 1; r := r || E'\nOK T2 duas entradas com validades diferentes';
exception when others then fail := fail + 1; r := r || E'\nFALHOU T2 ' || sqlerrm; end;

select fefo_rank into v_rank from v_lot_stock where lot_id = l_a;
select string_agg(coalesce(lot_number,'importado') || '=' || fefo_rank, ' ' order by fefo_rank) into v_st from v_lot_stock where product_id = p_imp and balance > 0;
if v_rank < (select fefo_rank from v_lot_stock where lot_id = l_b) then ok := ok + 1; r := r || E'\nOK T3 FEFO ordem (' || v_st || ')';
else fail := fail + 1; r := r || E'\nFALHOU T3 ' || v_st; end if;

update app_settings set value = '"bloquear"' where key = 'fefo_modo';
begin insert into stock_movements (type, product_id, lot_id, quantity) values ('SAIDA', p_imp, l_b, 1);
fail := fail + 1; r := r || E'\nFALHOU T4'; exception when others then ok := ok + 1; r := r || E'\nOK T4 FEFO bloquear: ' || sqlerrm; end;
begin insert into stock_movements (type, product_id, lot_id, quantity) values ('SAIDA', p_imp, l_a, 1);
ok := ok + 1; r := r || E'\nOK T5 saída do lote que vence primeiro';
exception when others then fail := fail + 1; r := r || E'\nFALHOU T5 ' || sqlerrm; end;
update app_settings set value = '"avisar"' where key = 'fefo_modo';
begin insert into stock_movements (type, product_id, lot_id, quantity) values ('SAIDA', p_imp, l_b, 1);
ok := ok + 1; r := r || E'\nOK T6 FEFO avisar permite lote posterior';
exception when others then fail := fail + 1; r := r || E'\nFALHOU T6 ' || sqlerrm; end;

if p_cir is not null then
insert into lots (product_id, lot_number, expiry_date) values (p_cir, null, current_date + 200) returning id into l_cir;
begin insert into stock_movements (type, product_id, lot_id, quantity, unit_cost) values ('ENTRADA', p_cir, l_cir, 2, 3);
ok := ok + 1; r := r || E'\nOK T7 CIRURGIA sem lote com validade';
exception when others then fail := fail + 1; r := r || E'\nFALHOU T7 ' || sqlerrm; end;
end if;

begin insert into stock_movements (type, product_id, quantity, unit_cost) values ('ENTRADA', p_ger, 1, 1);
fail := fail + 1; r := r || E'\nFALHOU T8'; exception when others then ok := ok + 1; r := r || E'\nOK T8 sem validade bloqueado'; end;
update processes set requires_expiry = false where name = 'GERAL';
begin insert into stock_movements (type, product_id, quantity, unit_cost) values ('ENTRADA', p_ger, 1, 1);
ok := ok + 1; r := r || E'\nOK T9 processo sem validade obrigatória';
exception when others then fail := fail + 1; r := r || E'\nFALHOU T9 ' || sqlerrm; end;
update processes set requires_expiry = true where name = 'GERAL';

begin insert into stock_movements (type, product_id, lot_id, quantity) values ('SAIDA', p_imp, l_a, 999999);
fail := fail + 1; r := r || E'\nFALHOU T10'; exception when others then ok := ok + 1; r := r || E'\nOK T10 saldo insuficiente'; end;

insert into lots (product_id, lot_number, expiry_date) values (p_imp, 'TESTE-VENC', current_date - 1) returning id into l_venc;
insert into stock_movements (type, product_id, lot_id, quantity, unit_cost, import_batch_id) values ('ENTRADA', p_imp, l_venc, 3, 100, (select id from import_batches where status = 'imported' limit 1));
begin insert into stock_movements (type, product_id, lot_id, quantity) values ('SAIDA', p_imp, l_venc, 1);
fail := fail + 1; r := r || E'\nFALHOU T11'; exception when others then ok := ok + 1; r := r || E'\nOK T11 lote vencido bloqueado'; end;
if (select expiry_status from v_lot_stock where lot_id = l_venc) = 'vencido' and (select expiry_status from v_lot_stock where lot_id = l_a) = 'ok'
then ok := ok + 1; r := r || E'\nOK T12 faixas de vencimento'; else fail := fail + 1; r := r || E'\nFALHOU T12'; end if;

begin insert into stock_movements (type, product_id, lot_id, quantity) values ('SAIDA', p_imp, l_a, 2) returning unit_cost, total_cost into v_cost, v_total;
if v_cost > 0 and v_total = round(v_cost * 2, 4) then ok := ok + 1; r := r || E'\nOK T13 custo médio na saída';
else fail := fail + 1; r := r || E'\nFALHOU T13'; end if;
exception when others then fail := fail + 1; r := r || E'\nFALHOU T13 ' || sqlerrm; end;

if stock_status(11, 10) = 'Estoque baixo' then
update app_settings set value = '50' where key = 'status_baixo_pct';
if stock_status(11, 10) = 'Estoque moderado' then ok := ok + 1; r := r || E'\nOK T14 faixa de status configurável'; else fail := fail + 1; r := r || E'\nFALHOU T14'; end if;
else fail := fail + 1; r := r || E'\nFALHOU T14 base'; end if;

begin insert into products (name, min_stock) values ('PRODUTO TESTE', 1) returning code into v_code;
if v_code ~ '^IRC\d{4}$' then ok := ok + 1; r := r || E'\nOK T15 código automático ' || v_code; else fail := fail + 1; r := r || E'\nFALHOU T15 ' || v_code; end if;
exception when others then fail := fail + 1; r := r || E'\nFALHOU T15 ' || sqlerrm; end;

begin insert into stock_movements (type, product_id, quantity) values ('AJUSTE', p_ger, -1);
fail := fail + 1; r := r || E'\nFALHOU T16'; exception when others then ok := ok + 1; r := r || E'\nOK T16 ajuste sem motivo bloqueado'; end;

if (select count(*) from v_expiry_summary) > 0 and (select count(*) from v_product_stock) = (select count(*) from products)
then ok := ok + 1; r := r || E'\nOK T17 visões de inventário e vencimentos'; else fail := fail + 1; r := r || E'\nFALHOU T17'; end if;

raise exception 'RESULTADO: % ok, % falhas (tudo desfeito)%', ok, fail, r;
end $$;
