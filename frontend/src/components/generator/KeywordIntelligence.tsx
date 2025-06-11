'use client'

import { useState, useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { CheckCircle, Circle, AlertTriangle, TrendingUp, Search } from 'lucide-react'
import type { JobAnalysis } from '@/types'
import { findCommonKeywords, findMissingKeywords, calculateKeywordCoverage } from '@/utils/keywordMatcher'

interface KeywordIntelligenceProps {
  analysis: JobAnalysis | null
  selectedKeywords: string[]
  onKeywordToggle: (keywords: string[]) => void
  resumeState?: any // Add resume state for semantic matching
}

export function KeywordIntelligence({ analysis, selectedKeywords, onKeywordToggle, resumeState }: KeywordIntelligenceProps) {
  const [searchTerm, setSearchTerm] = useState('')

  // Calculate semantic matches
  const { commonKeywords, missingKeywords, keywordCoverage } = useMemo(() => {
    if (!analysis || !resumeState) {
      return { 
        commonKeywords: [], 
        missingKeywords: [], 
        keywordCoverage: 0 
      }
    }

    const common = findCommonKeywords(analysis, resumeState)
    const missing = findMissingKeywords(analysis, resumeState)
    const coverage = calculateKeywordCoverage(analysis, resumeState)

    return {
      commonKeywords: common,
      missingKeywords: missing,
      keywordCoverage: coverage
    }
  }, [analysis, resumeState])

  if (!analysis) {
    return (
      <div className="p-4">
        <div className="text-center text-gray-500">
          <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Complete job analysis to see keyword intelligence</p>
        </div>
      </div>
    )
  }

  const toggleKeyword = (keyword: string) => {
    if (selectedKeywords.includes(keyword)) {
      onKeywordToggle(selectedKeywords.filter(k => k !== keyword))
    } else {
      onKeywordToggle([...selectedKeywords, keyword])
    }
  }

  const selectAllInCategory = (keywords: string[]) => {
    const newSelected = [...new Set([...selectedKeywords, ...keywords])]
    onKeywordToggle(newSelected)
  }

  const clearAllInCategory = (keywords: string[]) => {
    onKeywordToggle(selectedKeywords.filter(k => !keywords.includes(k)))
  }

  const filterKeywords = (keywords: string[]) => {
    if (!searchTerm) return keywords
    return keywords.filter(k => k.toLowerCase().includes(searchTerm.toLowerCase()))
  }

  const KeywordSection = ({ 
    title, 
    keywords, 
    icon: Icon, 
    color,
    description 
  }: {
    title: string
    keywords: string[]
    icon: any
    color: string
    description: string
  }) => {
    const filteredKeywords = filterKeywords(keywords)
    
    return (
      <Card className="p-3 mb-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Icon className={`h-4 w-4 ${color}`} />
            <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
            <Badge variant="secondary" className="text-xs">
              {filteredKeywords.length}
            </Badge>
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => selectAllInCategory(filteredKeywords)}
              className="h-5 px-2 text-xs"
            >
              All
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {filteredKeywords.map((keyword) => {
            const isSelected = selectedKeywords.includes(keyword)
            return (
              <button
                key={keyword}
                onClick={() => toggleKeyword(keyword)}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors ${
                  isSelected
                    ? 'bg-blue-100 text-blue-800 border border-blue-200'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-transparent'
                }`}
              >
                {isSelected ? (
                  <CheckCircle className="h-3 w-3" />
                ) : (
                  <Circle className="h-3 w-3" />
                )}
                <span className="text-xs">{keyword}</span>
              </button>
            )
          })}
        </div>
      </Card>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto p-3">
        <KeywordSection
          title="Critical Keywords"
          keywords={analysis.critical_keywords || []}
          icon={AlertTriangle}
          color="text-red-500"
          description=""
        />

        <KeywordSection
          title="Common Keywords"
          keywords={commonKeywords}
          icon={TrendingUp}
          color="text-green-500"
          description=""
        />

        <KeywordSection
          title="Missing Keywords"
          keywords={missingKeywords}
          icon={Circle}
          color="text-yellow-500"
          description=""
        />

        <KeywordSection
          title="Technical Skills"
          keywords={analysis.keywords?.technical_skills || []}
          icon={CheckCircle}
          color="text-blue-500"
          description=""
        />

        <KeywordSection
          title="Soft Skills"
          keywords={analysis.keywords?.soft_skills || []}
          icon={CheckCircle}
          color="text-purple-500"
          description=""
        />
      </div>
    </div>
  )
}