import { oficioEnabled, circularEnabled, ordemServicoEnabled } from '@/flags'
import { NewDocumentForm } from './new-document-form'

export default async function NewDocumentPage() {
  const [oficio, circular, ordem] = await Promise.all([
    oficioEnabled(),
    circularEnabled(),
    ordemServicoEnabled(),
  ])

  return <NewDocumentForm enabledTypes={{ oficio, circular, ordem }} />
}
