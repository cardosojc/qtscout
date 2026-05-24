'use client'

import { useState } from 'react'
import { ORDEM_SECTIONS, ORDEM_SECTION_LABELS, type OrdemSection } from '@/types/ordem-item'
import type { Scout } from '@/types/scout'

type FormValues = {
  firstName: string
  lastName: string
  numeroAssociado: string
  dateOfBirth: string
  section: OrdemSection | ''
  joinedAt: string
  active: boolean
  sexo: string
  cc: string
  nif: string
  email: string
  telefone: string
  telemovel: string
  morada: string
  localidade: string
  codigoPostal: string
  paiNome: string
  paiTelefone: string
  paiEmail: string
  maeNome: string
  maeTelefone: string
  maeEmail: string
  encarregadoNome: string
  encarregadoTelefone: string
  encarregadoEmail: string
}

type Props = {
  initial?: Partial<Scout>
  submitLabel: string
  onSubmit: (values: FormValues) => Promise<void>
  onCancel: () => void
}

function isoDay(value?: string | null): string {
  if (!value) return ''
  return value.slice(0, 10)
}

const fieldCls =
  'w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500'
const labelCls = 'block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1'

export function ScoutForm({ initial, submitLabel, onSubmit, onCancel }: Props) {
  const [values, setValues] = useState<FormValues>({
    firstName: initial?.firstName ?? '',
    lastName: initial?.lastName ?? '',
    numeroAssociado: initial?.numeroAssociado ?? '',
    dateOfBirth: isoDay(initial?.dateOfBirth),
    section: (initial?.section as OrdemSection | undefined) ?? '',
    joinedAt: isoDay(initial?.joinedAt) || new Date().toISOString().slice(0, 10),
    active: initial?.active ?? true,
    sexo: initial?.sexo ?? '',
    cc: initial?.cc ?? '',
    nif: initial?.nif ?? '',
    email: initial?.email ?? '',
    telefone: initial?.telefone ?? '',
    telemovel: initial?.telemovel ?? '',
    morada: initial?.morada ?? '',
    localidade: initial?.localidade ?? '',
    codigoPostal: initial?.codigoPostal ?? '',
    paiNome: initial?.paiNome ?? '',
    paiTelefone: initial?.paiTelefone ?? '',
    paiEmail: initial?.paiEmail ?? '',
    maeNome: initial?.maeNome ?? '',
    maeTelefone: initial?.maeTelefone ?? '',
    maeEmail: initial?.maeEmail ?? '',
    encarregadoNome: initial?.encarregadoNome ?? '',
    encarregadoTelefone: initial?.encarregadoTelefone ?? '',
    encarregadoEmail: initial?.encarregadoEmail ?? '',
  })
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await onSubmit(values)
    } finally {
      setSubmitting(false)
    }
  }

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }))

  const Input = ({ label, field, type = 'text' }: { label: string; field: keyof FormValues; type?: string }) => (
    <div>
      <label className={labelCls}>{label}</label>
      <input
        type={type}
        value={values[field] as string}
        onChange={(e) => set(field, e.target.value as FormValues[typeof field])}
        className={fieldCls}
      />
    </div>
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <fieldset className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <legend className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300 px-2">
          Identificação
        </legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Nome</label>
            <input type="text" value={values.firstName} onChange={(e) => set('firstName', e.target.value)} required className={fieldCls} />
          </div>
          <div>
            <label className={labelCls}>Apelido</label>
            <input type="text" value={values.lastName} onChange={(e) => set('lastName', e.target.value)} required className={fieldCls} />
          </div>
          <Input label="Nº de Associado" field="numeroAssociado" />
          <div>
            <label className={labelCls}>Data de Nascimento</label>
            <input type="date" value={values.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)} required className={fieldCls} />
          </div>
          <div>
            <label className={labelCls}>Secção</label>
            <select value={values.section} onChange={(e) => set('section', e.target.value as OrdemSection | '')} className={fieldCls}>
              <option value="">— Nenhuma (dirigente / não atribuído) —</option>
              {ORDEM_SECTIONS.map((s) => (
                <option key={s} value={s}>{ORDEM_SECTION_LABELS[s]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Data de Admissão</label>
            <input type="date" value={values.joinedAt} onChange={(e) => set('joinedAt', e.target.value)} required className={fieldCls} />
          </div>
          <div>
            <label className={labelCls}>Sexo</label>
            <select value={values.sexo} onChange={(e) => set('sexo', e.target.value)} className={fieldCls}>
              <option value="">—</option>
              <option value="F">Feminino</option>
              <option value="M">Masculino</option>
            </select>
          </div>
          <Input label="Cartão de Cidadão" field="cc" />
          <Input label="NIF" field="nif" />
        </div>
      </fieldset>

      <fieldset className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <legend className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300 px-2">Morada</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <Input label="Rua / morada" field="morada" />
          </div>
          <Input label="Código Postal" field="codigoPostal" />
          <Input label="Localidade" field="localidade" />
        </div>
      </fieldset>

      <fieldset className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <legend className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300 px-2">Contactos</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label="Email" field="email" type="email" />
          <Input label="Telemóvel" field="telemovel" type="tel" />
          <Input label="Telefone" field="telefone" type="tel" />
        </div>
      </fieldset>

      <fieldset className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <legend className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300 px-2">Pai</legend>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input label="Nome" field="paiNome" />
          <Input label="Telefone" field="paiTelefone" type="tel" />
          <Input label="Email" field="paiEmail" type="email" />
        </div>
      </fieldset>

      <fieldset className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <legend className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300 px-2">Mãe</legend>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input label="Nome" field="maeNome" />
          <Input label="Telefone" field="maeTelefone" type="tel" />
          <Input label="Email" field="maeEmail" type="email" />
        </div>
      </fieldset>

      <fieldset className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <legend className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300 px-2">Encarregado de Educação</legend>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input label="Nome" field="encarregadoNome" />
          <Input label="Telefone" field="encarregadoTelefone" type="tel" />
          <Input label="Email" field="encarregadoEmail" type="email" />
        </div>
      </fieldset>

      {initial?.id && (
        <label className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
          <input type="checkbox" checked={values.active} onChange={(e) => set('active', e.target.checked)} className="w-4 h-4" />
          Membro ativo
        </label>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg"
        >
          {submitting ? 'A guardar...' : submitLabel}
        </button>
      </div>
    </form>
  )
}
