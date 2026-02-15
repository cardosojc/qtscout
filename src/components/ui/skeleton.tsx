export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-gray-200 dark:bg-gray-700 ${className}`}
    />
  )
}

export function MeetingCardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-36" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-14 rounded-lg" />
          <Skeleton className="h-9 w-16 rounded-lg" />
          <Skeleton className="h-9 w-12 rounded-lg" />
        </div>
      </div>
    </div>
  )
}

export function MeetingListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4" aria-busy="true" role="status">
      <span className="sr-only">Carregando reuniões...</span>
      {Array.from({ length: count }, (_, i) => (
        <MeetingCardSkeleton key={i} />
      ))}
    </div>
  )
}

export function DashboardSkeleton() {
  return (
    <div aria-busy="true" role="status">
      <span className="sr-only">Carregando...</span>
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
        <Skeleton className="h-7 w-64 mx-auto mb-4" />
        <Skeleton className="h-4 w-80 mx-auto mb-6" />
        <div className="grid md:grid-cols-3 gap-4">
          <Skeleton className="h-12 rounded-lg" />
          <Skeleton className="h-12 rounded-lg" />
          <Skeleton className="h-12 rounded-lg" />
        </div>
      </div>
    </div>
  )
}
