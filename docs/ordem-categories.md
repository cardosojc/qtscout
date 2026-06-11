# Ordem de Serviço — category catalog

Generated from `api/app/core/ordem_categories.json` and `api/app/core/ordem_assembler.py`.
Do not edit by hand — run `npm run docs:sync`.

| Category | Shape | Scope | Snapshot bucket |
|---|---|---|---|
| `RESOLUCAO` | STRING | GROUP | `data["determinacoes"]["resolucoes"]` |
| `DETERMINACAO` | STRING | GROUP | `data["determinacoes"]["determinacoes"]` |
| `ATIVIDADE` | ATIVIDADE | BOTH | `data["atividades"][section]` / `data["atividades"]["agrupamento"]` |
| `CRIACAO` | STRING | SECTION | `data["criacaoExtincao"]["criacao"][section]` |
| `EXTINCAO` | STRING | SECTION | `data["criacaoExtincao"]["extincao"][section]` |
| `NOMEACAO_DIRIGENTE` | PROFILE_REF | GROUP | `data["nomeacoes"]["dirigentes"]` |
| `NOMEACAO_SECCAO` | SCOUT_OR_PROFILE_REF | SECTION | `data["nomeacoes"][section]` |
| `NOMEACAO_DEPARTAMENTO` | STRING | GROUP | `data["nomeacoes"]["departamentos"]` |
| `READMISSAO` | MEMBER_REF | SECTION | `data["efetivo"]["readmissao"][section]` |
| `TRANSFERENCIA` | MEMBER_REF | SECTION | `data["efetivo"]["transferencia"][section]` |
| `PASSAGEM` | MEMBER_REF | SECTION | `data["efetivo"]["passagens"][section]` |
| `INVESTIDURA` | MEMBER_REF | SECTION | `data["efetivo"]["investiduras"][section]` |
| `SAIDA_ATIVO_SECCAO` | MEMBER_REF | SECTION | `data["efetivo"]["saidaAtivo"][section]` |
| `SAIDA_ATIVO_DIRIGENTE` | STRING | GROUP | `data["efetivo"]["saidaAtivo"]["dirigentes"]` |
| `PROGRESSO` | MEMBER_REF | SECTION | `data["sistemaProgresso"][section]` |
| `ACCAO_DISCIPLINAR` | STRING | GROUP | `data["justicaDisciplina"]["accoesDisicplinares"]` |
| `DISTINCAO_PREMIO` | TEXT | GROUP | — |
| `RETIFICACAO` | STRING | GROUP | `data["retificacoes"]` |

Also folded in at generation time (not a manual category):

- `Scout.joinedAt in OS period` → `data["efetivo"]["admissao"][section]` (see `api/app/routers/ordens_servico.py`)

## Unmapped categories

_None — every catalog entry has at least one branch in the assembler._
