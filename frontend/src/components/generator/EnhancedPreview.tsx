'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Eye, Download, RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react'

interface EnhancedPreviewProps {
  resumeState: any
  highlightKeywords: string[]
  showAtsIndicators?: boolean
  atsScore?: number
  aiDetectionScore?: number
}

export function EnhancedPreview({ 
  resumeState, 
  highlightKeywords, 
  showAtsIndicators = true,
  atsScore = 0,
  aiDetectionScore = 0
}: EnhancedPreviewProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  const generatePreview = async () => {
    setIsGenerating(true)
    try {
      // Simulate preview generation - replace with actual API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      setPreviewUrl('/api/preview-html/sample.html')
      setLastUpdate(new Date())
    } catch (error) {
      console.error('Error generating preview:', error)
    } finally {
      setIsGenerating(false)
    }
  }

  useEffect(() => {
    if (resumeState) {
      const timer = setTimeout(() => {
        generatePreview()
      }, 1000) // Auto-regenerate 1 second after content changes
      
      return () => clearTimeout(timer)
    }
  }, [resumeState])

  const highlightText = (text: string, keywords: string[]) => {
    if (!keywords.length) return text
    
    let highlightedText = text
    keywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi')
      highlightedText = highlightedText.replace(
        regex, 
        `<mark class="bg-yellow-200 px-1 rounded">${keyword}</mark>`
      )
    })
    
    return highlightedText
  }

  const getContentAnalysis = () => {
    const summary = resumeState?.summary?.current || ''
    const skills = resumeState?.skills?.current || ''
    const experience = resumeState?.experience?.current || ''
    
    const totalWords = (summary + ' ' + skills + ' ' + experience).split(' ').length
    const keywordMatches = highlightKeywords.filter(keyword =>
      (summary + skills + experience).toLowerCase().includes(keyword.toLowerCase())
    ).length
    
    return {
      totalWords,
      keywordMatches,
      keywordCoverage: highlightKeywords.length > 0 ? (keywordMatches / highlightKeywords.length) * 100 : 0
    }
  }

  const analysis = getContentAnalysis()

  return (
    <div className="h-full flex flex-col">
      {/* Preview Header */}
      <div className="bg-gray-50 border-b p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-gray-600" />
            {isGenerating && (
              <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
            )}
          </div>
          
          {/* Inline Indicators */}
          {showAtsIndicators && (
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-full ${
                  analysis.keywordCoverage >= 80 ? 'bg-green-500' : 
                  analysis.keywordCoverage >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                }`} />
                <span className="text-gray-600 font-medium">Keywords: {analysis.keywordCoverage.toFixed(0)}%</span>
              </div>
              <div className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-full ${
                  atsScore >= 80 ? 'bg-green-500' : 
                  atsScore >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                }`} />
                <span className="text-gray-600 font-medium">ATS: {atsScore}%</span>
              </div>
              <div className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-full ${
                  aiDetectionScore <= 20 ? 'bg-green-500' : 
                  aiDetectionScore <= 40 ? 'bg-yellow-500' : 'bg-red-500'
                }`} />
                <span className="text-gray-600 font-medium">AI: {aiDetectionScore}%</span>
              </div>
            </div>
          )}
          
          <div className="flex items-center gap-2">
            <button
              onClick={generatePreview}
              disabled={isGenerating}
              className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-50"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button className="p-1 text-gray-500 hover:text-gray-700">
              <Download className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Preview Content */}
      <div className="flex-1 overflow-y-auto bg-white">
        {previewUrl ? (
          <iframe 
            src={previewUrl}
            className="w-full h-full border-0"
            title="Resume Preview"
          />
        ) : (
          <div className="p-8">
            {/* Mock Resume Preview */}
            <div className="max-w-2xl mx-auto bg-white border rounded-lg shadow-sm p-8">
              <div className="text-center mb-6">
                <h1 className="text-2xl font-bold text-gray-900">HARSHA VIPPALA</h1>
                <p className="text-gray-600 font-normal">harsha.vippala@gmail.com • +1(909)600-7297</p>
                <p className="text-gray-600 font-normal">linkedin.com/in/harsha-vippala</p>
              </div>

              {/* Professional Summary */}
              {resumeState?.summary?.current && (
                <div className="mb-6">
                  <h2 className="text-lg font-bold text-gray-900 mb-2 border-b">
                    PROFESSIONAL SUMMARY
                  </h2>
                  <div 
                    className="text-sm text-gray-700 leading-relaxed font-normal"
                    dangerouslySetInnerHTML={{ 
                      __html: highlightText(resumeState.summary.current, highlightKeywords) 
                    }}
                  />
                </div>
              )}

              {/* Skills */}
              {resumeState?.skills?.current && (
                <div className="mb-6">
                  <h2 className="text-lg font-bold text-gray-900 mb-2 border-b">
                    TECHNICAL SKILLS
                  </h2>
                  <div 
                    className="text-sm text-gray-700 font-normal"
                    dangerouslySetInnerHTML={{ 
                      __html: highlightText(resumeState.skills.current, highlightKeywords) 
                    }}
                  />
                </div>
              )}

              {/* Experience */}
              {resumeState?.experience?.current && (
                <div className="mb-6">
                  <h2 className="text-lg font-bold text-gray-900 mb-2 border-b">
                    PROFESSIONAL EXPERIENCE
                  </h2>
                  <div 
                    className="text-sm text-gray-700 font-normal"
                    dangerouslySetInnerHTML={{ 
                      __html: highlightText(resumeState.experience.current, highlightKeywords) 
                    }}
                  />
                </div>
              )}

              {/* Placeholder if no content */}
              {!resumeState?.summary?.current && !resumeState?.skills?.current && !resumeState?.experience?.current && (
                <div className="text-center py-12">
                  <Eye className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 font-normal">Start editing to see your resume preview</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

    </div>
  )
}