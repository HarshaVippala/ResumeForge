'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  CheckCircle, 
  Download, 
  Edit, 
  RefreshCw 
} from 'lucide-react'
import { useState, useEffect } from 'react'

interface ResumeResultViewProps {
  result: any
  onStartOver: () => void
  onExport: (format: 'docx' | 'pdf') => void
  editMode: boolean
  onEditModeChange: (value: boolean) => void
  onResumeUpdate: (updatedResume: any) => void
}

export function ResumeResultView({ 
  result, 
  onStartOver, 
  onExport,
  editMode,
  onEditModeChange,
  onResumeUpdate
}: ResumeResultViewProps) {
  // Determine the shape – support both legacy (`tailored_resume`) and enhanced
  // (`optimizedResume.content`) payloads so we don't explode when backend
  // toggles between versions.

  const tailoredResume: any = (result as any).tailored_resume ?? result.optimizedResume?.content

  if (!tailoredResume) {
    // We've got an unknown shape – better to bail out gracefully.
    console.warn('⚠️ resume result view: unsupported resume payload shape', result)
    return (
      <div className="p-6 text-center text-sm text-red-500">
        unable to render resume – unsupported response format 🙈
      </div>
    )
  }

  // Local editable state (summary only for now)
  const [summaryValue, setSummaryValue] = useState(tailoredResume.summary)

  // Sync local state if parent updates (e.g., reload)
  useEffect(() => {
    setSummaryValue(tailoredResume.summary)
  }, [tailoredResume.summary])

  // Extract enhanced data from Resume Matcher response
  const insights = (result as any).insights ?? {}
  const improvementAreas = insights?.improvementAreas ?? []
  const strengthAreas = insights?.strengthAreas ?? []
  const keywordCoverage = insights?.keywordCoverage ?? 0
  const estimatedMatchScore = insights?.estimatedMatchScore ?? 0
  const atsCompatibility = (result as any).validation?.atsCompatibility ?? 0
  const qualityScore = (result as any).validation?.qualityScore ?? 0
  
  // Extract iteration details for Resume Matcher approach
  const iterationDetails = insights?.iterationDetails ?? []
  const hasIterations = iterationDetails.length > 0
  
  // Extract real ATS scores from Resume Matcher
  const atsScore = atsCompatibility // Direct ATS score from validation
  const keywordMatchScore = keywordCoverage // Keyword coverage percentage
  const matchedKeywords = (result as any).optimizedResume?.keywordsIntegrated ?? []
  const missingKeywords = insights?.missingKeywords ?? []
  const recommendations = (result as any).validation?.recommendations ?? []

  return (
    <div className="w-full lg:grid lg:grid-cols-3 gap-6">
      {/* ----- Sidebar (Insights & Actions) ----- */}
      <aside className="lg:col-span-1 space-y-6 sticky top-4 self-start">
        <Card className="w-full">
          <CardHeader>
            <div className="flex items-center gap-3">
              <CheckCircle className="h-6 w-6 text-green-500" />
              <CardTitle className="text-xl">analysis</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Key Metrics - Real Scores from Resume Matcher */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">keyword match</p>
                <p className="text-lg font-bold text-green-600">{Math.round(keywordMatchScore)}%</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">overall match</p>
                <p className="text-lg font-bold text-blue-600">{Math.round(estimatedMatchScore)}%</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">ATS score</p>
                <p className="text-lg font-bold text-purple-600">{Math.round(atsScore)}%</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">quality</p>
                <p className="text-lg font-bold text-orange-600">{Math.round(qualityScore)}%</p>
              </div>
            </div>

            {/* Iteration Progress (Resume Matcher) */}
            {hasIterations && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-purple-600">optimization progress</p>
                {iterationDetails.map((iter: any, idx: number) => (
                  <div key={idx} className="text-xs">
                    <div className="flex justify-between">
                      <span>Iteration {iter.iteration}</span>
                      <span className={iter.improvement > 0 ? "text-green-600" : "text-gray-600"}>
                        {iter.score}% {iter.improvement > 0 ? `(+${iter.improvement}%)` : ''}
                      </span>
                    </div>
                    <p className="text-muted-foreground truncate">{iter.feedback}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Keyword Analysis & Recommendations */}
            <div className="space-y-4 max-h-60 overflow-auto pr-1">
              {matchedKeywords.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-green-600">matched keywords ({matchedKeywords.length})</p>
                  <div className="flex flex-wrap gap-1">
                    {matchedKeywords.slice(0, 10).map((kw: string, idx: number) => (
                      <span key={idx} className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">{kw}</span>
                    ))}
                    {matchedKeywords.length > 10 && (
                      <span className="text-xs text-muted-foreground">+{matchedKeywords.length - 10} more</span>
                    )}
                  </div>
                </div>
              )}
              {missingKeywords.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-amber-600">missing keywords</p>
                  <div className="flex flex-wrap gap-1">
                    {missingKeywords.slice(0, 5).map((kw: string, idx: number) => (
                      <span key={idx} className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">{kw}</span>
                    ))}
                  </div>
                </div>
              )}
              {strengthAreas.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-green-600">strengths</p>
                  {strengthAreas.map((s: string, idx: number) => <p key={idx} className="text-xs">✓ {s}</p>)}
                </div>
              )}
              {recommendations.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-blue-600">recommendations</p>
                  {recommendations.slice(0, 3).map((r: string, idx: number) => <p key={idx} className="text-xs">→ {r}</p>)}
                </div>
              )}
            </div>

            {/* actions */}
            <div className="flex flex-col gap-2 pt-4">
              <Button onClick={() => onExport('docx')} size="sm">
                <Download className="mr-1 h-4 w-4" /> docx
              </Button>
              <Button onClick={() => onExport('pdf')} variant="outline" size="sm">
                <Download className="mr-1 h-4 w-4" /> pdf
              </Button>
              <Button onClick={() => onEditModeChange(!editMode)} variant="secondary" size="sm">
                <Edit className="mr-1 h-4 w-4" /> {editMode ? 'view' : 'edit'}
              </Button>
              <Button onClick={onStartOver} variant="ghost" size="sm">
                <RefreshCw className="mr-1 h-4 w-4" /> restart
              </Button>
            </div>
          </CardContent>
        </Card>
      </aside>

      {/* ----- Main resume content ----- */}
      <main className="lg:col-span-2 space-y-6 max-h-[80vh] overflow-y-auto pr-2">
        {/* Professional Summary */}
        <section className="space-y-3">
          <h3 className="text-xl font-semibold">Professional Summary</h3>
          <div className="bg-muted/30 rounded-lg p-4">
            {editMode ? (
              <textarea
                className="w-full min-h-[100px] p-3 rounded-md border bg-background"
                value={summaryValue}
                onChange={(e) => {
                  const newVal = e.target.value
                  setSummaryValue(newVal)
                  const updated = { ...tailoredResume, summary: newVal }
                  onResumeUpdate(updated)
                }}
              />
            ) : (
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {tailoredResume.summary}
              </p>
            )}
          </div>
        </section>

        {/* Professional Experience */}
        <section className="space-y-3">
          <h3 className="text-xl font-semibold">Professional Experience</h3>
          {(tailoredResume.experience || []).map((exp: any, index: number) => (
            <div key={index} className="bg-muted/30 rounded-lg p-4 space-y-2">
              <div>
                <h4 className="font-semibold">{exp.title}</h4>
                <p className="text-sm text-muted-foreground">
                  {exp.company} | {exp.duration}
                </p>
              </div>
              <ul className="space-y-1">
                {exp.achievements.map((ach: string, aIdx: number) => (
                  <li key={aIdx} className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">•</span>
                    {editMode ? (
                      <input
                        type="text"
                        className="flex-1 p-1 rounded border bg-background text-sm"
                        defaultValue={ach}
                      />
                    ) : (
                      <span className="text-sm">{ach}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        {/* Skills */}
        <section className="space-y-3">
          <h3 className="text-xl font-semibold">Technical Skills</h3>
          <div className="bg-muted/30 rounded-lg p-4 space-y-3">
            {Object.entries(tailoredResume.skills || {}).map(([category, skills]: [string, any]) => (
              <div key={category} className="space-y-2">
                <h4 className="font-medium capitalize">{category.replace('_', ' ')}:</h4>
                <div className="flex flex-wrap gap-2">
                  {(skills as string[]).map((skill: string, idx: number) => (
                    <Badge key={idx} variant="secondary">{skill}</Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Education */}
        <section className="space-y-3 pb-8">
          <h3 className="text-xl font-semibold">Education</h3>
          {(tailoredResume.education || []).map((edu: any, index: number) => (
            <div key={index} className="bg-muted/30 rounded-lg p-4">
              <h4 className="font-semibold">{edu.degree}</h4>
              <p className="text-sm text-muted-foreground">
                {edu.institution} | {edu.year}
              </p>
            </div>
          ))}
        </section>
      </main>
    </div>
  )
}