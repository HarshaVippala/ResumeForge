'use client'

import { useState } from 'react'
import { JobAnalysisForm } from '@/components/generator/JobAnalysisForm'
import { SectionEditor } from '@/components/generator/SectionEditor'
import { ResumePreview } from '@/components/generator/ResumePreview'
import { VersionHistory } from '@/components/generator/VersionHistory'
import { useVersionHistory } from '@/hooks/useVersionHistory'
import { useResumeStore } from '@/stores/useResumeStore'
import { Button } from '@/components/ui/button'
import { History, X } from 'lucide-react'
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
    resetGenerator
  } = useResumeStore()
  
  const [showVersionHistory, setShowVersionHistory] = useState(false)

  const {
    versionHistory,
    createVersion,
    revertToVersion,
    deleteVersion,
    clearHistory
  } = useVersionHistory(resumeState)

  const handleJobAnalysisComplete = (analysis: JobAnalysis) => {
    setJobAnalysis(analysis)
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

  if (generatorStep === 'analysis') {
    return (
      <div className="h-[calc(100vh-80px)] px-6 py-6">
        <JobAnalysisForm onComplete={handleJobAnalysisComplete} />
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-6 py-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-medium text-gray-900">
              {jobAnalysis?.job_info.role} - {jobAnalysis?.job_info.company}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleVersionHistoryToggle}
              className="flex items-center gap-2"
            >
              <History className="h-4 w-4" />
              {showVersionHistory ? 'Hide' : 'Show'} History
            </Button>
            <button
              onClick={handleStartOver}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              Start Over
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Version History Sidebar */}
        {showVersionHistory && (
          <div className="w-80 border-r bg-gray-50 p-4 overflow-y-auto">
            <VersionHistory
              versionHistory={versionHistory}
              onRevertToVersion={handleRevertToVersion}
              onDeleteVersion={deleteVersion}
              onClearHistory={clearHistory}
            />
          </div>
        )}

        {/* Main Editor and Preview */}
        <div className={`flex-1 grid ${showVersionHistory ? 'grid-cols-2' : 'grid-cols-2'} gap-0`}>
          <SectionEditor
            section={currentSection}
            keywords={jobAnalysis?.keywords}
            resumeState={resumeState}
            setResumeState={setResumeState}
            setCurrentSection={setCurrentSection}
            jobAnalysis={jobAnalysis}
            onCreateVersion={createVersion}
          />
          <ResumePreview
            resumeState={resumeState}
            jobAnalysis={jobAnalysis}
            highlightKeywords={true}
          />
        </div>
      </div>
    </div>
  )
}