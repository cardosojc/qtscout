'use client'

import { useState } from 'react'
import {
  defaultOrdemServicoData,
  type OrdemServicoData,
  type OSAtividade,
  type OSNomeacao,
  type OSNoitesMilestone,
} from '@/types/ordem-servico'

// ─── Primitive helpers ────────────────────────────────────────────────────────

function addItem<T>(list: T[], item: T): T[] {
  return [...list, item]
}
function removeItem<T>(list: T[], idx: number): T[] {
  return list.filter((_, i) => i !== idx)
}
function updateItem<T>(list: T[], idx: number, value: T): T[] {
  return list.map((item, i) => (i === idx ? value : item))
}

// ─── Reusable sub-editors ─────────────────────────────────────────────────────

function StringListEditor({
  items,
  onChange,
  placeholder = 'Adicionar item...',
}: {
  items: string[]
  onChange: (items: string[]) => void
  placeholder?: string
}) {
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex gap-2">
          <input
            value={item}
            onChange={(e) => onChange(updateItem(items, i, e.target.value))}
            className="flex-1 text-sm px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={() => onChange(removeItem(items, i))}
            className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
      {items.length === 0 && (
        <p className="text-xs text-gray-400 italic">Nada consta</p>
      )}
      <button
        type="button"
        onClick={() => onChange(addItem(items, ''))}
        className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
      >
        + Adicionar
      </button>
    </div>
  )
}

function AtividadeListEditor({
  items,
  onChange,
}: {
  items: OSAtividade[]
  onChange: (items: OSAtividade[]) => void
}) {
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="flex gap-2 p-3 border border-gray-200 dark:border-gray-600 rounded-lg">
          <div className="flex-1 grid grid-cols-3 gap-2">
            <input
              value={item.nome}
              onChange={(e) => onChange(updateItem(items, i, { ...item, nome: e.target.value }))}
              placeholder="Nome da atividade"
              className="text-sm px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              value={item.datas}
              onChange={(e) => onChange(updateItem(items, i, { ...item, datas: e.target.value }))}
              placeholder="Data(s)"
              className="text-sm px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              value={item.local}
              onChange={(e) => onChange(updateItem(items, i, { ...item, local: e.target.value }))}
              placeholder="Local"
              className="text-sm px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="button"
            onClick={() => onChange(removeItem(items, i))}
            className="p-1.5 text-gray-400 hover:text-red-500 transition-colors self-start"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
      {items.length === 0 && (
        <p className="text-xs text-gray-400 italic">Nada consta</p>
      )}
      <button
        type="button"
        onClick={() => onChange(addItem(items, { nome: '', datas: '', local: '' }))}
        className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
      >
        + Adicionar atividade
      </button>
    </div>
  )
}

function NomeacaoListEditor({
  items,
  onChange,
  nomePlaceholder = 'Nome',
  cargoPlaceholder = 'Cargo / Função',
}: {
  items: OSNomeacao[]
  onChange: (items: OSNomeacao[]) => void
  nomePlaceholder?: string
  cargoPlaceholder?: string
}) {
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex gap-2">
          <input
            value={item.nome}
            onChange={(e) => onChange(updateItem(items, i, { ...item, nome: e.target.value }))}
            placeholder={nomePlaceholder}
            className="flex-1 text-sm px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            value={item.cargo}
            onChange={(e) => onChange(updateItem(items, i, { ...item, cargo: e.target.value }))}
            placeholder={cargoPlaceholder}
            className="flex-1 text-sm px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={() => onChange(removeItem(items, i))}
            className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
      {items.length === 0 && (
        <p className="text-xs text-gray-400 italic">Nada consta</p>
      )}
      <button
        type="button"
        onClick={() => onChange(addItem(items, { nome: '', cargo: '' }))}
        className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
      >
        + Adicionar
      </button>
    </div>
  )
}

function NoitesMilestoneEditor({
  items,
  onChange,
}: {
  items: OSNoitesMilestone[]
  onChange: (items: OSNoitesMilestone[]) => void
}) {
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="p-3 border border-gray-200 dark:border-gray-600 rounded-lg space-y-2">
          <div className="flex gap-2 items-center">
            <input
              type="number"
              min={1}
              value={item.count}
              onChange={(e) =>
                onChange(updateItem(items, i, { ...item, count: parseInt(e.target.value) || 0 }))
              }
              className="w-24 text-sm px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-600 dark:text-gray-300">noites de campo</span>
            <button
              type="button"
              onClick={() => onChange(removeItem(items, i))}
              className="ml-auto p-1.5 text-gray-400 hover:text-red-500 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <StringListEditor
            items={item.membros}
            onChange={(membros) => onChange(updateItem(items, i, { ...item, membros }))}
            placeholder="Nome do membro"
          />
        </div>
      ))}
      {items.length === 0 && (
        <p className="text-xs text-gray-400 italic">Nada consta</p>
      )}
      <button
        type="button"
        onClick={() => onChange(addItem(items, { count: 0, membros: [] }))}
        className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
      >
        + Adicionar marco
      </button>
    </div>
  )
}

// ─── Collapsible section panel ────────────────────────────────────────────────

function Section({
  title,
  children,
  defaultOpen = false,
}: {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-700/50 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <span className="font-semibold text-sm text-gray-800 dark:text-gray-200">{title}</span>
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="p-4 space-y-4">{children}</div>}
    </div>
  )
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
        {title}
      </p>
      {children}
    </div>
  )
}

// ─── Main form ────────────────────────────────────────────────────────────────

export function OrdemServicoForm({
  data: dataProp,
  onChange,
}: {
  data?: OrdemServicoData | null
  onChange: (data: OrdemServicoData) => void
}) {
  const data = dataProp ?? defaultOrdemServicoData()
  const set = <K extends keyof OrdemServicoData>(key: K, value: OrdemServicoData[K]) =>
    onChange({ ...data, [key]: value })

  const setNested = <K extends keyof OrdemServicoData>(
    key: K,
    subKey: keyof OrdemServicoData[K],
    value: unknown
  ) => onChange({ ...data, [key]: { ...(data[key] as object), [subKey]: value } })

  const setEfetivo = <K extends keyof OrdemServicoData['efetivo']>(
    sub: K,
    subKey: keyof OrdemServicoData['efetivo'][K],
    value: unknown
  ) =>
    onChange({
      ...data,
      efetivo: {
        ...data.efetivo,
        [sub]: { ...data.efetivo[sub], [subKey]: value },
      },
    })

  const SECCOES = [
    { key: 'alcateia', label: 'Alcateia' },
    { key: 'expedicao', label: 'Expedição' },
    { key: 'comunidade', label: 'Comunidade' },
    { key: 'cla', label: 'Clã' },
  ] as const

  return (
    <div className="space-y-3">
      {/* Período */}
      <div className="flex flex-wrap gap-4 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <span className="text-sm font-semibold text-blue-800 dark:text-blue-300 self-center">Período</span>
        <div className="flex items-center gap-2 flex-1 min-w-48">
          <label className="text-xs text-blue-700 dark:text-blue-400 whitespace-nowrap">De</label>
          <input
            value={data.periodo.de}
            onChange={(e) => setNested('periodo', 'de', e.target.value)}
            placeholder="ex: 1 de Janeiro de 2026"
            className="flex-1 text-sm px-3 py-1.5 border border-blue-300 dark:border-blue-700 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center gap-2 flex-1 min-w-48">
          <label className="text-xs text-blue-700 dark:text-blue-400 whitespace-nowrap">Até</label>
          <input
            value={data.periodo.ate}
            onChange={(e) => setNested('periodo', 'ate', e.target.value)}
            placeholder="ex: 28 de Fevereiro de 2026"
            className="flex-1 text-sm px-3 py-1.5 border border-blue-300 dark:border-blue-700 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* 1. Determinações */}
      <Section title="1. Determinações" defaultOpen>
        <SubSection title="Resoluções do Conselho de Agrupamento">
          <StringListEditor
            items={data.determinacoes.resolucoes}
            onChange={(v) => setNested('determinacoes', 'resolucoes', v)}
          />
        </SubSection>
        <SubSection title="Determinações do Conselho de Agrupamento">
          <StringListEditor
            items={data.determinacoes.determinacoes}
            onChange={(v) => setNested('determinacoes', 'determinacoes', v)}
          />
        </SubSection>
      </Section>

      {/* 2. Atividades */}
      <Section title="2. Atividades">
        <div className="text-xs text-gray-500 dark:text-gray-400 grid grid-cols-3 gap-2 px-1 mb-1">
          <span>Nome</span><span>Data(s)</span><span>Local</span>
        </div>
        <SubSection title="Agrupamento">
          <AtividadeListEditor
            items={data.atividades.agrupamento}
            onChange={(v) => setNested('atividades', 'agrupamento', v)}
          />
        </SubSection>
        {SECCOES.map(({ key, label }) => (
          <SubSection key={key} title={label}>
            <AtividadeListEditor
              items={data.atividades[key]}
              onChange={(v) => setNested('atividades', key, v)}
            />
          </SubSection>
        ))}
      </Section>

      {/* 3. Criação/Extinção */}
      <Section title="3. Criação/Extinção de Unidades, Patrulhas, Equipas, Tribos e Departamentos">
        {SECCOES.map(({ key, label }) => (
          <SubSection key={key} title={label}>
            <StringListEditor
              items={data.criacaoExtincao[key]}
              onChange={(v) => setNested('criacaoExtincao', key, v)}
            />
          </SubSection>
        ))}
      </Section>

      {/* 4. Nomeações e Exonerações */}
      <Section title="4. Nomeações e Exonerações">
        <SubSection title="Dirigentes">
          <NomeacaoListEditor
            items={data.nomeacoes.dirigentes}
            onChange={(v) => setNested('nomeacoes', 'dirigentes', v)}
            cargoPlaceholder="Função"
          />
        </SubSection>
        {SECCOES.map(({ key, label }) => (
          <SubSection key={key} title={label}>
            <NomeacaoListEditor
              items={data.nomeacoes[key]}
              onChange={(v) => setNested('nomeacoes', key, v)}
              cargoPlaceholder="Cargo (ex: Guia Patrulha Esquilo)"
            />
          </SubSection>
        ))}
        <SubSection title="Departamentos">
          <StringListEditor
            items={data.nomeacoes.departamentos}
            onChange={(v) => setNested('nomeacoes', 'departamentos', v)}
          />
        </SubSection>
      </Section>

      {/* 5. Efetivo */}
      <Section title="5. Efetivo">
        {(
          [
            { sub: 'admissao', label: 'Admissão de Associados' },
            { sub: 'readmissao', label: 'Readmissão de Associados' },
            { sub: 'transferencia', label: 'Transferência de Associados' },
            { sub: 'passagens', label: 'Passagens de Secção' },
            { sub: 'investiduras', label: 'Investiduras' },
          ] as const
        ).map(({ sub, label }) => (
          <SubSection key={sub} title={label}>
            {SECCOES.map(({ key, label: sLabel }) => (
              <div key={key} className="mb-3">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{sLabel}</p>
                <StringListEditor
                  items={(data.efetivo[sub] as Record<string, string[]>)[key]}
                  onChange={(v) => setEfetivo(sub, key as never, v)}
                />
              </div>
            ))}
          </SubSection>
        ))}
        <SubSection title="Saída do Ativo de Associados">
          <div className="mb-3">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Dirigentes</p>
            <StringListEditor
              items={data.efetivo.saidaAtivo.dirigentes}
              onChange={(v) => setEfetivo('saidaAtivo', 'dirigentes', v)}
            />
          </div>
          {SECCOES.map(({ key, label }) => (
            <div key={key} className="mb-3">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
              <StringListEditor
                items={data.efetivo.saidaAtivo[key]}
                onChange={(v) => setEfetivo('saidaAtivo', key as never, v)}
              />
            </div>
          ))}
        </SubSection>
      </Section>

      {/* 6. Sistema de Progresso */}
      <Section title="6. Sistema de Progresso">
        {SECCOES.map(({ key, label }) => (
          <SubSection key={key} title={label}>
            <StringListEditor
              items={data.sistemaProgresso[key]}
              onChange={(v) => setNested('sistemaProgresso', key, v)}
            />
          </SubSection>
        ))}
      </Section>

      {/* 7. Noites de Campo */}
      <Section title="7. Noites de Campo">
        {SECCOES.map(({ key, label }) => (
          <SubSection key={key} title={label}>
            <NoitesMilestoneEditor
              items={data.noitesCampo[key]}
              onChange={(v) => setNested('noitesCampo', key, v)}
            />
          </SubSection>
        ))}
      </Section>

      {/* 8. Justiça e Disciplina */}
      <Section title="8. Justiça e Disciplina">
        <SubSection title="Acções Disciplinares">
          <StringListEditor
            items={data.justicaDisciplina.accoesDisicplinares}
            onChange={(v) => setNested('justicaDisciplina', 'accoesDisicplinares', v)}
          />
        </SubSection>
        <SubSection title="Distinções e Prémios">
          <textarea
            rows={6}
            value={data.justicaDisciplina.distincoesPremios}
            onChange={(e) => setNested('justicaDisciplina', 'distincoesPremios', e.target.value)}
            placeholder="Texto da distinção ou prémio..."
            className="w-full text-sm px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
          />
        </SubSection>
      </Section>

      {/* 9. Retificações */}
      <Section title="9. Retificações">
        <StringListEditor
          items={data.retificacoes}
          onChange={(v) => set('retificacoes', v)}
        />
      </Section>

      {/* 10. Rodapé */}
      <Section title="10. Rodapé / Assinaturas" defaultOpen>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Local e Data
            </label>
            <input
              value={data.localData}
              onChange={(e) => set('localData', e.target.value)}
              placeholder="ex: Olivais, 31 de Janeiro de 2026"
              className="w-full text-sm px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Chefe de Agrupamento
            </label>
            <input
              value={data.chefeAgrupamento}
              onChange={(e) => set('chefeAgrupamento', e.target.value)}
              placeholder="Nome"
              className="w-full text-sm px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Secretário de Agrupamento
            </label>
            <input
              value={data.secretarioAgrupamento}
              onChange={(e) => set('secretarioAgrupamento', e.target.value)}
              placeholder="Nome"
              className="w-full text-sm px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </Section>
    </div>
  )
}
