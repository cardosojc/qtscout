import { type OrdemServicoData, type OSAtividade, type OSNomeacao, type OSNoitesMilestone } from '@/types/ordem-servico'

const SECCAO_LABELS = {
  alcateia: 'Alcateia',
  expedicao: 'Expedição',
  comunidade: 'Comunidade',
  cla: 'Clã',
} as const

type SeccaoKey = keyof typeof SECCAO_LABELS

function nadaConsta(items: unknown[]): boolean {
  return items.length === 0
}

function ListItems({ items }: { items: string[] }) {
  if (nadaConsta(items)) return <p className="ml-4 text-gray-600 dark:text-gray-400">Nada consta</p>
  return (
    <ul className="ml-4 space-y-0.5">
      {items.map((item, i) => (
        <li key={i} className="text-gray-800 dark:text-gray-200">{item}</li>
      ))}
    </ul>
  )
}

function AtividadeItems({ items }: { items: OSAtividade[] }) {
  if (nadaConsta(items)) return <p className="ml-4 text-gray-600 dark:text-gray-400">Nada consta</p>
  return (
    <ul className="ml-4 space-y-0.5">
      {items.map((a, i) => (
        <li key={i} className="text-gray-800 dark:text-gray-200">
          {a.nome}{a.datas ? ` - ${a.datas}` : ''}{a.local ? ` - ${a.local}` : ''}
        </li>
      ))}
    </ul>
  )
}

function NomeacaoItems({ items }: { items: OSNomeacao[] }) {
  if (nadaConsta(items)) return <p className="ml-4 text-gray-600 dark:text-gray-400">Nada consta</p>
  return (
    <ul className="ml-4 space-y-0.5">
      {items.map((n, i) => (
        <li key={i} className="text-gray-800 dark:text-gray-200">
          {n.nome}{n.cargo ? ` - ${n.cargo}` : ''}
        </li>
      ))}
    </ul>
  )
}

function NoitesMilestoneItems({ items }: { items: OSNoitesMilestone[] }) {
  if (nadaConsta(items)) return <p className="ml-4 text-gray-600 dark:text-gray-400">Nada consta</p>
  return (
    <div className="ml-4 space-y-2">
      {items.map((m, i) => (
        <div key={i}>
          <p className="font-medium text-gray-800 dark:text-gray-200">{m.count} noites de campo</p>
          <ul className="ml-4 space-y-0.5">
            {m.membros.map((nome, j) => (
              <li key={j} className="text-gray-800 dark:text-gray-200">{nome}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-base font-bold text-gray-900 dark:text-white mt-6 mb-2 border-b border-gray-200 dark:border-gray-700 pb-1">
      {children}
    </h2>
  )
}

function SubTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mt-3 mb-1">
      {children}
    </h3>
  )
}

const SECCOES: SeccaoKey[] = ['alcateia', 'expedicao', 'comunidade', 'cla']

export function OrdemServicoView({ data }: { data: OrdemServicoData }) {
  return (
    <div className="text-sm leading-relaxed">

      {/* 1. Determinações */}
      <SectionTitle>Determinações</SectionTitle>
      <SubTitle>Resoluções do Conselho de Agrupamento</SubTitle>
      <ListItems items={data.determinacoes.resolucoes} />
      <SubTitle>Determinações do Conselho de Agrupamento</SubTitle>
      <ListItems items={data.determinacoes.determinacoes} />

      {/* 2. Atividades */}
      <SectionTitle>Atividades</SectionTitle>
      <SubTitle>Agrupamento</SubTitle>
      <AtividadeItems items={data.atividades.agrupamento} />
      <SubTitle>Unidades</SubTitle>
      {SECCOES.map((key) => (
        <div key={key} className="ml-2 mt-2">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
            {SECCAO_LABELS[key]}
          </p>
          <AtividadeItems items={data.atividades[key]} />
        </div>
      ))}

      {/* 3. Criação/Extinção */}
      <SectionTitle>Criação/Extinção de Unidades, Bandos, Patrulhas, Equipas, Tribos e Departamentos</SectionTitle>
      {SECCOES.map((key) => (
        <div key={key}>
          <SubTitle>{SECCAO_LABELS[key]}</SubTitle>
          <ListItems items={data.criacaoExtincao[key]} />
        </div>
      ))}

      {/* 4. Nomeações e Exonerações */}
      <SectionTitle>Nomeações e Exonerações</SectionTitle>
      <SubTitle>Dirigentes</SubTitle>
      <NomeacaoItems items={data.nomeacoes.dirigentes} />
      <SubTitle>Secções</SubTitle>
      {SECCOES.map((key) => (
        <div key={key} className="ml-2 mt-2">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
            {SECCAO_LABELS[key]}
          </p>
          <NomeacaoItems items={data.nomeacoes[key]} />
        </div>
      ))}
      <SubTitle>Departamentos</SubTitle>
      <ListItems items={data.nomeacoes.departamentos} />

      {/* 5. Efetivo */}
      <SectionTitle>Efetivo</SectionTitle>
      {(
        [
          { sub: 'admissao', label: 'Admissão de Associados' },
          { sub: 'readmissao', label: 'Readmissão de Associados' },
          { sub: 'transferencia', label: 'Transferência de Associados' },
          { sub: 'passagens', label: 'Passagens de Secção' },
          { sub: 'investiduras', label: 'Investiduras' },
        ] as const
      ).map(({ sub, label }) => (
        <div key={sub}>
          <SubTitle>{label}</SubTitle>
          {SECCOES.map((key) => (
            <div key={key} className="ml-2 mt-1">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-0.5">
                {SECCAO_LABELS[key]}
              </p>
              <ListItems items={(data.efetivo[sub] as Record<string, string[]>)[key]} />
            </div>
          ))}
        </div>
      ))}
      <SubTitle>Saída do Ativo de Associados</SubTitle>
      <div className="ml-2 mt-1">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-0.5">Dirigentes</p>
        <ListItems items={data.efetivo.saidaAtivo.dirigentes} />
      </div>
      {SECCOES.map((key) => (
        <div key={key} className="ml-2 mt-1">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-0.5">
            {SECCAO_LABELS[key]}
          </p>
          <ListItems items={data.efetivo.saidaAtivo[key]} />
        </div>
      ))}

      {/* 6. Sistema de Progresso */}
      <SectionTitle>Sistema de Progresso</SectionTitle>
      {SECCOES.map((key) => (
        <div key={key}>
          <SubTitle>{SECCAO_LABELS[key]}</SubTitle>
          <ListItems items={data.sistemaProgresso[key]} />
        </div>
      ))}

      {/* 7. Noites de Campo */}
      <SectionTitle>Noites de Campo</SectionTitle>
      {SECCOES.map((key) => (
        <div key={key}>
          <SubTitle>{SECCAO_LABELS[key]}</SubTitle>
          <NoitesMilestoneItems items={data.noitesCampo[key]} />
        </div>
      ))}

      {/* 8. Justiça e Disciplina */}
      <SectionTitle>Justiça e Disciplina</SectionTitle>
      <SubTitle>Acções Disciplinares</SubTitle>
      <ListItems items={data.justicaDisciplina.accoesDisicplinares} />
      <SubTitle>Distinções e Prémios</SubTitle>
      {data.justicaDisciplina.distincoesPremios.trim() ? (
        <p className="ml-4 text-gray-800 dark:text-gray-200 italic whitespace-pre-wrap">
          {data.justicaDisciplina.distincoesPremios}
        </p>
      ) : (
        <p className="ml-4 text-gray-600 dark:text-gray-400">Nada consta</p>
      )}

      {/* 9. Retificações */}
      <SectionTitle>Retificações</SectionTitle>
      <ListItems items={data.retificacoes} />

      {/* Rodapé */}
      {(data.localData || data.chefeAgrupamento || data.secretarioAgrupamento) && (
        <div className="mt-10 space-y-6 border-t border-gray-200 dark:border-gray-700 pt-6">
          {data.localData && (
            <p className="text-gray-800 dark:text-gray-200">{data.localData}</p>
          )}
          <div className="flex justify-between gap-8 text-sm">
            {data.chefeAgrupamento && (
              <div>
                <p className="text-gray-600 dark:text-gray-400">Chefe de Agrupamento</p>
                <p className="font-medium text-gray-900 dark:text-white mt-1">{data.chefeAgrupamento}</p>
              </div>
            )}
            {data.secretarioAgrupamento && (
              <div className="text-right">
                <p className="text-gray-600 dark:text-gray-400">Secretário de Agrupamento</p>
                <p className="font-medium text-gray-900 dark:text-white mt-1">{data.secretarioAgrupamento}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
