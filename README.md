# Estoque RC · Instituto RC Odontologia

Controle de estoque online (PWA para celular) que substitui a "Planilha de Controle de Estoque 4.0".

## Stack
- Next.js 15 (App Router) + TypeScript + Tailwind CSS 4
- Supabase (Postgres, Auth, Storage, RLS) — projeto `lphyexppwvtlckgcjfoq`
- Identidade visual: Brandbook Instituto RC (Azul Profundo #23272F, Branco Neve #F2F2F2, Ouro Fosco #D4C9BE, Marfim #D4D4D4; Clash Display + Hanken Grotesk)

## Regras de negócio
- Lote **e** validade obrigatórios para IMPLANTE e HOF; validade obrigatória para todos os demais (inclusive CIRURGIA).
- Status igual à planilha: ≤0 Sem estoque · <25% do mínimo Quase sem · <120% Baixo · <200% Moderado · acima Confortável.
- Saída por FEFO, bloqueio de lote vencido e de saldo insuficiente; ajustes exigem motivo; auditoria de tudo.
- Código IRC#### automático (novos a partir de IRC0400).
- Perfis: admin, almoxarife, profissional (só saídas), leitura. Primeiro usuário = admin; novos usuários entram inativos.

## Importação da planilha
Mais → Importar planilha (admin). Prévia com conferência contra a aba RELA_GERA, lista de correções e gravação em transação única (`import_planilha`). Pode ser refeita enquanto não houver movimentações lançadas pelo sistema.
Simulação local: `npx tsx scripts/simular-importacao.ts "<planilha.xlsx>"`. Auditoria completa em `docs/AUDITORIA_PLANILHA.md`.

## Rodar localmente
```bash
cp .env.example .env.local   # preencher URL e publishable key
npm install
npm run dev
```

## Banco de dados
Migrations em `supabase/migrations/` (aplicar em ordem). Testes de regras em `supabase/tests/regras_negocio.sql` (desfazem tudo ao final).

## Roadmap
- [x] Fase 0 — fundação: schema, RLS, auth, tema, navegação mobile, dashboard, lista de produtos
- [x] Fase 1 — cadastros completos + importador da planilha (carga oficial feita)
- [x] Fase 2 — entradas/saídas mobile, scanner, lotes, inventário (versão 1)
- [x] Fase 3 — relatórios, lista de compras, parâmetros configuráveis, FEFO e validades (alertas por e-mail/WhatsApp pendentes)
- [x] Carga oficial com a planilha atual (validades do inventário aplicadas)
- [ ] Fase 4 — homologação e go-live
