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

    // Set a timeout for the entire operation
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Analysis timed out. Please check your backend connection.')), 30000) // 30 second timeout
    })

    try {
      // Race between the actual API call and the timeout
      const response = await Promise.race([
        fetch('http://localhost:5001/api/analyze-job', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            company: formData.company,
            role: formData.role,
            jobDescription: formData.jobDescription
          })
        }),
        timeoutPromise
      ]) as Response

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
        if (err.message.includes('fetch') || err.message.includes('Failed to fetch')) {
          setError('Unable to connect to backend server. Please ensure the backend is running on http://localhost:5001')
        } else if (err.message.includes('timed out')) {
          setError('Analysis is taking too long. Please check that the backend server and LM Studio are running.')
        } else if (err.message.includes('LM Studio')) {
          setError('LM Studio is not running or no models are loaded. The system will use basic keyword extraction.')
          // Don't block the user, let them know it will work with limitations
          setTimeout(() => setError(''), 5000)
        } else {
          setError(err.message)
        }
      } else {
        setError('Failed to analyze job description. Please try again.')
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4">
        <div className="max-w-2xl w-full">
          <Card className="shadow-2xl border-0 bg-white dark:bg-gray-800">
            <CardContent className="p-12">
              {/* Modern animated header */}
              <div className="text-center mb-10">
                <div className="relative inline-block mb-6">
                  <div className="absolute inset-0 bg-blue-500 rounded-full blur-xl opacity-20 animate-pulse" />
                  <div className="relative bg-gradient-to-tr from-blue-500 to-blue-600 rounded-2xl p-4">
                    <Sparkles className="h-10 w-10 text-white animate-pulse" />
                  </div>
                </div>
                <h2 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent mb-3">
                  Analyzing Job Description
                </h2>
                <p className="text-gray-600 dark:text-gray-400 text-lg">
                  Extracting strategic insights to optimize your resume
                </p>
              </div>
              
              {/* Progress steps with modern design */}
              <div className="space-y-6">
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                      <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        Parsing job requirements
                      </span>
                      <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                        Complete
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full" style={{ width: '100%' }} />
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                      <Loader className="h-6 w-6 text-blue-600 dark:text-blue-400 animate-spin" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        Extracting strategic keywords
                      </span>
                      <span className="text-xs text-blue-600 dark:text-blue-400 font-medium animate-pulse">
                        Processing...
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full animate-progress" style={{ width: '60%' }} />
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-4 opacity-50">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                      <div className="h-6 w-6 rounded-full border-2 border-gray-300 dark:border-gray-600" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Analyzing skill criticality
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        Pending
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full" />
                  </div>
                </div>

                <div className="flex items-center space-x-4 opacity-50">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                      <div className="h-6 w-6 rounded-full border-2 border-gray-300 dark:border-gray-600" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Generating optimization strategy
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        Pending
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full" />
                  </div>
                </div>
              </div>

              {/* Helpful tip */}
              <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  <strong>Tip:</strong> We're using advanced AI to understand not just keywords, but the strategic context of the role to help you stand out.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-foreground">Resume Generator</h1>
      </div>

      {/* Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Form Fields */}
        <div className="space-y-4">
          <Input
            type="text"
            value={formData.company}
            onChange={(e) => handleInputChange('company', e.target.value)}
            placeholder="Company *"
            className="h-10"
          />
          
          <Input
            type="text"
            value={formData.role}
            onChange={(e) => handleInputChange('role', e.target.value)}
            placeholder="Role *"
            className="h-10"
          />
          
          <Input
            type="url"
            value={formData.jobUrl}
            onChange={(e) => handleInputChange('jobUrl', e.target.value)}
            placeholder="Job URL (optional)"
            className="h-10"
          />

          {error && (
            <div className="bg-destructive/15 border border-destructive/20 rounded-lg p-3">
              <p className="text-destructive text-sm">{error}</p>
            </div>
          )}

          <Button
            onClick={analyzeJob}
            disabled={!formData.company || !formData.role || !formData.jobDescription}
            className="w-full h-10"
          >
            Generate Resume
          </Button>
        </div>

        {/* Right Column - Job Description */}
        <div className="lg:col-span-2">
          <textarea
            value={formData.jobDescription}
            onChange={(e) => handleInputChange('jobDescription', e.target.value)}
            placeholder="Paste job description here..."
            className="w-full h-full min-h-[400px] px-4 py-3 border border-input rounded-lg focus:ring-2 focus:ring-ring focus:border-input transition-colors resize-none text-sm bg-background text-foreground"
          />
        </div>
      </div>
    </div>
  )
}