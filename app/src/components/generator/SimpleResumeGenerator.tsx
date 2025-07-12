'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Loader } from 'lucide-react'
import { apiConfig } from '@/config/api.config'
import type { EnhancedResumeTailoringResponse, GenerateResumeResponse } from '@/types'
import { ResumeInputForm } from './ResumeInputForm'
import { GeneratingIndicator } from './GeneratingIndicator'
import { ResumeResultView } from './ResumeResultView'
import { useDebounce } from '@/hooks/useDebounce'
import { MasterResumeQuickSetup } from '@/components/master-resume/QuickSetup'

type Step = 'input' | 'generating' | 'complete'

interface ResumeGeneratorState {
  step: Step
  formData: {
    company: string
    role: string
    jobDescription: string
    jobLink?: string  // Make optional to fix type mismatch
  }
  result: EnhancedResumeTailoringResponse | GenerateResumeResponse | null
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
      
      // Validate the structure for enhanced response
      if (parsed.result && parsed.result.optimizedResume) {
        // Enhanced response structure is valid
        console.log(`📂 Loaded saved resume session: ${parsed.result.sessionId}`);
        return parsed
      }
      
      // Legacy data or invalid structure, clear it
      localStorage.removeItem(STORAGE_KEY)
      return null
    }
  } catch (error) {
    console.warn('Failed to load state from localStorage:', error)
    localStorage.removeItem(STORAGE_KEY)
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

// A unified type representing either the legacy or enhanced resume response
type ResumeResult = EnhancedResumeTailoringResponse | GenerateResumeResponse

export function SimpleResumeGenerator() {
  const [step, setStep] = useState<Step>('input')
  const [formData, setFormData] = useState<{ company: string; role: string; jobDescription: string; jobLink?: string }>({
    company: '',
    role: '',
    jobDescription: '',
    jobLink: ''
  })
  const [result, setResult] = useState<ResumeResult | null>(null)
  const [error, setError] = useState('')
  const [editMode, setEditMode] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasMasterResume, setHasMasterResume] = useState<boolean | null>(null)

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

  // Check for master resume
  useEffect(() => {
    const checkMasterResume = async () => {
      try {
        const response = await fetch('/api/master-resume/default')
        setHasMasterResume(response.ok)
      } catch (err) {
        console.error('Failed to check master resume:', err)
        setHasMasterResume(false)
      }
    }
    checkMasterResume()
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
      
      const response = await fetch(`${apiConfig.baseUrl}${apiConfig.endpoints.resumeTailoringComplete}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          company: formData.company,
          role: formData.role,
          jobDescription: formData.jobDescription,
          jobLink: formData.jobLink
        })
      })

      console.log('Response status:', response.status)

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`API Error: ${response.status} - ${errorText}`)
      }

      const data = await response.json() as ResumeResult
      console.log('Generated resume data:', data)

      if (!data.success) {
        throw new Error('Failed to generate enhanced resume')
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
    const optimizedResume: any = (result as any)?.optimizedResume

    if (!result || !optimizedResume) {
      setError('No resume data to export. Please generate a resume first.')
      return
    }

    try {
      console.log(`Exporting enhanced resume as ${format.toUpperCase()}...`)

      const response = await fetch(`${apiConfig.baseUrl}${apiConfig.endpoints.exportSimpleResume}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tailored_resume: optimizedResume.content,
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

  /**
   * Receive partial updates to the tailored resume from child components (e.g.
   * when the user edits the summary). This will update the `result` object and
   * because the component already persists `result` to localStorage via the
   * debounced effect, the changes will survive reloads/navigation.
   */
  const handleResumeUpdate = useCallback((updatedTailoredResume: any) => {
    setResult((prev: ResumeResult | null) => {
      if (!prev) return prev
      // Legacy shape – tailored_resume
      if ((prev as any).tailored_resume) {
        return {
          ...(prev as any),
          tailored_resume: {
            ...(prev as any).tailored_resume,
            ...updatedTailoredResume
          }
        } as any
      }

      // Enhanced shape – optimizedResume.content
      if ('optimizedResume' in prev && (prev as any).optimizedResume) {
        return {
          ...prev,
          optimizedResume: {
            ...(prev as any).optimizedResume,
            content: {
              ...(prev as any).optimizedResume.content,
              ...updatedTailoredResume
            }
          }
        }
      }

      return prev
    })
  }, [])

  // Show loading state while localStorage is being loaded
  if (!isLoaded || hasMasterResume === null) {
    return (
      <div className="min-h-screen">
        <div className="max-w-4xl mx-auto p-4 md:p-6">
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-lg p-8">
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-12 h-12 mb-4">
                <Loader className="w-6 h-6 text-gray-900 dark:text-gray-100 animate-spin" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Loading...</h3>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Show quick setup if no master resume exists
  if (hasMasterResume === false) {
    return (
      <div className="min-h-screen">
        <div className="max-w-4xl mx-auto p-4 md:p-6">
          <MasterResumeQuickSetup />
        </div>
      </div>
    )
  }

  if (step === 'generating') {
    return (
      <div className="h-full bg-gradient-to-br from-background via-background/98 to-background/95 overflow-hidden flex items-center justify-center">
        <div className="w-full max-w-4xl p-4 md:p-6 lg:p-8">
          <GeneratingIndicator company={formData.company} role={formData.role} />
        </div>
      </div>
    )
  }

  if (step === 'complete' && result) {
    return (
      <div className="h-full bg-gradient-to-br from-background via-background/98 to-background/95 overflow-hidden">
        <div className="h-full overflow-y-auto p-4 md:p-6 lg:p-8">
          <ResumeResultView 
            result={result as any}
            onStartOver={handleStartOver}
            onExport={handleExport}
            editMode={editMode}
            onEditModeChange={setEditMode}
            onResumeUpdate={handleResumeUpdate}
          />
          {error && (
            <div className="mt-4">
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
                <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Input form
  return (
    <div className="h-full bg-gradient-to-br from-background via-background/98 to-background/95 overflow-hidden">
      <div className="h-full p-4 md:p-6 lg:p-8">
        <ResumeInputForm 
          formData={formData}
          onFormDataChange={handleInputChange}
          onGenerate={handleGenerate}
          error={error}
        />
      </div>
    </div>
  )
}