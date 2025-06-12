'use client'

import { useState, useEffect } from 'react'
import { JobAnalysisForm } from '@/components/generator/JobAnalysisForm'
import { KeywordIntelligence } from '@/components/generator/KeywordIntelligence'
import { QuickEditor } from '@/components/generator/QuickEditor'
import { EnhancedPreview } from '@/components/generator/EnhancedPreview'
import { VersionHistory } from '@/components/generator/VersionHistory'
import { useVersionHistory } from '@/hooks/useVersionHistory'
import { useResumeStore } from '@/stores/useResumeStore'
import { Button } from '@/components/ui/button'
import { History, RefreshCw, Download, Save, X } from 'lucide-react'
import type { JobAnalysis } from '@/types'

export default function ResumeGeneratorPage() {
  const {
    generatorStep,
    jobAnalysis,
    resumeState,
    currentSection,
    setGeneratorStep,
    setJobAnalysis,
    setResumeState,
    setCurrentSection,
    resetGenerator,
    loadBaseResumeContent
  } = useResumeStore()
  
  const [showVersionHistory, setShowVersionHistory] = useState(false)
  const [atsScore, setAtsScore] = useState(0)
  const [aiDetectionScore, setAiDetectionScore] = useState(0)
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([])
  const [isHydrated, setIsHydrated] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  // Handle hydration to prevent navigation reset
  useEffect(() => {
    setIsHydrated(true)
  }, [])

  const {
    versionHistory,
    createVersion,
    revertToVersion,
    deleteVersion,
    clearHistory
  } = useVersionHistory(resumeState)

  const handleJobAnalysisComplete = async (analysis: JobAnalysis) => {
    setJobAnalysis(analysis)
    await loadBaseResumeContent()
    setGeneratorStep('editing')
  }

  const handleStartOver = () => {
    resetGenerator()
    clearHistory()
  }

  const handleRevertToVersion = (versionId: string) => {
    const restoredState = revertToVersion(versionId)
    if (restoredState) {
      setResumeState(restoredState)
    }
  }

  const handleVersionHistoryToggle = () => {
    setShowVersionHistory(!showVersionHistory)
  }

  const handleContentUpdate = (newContent: any) => {
    setResumeState(newContent)
    setLastUpdated(new Date())
    // Trigger ATS and AI detection analysis
    analyzeContent(newContent)
  }

  const analyzeContent = async (content: any) => {
    // TODO: Implement ATS scoring and AI detection
    // This will call backend endpoints to analyze the content
    setAtsScore(85) // Placeholder
    setAiDetectionScore(15) // Placeholder
  }

  const handleSaveVersion = () => {
    if (resumeState) {
      createVersion(
        resumeState, 
        `Manual save - ${new Date().toLocaleString()}`,
        [{
          section: 'summary',
          type: 'update',
          diff: {
            before: 'Previous state',
            after: 'Current state'
          },
          keywords_used: []
        }]
      )
    }
  }

  const handleExportResume = async () => {
    // TODO: Implement export functionality
    console.log('Exporting resume...')
  }

  useEffect(() => {
    if (resumeState) {
      analyzeContent(resumeState)
    }
  }, [resumeState])

  // Wait for hydration before rendering to prevent navigation reset
  if (!isHydrated) {
    return (
      <div className="h-[calc(100vh-80px)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (generatorStep === 'analysis') {
    return (
      <div className="h-[calc(100vh-80px)] px-6 py-6">
        <JobAnalysisForm onComplete={handleJobAnalysisComplete} />
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col bg-gray-50">
      {/* Header with company and role */}
      <div className="bg-white border-b px-6 py-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {jobAnalysis?.job_info.company} - {jobAnalysis?.job_info.role}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-light text-gray-500">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveVersion}
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              Save Version
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleVersionHistoryToggle}
              className="flex items-center gap-2"
            >
              <History className="h-4 w-4" />
              {showVersionHistory ? 'Hide' : 'Show'} History
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleExportResume}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
            <button
              onClick={handleStartOver}
              className="text-sm text-gray-600 hover:text-gray-700 flex items-center gap-1"
            >
              <RefreshCw className="h-4 w-4" />
              Start Over
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Keyword Intelligence */}
        <div className="w-80 bg-white border-r shadow-sm overflow-y-auto">
          <KeywordIntelligence
            analysis={jobAnalysis}
            selectedKeywords={selectedKeywords}
            onKeywordToggle={setSelectedKeywords}
            resumeState={resumeState}
          />
        </div>

        {/* Center - Quick Editor */}
        <div className="flex-1 bg-white">
          <QuickEditor
            resumeState={resumeState}
            selectedKeywords={selectedKeywords}
            onContentUpdate={handleContentUpdate}
            currentSection={currentSection}
            onSectionChange={(section: string) => setCurrentSection(section as 'summary' | 'skills' | 'experience')}
          />
        </div>

        {/* Right - Enhanced Preview */}
        <div className="flex-1 bg-white border-l shadow-sm">
          <EnhancedPreview
            resumeState={resumeState}
            highlightKeywords={selectedKeywords}
            showAtsIndicators={true}
            atsScore={atsScore}
            aiDetectionScore={aiDetectionScore}
          />
        </div>

        {/* Version History Sidebar (overlays when shown) */}
        {showVersionHistory && (
          <div className="absolute right-0 top-0 bottom-0 w-80 bg-white border-l shadow-lg z-10 overflow-y-auto">
            <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between">
              <h3 className="font-medium">Version History</h3>
              <button
                onClick={handleVersionHistoryToggle}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4">
              <VersionHistory
                versionHistory={versionHistory}
                onRevertToVersion={handleRevertToVersion}
                onDeleteVersion={deleteVersion}
                onClearHistory={clearHistory}
              />
            </div>
          </div>
        )}
      </div>

    </div>
  )
}