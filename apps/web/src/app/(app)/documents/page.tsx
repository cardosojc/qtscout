import { redirect } from 'next/navigation'
import { getFeatureFlags } from '@/lib/flags'
import { DocumentsList } from './documents-list'

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>
}) {
  const { type } = await searchParams
  const flags = await getFeatureFlags()
  const { oficio, circular, ordem } = flags

  const disabled: Record<string, boolean> = {
    OFICIO: !oficio,
    CIRCULAR: !circular,
    ORDEM_SERVICO: !ordem,
  }
  if (type && disabled[type]) {
    const firstEnabled = oficio ? 'OFICIO' : circular ? 'CIRCULAR' : ordem ? 'ORDEM_SERVICO' : null
    redirect(firstEnabled ? `/documents?type=${firstEnabled}` : '/')
  }

  return <DocumentsList enabledTypes={{ oficio, circular, ordem }} />
}
