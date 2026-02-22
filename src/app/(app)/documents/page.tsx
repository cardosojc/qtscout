import { oficioEnabled, circularEnabled, ordemServicoEnabled } from '@/flags'
import { DocumentsList } from './documents-list'

export default async function DocumentsPage() {
  const [oficio, circular, ordem] = await Promise.all([
    oficioEnabled(),
    circularEnabled(),
    ordemServicoEnabled(),
  ])

  return <DocumentsList enabledTypes={{ oficio, circular, ordem }} />
}
