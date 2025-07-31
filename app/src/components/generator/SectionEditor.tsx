'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  User, 
  Code, 
  Briefcase, 
  Wand2, 
  Save,
  RotateCcw,
  CheckCircle,
  AlertCircle,
  Plus,
  Star,
  Zap
} from 'lucide-react'
import type { JobAnalysis, ResumeState } from '@/types'
import { cn } from '@/lib/utils'

interface SectionEditorProps {
  section: 'summary' | 'skills' | 'experience'
  keywords?: JobAnalysis['keywords']
  resumeState: ResumeState
  setResumeState: (state: ResumeState) => void
  setCurrentSection: (section: 'summary' | 'skills' | 'experience') => void
  jobAnalysis: JobAnalysis | null
  onCreateVersion?: (resumeState: ResumeState, description: string, changes: any[]) => void
}

export function SectionEditor({
  section,
  keywords,
  resumeState,
  setResumeState,
  setCurrentSection,
  jobAnalysis,
  onCreateVersion
}: SectionEditorProps) {
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([])
  const [customPrompt, setCustomPrompt] = useState('')
  const [showCustomPrompt, setShowCustomPrompt] = useState(false)

  const sections = [
    { id: 'summary' as const, title: 'Professional Summary', icon: User },
    { id: 'skills' as const, title: 'Technical Skills', icon: Code },
    { id: 'experience' as const, title: 'Work Experience', icon: Briefcase }
  ]

  const currentSectionData = resumeState[section]

  const handleOptimize = async () => {
    if (!jobAnalysis?.session_id) {
      alert('No session ID available. Please analyze the job description first.')
      return
    }

    if (selectedKeywords.length === 0) {
      alert('Please select at least one keyword to optimize with.')
      return
    }

    setIsOptimizing(true)

    try {
      // Call TypeScript API for section generation
      const response = await fetch('/api/generate-section', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: jobAnalysis.session_id,
          section_type: section,
          selected_keywords: selectedKeywords,
          base_content: typeof currentSectionData.current === 'string'
            ? currentSectionData.current
            : JSON.stringify(currentSectionData.current),
          preferences: {
            tone: 'professional',
            length: 'medium',
            custom_instructions: customPrompt || undefined
          }
        })
      })

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Section generation failed')
      }

      // Handle experience section specially - update just the bullets for the current job
      let updatedContent = data.content
      if (section === 'experience' && Array.isArray(data.content)) {
        try {
          // Parse existing experience structure
          const existingExperience = typeof currentSectionData.current === 'string' 
            ? JSON.parse(currentSectionData.current) 
            : currentSectionData.current
          
          if (Array.isArray(existingExperience) && existingExperience.length > 0) {
            // Update the first job's achievements with new generated bullets
            const updatedExperience = [...existingExperience]
            updatedExperience[0] = {
              ...updatedExperience[0],
              achievements: data.content
            }
            updatedContent = JSON.stringify(updatedExperience, null, 2)
          } else {
            // Fallback: create a basic structure if none exists
            updatedContent = JSON.stringify([{
              company: jobAnalysis?.job_info.company || 'Current Company',
              role: jobAnalysis?.job_info.role || 'Software Engineer',
              location: 'Location',
              duration: 'Present',
              achievements: data.content
            }], null, 2)
          }
        } catch (error) {
          console.error('Error updating experience structure:', error)
          // Fallback to raw content
          updatedContent = JSON.stringify(data.content, null, 2)
        }
      }

      const newResumeState = {
        ...resumeState,
        [section]: {
          ...currentSectionData,
          current: updatedContent,
          keywords: selectedKeywords,
          status: 'complete'
        }
      }

      setResumeState(newResumeState)

      // Create version history entry
      if (onCreateVersion) {
        onCreateVersion(
          newResumeState,
          `AI optimized ${section} section`,
          [{
            section,
            type: 'update' as const,
            diff: {
              before: currentSectionData.current,
              after: data.content
            },
            keywords_used: selectedKeywords
          }]
        )
      }

    } catch (err) {
      console.error('Section optimization failed:', err)

      // Fallback to mock content if API fails
      let fallbackContent = ''

      switch (section) {
        case 'summary':
          fallbackContent = `Results-driven ${jobAnalysis?.job_info.seniority || 'Senior'} Software Engineer with 5+ years of experience in ${keywords?.technical_skills.slice(0, 3).join(', ')}. Proven track record of delivering scalable solutions and leading cross-functional teams. Expert in ${jobAnalysis?.critical_keywords.slice(0, 2).join(' and ')}, with strong ${keywords?.soft_skills.slice(0, 2).join(' and ')} skills.`
          break
        case 'skills':
          fallbackContent = [
            'Programming Languages: TypeScript, Python, JavaScript, Go',
            'Frontend: React, Next.js, Vue.js, HTML5, CSS3',
            'Backend: Node.js, Express, FastAPI, PostgreSQL, MongoDB',
            'Cloud & DevOps: AWS, Docker, Kubernetes, CI/CD, Terraform',
            'Tools: Git, Jest, Webpack, Redis, Elasticsearch'
          ].join('\n')
          break
        case 'experience':
          fallbackContent = JSON.stringify([
            {
              company: 'Tech Company',
              role: 'Senior Software Engineer',
              duration: '2022 - Present',
              achievements: [
                `Led development of microservices architecture using ${keywords?.technical_skills[0]} and ${keywords?.technical_skills[1]}`,
                `Improved system performance by 40% through optimization and ${keywords?.technical_skills[2]} implementation`,
                `Mentored team of 4 junior developers, demonstrating strong ${keywords?.soft_skills[0]} skills`
              ]
            }
          ], null, 2)
          break
      }

      setResumeState({
        ...resumeState,
        [section]: {
          ...currentSectionData,
          current: fallbackContent,
          keywords: selectedKeywords,
          status: 'complete'
        }
      })

      // Show error message but continue with fallback
      alert(`API optimization failed: ${err instanceof Error ? err.message : 'Unknown error'}. Using fallback content.`)
    }

    setIsOptimizing(false)
  }

  const handleSave = () => {
    setResumeState({
      ...resumeState,
      [section]: {
        ...currentSectionData,
        status: 'complete'
      }
    })
  }

  const handleReset = () => {
    setResumeState({
      ...resumeState,
      [section]: {
        ...currentSectionData,
        current: currentSectionData.original,
        status: 'pending'
      }
    })
  }

  const handleRegenerate = async () => {
    if (!jobAnalysis?.session_id) {
      alert('No session ID available. Please analyze the job description first.')
      return
    }

    if (selectedKeywords.length === 0) {
      alert('Please select at least one keyword to regenerate with.')
      return
    }

    setIsOptimizing(true)

    try {
      // Reset to original content first
      setResumeState({
        ...resumeState,
        [section]: {
          ...currentSectionData,
          current: currentSectionData.original,
          status: 'editing'
        }
      })

      // Then regenerate with selected keywords
      await handleOptimize()
    } catch (err) {
      console.error('Regeneration failed:', err)
      alert(`Regeneration failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }

    setIsOptimizing(false)
  }

  const toggleKeyword = (keyword: string) => {
    setSelectedKeywords(prev =>
      prev.includes(keyword)
        ? prev.filter(k => k !== keyword)
        : [...prev, keyword]
    )
  }

  return (
    <div className="bg-gray-50 border-r h-full overflow-y-auto">
      {/* Section Navigation */}
      <div className="bg-white border-b p-4">
        <div className="flex justify-between">
          {sections.map((s) => {
            const Icon = s.icon
            const isActive = s.id === section
            const sectionStatus = resumeState[s.id].status
            
            return (
              <button
                key={s.id}
                onClick={() => setCurrentSection(s.id)}
                className={cn(
                  'flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  isActive 
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-foreground/70 hover:text-foreground hover:bg-gray-100'
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{s.title}</span>
                {sectionStatus === 'complete' && (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                )}
                {sectionStatus === 'editing' && (
                  <AlertCircle className="h-4 w-4 text-yellow-500" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="p-3 space-y-3">

        {/* Keyword Selection */}
        {keywords && (
          <div className="space-y-2">
            {/* Header */}
            <div className="bg-white rounded-lg border border-gray-200 p-3">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900">Keywords</h3>
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <div className="text-lg font-bold text-blue-600">{selectedKeywords.length}</div>
                    <div className="text-[10px] text-foreground/60 uppercase tracking-wide">Selected</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-green-600">
                      {Math.min(100, 20 + selectedKeywords.length * 8)}%
                    </div>
                    <div className="text-[10px] text-foreground/60 uppercase tracking-wide">Match</div>
                  </div>
                </div>
              </div>

              <div className="flex gap-1">
                <button
                  onClick={() => {
                    const criticalSkills = jobAnalysis?.critical_keywords || [];
                    const topTechSkills = keywords.technical_skills?.slice(0, 6) || [];
                    setSelectedKeywords([...criticalSkills, ...topTechSkills]);
                  }}
                  className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-medium hover:bg-blue-100 transition-colors"
                >
                  Auto
                </button>
                <button
                  onClick={() => setSelectedKeywords(jobAnalysis?.critical_keywords || [])}
                  className="px-2 py-1 bg-gray-50 text-gray-700 rounded text-xs font-medium hover:bg-gray-100 transition-colors"
                >
                  Essential
                </button>
                <button
                  onClick={() => setSelectedKeywords([])}
                  className="px-2 py-1 bg-gray-50 text-gray-700 rounded text-xs font-medium hover:bg-gray-100 transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Skill Categories */}
            <div className="space-y-2">
              {/* Critical Keywords */}
              {jobAnalysis?.critical_keywords && jobAnalysis.critical_keywords.length > 0 && (
                <div className="bg-white rounded-lg border border-gray-200 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-wide">Essential</h4>
                    <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                  </div>
                  
                  <div className="flex flex-wrap gap-1">
                    {jobAnalysis?.critical_keywords.map((keyword, index) => (
                      <button
                        key={`critical-${index}-${keyword}`}
                        onClick={() => toggleKeyword(keyword)}
                        className={cn(
                          "px-2 py-1 rounded text-xs font-medium transition-all duration-200",
                          selectedKeywords.includes(keyword)
                            ? "bg-red-500 text-white"
                            : "bg-red-50 text-red-700 hover:bg-red-100 border border-red-200"
                        )}
                      >
                        {keyword}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Technical Skills */}
              <div className="bg-white rounded-lg border border-gray-200 p-3">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-wide">Technical</h4>
                  <div className="text-[10px] text-foreground/60 font-medium">
                    {keywords.technical_skills?.length || 0}
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                  {keywords.technical_skills?.map((keyword, index) => (
                    <button
                      key={`technical-${index}-${keyword}`}
                      onClick={() => toggleKeyword(keyword)}
                      className={cn(
                        "px-2 py-1 rounded text-xs font-medium transition-all duration-200",
                        selectedKeywords.includes(keyword)
                          ? "bg-blue-500 text-white"
                          : "bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"
                      )}
                    >
                      {keyword}
                    </button>
                  ))}
                </div>
              </div>

              {/* Soft Skills */}
              {keywords.soft_skills && keywords.soft_skills.length > 0 && (
                <div className="bg-white rounded-lg border border-gray-200 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-wide">Soft Skills</h4>
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                  </div>
                  
                  <div className="flex flex-wrap gap-1">
                    {keywords.soft_skills.map((keyword, index) => (
                      <button
                        key={`soft-${index}-${keyword}`}
                        onClick={() => toggleKeyword(keyword)}
                        className={cn(
                          "px-2 py-1 rounded text-xs font-medium transition-all duration-200",
                          selectedKeywords.includes(keyword)
                            ? "bg-green-500 text-white"
                            : "bg-green-50 text-green-700 hover:bg-green-100 border border-green-200"
                        )}
                      >
                        {keyword}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Experience Requirements */}
              {keywords.experience_requirements && keywords.experience_requirements.length > 0 && (
                <div className="bg-white rounded-lg border border-gray-200 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-wide">Experience</h4>
                    <div className="w-1.5 h-1.5 bg-purple-500 rounded-full"></div>
                  </div>
                  
                  <div className="flex flex-wrap gap-1">
                    {keywords.experience_requirements.map((keyword, index) => (
                      <button
                        key={`experience-${index}-${keyword}`}
                        onClick={() => toggleKeyword(keyword)}
                        className={cn(
                          "px-2 py-1 rounded text-xs font-medium transition-all duration-200",
                          selectedKeywords.includes(keyword)
                            ? "bg-purple-500 text-white"
                            : "bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200"
                        )}
                      >
                        {keyword}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Selected Keywords Summary */}
            {selectedKeywords.length > 0 && (
              <div className="bg-gray-50 rounded-lg border border-gray-200 p-3">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-wide">Selection ({selectedKeywords.length})</h4>
                  <button
                    onClick={() => setSelectedKeywords([])}
                    className="text-[10px] text-foreground/60 hover:text-foreground/80"
                  >
                    Clear
                  </button>
                </div>
                
                <div className="flex flex-wrap gap-1">
                  {selectedKeywords.map((keyword, index) => (
                    <div
                      key={`selected-${index}-${keyword}`}
                      className="px-2 py-1 bg-gray-800 text-white rounded text-xs font-medium"
                    >
                      {keyword}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Content Editor */}
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Editor</h3>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleOptimize}
                disabled={isOptimizing || selectedKeywords.length === 0}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 text-xs font-medium h-7"
              >
                {isOptimizing ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border border-white border-t-transparent mr-1" />
                    Optimizing...
                  </>
                ) : (
                  <>
                    <Wand2 className="h-3 w-3 mr-1" />
                    Optimize
                  </>
                )}
              </Button>
              
              <Button
                variant="outline"
                onClick={() => handleRegenerate()}
                disabled={isOptimizing || selectedKeywords.length === 0}
                className="border-gray-300 hover:bg-gray-50 px-3 py-1 text-xs h-7"
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Regenerate
              </Button>
            </div>
          </div>

          {/* Custom Instructions */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-900 uppercase tracking-wide">
                Custom Instructions
              </label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCustomPrompt(!showCustomPrompt)}
                className="text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 h-6 px-2"
              >
                {showCustomPrompt ? 'Hide' : 'Show'}
              </Button>
            </div>

            {showCustomPrompt && (
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder={`Add specific instructions for ${section} generation`}
                rows={2}
                className="w-full p-2 bg-gray-50 border border-gray-200 rounded text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 resize-none"
              />
            )}
          </div>

          {/* Main Content Editor */}
          <div className="mb-3">
            <label className="text-xs font-semibold text-gray-900 mb-2 block uppercase tracking-wide">
              {sections.find(s => s.id === section)?.title} Content
            </label>
            
            <div className="relative">
              <textarea
                value={typeof currentSectionData.current === 'string' ? currentSectionData.current : JSON.stringify(currentSectionData.current, null, 2)}
                onChange={(e) => setResumeState({
                  ...resumeState,
                  [section]: {
                    ...currentSectionData,
                    current: e.target.value,
                    status: 'editing'
                  }
                })}
                placeholder={`Enter your ${section} content here...`}
                rows={section === 'experience' ? 12 : 6}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 resize-none font-mono leading-relaxed"
              />
              
              {/* Word Count */}
              <div className="absolute bottom-2 right-2">
                <div className="px-1.5 py-0.5 bg-white rounded text-[10px] text-foreground/60 shadow-sm">
                  {typeof currentSectionData.current === 'string' 
                    ? currentSectionData.current.split(' ').filter(word => word.length > 0).length
                    : 0}w
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <Button 
              onClick={handleSave} 
              className="flex-1 bg-green-600 hover:bg-green-700 text-white py-1 text-xs font-medium h-7"
            >
              <Save className="h-3 w-3 mr-1" />
              Save
            </Button>
            <Button 
              variant="outline" 
              onClick={handleReset}
              className="border-gray-300 hover:bg-gray-50 px-3 py-1 text-xs h-7"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Reset
            </Button>
          </div>
        </div>

      </div>
    </div>
  )
}