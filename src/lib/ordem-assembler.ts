import type { OrdemItem } from '@prisma/client'
import {
  defaultOrdemServicoData,
  type OSAtividade,
  type OSNoitesMilestone,
  type OSNomeacao,
  type OrdemServicoData,
} from '@/types/ordem-servico'
import type { OrdemSection } from '@/types/ordem-item'
import { profileLabel, scoutLabel, type ResolvedRef } from '@/lib/ordem-resolver'

const SECTION_KEY: Record<OrdemSection, 'alcateia' | 'expedicao' | 'comunidade' | 'cla'> = {
  ALCATEIA: 'alcateia',
  EXPEDICAO: 'expedicao',
  COMUNIDADE: 'comunidade',
  CLA: 'cla',
}

type StringData = { value: string }

function asString(data: unknown): string {
  const v = (data as StringData | null)?.value
  return typeof v === 'string' ? v : ''
}

function asAtividade(data: unknown): OSAtividade {
  const d = (data ?? {}) as Partial<OSAtividade>
  return {
    nome: typeof d.nome === 'string' ? d.nome : '',
    datas: typeof d.datas === 'string' ? d.datas : '',
    local: typeof d.local === 'string' ? d.local : '',
  }
}

function refScoutName(data: unknown, refs: ResolvedRef): string {
  const d = (data ?? {}) as Record<string, unknown>
  if (typeof d.scoutId !== 'string') return ''
  return scoutLabel(refs.scouts.get(d.scoutId))
}

function refProfileNomeacao(data: unknown, refs: ResolvedRef): OSNomeacao {
  const d = (data ?? {}) as Record<string, unknown>
  const profile = typeof d.profileId === 'string' ? refs.profiles.get(d.profileId) : undefined
  return {
    nome: profileLabel(profile),
    cargo: typeof d.cargo === 'string' ? d.cargo : '',
  }
}

function refMixedNomeacao(data: unknown, refs: ResolvedRef): OSNomeacao {
  const d = (data ?? {}) as Record<string, unknown>
  const nome =
    d.kind === 'scout' && typeof d.refId === 'string'
      ? scoutLabel(refs.scouts.get(d.refId))
      : d.kind === 'profile' && typeof d.refId === 'string'
        ? profileLabel(refs.profiles.get(d.refId))
        : ''
  return { nome, cargo: typeof d.cargo === 'string' ? d.cargo : '' }
}

function refNoites(data: unknown, refs: ResolvedRef): OSNoitesMilestone {
  const d = (data ?? {}) as Record<string, unknown>
  const count = typeof d.count === 'number' ? d.count : 0
  const membros = Array.isArray(d.scoutIds)
    ? d.scoutIds
        .filter((id): id is string => typeof id === 'string')
        .map((id) => scoutLabel(refs.scouts.get(id)))
    : []
  return { count, membros }
}

export function assembleOrdemServico(
  items: OrdemItem[],
  periodo: { de: string; ate: string },
  refs: ResolvedRef
): OrdemServicoData {
  const data = defaultOrdemServicoData()
  data.periodo = periodo

  const distincaoPieces: string[] = []

  for (const item of items) {
    const section = item.section ? SECTION_KEY[item.section as OrdemSection] : null

    switch (item.category) {
      case 'RESOLUCAO':
        data.determinacoes.resolucoes.push(asString(item.data))
        break
      case 'DETERMINACAO':
        data.determinacoes.determinacoes.push(asString(item.data))
        break

      case 'ATIVIDADE':
        if (section) data.atividades[section].push(asAtividade(item.data))
        else data.atividades.agrupamento.push(asAtividade(item.data))
        break

      case 'CRIACAO':
        if (section) data.criacaoExtincao.criacao[section].push(asString(item.data))
        break
      case 'EXTINCAO':
        if (section) data.criacaoExtincao.extincao[section].push(asString(item.data))
        break

      case 'NOMEACAO_DIRIGENTE':
        data.nomeacoes.dirigentes.push(refProfileNomeacao(item.data, refs))
        break
      case 'NOMEACAO_SECCAO':
        if (section) data.nomeacoes[section].push(refMixedNomeacao(item.data, refs))
        break
      case 'NOMEACAO_DEPARTAMENTO':
        data.nomeacoes.departamentos.push(asString(item.data))
        break

      case 'ADMISSAO':
        if (section) data.efetivo.admissao[section].push(refScoutName(item.data, refs))
        break
      case 'READMISSAO':
        if (section) data.efetivo.readmissao[section].push(refScoutName(item.data, refs))
        break
      case 'TRANSFERENCIA':
        if (section) data.efetivo.transferencia[section].push(refScoutName(item.data, refs))
        break
      case 'PASSAGEM':
        if (section) data.efetivo.passagens[section].push(refScoutName(item.data, refs))
        break
      case 'INVESTIDURA':
        if (section) data.efetivo.investiduras[section].push(refScoutName(item.data, refs))
        break
      case 'SAIDA_ATIVO_SECCAO':
        if (section) data.efetivo.saidaAtivo[section].push(refScoutName(item.data, refs))
        break
      case 'SAIDA_ATIVO_DIRIGENTE':
        data.efetivo.saidaAtivo.dirigentes.push(asString(item.data))
        break

      case 'PROGRESSO':
        if (section) data.sistemaProgresso[section].push(refScoutName(item.data, refs))
        break

      case 'NOITES_CAMPO':
        if (section) data.noitesCampo[section].push(refNoites(item.data, refs))
        break

      case 'ACCAO_DISCIPLINAR':
        data.justicaDisciplina.accoesDisicplinares.push(asString(item.data))
        break
      case 'DISTINCAO_PREMIO':
        distincaoPieces.push(asString(item.data))
        break

      case 'RETIFICACAO':
        data.retificacoes.push(asString(item.data))
        break
    }
  }

  data.justicaDisciplina.distincoesPremios = distincaoPieces.join('\n\n')
  return data
}
