import type { OrdemItem } from '@prisma/client'
import {
  defaultOrdemServicoData,
  type OSAtividade,
  type OSNoitesMilestone,
  type OSNomeacao,
  type OrdemServicoData,
} from '@/types/ordem-servico'
import type { OrdemSection } from '@/types/ordem-item'

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

function asNomeacao(data: unknown): OSNomeacao {
  const d = (data ?? {}) as Partial<OSNomeacao>
  return {
    nome: typeof d.nome === 'string' ? d.nome : '',
    cargo: typeof d.cargo === 'string' ? d.cargo : '',
  }
}

function asNoites(data: unknown): OSNoitesMilestone {
  const d = (data ?? {}) as Partial<OSNoitesMilestone>
  return {
    count: typeof d.count === 'number' ? d.count : 0,
    membros: Array.isArray(d.membros) ? d.membros.filter((m): m is string => typeof m === 'string') : [],
  }
}

export function assembleOrdemServico(
  items: OrdemItem[],
  periodo: { de: string; ate: string }
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

      case 'ATIVIDADE_AGRUPAMENTO':
        data.atividades.agrupamento.push(asAtividade(item.data))
        break
      case 'ATIVIDADE_SECCAO':
        if (section) data.atividades[section].push(asAtividade(item.data))
        break

      case 'CRIACAO_EXTINCAO':
        if (section) data.criacaoExtincao[section].push(asString(item.data))
        break

      case 'NOMEACAO_DIRIGENTE':
        data.nomeacoes.dirigentes.push(asNomeacao(item.data))
        break
      case 'NOMEACAO_SECCAO':
        if (section) data.nomeacoes[section].push(asNomeacao(item.data))
        break
      case 'NOMEACAO_DEPARTAMENTO':
        data.nomeacoes.departamentos.push(asString(item.data))
        break

      case 'ADMISSAO':
        if (section) data.efetivo.admissao[section].push(asString(item.data))
        break
      case 'READMISSAO':
        if (section) data.efetivo.readmissao[section].push(asString(item.data))
        break
      case 'TRANSFERENCIA':
        if (section) data.efetivo.transferencia[section].push(asString(item.data))
        break
      case 'PASSAGEM':
        if (section) data.efetivo.passagens[section].push(asString(item.data))
        break
      case 'INVESTIDURA':
        if (section) data.efetivo.investiduras[section].push(asString(item.data))
        break
      case 'SAIDA_ATIVO_SECCAO':
        if (section) data.efetivo.saidaAtivo[section].push(asString(item.data))
        break
      case 'SAIDA_ATIVO_DIRIGENTE':
        data.efetivo.saidaAtivo.dirigentes.push(asString(item.data))
        break

      case 'PROGRESSO':
        if (section) data.sistemaProgresso[section].push(asString(item.data))
        break

      case 'NOITES_CAMPO':
        if (section) data.noitesCampo[section].push(asNoites(item.data))
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
