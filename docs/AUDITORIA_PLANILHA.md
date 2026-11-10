# Auditoria completa — Planilha de Controle de Estoque 4.0 × Estoque RC
Instituto RC Odontologia · 10/11/2026

## 1. Resultado da carga oficial

| Indicador (RELA_GERA) | Planilha | Estoque RC | Situação |
|---|---|---|---|
| Variedade de itens | 398 | 398 | ✓ igual |
| Quantidade em estoque | 20.878 | 20.878 | ✓ igual |
| Total de compras | R$ 913.813,46 | R$ 913.813,46 | ✓ igual |
| Total de saídas (R$) | R$ 128.750,72 | R$ 118.813,89 | corrigido (erro de fórmula, item 2.1) |
| Valor total em estoque | R$ 785.062,75 | **R$ 794.999,57** | corrigido (consequência do 2.1) |

Carga: 398 produtos, 15 fornecedores, 33 locais, 1 centro, 2 profissionais, 398 entradas (24 com qtd. 0 descartadas), 455 saídas. **0 erros bloqueantes.**
Status por produto: 74 sem estoque · 12 quase sem · 136 baixo · 63 moderado · 113 confortável. Diferenças em relação ao INVE_GERA: 4 produtos, todos por erro da planilha (item 2.3).

## 2. Erros encontrados na planilha (e como o sistema trata)

### 2.1 Valores errados
| # | Aba | Problema | Impacto | Tratamento |
|---|---|---|---|---|
| 1 | MOVI_SAID J | 42 saídas (linhas 155, 166–168, 355–401, 411) calculam o valor com a **quantidade da linha de baixo** (`…*H(n+1)`) | Saídas infladas em R$ 9.936,83 (ex.: caixa coletora 3 un. = R$ 2.180 em vez de R$ 65,40; Mini Pilar DP0200 = R$ 6.723 em vez de R$ 336,15) | Recalculado: qtde × custo de 1ª entrada |
| 2 | MOVI_SAID J/E | 28 fórmulas apontam para **outro arquivo** (`[1]CADA_PROD` no Downloads da Missiane) | Valores congelados; quebram se o arquivo sumir | Ignorado — usa o cadastro importado |
| 3 | MOVI_ENTR H | 14 custos puxados da **linha de cima** (`VLOOKUP(D(n-1))`) | Hoje coincidem (mesmo preço), mas é bomba-relógio | Conferido e importado o valor |
| 4 | MOVI_ENTR I | Quantidades digitadas como conta (40+36, 19+2, 5+2) | — | Importado o resultado |
| 5 | Custos | 3 custos com 6 casas decimais (R$ 0,183272) | Arredondamento | Banco com 6 casas |

### 2.2 Relatórios que não fecham
| # | Aba | Problema | Tratamento |
|---|---|---|---|
| 6 | MOVI_ENTR B / MOVI_SAID B | 22 entradas e 19 saídas **sem a fórmula do mês** (+ 3 com `#REF!`) → ficam fora do RELA_GERA (por isso o mensal soma R$ 850 mil e não R$ 913 mil) | Mês vem da data |
| 7 | RELA_GERA linha 9 | Jan–Jul somam **quantidade**, Ago–Dez somam **R$** na mesma linha | Relatório mensal recalculado |
| 8 | DASH_BOAR | "Total de gastos" R$ 914.603,87 ≠ total de compras (duplicados contados 2×) | Totais únicos |
| 9 | DASH_INDI | "Quantidade em estoque" mostra **Saídas**; "Status" mostra o saldo | Ficha do produto correta |
| 10 | DASH_REPR / INVE_GERA Q | ADRENALINA com valor 174 digitado na coluna de desempate → aparece com relevância 17.400% e "Demais produtos" negativo | Ranking por % real |
| 11 | RELA_ANA | "Estoque mínimo" mostra a **prateleira**; "Prazo médio de entrega" usa a coluna Processo; ABC baseada em % de estoque (quase tudo "C") | Curva ABC por gasto (80/15/5) |

### 2.3 Cadastro e inventário
| # | Problema | Tratamento |
|---|---|---|
| 12 | INVE_GERA linha 85: nome digitado por cima da fórmula → ESCALPE 21G E 23G aparece com 0, mas tem **23** | Saldo correto (23) |
| 13 | Entrada "RENNOVA- ESPUMA DE LIMPEZA FACIAL" com nome incompleto → 3 unidades **fora do inventário**; IRC0352 aparecia "Sem estoque" | Vinculada ao IRC0352 (mesmo custo/data) |
| 14 | Nomes duplicados: IRC0118 = IRC0396 e IRC0256 = IRC0257 → SUMIFS soma o saldo 2× (IRC0396 mostrava 25 falsos) | Movimentos no 1º código; duplicado marcado "revisar" |
| 15 | IRC0398 não aparece no INVE_GERA; 60 produtos ausentes do INVE_CENT; `#REF!` na coluna B do INVE_CENT | Inventário por centro calculado das movimentações |
| 16 | IRC0396–0398 sem unidade/processo/mínimo/custo; IRC0399 sem nome | Importados com "revisar cadastro"; IRC0399 ignorado; novos códigos a partir de IRC0400 |
| 17 | IRC0202–0205 sem custo de 1ª entrada | Preenchido pela 1ª entrada (R$ 208,50 / 187,65) |
| 18 | 31 nomes com espaços extras; "unid"; "31/078" como data; "HOF/IMPLANTE" em uma célula | Limpos; data da 1ª entrada; dois processos |
| 19 | 83 entradas com "Fornecedor 2" (texto do modelo) + 39 sem fornecedor | "FORNECEDOR NÃO INFORMADO" |
| 20 | IRC0241 Mini Pilar CMI 17° H3.5 com saldo **−20** | Importado como está, marcado para contagem |
| 21 | Lista suspensa de produto da MOVI_ENTR lê a própria coluna; da MOVI_SAID aponta para `#REF!` | Busca no cadastro + leitor de código de barras |
| 22 | Coluna "Validade" do INVE_CENT 100% vazia; nenhum lote registrado | Lote/validade por entrada; saldo importado = "Saldo importado da planilha" (informar lote/validade na conferência) |

## 3. Regras da planilha mantidas no sistema
- Status: ≤0 Sem estoque · <25% do mínimo Quase sem · <120% Baixo · <200% Moderado · senão Confortável (sem mínimo → "Sem mínimo definido").
- Custo médio = Σ compras ÷ Σ qtde de entradas. Giro = saídas ÷ estoque mínimo (fórmula INVE_GERA!O).
- % de gastos, % no estoque, local = local da 1ª entrada, análise mensal por produto e por centro.

## 4. Regras novas
- Lote **e** validade obrigatórios: IMPLANTE, HOF. Validade obrigatória: todos os demais (incl. CIRURGIA).
- Saída escolhe o lote que vence primeiro (FEFO); lote vencido bloqueado; saldo nunca negativo; ajuste exige motivo.
- Toda alteração fica no histórico (auditoria). Perfis: Administrador, Almoxarife, Profissional (só saídas), Consulta. Novo usuário entra inativo até o admin liberar.

## 5. Testes executados
- Simulação local do importador com o arquivo real; carga oficial; **reimportação** (substitui sem duplicar).
- 13 testes automáticos no banco (`supabase/tests/regras_negocio.sql`, tudo desfeito ao final): lote obrigatório, CIRURGIA sem lote, validade obrigatória, saldo insuficiente, saída sem lote, lote vencido, custo médio na saída, ajuste com/sem motivo, código IRC automático, regra de status, auditoria — **13/13 ok**.
- Interface: login, painel, produtos/filtros, ficha do produto, entrada (bloqueio sem validade/lote), saída (FEFO e saldo insuficiente), inventário, relatórios, cadastros; páginas protegidas sem login.

## 6. Pendências para a equipe (sistema já sinaliza)
1. Revisar 6 produtos "revisar cadastro" (duplicados IRC0257/IRC0396, IRC0397/0398 incompletos, IRC0241 negativo, IRC0352).
2. Conferir as prateleiras e informar lote/validade do "saldo importado" (prioridade: IMPLANTE e HOF).
3. Completar fornecedores reais das 122 entradas "não informado", se desejado.

## 7. Atualização — "Planilha de Controle de Estoque - Atual.xlsx" (10/11/2026)
Comparação célula a célula com a versão anterior:
- **INVE_CENT coluna O ("Validade Produto")**: 343 linhas preenchidas — 326 datas (01/01/2027 a 01/08/2034, nenhuma vencida) e 17 "sem estoque".
- **CADA_PROD**: IRC0396–IRC0398 completados (mín. 20, custo R$ 23,60, UNID, IMPLANTE); linha vazia IRC0399 removida.
- **MOVI_ENTR / MOVI_SAID / cadastros auxiliares**: sem alteração. Totais iguais (398 itens, 20.878 un., R$ 913.813,46).

Carga completa refeita com a planilha atual (0 lançamentos manuais no sistema):

| Faixa | Lotes | Unidades | Valor |
|---|---|---|---|
| OK (> 90 dias) | 277 | 19.596 | R$ 768.767,58 |
| Atenção (≤ 60 dias) | 2 | 2 | R$ 66,26 |
| Sem validade | 45 | 1.300 | R$ 28.439,62 |

Sem validade: 42 produtos que não aparecem na aba INVE_CENT (erro antigo da planilha) + 3 marcados "sem estoque" com saldo no sistema (IRC0073 Micropório 1, IRC0290 Membrana importada 2, IRC0295 Osso importado 1g 2) — conferência física. Lista em "Conferencia de validades - 45 produtos.xlsx".
47 validades pertencem a produtos com saldo zero e não geram lote.

Testes de regra da versão 2 (`supabase/tests/regras_v2_fefo_parametros.sql`): 17/17 ok.
