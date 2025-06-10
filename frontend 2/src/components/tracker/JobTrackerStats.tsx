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

interface JobTrackerStatsProps {
  stats: {
    total: number
    active: number
    interviews: number
    offers: number
    avgResponseTime: number
  }
}

export function JobTrackerStats({ stats }: JobTrackerStatsProps) {
  const conversionRate = stats.total > 0 ? Math.round((stats.interviews / stats.total) * 100) : 0
  const offerRate = stats.interviews > 0 ? Math.round((stats.offers / stats.interviews) * 100) : 0
  
  const statCards = [
    {
      title: 'Total Applications',
      value: stats.total.toString(),
      icon: Briefcase,
      color: 'text-blue-600 bg-blue-100',
      trend: '+12% this month'
    },
    {
      title: 'Active Pipeline',
      value: stats.active.toString(),
      icon: Target,
      color: 'text-green-600 bg-green-100',
      trend: `${stats.active} in progress`
    },
    {
      title: 'Interview Rate',
      value: `${conversionRate}%`,
      icon: Users,
      color: 'text-purple-600 bg-purple-100',
      trend: `${stats.interviews} interviews`
    },
    {
      title: 'Offer Rate',
      value: `${offerRate}%`,
      icon: Trophy,
      color: 'text-yellow-600 bg-yellow-100',
      trend: `${stats.offers} offers received`
    },
    {
      title: 'Avg Response Time',
      value: stats.avgResponseTime > 0 ? `${stats.avgResponseTime}d` : 'N/A',
      icon: Clock,
      color: 'text-indigo-600 bg-indigo-100',
      trend: 'Industry: 7-14d'
    },
    {
      title: 'This Week',
      value: '3',
      icon: Calendar,
      color: 'text-orange-600 bg-orange-100',
      trend: '2 applications, 1 interview'
    }
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {statCards.map((stat, index) => (
        <Card key={index} className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2 rounded-lg ${stat.color}`}>
                <stat.icon className="h-4 w-4" />
              </div>
              <TrendingUp className="h-4 w-4 text-gray-400" />
            </div>
            
            <div className="space-y-1">
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-sm font-medium text-gray-600">{stat.title}</p>
              <p className="text-xs text-gray-500">{stat.trend}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}