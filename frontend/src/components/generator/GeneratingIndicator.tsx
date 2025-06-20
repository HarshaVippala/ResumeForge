'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Loader } from 'lucide-react'

interface GeneratingIndicatorProps {
  company: string
  role: string
}

export function GeneratingIndicator({ company, role }: GeneratingIndicatorProps) {
  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardContent className="py-20">
        <div className="text-center space-y-4">
          <Loader className="h-12 w-12 animate-spin mx-auto text-primary" />
          <h3 className="text-xl font-semibold">Generating Your Resume</h3>
          <p className="text-muted-foreground">
            Creating a tailored resume for {role} at {company}...
          </p>
          <p className="text-sm text-muted-foreground">
            This may take 30-60 seconds
          </p>
        </div>
      </CardContent>
    </Card>
  )
}