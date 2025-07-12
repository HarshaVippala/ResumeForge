'use client'

import { Card, CardContent } from '@/components/ui/card'
import { 
  Briefcase, 
  Calendar, 
  Trophy, 
  Clock,
  TrendingUp,
  Target,
  Users,
  DollarSign
} from 'lucide-react'

interface ApplicationPipelineStatsProps {
  stats: {
    total: number
    active: number
    interviews: number
    offers: number
    avgResponseTime: number
  }
}

export function ApplicationPipelineStats({ stats }: ApplicationPipelineStatsProps) {
  const conversionRate = stats.total > 0 ? Math.round((stats.interviews / stats.total) * 100) : 0
  
  const statCards = [
    {
      title: 'Total Applications',
      value: stats.total.toString(),
      icon: Briefcase,
      color: 'text-blue-600 bg-blue-100',
      description: 'All applications'
    },
    {
      title: 'Active Pipeline',
      value: stats.active.toString(),
      icon: Target,
      color: 'text-green-600 bg-green-100',
      description: 'In progress'
    },
    {
      title: 'Interview Rate',
      value: `${conversionRate}%`,
      icon: Users,
      color: 'text-purple-600 bg-purple-100',
      description: `${stats.interviews} interviews`
    }
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {statCards.map((stat, index) => (
        <Card key={index} className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className={`p-2 rounded-lg ${stat.color}`}>
                <stat.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-sm font-medium text-foreground/70">{stat.title}</p>
                <p className="text-xs text-foreground/60">{stat.description}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}