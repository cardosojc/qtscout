import { Sidebar } from '@/components/ui/sidebar'

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      <div className="lg:ml-64 min-h-screen pt-16 lg:pt-0">
        {children}
      </div>
    </div>
  )
}
