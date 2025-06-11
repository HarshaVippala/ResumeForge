'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { User, Briefcase, Award, Edit3, Save, RotateCcw, MessageSquare, Send, X, RotateCw, ChevronLeft, ChevronRight } from 'lucide-react'

interface QuickEditorProps {
  resumeState: any
  selectedKeywords: string[]
  onContentUpdate: (content: any) => void
  currentSection: string
  onSectionChange: (section: string) => void
}

export function QuickEditor({ 
  resumeState, 
  selectedKeywords, 
  onContentUpdate, 
  currentSection, 
  onSectionChange 
}: QuickEditorProps) {
  const [editingContent, setEditingContent] = useState('')
  const [hasChanges, setHasChanges] = useState(false)
  const [showAI, setShowAI] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiResponse, setAiResponse] = useState('')
  const [isAiLoading, setIsAiLoading] = useState(false)

  const sections = [
    { id: 'summary', label: 'Summary', icon: User },
    { id: 'skills', label: 'Skills', icon: Award },
    { id: 'experience', label: 'Experience', icon: Briefcase }
  ]

  const handleContentChange = (value: string) => {
    setEditingContent(value)
    setHasChanges(true)
    
    // Auto-save after 2 seconds of no typing
    setTimeout(() => {
      if (value === editingContent) {
        handleSave()
      }
    }, 2000)
  }

  const handleSave = () => {
    const updatedState = {
      ...resumeState,
      [currentSection]: {
        ...resumeState[currentSection],
        current: editingContent
      }
    }
    onContentUpdate(updatedState)
    setHasChanges(false)
  }

  const handleRevert = () => {
    const originalContent = resumeState[currentSection]?.original || ''
    setEditingContent(originalContent)
    setHasChanges(false)
  }

  const getCurrentContent = () => {
    return resumeState[currentSection]?.current || resumeState[currentSection]?.original || ''
  }

  const getKeywordSuggestions = () => {
    const content = getCurrentContent().toLowerCase()
    return selectedKeywords.filter(keyword => 
      !content.includes(keyword.toLowerCase())
    )
  }

  const insertKeyword = (keyword: string) => {
    const currentContent = editingContent || getCurrentContent()
    const updatedContent = currentContent + (currentContent ? ' ' : '') + keyword
    setEditingContent(updatedContent)
    setHasChanges(true)
  }

  const handleAiRequest = async () => {
    if (!aiPrompt.trim()) return
    
    setIsAiLoading(true)
    try {
      // Simulate AI response - replace with actual API call
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      const mockResponse = `Here's an improved version based on your request: "${aiPrompt}". This version includes better action verbs and quantifiable results.`
      setAiResponse(mockResponse)
    } catch (error) {
      console.error('AI request failed:', error)
      setAiResponse('Sorry, AI assistant is temporarily unavailable.')
    } finally {
      setIsAiLoading(false)
    }
  }

  const handleApplyAiSuggestion = () => {
    if (aiResponse) {
      setEditingContent(aiResponse)
      setHasChanges(true)
      setShowAI(false)
      setAiPrompt('')
      setAiResponse('')
    }
  }

  const handleStartOver = () => {
    setAiPrompt('')
    setAiResponse('')
  }

  const SectionTab = ({ section }: { section: any }) => {
    const Icon = section.icon
    const isActive = currentSection === section.id
    const hasContent = resumeState[section.id]?.current || resumeState[section.id]?.original
    
    return (
      <button
        onClick={() => {
          onSectionChange(section.id)
          setEditingContent(getCurrentContent())
        }}
        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
          isActive
            ? 'bg-white text-blue-600 border-b-2 border-blue-600'
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
        }`}
      >
        <Icon className="h-4 w-4" />
        {section.label}
        {hasContent && <div className="w-2 h-2 bg-green-500 rounded-full" />}
      </button>
    )
  }

  const navigateSection = (direction: 'prev' | 'next') => {
    const currentIndex = sections.findIndex(s => s.id === currentSection)
    let newIndex
    
    if (direction === 'prev') {
      newIndex = currentIndex > 0 ? currentIndex - 1 : sections.length - 1
    } else {
      newIndex = currentIndex < sections.length - 1 ? currentIndex + 1 : 0
    }
    
    onSectionChange(sections[newIndex].id)
    setEditingContent(getCurrentContent())
  }

  return (
    <div className="h-full flex flex-col bg-gray-50 relative">
      {/* Section Navigation Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigateSection('prev')}
            className="text-gray-400 hover:text-gray-600"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          
          <div className="flex items-center gap-2">
            {(() => {
              const current = sections.find(s => s.id === currentSection)
              const Icon = current?.icon || User
              return (
                <>
                  <Icon className="h-4 w-4 text-gray-600" />
                  <span className="font-semibold text-gray-900">{current?.label}</span>
                </>
              )
            })()}
          </div>
          
          <button
            onClick={() => navigateSection('next')}
            className="text-gray-400 hover:text-gray-600"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          
          {hasChanges && (
            <Badge variant="secondary" className="text-xs ml-2">
              Unsaved changes
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRevert}
            disabled={!hasChanges}
            className="flex items-center gap-1"
          >
            <RotateCcw className="h-4 w-4" />
            Revert
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleSave}
            disabled={!hasChanges}
            className="flex items-center gap-1"
          >
            <Save className="h-4 w-4" />
            Save
          </Button>
        </div>
      </div>

      {/* Editor Content */}
      <div className="flex-1 p-4 overflow-y-auto">
        <Card className="h-full">
          <div className="p-4 h-full flex flex-col">
            <textarea
              value={editingContent || getCurrentContent()}
              onChange={(e) => handleContentChange(e.target.value)}
              placeholder={`Enter your ${currentSection} content here...`}
              className="flex-1 w-full p-4 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
            
            {/* Keyword Suggestions */}
            {getKeywordSuggestions().length > 0 && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm font-medium text-blue-900 mb-2">
                  Suggested keywords to add:
                </p>
                <div className="flex flex-wrap gap-2">
                  {getKeywordSuggestions().slice(0, 6).map((keyword) => (
                    <button
                      key={keyword}
                      onClick={() => insertKeyword(keyword)}
                      className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs hover:bg-blue-200 transition-colors"
                    >
                      + {keyword}
                    </button>
                  ))}
                </div>
              </div>
            )}


          </div>
        </Card>
      </div>

      {/* AI Assistant - Bottom Right */}
      <div className="absolute bottom-4 right-4">
        {!showAI ? (
          <button
            onClick={() => setShowAI(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-full p-2 shadow-lg transition-colors"
          >
            <MessageSquare className="h-4 w-4" />
          </button>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 w-80">
            {!aiResponse ? (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-900">AI Writing Assistant</span>
                  <button
                    onClick={() => setShowAI(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAiRequest()}
                    placeholder="Ask for help improving this content..."
                    className="flex-1 px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    disabled={isAiLoading}
                  />
                  <button
                    onClick={handleAiRequest}
                    disabled={!aiPrompt.trim() || isAiLoading}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded px-2 py-1"
                  >
                    {isAiLoading ? (
                      <RotateCw className="h-3 w-3 animate-spin" />
                    ) : (
                      <Send className="h-3 w-3" />
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-900">AI Suggestion</span>
                  <button
                    onClick={() => setShowAI(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="text-sm text-gray-700 mb-3 p-2 bg-gray-50 rounded">
                  {aiResponse}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleApplyAiSuggestion}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1 rounded flex items-center gap-1"
                  >
                    <Edit3 className="h-3 w-3" />
                    Apply
                  </button>
                  <button
                    onClick={handleStartOver}
                    className="bg-gray-600 hover:bg-gray-700 text-white text-xs px-3 py-1 rounded flex items-center gap-1"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Start Over
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}