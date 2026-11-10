# Estoque RC · Instituto RC Odontologia

Controle de estoque online (PWA para celular) que substitui a "Planilha de Controle de Estoque 4.0".

## Stack
- Next.js 15 (App Router) + TypeScript + Tailwind CSS 4
- Supabase (Postgres, Auth, Storage, RLS) — projeto `lphyexppwvtlckgcjfoq`
- Identidade visual: Brandbook Instituto RC (Azul Profundo #23272F, Branco Neve #F2F2F2, Ouro Fosco #D4C9BE, Marfim #D4D4D4; Clash Display + Hanken Grotesk)

## Regras de negócio
- Lote **e** validade obrigatórios para produtos de IMPLANTE, HOF e CIRURGIA.
- Validade obrigatória para os demais processos (lote opcional).
- Status do estoque idêntico à planilha: ≤0 Sem estoque · <25% do mínimo Quase sem · <120% Baixo · <200% Moderado · acima Confortável.
- Código de produto IRC#### gerado automaticamente.
- Saída bloqueada sem saldo; ajustes exigem motivo; tudo auditado.
- Perfis: admin, almoxarife, profissional (só saídas), leitura. O primeiro usuário criado vira admin.

## Rodar localmente
```bash
cp .env.example .env.local   # preencher URL e publishable key
npm install
npm run dev
```

## Banco de dados
Migrations em `supabase/migrations/`.

## Roadmap
- [x] Fase 0 — fundação: schema, RLS, auth, tema, navegação mobile, dashboard, lista de produtos
- [ ] Fase 1 — cadastros completos + importador da planilha
- [ ] Fase 2 — entradas/saídas mobile, scanner, lotes, inventário
- [ ] Fase 3 — relatórios, alertas, sugestão de compras
- [ ] Fase 4 — homologação e go-live
