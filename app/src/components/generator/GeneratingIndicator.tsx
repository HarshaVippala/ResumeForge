'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Loader } from 'lucide-react'

interface GeneratingIndicatorProps {
  company: string
  role: string
}

export function GeneratingIndicator({ company, role }: GeneratingIndicatorProps) {
  return (
    <div className="w-full max-w-4xl mx-auto">
      <Card className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-lg">
        <CardContent className="py-20">
          <div className="text-center space-y-6">
            <div className="inline-flex items-center justify-center w-16 h-16 mb-4">
              <Loader className="h-8 w-8 animate-spin text-gray-900 dark:text-gray-100" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Generating Your Resume
              </h3>
              <p className="text-lg text-gray-600 dark:text-gray-400">
                Creating a tailored resume for <span className="font-semibold text-gray-900 dark:text-gray-100">{role}</span> at <span className="font-semibold text-gray-900 dark:text-gray-100">{company}</span>
              </p>
            </div>
            <div className="flex justify-center gap-1 mt-6">
              <div className="w-1.5 h-1.5 bg-gray-900 dark:bg-gray-100 rounded-full animate-pulse" />
              <div className="w-1.5 h-1.5 bg-gray-900 dark:bg-gray-100 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
              <div className="w-1.5 h-1.5 bg-gray-900 dark:bg-gray-100 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              This typically takes 15-30 seconds
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}