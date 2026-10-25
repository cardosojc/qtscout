'use client'

/**
 * How to get each SIIE export QTScout imports. SIIE (siie.escutismo.pt) has no
 * API: lists are exported to Excel and imported here. Paths verified against
 * SIIE v3 (October 2026).
 */

export type SiieExport = 'elementos' | 'atividades-por-elemento' | 'atividades'

const GUIDES: Record<SiieExport, { title: string; steps: string[]; note?: string }> = {
  elementos: {
    title: 'Membros (botão “Importar de SIIE”)',
    steps: [
      'No topo, carregue no ícone do quadrado (Agrupamento).',
      'Abra o menu principal (☰) e escolha Importações › Exportações › Elementos.',
    ],
    note: 'Cria ou atualiza membros pelo nº de associado (NIN).',
  },
  'atividades-por-elemento': {
    title: 'Noites de campo (botão “Importar noites de campo (SIIE)”)',
    steps: [
      'No topo, carregue no ícone da pessoa (Elementos).',
      'Abra o menu principal (☰) e escolha Listagens › Atividades › Atividades por Elemento.',
    ],
    note:
      'Contam as noites da coluna “N. Campo”. Cada importação substitui o histórico de cada membro, por isso importe sempre a lista completa.',
  },
  atividades: {
    title: 'Atividades (botão “Importar Atividades (SIIE)”)',
    steps: [
      'No topo, carregue no ícone do quadrado (Agrupamento).',
      'Abra o menu principal (☰) e escolha Importações › Exportações › Atividades.',
    ],
    note: 'Cria um item “Atividade” por atividade; as que já estão numa OS são ignoradas.',
  },
}

/** Collapsible step-by-step guide for the given SIIE exports. */
export function SiieExportHelp({ exports }: { exports: SiieExport[] }) {
  return (
    <details className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 text-sm text-gray-700 dark:text-gray-300">
      <summary className="cursor-pointer font-medium text-gray-900 dark:text-white">
        Como exportar do SIIE
      </summary>
      <div className="mt-3 space-y-4">
        <p>
          Entre em{' '}
          <a
            href="https://siie.escutismo.pt"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline dark:text-blue-400"
          >
            siie.escutismo.pt
          </a>{' '}
          com o perfil de Agrupamento. Cada lista do SIIE exporta para Excel no botão cinzento com o
          ícone de ficheiro Excel, no canto superior esquerdo da tabela. Exporte sem filtros e
          importe aqui o ficheiro tal como foi descarregado (.xlsx).
        </p>
        {exports.map((key) => {
          const g = GUIDES[key]
          return (
            <div key={key}>
              <h3 className="font-semibold text-gray-900 dark:text-white">{g.title}</h3>
              <ol className="mt-1 list-decimal pl-5 space-y-0.5">
                {g.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
                <li>Carregue no botão de exportar para Excel e guarde o ficheiro.</li>
              </ol>
              {g.note && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{g.note}</p>}
            </div>
          )
        })}
      </div>
    </details>
  )
}
