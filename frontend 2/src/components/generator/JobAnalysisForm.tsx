'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { 
  Building2, 
  User, 
  FileText, 
  Loader, 
  CheckCircle,
  Globe,
  Sparkles
} from 'lucide-react'
import type { JobAnalysis } from '@/types'

interface JobAnalysisFormProps {
  onComplete: (analysis: JobAnalysis) => void
}

export function JobAnalysisForm({ onComplete }: JobAnalysisFormProps) {
  const [formData, setFormData] = useState({
    company: '',
    role: '',
    jobDescription: '',
    jobUrl: ''
  })
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState('')

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const analyzeJob = async () => {
    if (!formData.company || !formData.role || !formData.jobDescription) {
      setError('Please fill in all required fields')
      return
    }

    setIsAnalyzing(true)
    setError('')

    try {
      // Call backend API for job analysis
      const response = await fetch('http://localhost:5001/api/analyze-job', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          company: formData.company,
          role: formData.role,
          jobDescription: formData.jobDescription
        })
      })

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Analysis failed')
      }

      // Transform backend response to match frontend interface
      const analysis: JobAnalysis = {
        keywords: {
          technical_skills: data.analysis.technical_skills || [],
          soft_skills: data.analysis.soft_skills || [],
          experience_requirements: data.analysis.experience_requirements || [],
          nice_to_have: [] // Not directly mapped from backend
        },
        categories: {
          programming_languages: data.analysis.programming_languages || [],
          frameworks_tools: data.analysis.frameworks_libraries_tools || [],
          methodologies: data.analysis.methodologies_concepts || [],
          soft_skills: data.analysis.soft_skills || []
        },
        critical_keywords: data.analysis.critical_keywords || [],
        job_info: {
          company: formData.company,
          role: formData.role,
          seniority: data.analysis.job_info?.seniority || 'Mid-level',
          department: data.analysis.job_info?.department || 'Engineering'
        },
        session_id: data.session_id // Store session ID for subsequent API calls
      }

      setIsAnalyzing(false)
      onComplete(analysis)

    } catch (err) {
      setIsAnalyzing(false)

      // Provide more specific error messages
      if (err instanceof Error) {
        if (err.message.includes('fetch')) {
          setError('Unable to connect to backend server. Please ensure the backend is running on http://localhost:5001')
        } else {
          setError(err.message)
        }
      } else {
        setError('Failed to analyze job description')
      }
    }
  }

  const handleUrlImport = async () => {
    if (!formData.jobUrl) return
    
    // Simulate URL import
    setFormData(prev => ({
      ...prev,
      jobDescription: 'Job description imported from URL...\n\nWe are seeking a Senior Software Engineer to join our team...'
    }))
  }

  if (isAnalyzing) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardContent className="p-8">
            <div className="text-center">
              <div className="mb-6">
                <Loader className="h-12 w-12 text-blue-600 animate-spin mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Analyzing Job Description</h2>
                <p className="text-gray-600">Using AI to extract keywords and requirements...</p>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-center space-x-3 text-sm">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-gray-700">Parsing job requirements</span>
                </div>
                <div className="flex items-center justify-center space-x-3 text-sm">
                  <Loader className="h-5 w-5 animate-spin text-blue-500" />
                  <span className="text-gray-700">Categorizing keywords by importance</span>
                </div>
                <div className="flex items-center justify-center space-x-3 text-sm">
                  <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
                  <span className="text-gray-400">Scoring keyword impact</span>
                </div>
                <div className="flex items-center justify-center space-x-3 text-sm">
                  <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
                  <span className="text-gray-400">Generating optimization suggestions</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto h-[calc(100vh-200px)] flex flex-col">
      {/* Header */}
      <div className="text-center mb-6 flex-shrink-0">
        <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
          <Sparkles className="h-6 w-6 text-blue-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">
          Resume Generator
        </h1>
      </div>

      {/* Main Content Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-hidden">
        {/* Left Column - Job Details */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="text-lg">Job Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Company Input */}
              <div>
                <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-2">
                  <Building2 className="h-4 w-4" />
                  <span>Company Name *</span>
                </label>
                <Input
                  type="text"
                  value={formData.company}
                  onChange={(e) => handleInputChange('company', e.target.value)}
                  placeholder="e.g., Google, Microsoft, Startup Inc."
                  className="w-full"
                />
              </div>

              {/* Role Input */}
              <div>
                <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-2">
                  <User className="h-4 w-4" />
                  <span>Role Title *</span>
                </label>
                <Input
                  type="text"
                  value={formData.role}
                  onChange={(e) => handleInputChange('role', e.target.value)}
                  placeholder="e.g., Senior Software Engineer, Product Manager"
                  className="w-full"
                />
              </div>

              {/* Job URL (Optional) */}
              <div>
                <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-2">
                  <Globe className="h-4 w-4" />
                  <span>Job Posting URL (Optional)</span>
                </label>
                <div className="flex gap-2">
                  <Input
                    type="url"
                    value={formData.jobUrl}
                    onChange={(e) => handleInputChange('jobUrl', e.target.value)}
                    placeholder="https://company.com/careers/job-123"
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    onClick={handleUrlImport}
                    disabled={!formData.jobUrl}
                    className="px-4"
                  >
                    Import
                  </Button>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}

              <Button
                onClick={analyzeJob}
                disabled={!formData.company || !formData.role || !formData.jobDescription}
                className="w-full py-3 flex items-center justify-center space-x-2"
              >
                <Sparkles className="h-5 w-5" />
                <span>Generate Resume</span>
              </Button>
            </CardContent>
          </Card>




        </div>

        {/* Right Column - Job Description */}
        <div className="lg:col-span-2 flex flex-col">
          <Card className="flex-1 flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-lg">
                <FileText className="h-5 w-5" />
                <span>Job Description *</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <textarea
                value={formData.jobDescription}
                onChange={(e) => handleInputChange('jobDescription', e.target.value)}
                placeholder="Paste the complete job description here...

Include requirements, responsibilities, and qualifications for best results"
                className="flex-1 w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none min-h-0"
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}