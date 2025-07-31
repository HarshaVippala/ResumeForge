'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { 
  Search, 
  Filter, 
  X, 
  ChevronDown,
  Code,
  Zap,
  Layers,
  Brain
} from 'lucide-react'
import { useResumeStore } from '@/stores/useResumeStore'
import { cn } from '@/lib/utils'
import type { JobType } from '@/types'

// Refined job types (only 4 main categories)
const jobTypes = [
  { value: 'full-stack', label: 'Full Stack', icon: Layers },
  { value: 'backend', label: 'Backend', icon: Code },
  { value: 'frontend', label: 'Frontend', icon: Zap },
  { value: 'ai-ml', label: 'AI/ML', icon: Brain }
]

// Smart tech stack quick filters
const techStackFilters = [
  {
    id: 'react-stack',
    label: 'React Stack',
    description: 'React, TypeScript, Node.js',
    technologies: ['React', 'TypeScript', 'Node.js', 'JavaScript'],
    color: 'bg-blue-100 text-blue-800 hover:bg-blue-200'
  },
  {
    id: 'python-stack',
    label: 'Python Stack',
    description: 'Python, Django, PostgreSQL',
    technologies: ['Python', 'Django', 'FastAPI', 'PostgreSQL', 'MongoDB'],
    color: 'bg-green-100 text-green-800 hover:bg-green-200'
  },
  {
    id: 'cloud-stack',
    label: 'Cloud Stack',
    description: 'AWS, Docker, Kubernetes',
    technologies: ['AWS', 'Docker', 'Kubernetes', 'GCP', 'Azure'],
    color: 'bg-purple-100 text-purple-800 hover:bg-purple-200'
  },
  {
    id: 'ai-stack',
    label: 'AI/ML Stack',
    description: 'TensorFlow, PyTorch, Scikit-learn',
    technologies: ['TensorFlow', 'PyTorch', 'Scikit-learn', 'Pandas', 'NumPy'],
    color: 'bg-orange-100 text-orange-800 hover:bg-orange-200'
  }
]

// Only important technologies for filtering
const importantTechnologies = [
  'React', 'Vue.js', 'Angular', 'TypeScript', 'JavaScript',
  'Python', 'Java', 'Go', 'Rust', 'C++', 'C#',
  'Node.js', 'Django', 'FastAPI', 'Spring Boot', 'Express.js',
  'AWS', 'GCP', 'Azure', 'Docker', 'Kubernetes',
  'PostgreSQL', 'MongoDB', 'Redis', 'MySQL',
  'GraphQL', 'REST API', 'gRPC', 'WebSockets',
  'TensorFlow', 'PyTorch', 'Scikit-learn', 'Pandas', 'NumPy',
  'Next.js', 'Nuxt.js', 'Svelte', 'Flutter', 'React Native',
  'Jenkins', 'GitHub Actions', 'GitLab CI', 'Terraform',
  'Elasticsearch', 'Kafka', 'RabbitMQ', 'Nginx'
]

interface ResumeFiltersProps {
  isExpanded: boolean
}

export function ResumeFilters({ isExpanded }: ResumeFiltersProps) {
  const [selectedTechStack, setSelectedTechStack] = useState<string | null>(null)
  const { filters, setFilters, resumes } = useResumeStore()

  // Get unique technologies from resumes (filtered to important ones)
  const availableTechnologies = [...new Set(
    resumes.flatMap(r => r.metadata.classification.primaryTechnologies)
  )].filter(tech => importantTechnologies.includes(tech)).sort()

  const handleSearchChange = (value: string) => {
    setFilters({ search: value })
  }

  const toggleJobType = (jobType: JobType) => {
    const currentTypes = filters.jobTypes || []
    const newTypes = currentTypes.includes(jobType)
      ? currentTypes.filter(type => type !== jobType)
      : [...currentTypes, jobType]
    
    setFilters({ jobTypes: newTypes })
  }

  const toggleTechnology = (tech: string) => {
    const currentTech = filters.technologies || []
    const newTech = currentTech.includes(tech)
      ? currentTech.filter(t => t !== tech)
      : [...currentTech, tech]
    
    setFilters({ technologies: newTech })
  }

  const handleTechStackFilter = (stackId: string) => {
    const stack = techStackFilters.find(s => s.id === stackId)
    if (!stack) return

    if (selectedTechStack === stackId) {
      // Remove the stack filter
      setSelectedTechStack(null)
      setFilters({ technologies: [] })
    } else {
      // Apply the stack filter
      setSelectedTechStack(stackId)
      setFilters({ technologies: stack.technologies })
    }
  }

  const activeFilterCount = 
    (filters.jobTypes?.length || 0) +
    (filters.technologies?.length || 0) +
    (filters.search ? 1 : 0) +
    (selectedTechStack ? 1 : 0)

  return (
    <>
      {isExpanded && (
        <Card>
          <CardContent className="p-4 space-y-6">
            {/* Active Filters Display */}
            {activeFilterCount > 0 && (
              <div className="space-y-2">
            <h4 className="text-sm font-medium text-card-foreground">Active Filters</h4>
            <div className="flex flex-wrap gap-2">
              {filters.search && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Search className="h-3 w-3" />
                  "{filters.search}"
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 ml-1"
                    onClick={() => handleSearchChange('')}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              )}

              {selectedTechStack && (
                <Badge variant="info" className="flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  {techStackFilters.find(s => s.id === selectedTechStack)?.label}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 ml-1"
                    onClick={() => handleTechStackFilter(selectedTechStack)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              )}

              {filters.technologies?.filter(tech => !selectedTechStack).map(tech => (
                <Badge key={tech} variant="info" className="flex items-center gap-1">
                  <Code className="h-3 w-3" />
                  {tech}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 ml-1"
                    onClick={() => toggleTechnology(tech)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
            </div>
          </div>
        )}

            {/* Filters Content */}
            <div className="space-y-6">
            {/* Search */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-card-foreground flex items-center gap-2">
                <Search className="h-4 w-4" />
                Search
              </h4>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search companies, roles, technologies..."
                  value={filters.search || ''}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Job Types */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-card-foreground flex items-center gap-2">
                <Code className="h-4 w-4" />
                Role Type
              </h4>
              <div className="flex flex-wrap gap-2">
                {jobTypes.map((type) => {
                  const Icon = type.icon
                  const isSelected = filters.jobTypes?.includes(type.value as JobType) || false
                  
                  return (
                    <button
                      key={type.value}
                      onClick={() => toggleJobType(type.value as JobType)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-all",
                        isSelected
                          ? "bg-blue-100 text-blue-800 border-blue-300"
                          : "bg-white text-gray-700 border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {type.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Smart Tech Stack Quick Filters */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-card-foreground flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Quick Tech Stack Filters
              </h4>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                {techStackFilters.map((stack) => (
                  <button
                    key={stack.id}
                    onClick={() => handleTechStackFilter(stack.id)}
                    className={cn(
                      "p-3 rounded-lg text-left transition-all border-2",
                      selectedTechStack === stack.id
                        ? "border-blue-300 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300",
                      stack.color
                    )}
                  >
                    <div className="font-medium text-sm">{stack.label}</div>
                    <div className="text-xs opacity-75 mt-1">{stack.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Individual Technologies */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-card-foreground">Individual Technologies</h4>
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {availableTechnologies.map(tech => (
                  <label key={tech} className="flex items-center space-x-2 text-sm">
                    <input
                      type="checkbox"
                      checked={filters.technologies?.includes(tech) || false}
                      onChange={() => toggleTechnology(tech)}
                      className="rounded border-gray-300"
                    />
                    <span className="truncate">{tech}</span>
                  </label>
                ))}
              </div>
            </div>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  )
}