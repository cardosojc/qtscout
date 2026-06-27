export type OSAtividade = {
  nome: string
  datas: string
  local: string
}

export type OSNomeacao = {
  nome: string
  cargo: string
}

export type OSNoitesMilestone = {
  count: number
  membros: string[]
}

/** One Sistema de Progresso entry: a member and the etapa they reached. */
export type OSProgresso = {
  nome: string
  etapa: string
}

/** One Especialidades entry: a member and the especialidade/insígnia earned. */
export type OSEspecialidade = {
  nome: string
  especialidade: string
}

export type OSSeccoes = {
  alcateia: string[]
  expedicao: string[]
  comunidade: string[]
  cla: string[]
}

export type OSProgressoSeccoes = {
  alcateia: OSProgresso[]
  expedicao: OSProgresso[]
  comunidade: OSProgresso[]
  cla: OSProgresso[]
}

export type OSEspecialidadeSeccoes = {
  alcateia: OSEspecialidade[]
  expedicao: OSEspecialidade[]
  comunidade: OSEspecialidade[]
  cla: OSEspecialidade[]
}

export type OSAtividadesSeccoes = {
  alcateia: OSAtividade[]
  expedicao: OSAtividade[]
  comunidade: OSAtividade[]
  cla: OSAtividade[]
}

export type OSNomeacoesSeccoes = {
  alcateia: OSNomeacao[]
  expedicao: OSNomeacao[]
  comunidade: OSNomeacao[]
  cla: OSNomeacao[]
}

export type OSNoitesSeccoes = {
  alcateia: OSNoitesMilestone[]
  expedicao: OSNoitesMilestone[]
  comunidade: OSNoitesMilestone[]
  cla: OSNoitesMilestone[]
}

export type OrdemServicoData = {
  periodo: {
    de: string
    ate: string
  }
  determinacoes: {
    resolucoes: string[]
    determinacoes: string[]
  }
  atividades: {
    agrupamento: OSAtividade[]
  } & OSAtividadesSeccoes
  criacaoExtincao: {
    criacao: OSSeccoes
    extincao: OSSeccoes
  }
  nomeacoes: {
    dirigentes: OSNomeacao[]
    departamentos: string[]
  } & OSNomeacoesSeccoes
  efetivo: {
    admissao: OSSeccoes
    readmissao: OSSeccoes
    transferencia: OSSeccoes
    saidaAtivo: OSSeccoes & { dirigentes: string[] }
    passagens: OSSeccoes
    investiduras: OSSeccoes
  }
  sistemaProgresso: OSProgressoSeccoes
  especialidades: OSEspecialidadeSeccoes
  noitesCampo: OSNoitesSeccoes
  justicaDisciplina: {
    accoesDisicplinares: string[]
    distincoesPremios: string
  }
  retificacoes: string[]
  localData: string
  chefeAgrupamento: string
  secretarioAgrupamento: string
}

const emptySeccoes = (): OSSeccoes => ({
  alcateia: [],
  expedicao: [],
  comunidade: [],
  cla: [],
})

export function defaultOrdemServicoData(): OrdemServicoData {
  return {
    periodo: { de: '', ate: '' },
    determinacoes: { resolucoes: [], determinacoes: [] },
    atividades: {
      agrupamento: [],
      alcateia: [],
      expedicao: [],
      comunidade: [],
      cla: [],
    },
    criacaoExtincao: { criacao: emptySeccoes(), extincao: emptySeccoes() },
    nomeacoes: {
      dirigentes: [],
      departamentos: [],
      alcateia: [],
      expedicao: [],
      comunidade: [],
      cla: [],
    },
    efetivo: {
      admissao: emptySeccoes(),
      readmissao: emptySeccoes(),
      transferencia: emptySeccoes(),
      saidaAtivo: { dirigentes: [], ...emptySeccoes() },
      passagens: emptySeccoes(),
      investiduras: emptySeccoes(),
    },
    sistemaProgresso: { alcateia: [], expedicao: [], comunidade: [], cla: [] },
    especialidades: { alcateia: [], expedicao: [], comunidade: [], cla: [] },
    noitesCampo: { alcateia: [], expedicao: [], comunidade: [], cla: [] },
    justicaDisciplina: { accoesDisicplinares: [], distincoesPremios: '' },
    retificacoes: [],
    localData: '',
    chefeAgrupamento: '',
    secretarioAgrupamento: '',
  }
}

export function parseOrdemServicoData(content: string): OrdemServicoData {
  try {
    return { ...defaultOrdemServicoData(), ...JSON.parse(content) }
  } catch {
    return defaultOrdemServicoData()
  }
}
