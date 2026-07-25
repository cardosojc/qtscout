import { Sidebar } from '@/components/ui/sidebar'
import { getFeatureFlags } from '@/lib/flags'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { oficio, circular, ordem } = await getFeatureFlags()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar enabledDocTypes={{ oficio, circular, ordem }} />
      <div className="lg:ml-64 min-h-screen pt-16 lg:pt-0">
        {children}
      </div>
    </div>
  )
}
