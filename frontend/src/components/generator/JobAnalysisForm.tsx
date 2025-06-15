'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Building2, 
  User, 
  FileText, 
  Loader, 
  CheckCircle,
  Globe,
  Sparkles,
  Settings,
  Brain,
  Zap
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
  const [selectedProvider, setSelectedProvider] = useState('lmstudio')
  const [providers, setProviders] = useState([])
  const [loadingProviders, setLoadingProviders] = useState(true)

  // Load available LLM providers on component mount
  useEffect(() => {
    const loadProviders = async () => {
      try {
        const response = await fetch('http://localhost:5001/api/llm-providers')
        const data = await response.json()
        
        if (data.success) {
          setProviders(data.providers)
          setSelectedProvider(data.current_provider || 'lmstudio')
        }
      } catch (err) {
        console.error('Failed to load LLM providers:', err)
        // Set default providers if API fails
        setProviders([
          { name: 'lmstudio', display_name: 'LMStudio', available: true, requires_api_key: false },
          { name: 'openai', display_name: 'OpenAI GPT', available: false, requires_api_key: false },
          { name: 'gemini', display_name: 'Google Gemini', available: false, requires_api_key: false }
        ])
      } finally {
        setLoadingProviders(false)
      }
    }
    
    loadProviders()
  }, [])

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
        fetch('http://localhost:5001/api/analyze-job-with-provider', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            company: formData.company,
            role: formData.role,
            jobDescription: formData.jobDescription,
            provider: selectedProvider
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
    if (!formData.jobUrl.trim()) return
    
    setIsAnalyzing(true)
    setError('')
    
    try {
      const response = await fetch('http://localhost:5001/api/parse-linkedin-job', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobUrl: formData.jobUrl.trim()
        })
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to parse LinkedIn job URL')
      }

      // Populate form with extracted data
      setFormData(prev => ({
        ...prev,
        company: data.company || prev.company,
        role: data.role || prev.role,
        jobDescription: data.jobDescription || prev.jobDescription
      }))

      setIsAnalyzing(false)

    } catch (err) {
      setIsAnalyzing(false)
      
      if (err instanceof Error) {
        if (err.message.includes('fetch') || err.message.includes('Failed to fetch')) {
          setError('Unable to connect to backend server. Please ensure the backend is running on http://localhost:5001')
        } else {
          setError(err.message)
        }
      } else {
        setError('Failed to parse LinkedIn job URL. Please try again or enter job details manually.')
      }
    }
  }

  if (isAnalyzing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-2xl w-full">
          <Card className="shadow-lg border bg-white">
            <CardContent className="p-12">
              {/* Modern animated header */}
              <div className="text-center mb-10">
                <div className="relative inline-block mb-6">
                  <div className="absolute inset-0 bg-blue-500 rounded-full blur-xl opacity-20 animate-pulse" />
                  <div className="relative bg-gradient-to-tr from-blue-500 to-blue-600 rounded-2xl p-4">
                    <Sparkles className="h-10 w-10 text-white animate-pulse" />
                  </div>
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-3">
                  Analyzing Job Description
                </h2>
                <p className="text-gray-600 text-lg">
                  Extracting strategic insights to optimize your resume
                </p>
              </div>
              
              {/* Progress steps with modern design */}
              <div className="space-y-6">
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                      <CheckCircle className="h-6 w-6 text-green-600" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-900">
                        Parsing job requirements
                      </span>
                      <span className="text-xs text-green-600 font-medium">
                        Complete
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full" style={{ width: '100%' }} />
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <Loader className="h-6 w-6 text-blue-600 animate-spin" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-900">
                        Extracting strategic keywords
                      </span>
                      <span className="text-xs text-blue-600 font-medium animate-pulse">
                        Processing...
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full animate-progress" style={{ width: '60%' }} />
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-4 opacity-50">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                      <div className="h-6 w-6 rounded-full border-2 border-gray-300" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-500">
                        Analyzing skill criticality
                      </span>
                      <span className="text-xs text-gray-400">
                        Pending
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 bg-gray-200 rounded-full" />
                  </div>
                </div>

                <div className="flex items-center space-x-4 opacity-50">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                      <div className="h-6 w-6 rounded-full border-2 border-gray-300" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-500">
                        Generating optimization strategy
                      </span>
                      <span className="text-xs text-gray-400">
                        Pending
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 bg-gray-200 rounded-full" />
                  </div>
                </div>
              </div>

              {/* Helpful tip */}
              <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-700">
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
          
          <div className="flex gap-2">
            <Input
              type="url"
              value={formData.jobUrl}
              onChange={(e) => handleInputChange('jobUrl', e.target.value)}
              placeholder="LinkedIn Job URL (optional)"
              className="h-10 flex-1"
            />
            <Button
              type="button"
              variant="outline"
              onClick={handleUrlImport}
              disabled={!formData.jobUrl.trim() || isAnalyzing}
              className="h-10 px-3"
            >
              <Globe className="h-4 w-4" />
            </Button>
          </div>

          {/* AI Provider Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Brain className="h-4 w-4" />
              AI Provider
            </label>
            <Select
              value={selectedProvider}
              onValueChange={setSelectedProvider}
              disabled={loadingProviders || isAnalyzing}
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Select AI Provider" />
              </SelectTrigger>
              <SelectContent>
                {providers.map((provider: any) => (
                  <SelectItem 
                    key={provider.name} 
                    value={provider.name}
                    disabled={!provider.available}
                  >
                    <div className="flex items-center gap-2">
                      <span>{provider.display_name}</span>
                      {!provider.available && (
                        <Badge variant="secondary" className="text-xs">
                          Not Configured
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Show configuration note for cloud providers */}
          {!providers.find((p: any) => p.name === selectedProvider)?.available && selectedProvider !== 'lmstudio' && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-700">
                <strong>Note:</strong> {providers.find((p: any) => p.name === selectedProvider)?.display_name} requires API key configuration in environment variables. Contact your administrator for setup.
              </p>
            </div>
          )}

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