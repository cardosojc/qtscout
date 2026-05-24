# Ordem de Serviço — category catalog

Generated from `src/types/ordem-item.ts` and `src/lib/ordem-assembler.ts`.
Do not edit by hand — run `npm run docs:sync`.

| Category | Shape | Scope | Snapshot bucket |
|---|---|---|---|
| `RESOLUCAO` | STRING | GROUP | `data.determinacoes.resolucoes.push` |
| `DETERMINACAO` | STRING | GROUP | `data.determinacoes.determinacoes.push` |
| `ATIVIDADE` | ATIVIDADE | BOTH | `data.atividades[section].push` / `data.atividades.agrupamento.push` |
| `CRIACAO` | STRING | SECTION | `data.criacaoExtincao.criacao[section].push` |
| `EXTINCAO` | STRING | SECTION | `data.criacaoExtincao.extincao[section].push` |
| `NOMEACAO_DIRIGENTE` | PROFILE_REF | GROUP | `data.nomeacoes.dirigentes.push` |
| `NOMEACAO_SECCAO` | SCOUT_OR_PROFILE_REF | SECTION | `data.nomeacoes[section].push` |
| `NOMEACAO_DEPARTAMENTO` | STRING | GROUP | `data.nomeacoes.departamentos.push` |
| `READMISSAO` | MEMBER_REF | SECTION | `data.efetivo.readmissao[section].push` |
| `TRANSFERENCIA` | MEMBER_REF | SECTION | `data.efetivo.transferencia[section].push` |
| `PASSAGEM` | MEMBER_REF | SECTION | `data.efetivo.passagens[section].push` |
| `INVESTIDURA` | MEMBER_REF | SECTION | `data.efetivo.investiduras[section].push` |
| `SAIDA_ATIVO_SECCAO` | MEMBER_REF | SECTION | `data.efetivo.saidaAtivo[section].push` |
| `SAIDA_ATIVO_DIRIGENTE` | STRING | GROUP | `data.efetivo.saidaAtivo.dirigentes.push` |
| `PROGRESSO` | MEMBER_REF | SECTION | `data.sistemaProgresso[section].push` |
| `NOITES_CAMPO` | NOITES_REF | SECTION | `data.noitesCampo[section].push` |
| `ACCAO_DISCIPLINAR` | STRING | GROUP | `data.justicaDisciplina.accoesDisicplinares.push` |
| `DISTINCAO_PREMIO` | TEXT | GROUP | — |
| `RETIFICACAO` | STRING | GROUP | `data.retificacoes.push` |

Also folded in at generation time (not a manual category):

- `Scout.joinedAt in OS period` → `data.efetivo.admissao[section]` (see `src/app/api/ordens-servico/generate/route.ts`)

## Unmapped categories

_None — every catalog entry has at least one matching `case` in the assembler._
