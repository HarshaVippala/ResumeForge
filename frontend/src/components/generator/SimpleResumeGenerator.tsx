'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Loader } from 'lucide-react'
import { apiConfig } from '@/config/api.config'
import type { GenerateResumeResponse } from '@/types'
import { ResumeInputForm } from './ResumeInputForm'
import { GeneratingIndicator } from './GeneratingIndicator'
import { ResumeResultView } from './ResumeResultView'
import { useDebounce } from '@/hooks/useDebounce'

type Step = 'input' | 'generating' | 'complete'

interface ResumeGeneratorState {
  step: Step
  formData: {
    company: string
    role: string
    jobDescription: string
  }
  result: GenerateResumeResponse | null
  editMode: boolean
}

const STORAGE_KEY = 'resumeGeneratorState'

// Helper functions for localStorage
const saveToStorage = (state: ResumeGeneratorState) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (error) {
    console.warn('Failed to save state to localStorage:', error)
  }
}

const loadFromStorage = (): ResumeGeneratorState | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      
      // Normalize the data to ensure insights is properly structured
      if (parsed.result && parsed.result.tailored_resume) {
        parsed.result = {
          ...parsed.result,
          insights: parsed.result.insights ? {
            keyword_coverage: parsed.result.insights.keyword_coverage ?? 0,
            match_strength: parsed.result.insights.match_strength ?? 'Unknown',
            improvements: parsed.result.insights.improvements ?? []
          } : null
        }
      }
      
      return parsed
    }
  } catch (error) {
    console.warn('Failed to load state from localStorage:', error)
  }
  return null
}

const clearStorage = () => {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (error) {
    console.warn('Failed to clear localStorage:', error)
  }
}

export function SimpleResumeGenerator() {
  const [step, setStep] = useState<Step>('input')
  const [formData, setFormData] = useState({
    company: '',
    role: '',
    jobDescription: ''
  })
  const [result, setResult] = useState<GenerateResumeResponse | null>(null)
  const [error, setError] = useState('')
  const [editMode, setEditMode] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  // Load state from localStorage on component mount
  useEffect(() => {
    const savedState = loadFromStorage()
    if (savedState) {
      setStep(savedState.step)
      setFormData(savedState.formData)
      setResult(savedState.result)
      setEditMode(savedState.editMode)
    }
    setIsLoaded(true)
  }, [])

  // Create debounced state for localStorage saving
  const debouncedState = useDebounce(
    { step, formData, result, editMode },
    500 // 500ms delay
  )

  // Save debounced state to localStorage
  useEffect(() => {
    if (isLoaded) {
      const state: ResumeGeneratorState = {
        step: debouncedState.step,
        formData: debouncedState.formData,
        result: debouncedState.result,
        editMode: debouncedState.editMode
      }
      saveToStorage(state)
    }
  }, [debouncedState, isLoaded])

  const handleInputChange = useCallback((field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }, [])

  const handleGenerate = useCallback(async () => {
    if (!formData.company || !formData.role || !formData.jobDescription) {
      setError('Please fill in all fields')
      return
    }

    setStep('generating')
    setError('')

    try {
      console.log('Generating complete tailored resume...', formData)
      
      const response = await fetch(`${apiConfig.baseUrl}${apiConfig.endpoints.tailorResumeComplete}`, {
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

      console.log('Response status:', response.status)

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`API Error: ${response.status} - ${errorText}`)
      }

      const data = await response.json() as GenerateResumeResponse
      console.log('Generated resume data:', data)

      if (!data.success) {
        throw new Error(data.error || 'Failed to generate resume')
      }

      setResult(data)
      setStep('complete')

    } catch (err) {
      console.error('Resume generation error:', err)
      setError(err instanceof Error ? err.message : 'Failed to generate resume')
      setStep('input')
    }
  }, [formData])

  const handleStartOver = useCallback(() => {
    setStep('input')
    setResult(null)
    setError('')
    setEditMode(false)
    clearStorage()
  }, [])

  const handleExport = useCallback(async (format: 'docx' | 'pdf' = 'docx') => {
    if (!result || !result.tailored_resume) {
      setError('No resume data to export. Please generate a resume first.')
      return
    }

    try {
      console.log(`Exporting resume as ${format.toUpperCase()}...`)

      const response = await fetch(`${apiConfig.baseUrl}${apiConfig.endpoints.exportSimpleResume}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tailored_resume: result.tailored_resume,
          company: formData.company,
          role: formData.role,
          format: format
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Export failed: ${response.status} - ${errorText}`)
      }

      // Download the generated file
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = url
      a.download = `${formData.company}_${formData.role}_Resume.${format}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      console.log(`Resume exported successfully as ${format.toUpperCase()}!`)

    } catch (err) {
      console.error('Resume export failed:', err)
      setError(`Failed to export resume: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }, [result, formData])

  // Show loading state while localStorage is being loaded
  if (!isLoaded) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <Card className="border-primary/20">
          <CardContent className="pt-8 pb-8">
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-4">
                <Loader className="w-8 h-8 text-primary animate-spin" />
              </div>
              <h3 className="text-xl font-semibold">Loading...</h3>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (step === 'generating') {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <GeneratingIndicator company={formData.company} role={formData.role} />
      </div>
    )
  }

  if (step === 'complete' && result) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <ResumeResultView 
          result={result}
          onStartOver={handleStartOver}
          onExport={handleExport}
          editMode={editMode}
          onEditModeChange={setEditMode}
        />
        {error && (
          <div className="mt-4 bg-destructive/15 border border-destructive/20 rounded-lg p-3">
            <p className="text-destructive text-sm">{error}</p>
          </div>
        )}
      </div>
    )
  }

  // Input form
  return (
    <div className="max-w-2xl mx-auto p-6">
      <ResumeInputForm 
        formData={formData}
        onFormDataChange={handleInputChange}
        onGenerate={handleGenerate}
        error={error}
      />
    </div>
  )
}