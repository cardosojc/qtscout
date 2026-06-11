// AUTO-GENERATED from api/app/core/ordem_categories.json by `npm run sync:categories`.
// Do not edit by hand — edit the JSON (the single source of truth) and re-run.
import type { CategorySpec } from './ordem-item'

export const ORDEM_CATEGORIES = [
  { key: "RESOLUCAO", label: "Resolução do Conselho de Agrupamento", shape: "STRING", scope: "GROUP" },
  { key: "DETERMINACAO", label: "Determinação do Conselho de Agrupamento", shape: "STRING", scope: "GROUP" },
  { key: "ATIVIDADE", label: "Atividade", shape: "ATIVIDADE", scope: "BOTH" },
  { key: "CRIACAO", label: "Criação (bando/patrulha/equipa/tribo)", shape: "STRING", scope: "SECTION" },
  { key: "EXTINCAO", label: "Extinção (bando/patrulha/equipa/tribo)", shape: "STRING", scope: "SECTION" },
  { key: "NOMEACAO_DIRIGENTE", label: "Nomeação/Exoneração de Dirigente", shape: "PROFILE_REF", scope: "GROUP" },
  { key: "NOMEACAO_SECCAO", label: "Nomeação/Exoneração na Secção", shape: "SCOUT_OR_PROFILE_REF", scope: "SECTION" },
  { key: "NOMEACAO_DEPARTAMENTO", label: "Nomeação/Exoneração em Departamento", shape: "STRING", scope: "GROUP" },
  { key: "READMISSAO", label: "Readmissão de Associado", shape: "MEMBER_REF", scope: "SECTION" },
  { key: "TRANSFERENCIA", label: "Transferência de Associado", shape: "MEMBER_REF", scope: "SECTION" },
  { key: "PASSAGEM", label: "Passagem de Secção", shape: "MEMBER_REF", scope: "SECTION" },
  { key: "INVESTIDURA", label: "Investidura", shape: "MEMBER_REF", scope: "SECTION" },
  { key: "SAIDA_ATIVO_SECCAO", label: "Saída do Ativo (Secção)", shape: "MEMBER_REF", scope: "SECTION" },
  { key: "SAIDA_ATIVO_DIRIGENTE", label: "Saída do Ativo (Dirigente)", shape: "STRING", scope: "GROUP" },
  { key: "PROGRESSO", label: "Sistema de Progresso", shape: "MEMBER_REF", scope: "SECTION" },
  { key: "ACCAO_DISCIPLINAR", label: "Ação Disciplinar", shape: "STRING", scope: "GROUP" },
  { key: "DISTINCAO_PREMIO", label: "Distinção ou Prémio", shape: "TEXT", scope: "GROUP" },
  { key: "RETIFICACAO", label: "Retificação", shape: "STRING", scope: "GROUP" },
] as const satisfies readonly CategorySpec[]
