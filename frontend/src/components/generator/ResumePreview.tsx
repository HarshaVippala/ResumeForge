'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  FileText,
  Download,
  Eye,
  BarChart3,
  Star,
  CheckCircle,
  AlertTriangle,
  Zap,
  RotateCcw
} from 'lucide-react'
import type { JobAnalysis, ResumeState } from '@/types'

interface ResumePreviewProps {
  resumeState: ResumeState
  jobAnalysis: JobAnalysis | null
  highlightKeywords?: boolean
}

export function ResumePreview({ resumeState, jobAnalysis, highlightKeywords = false }: ResumePreviewProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [documentUrl, setDocumentUrl] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewType, setPreviewType] = useState<string>('direct')
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  // Calculate ATS score based on keyword matches
  const calculateATSScore = () => {
    if (!jobAnalysis) return 65

    const allKeywords = [
      ...(jobAnalysis.critical_keywords || []),
      ...(jobAnalysis.keywords.technical_skills || []),
      ...(jobAnalysis.keywords.soft_skills || [])
    ]

    const resumeContent = [
      resumeState.summary.current,
      resumeState.skills.current,
      JSON.stringify(resumeState.experience.current)
    ].join(' ').toLowerCase()

    const matchedKeywords = allKeywords.filter(keyword =>
      resumeContent.includes(keyword.toLowerCase())
    )

    return Math.min(95, Math.max(45, Math.round((matchedKeywords.length / allKeywords.length) * 100)))
  }

  const atsScore = calculateATSScore()
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-100'
    if (score >= 60) return 'text-yellow-600 bg-yellow-100'
    return 'text-red-600 bg-red-100'
  }

  // Generate document preview for Google Docs viewer
  const generatePreview = async () => {
    if (!jobAnalysis?.session_id) {
      setPreviewError('No session ID available. Please analyze the job description first.')
      return
    }

    setIsLoadingPreview(true)
    setPreviewError(null)

    try {
      const response = await fetch('http://localhost:5001/api/preview-document', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: jobAnalysis.session_id,
          sections: {
            summary: resumeState.summary.current,
            skills: resumeState.skills.current,
            experience: resumeState.experience.current
          },
          template: 'placeholder_resume.docx'
        })
      })

      if (!response.ok) {
        throw new Error(`Preview failed: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      setDocumentUrl(data.document_url)
      setPreviewUrl(data.preview_url || data.document_url)
      setPreviewType(data.preview_type || 'direct')

    } catch (err) {
      console.error('Preview generation failed:', err)
      setPreviewError(`Failed to generate preview: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }

    setIsLoadingPreview(false)
  }

  // Auto-generate preview when data changes
  useEffect(() => {
    if (jobAnalysis?.session_id && (resumeState.summary.current || resumeState.skills.current || resumeState.experience.current)) {
      generatePreview()
    }
  }, [resumeState.summary.current, resumeState.skills.current, resumeState.experience.current, jobAnalysis?.session_id])

  const handleGenerate = async () => {
    if (!jobAnalysis?.session_id) {
      alert('No session ID available. Please analyze the job description first.')
      return
    }

    setIsGenerating(true)

    try {
      // Call backend API for PDF generation using your resume template
      const response = await fetch('http://localhost:5001/api/template-export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: jobAnalysis.session_id,
          sections: {
            summary: resumeState.summary.current,
            skills: resumeState.skills.current,
            experience: resumeState.experience.current
          },
          template: 'placeholder_resume.docx'
        })
      })

      if (!response.ok) {
        throw new Error(`Export failed: ${response.status} ${response.statusText}`)
      }

      // Download the generated file
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = url
      a.download = `${jobAnalysis.job_info.company}_${jobAnalysis.job_info.role}_Resume.docx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

    } catch (err) {
      console.error('Resume generation failed:', err)
      alert(`Failed to generate resume: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }

    setIsGenerating(false)
  }

  const highlightKeywordsInText = (text: string) => {
    if (!highlightKeywords || !jobAnalysis) return text

    let highlightedText = text
    const keywords = [
      ...(jobAnalysis.critical_keywords || []),
      ...(jobAnalysis.keywords.technical_skills || [])
    ]

    keywords.forEach(keyword => {
      const regex = new RegExp(`(${keyword})`, 'gi')
      highlightedText = highlightedText.replace(regex, '<mark class="bg-yellow-200 px-1 rounded">$1</mark>')
    })

    return highlightedText
  }

  return (
    <div className="bg-white h-full flex flex-col">
      {/* Simplified Header */}
      <div className="border-b p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Resume Preview
          </h2>

          <div className="flex items-center gap-3">
            {/* ATS Score */}
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">ATS Score:</span>
              <div className={`px-2 py-1 rounded text-xs font-medium ${getScoreColor(atsScore)}`}>
                {atsScore}%
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => window.location.reload()}
                size="sm"
                className="flex items-center gap-2"
              >
                <RotateCcw className="h-3 w-3" />
                Regenerate
              </Button>

              <Button
                onClick={handleGenerate}
                disabled={isGenerating}
                size="sm"
                className="flex items-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Download className="h-3 w-3" />
                    Download PDF
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {isLoadingPreview ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent mx-auto mb-4" />
              <p className="text-gray-600">Generating document preview...</p>
            </div>
          </div>
        ) : previewError ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-4" />
              <p className="text-red-600 mb-4">{previewError}</p>
              <Button onClick={generatePreview} variant="outline" size="sm">
                <RotateCcw className="h-4 w-4 mr-2" />
                Retry Preview
              </Button>
            </div>
          </div>
        ) : previewUrl ? (
          previewType === 'html' ? (
            <div className="h-full flex flex-col">
              {/* Preview header with actions */}
              <div className="bg-gray-50 border-b p-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Eye className="h-4 w-4" />
                  Resume Preview
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => documentUrl && window.open(documentUrl, '_blank')}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-1"
                  >
                    <FileText className="h-3 w-3" />
                    Open Word
                  </Button>
                  <Button
                    onClick={() => {
                      if (documentUrl) {
                        const link = document.createElement('a')
                        link.href = documentUrl
                        link.download = `Resume_${new Date().toISOString().split('T')[0]}.docx`
                        document.body.appendChild(link)
                        link.click()
                        document.body.removeChild(link)
                      }
                    }}
                    size="sm"
                    className="flex items-center gap-1"
                  >
                    <Download className="h-3 w-3" />
                    Download
                  </Button>
                </div>
              </div>
              
              {/* HTML preview iframe */}
              <div className="flex-1">
                <iframe 
                  src={previewUrl}
                  width="100%" 
                  height="100%"
                  frameBorder="0"
                  className="w-full h-full"
                  title="Resume Preview"
                />
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-8">
              <div className="max-w-md w-full bg-white border border-gray-200 rounded-lg shadow-sm p-6">
                <div className="text-center">
                  <FileText className="h-16 w-16 text-blue-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Resume Generated Successfully</h3>
                  <p className="text-gray-600 mb-6">Your resume has been generated with the latest content. Click below to view or download it.</p>
                  
                  <div className="space-y-3">
                    <Button
                      onClick={() => documentUrl && window.open(documentUrl, '_blank')}
                      className="w-full flex items-center justify-center gap-2"
                      size="lg"
                    >
                      <Eye className="h-4 w-4" />
                      View Resume Document
                    </Button>
                    
                    <Button
                      onClick={() => {
                        if (documentUrl) {
                          const link = document.createElement('a')
                          link.href = documentUrl
                          link.download = `Resume_${new Date().toISOString().split('T')[0]}.docx`
                          document.body.appendChild(link)
                          link.click()
                          document.body.removeChild(link)
                        }
                      }}
                      variant="outline"
                      className="w-full flex items-center justify-center gap-2"
                      size="lg"
                    >
                      <Download className="h-4 w-4" />
                      Download Word Document
                    </Button>
                  </div>
                  
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                    <p className="text-xs text-blue-700">
                      Document updates automatically when you modify any section
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <FileText className="h-8 w-8 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">No document preview available</p>
              <Button onClick={generatePreview} variant="outline" size="sm">
                <Eye className="h-4 w-4 mr-2" />
                Generate Preview
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

