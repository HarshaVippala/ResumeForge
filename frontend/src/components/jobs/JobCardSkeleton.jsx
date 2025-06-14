'use client'

export function JobCardSkeleton() {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 h-[320px]">
      <div className="animate-pulse flex flex-col h-full">
        {/* Header skeleton */}
        <div className="flex items-start gap-3 mb-3">
          <div className="h-12 w-12 rounded-md bg-gray-200 flex-shrink-0"></div>
          <div className="flex-grow space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          </div>
          <div className="h-6 w-6 bg-gray-200 rounded-full"></div>
        </div>

        {/* Metadata pills skeleton */}
        <div className="flex gap-1.5 mb-3">
          <div className="h-6 bg-gray-200 rounded-full w-20"></div>
          <div className="h-6 bg-gray-200 rounded-full w-16"></div>
          <div className="h-6 bg-gray-200 rounded-full w-24"></div>
        </div>

        {/* Description skeleton */}
        <div className="space-y-2 mb-4 flex-grow">
          <div className="h-3 bg-gray-200 rounded"></div>
          <div className="h-3 bg-gray-200 rounded"></div>
          <div className="h-3 bg-gray-200 rounded w-5/6"></div>
        </div>

        {/* Footer skeleton */}
        <div className="mt-auto border-t border-gray-100 pt-3">
          {/* Skills skeleton */}
          <div className="flex gap-1.5 mb-3">
            <div className="h-5 bg-gray-200 rounded w-12"></div>
            <div className="h-5 bg-gray-200 rounded w-16"></div>
            <div className="h-5 bg-gray-200 rounded w-14"></div>
            <div className="h-5 bg-gray-200 rounded w-10"></div>
          </div>
          
          {/* Action buttons skeleton */}
          <div className="flex gap-2">
            <div className="h-8 bg-gray-200 rounded flex-1"></div>
            <div className="h-8 bg-gray-200 rounded flex-1"></div>
          </div>
        </div>
      </div>
    </div>
  )
}