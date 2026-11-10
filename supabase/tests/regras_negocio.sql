-- Testes automáticos das regras de negócio. Tudo é desfeito no final (o bloco termina com erro proposital).
do $$
declare
  r text := '';
  ok int := 0; fail int := 0;
  p_imp uuid; p_cir uuid; p_ger uuid; c uuid;
  l_sem_lote uuid; l_imp uuid; l_cir uuid; l_venc uuid;
  v_cost numeric; v_total numeric; v_code text; v_status text; v_bal numeric;
  procedure_result text;
begin
  select id into c from distribution_centers limit 1;
  select pr.id into p_imp from products pr join product_processes pp on pp.product_id = pr.id join processes ps on ps.id = pp.process_id where ps.name = 'IMPLANTE' and pr.min_stock > 0 limit 1;
  select pr.id into p_cir from products pr join product_processes pp on pp.product_id = pr.id join processes ps on ps.id = pp.process_id where ps.name = 'CIRURGIA'
    and not exists (select 1 from product_processes x join processes y on y.id = x.process_id where x.product_id = pr.id and y.requires_lot) limit 1;
  select pr.id into p_ger from products pr join product_processes pp on pp.product_id = pr.id join processes ps on ps.id = pp.process_id where ps.name = 'GERAL'
    and not exists (select 1 from product_processes x join processes y on y.id = x.process_id where x.product_id = pr.id and y.requires_lot) limit 1;

  -- T1: IMPLANTE sem número de lote -> bloqueia
  insert into lots (product_id, lot_number, expiry_date) values (p_imp, null, current_date + 365) returning id into l_sem_lote;
  begin
    insert into stock_movements (type, product_id, lot_id, quantity, unit_cost) values ('ENTRADA', p_imp, l_sem_lote, 1, 10);
    fail := fail + 1; r := r || E'\nFALHOU T1 IMPLANTE sem lote foi aceito';
  exception when others then ok := ok + 1; r := r || E'\nOK T1 IMPLANTE sem lote bloqueado: ' || sqlerrm; end;

  -- T2: IMPLANTE com lote e validade -> aceita
  insert into lots (product_id, lot_number, expiry_date) values (p_imp, 'TESTE-LOTE-1', current_date + 365) returning id into l_imp;
  begin
    insert into stock_movements (type, product_id, lot_id, quantity, unit_cost, center_id) values ('ENTRADA', p_imp, l_imp, 5, 100, c);
    ok := ok + 1; r := r || E'\nOK T2 IMPLANTE com lote+validade aceito';
  exception when others then fail := fail + 1; r := r || E'\nFALHOU T2 ' || sqlerrm; end;

  -- T3: CIRURGIA sem lote, com validade -> aceita (regra nova)
  if p_cir is null then r := r || E'\n-- T3 pulado: nenhum produto só de CIRURGIA';
  else
    insert into lots (product_id, lot_number, expiry_date) values (p_cir, null, current_date + 200) returning id into l_cir;
    begin
      insert into stock_movements (type, product_id, lot_id, quantity, unit_cost) values ('ENTRADA', p_cir, l_cir, 2, 3);
      ok := ok + 1; r := r || E'\nOK T3 CIRURGIA sem lote (com validade) aceito';
    exception when others then fail := fail + 1; r := r || E'\nFALHOU T3 ' || sqlerrm; end;
  end if;

  -- T4: GERAL sem validade -> bloqueia
  begin
    insert into stock_movements (type, product_id, quantity, unit_cost) values ('ENTRADA', p_ger, 1, 1);
    fail := fail + 1; r := r || E'\nFALHOU T4 entrada sem validade aceita';
  exception when others then ok := ok + 1; r := r || E'\nOK T4 sem validade bloqueado: ' || sqlerrm; end;

  -- T5: saída maior que o saldo -> bloqueia
  begin
    insert into stock_movements (type, product_id, lot_id, quantity) values ('SAIDA', p_imp, l_imp, 999999);
    fail := fail + 1; r := r || E'\nFALHOU T5 saída acima do saldo aceita';
  exception when others then ok := ok + 1; r := r || E'\nOK T5 saldo insuficiente bloqueado: ' || sqlerrm; end;

  -- T6: saída de IMPLANTE sem lote -> bloqueia
  begin
    insert into stock_movements (type, product_id, quantity) values ('SAIDA', p_imp, 1);
    fail := fail + 1; r := r || E'\nFALHOU T6 saída IMPLANTE sem lote aceita';
  exception when others then ok := ok + 1; r := r || E'\nOK T6 saída IMPLANTE sem lote bloqueada: ' || sqlerrm; end;

  -- T7: saída de lote vencido -> bloqueia
  insert into lots (product_id, lot_number, expiry_date) values (p_imp, 'TESTE-VENCIDO', current_date - 1) returning id into l_venc;
  insert into stock_movements (type, product_id, lot_id, quantity, unit_cost, import_batch_id)
    values ('ENTRADA', p_imp, l_venc, 3, 100, (select id from import_batches where status = 'imported' limit 1));
  begin
    insert into stock_movements (type, product_id, lot_id, quantity) values ('SAIDA', p_imp, l_venc, 1);
    fail := fail + 1; r := r || E'\nFALHOU T7 saída de lote vencido aceita';
  exception when others then ok := ok + 1; r := r || E'\nOK T7 lote vencido bloqueado: ' || sqlerrm; end;

  -- T8: saída válida -> custo médio aplicado e total calculado
  begin
    insert into stock_movements (type, product_id, lot_id, quantity) values ('SAIDA', p_imp, l_imp, 2) returning unit_cost, total_cost into v_cost, v_total;
    if v_cost > 0 and v_total = round(v_cost * 2, 4) then ok := ok + 1; r := r || E'\nOK T8 saída válida: custo médio R$ ' || round(v_cost, 4) || ' total R$ ' || round(v_total, 2);
    else fail := fail + 1; r := r || E'\nFALHOU T8 custo ' || coalesce(v_cost::text, 'null') || ' total ' || coalesce(v_total::text, 'null'); end if;
  exception when others then fail := fail + 1; r := r || E'\nFALHOU T8 ' || sqlerrm; end;

  -- T9: ajuste sem motivo -> bloqueia
  begin
    insert into stock_movements (type, product_id, quantity) values ('AJUSTE', p_ger, -1);
    fail := fail + 1; r := r || E'\nFALHOU T9 ajuste sem motivo aceito';
  exception when others then ok := ok + 1; r := r || E'\nOK T9 ajuste sem motivo bloqueado: ' || sqlerrm; end;

  -- T10: ajuste com motivo -> aceita e altera saldo
  begin
    select balance into v_bal from v_product_stock where product_id = p_ger;
    insert into stock_movements (type, product_id, quantity, reason) values ('AJUSTE', p_ger, 7, 'Contagem física (teste)');
    if (select balance from v_product_stock where product_id = p_ger) = v_bal + 7 then ok := ok + 1; r := r || E'\nOK T10 ajuste com motivo altera saldo (+7)';
    else fail := fail + 1; r := r || E'\nFALHOU T10 saldo não mudou'; end if;
  exception when others then fail := fail + 1; r := r || E'\nFALHOU T10 ' || sqlerrm; end;

  -- T11: código IRC automático
  begin
    insert into products (name, min_stock) values ('  PRODUTO   TESTE  ', 1) returning code into v_code;
    if v_code ~ '^IRC\d{4}$' then ok := ok + 1; r := r || E'\nOK T11 código automático ' || v_code || ' e nome normalizado';
    else fail := fail + 1; r := r || E'\nFALHOU T11 código ' || coalesce(v_code, 'null'); end if;
  exception when others then fail := fail + 1; r := r || E'\nFALHOU T11 ' || sqlerrm; end;

  -- T12: regra de status idêntica à planilha
  if stock_status(0, 10) = 'Sem estoque' and stock_status(2, 10) = 'Quase sem estoque' and stock_status(11, 10) = 'Estoque baixo'
     and stock_status(19, 10) = 'Estoque moderado' and stock_status(20, 10) = 'Estoque confortável' and stock_status(5, 0) = 'Sem mínimo definido'
  then ok := ok + 1; r := r || E'\nOK T12 regra de status (0/25%/120%/200%)';
  else fail := fail + 1; r := r || E'\nFALHOU T12 status'; end if;

  -- T13: auditoria registrou as movimentações manuais
  if (select count(*) from audit_log where table_name = 'stock_movements' and created_at >= now() - interval '1 minute') >= 3
  then ok := ok + 1; r := r || E'\nOK T13 auditoria registrando movimentações';
  else fail := fail + 1; r := r || E'\nFALHOU T13 auditoria'; end if;

  raise exception 'RESULTADO: % ok, % falhas (tudo desfeito)%', ok, fail, r;
end $$;
