-- Estoque RC - Migration 5: novos códigos começam em IRC0400 (IRC0399 era linha vazia na planilha)
create or replace function public.next_product_code()
returns text language sql volatile as $$
select 'IRC' || lpad((greatest(coalesce(max(substring(code from 4)::int), 0), 399) + 1)::text, 4, '0')
from public.products where code ~ '^IRC[0-9]+$'
$$;
select public.next_product_code() as proximo_codigo;
