import { redirect } from 'next/navigation'
import { getFeatureFlags } from '@/lib/flags'
import { NewDocumentForm } from './new-document-form'

export default async function NewDocumentPage({
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
    redirect(firstEnabled ? `/documents/new?type=${firstEnabled}` : '/')
  }

  return <NewDocumentForm enabledTypes={{ oficio, circular, ordem }} />
}
