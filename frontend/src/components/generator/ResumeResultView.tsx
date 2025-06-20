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
import type { GenerateResumeResponse } from '@/types'

interface ResumeResultViewProps {
  result: GenerateResumeResponse
  onStartOver: () => void
  onExport: (format: 'docx' | 'pdf') => void
  editMode: boolean
  onEditModeChange: (value: boolean) => void
}

export function ResumeResultView({ 
  result, 
  onStartOver, 
  onExport,
  editMode,
  onEditModeChange
}: ResumeResultViewProps) {
  if (!result.tailored_resume) {
    return null
  }

  // Safely derive data with defaults to prevent undefined errors
  const insights = result.insights ?? null
  const improvements = insights?.improvements ?? []
  const keywordCoverage = insights?.keyword_coverage ?? 0
  const matchStrength = insights?.match_strength ?? 'Unknown'

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-6 w-6 text-green-500" />
            <CardTitle className="text-2xl">Resume Generated Successfully!</CardTitle>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onStartOver}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Start Over
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Insights Section */}
        {insights && (
          <div className="bg-muted/50 rounded-lg p-6 space-y-4">
            <h3 className="font-semibold text-lg">Resume Insights</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Keyword Coverage</p>
                <p className="text-2xl font-bold">{keywordCoverage}%</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Match Strength</p>
                <Badge variant={
                  matchStrength === 'Strong' ? 'default' : 
                  matchStrength === 'Medium' ? 'secondary' : 'outline'
                }>
                  {matchStrength}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Improvements</p>
                <p className="text-sm">{improvements.length} suggestions</p>
              </div>
            </div>
            {improvements.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Suggested Improvements:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {improvements.map((improvement, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-primary mt-0.5">•</span>
                      <span>{improvement}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          <Button 
            onClick={() => onExport('docx')}
            variant="default"
            className="flex-1 sm:flex-none"
          >
            <Download className="mr-2 h-4 w-4" />
            Export as DOCX
          </Button>
          <Button 
            onClick={() => onExport('pdf')}
            variant="outline"
            className="flex-1 sm:flex-none"
          >
            <Download className="mr-2 h-4 w-4" />
            Export as PDF
          </Button>
          <Button 
            onClick={() => onEditModeChange(!editMode)}
            variant="outline"
            className="flex-1 sm:flex-none"
          >
            <Edit className="mr-2 h-4 w-4" />
            {editMode ? 'View Mode' : 'Edit Mode'}
          </Button>
        </div>

        {/* Resume Content */}
        <div className="space-y-6">
          {/* Summary Section */}
          <div className="space-y-3">
            <h3 className="text-xl font-semibold">Professional Summary</h3>
            <div className="bg-muted/30 rounded-lg p-4">
              {editMode ? (
                <textarea
                  className="w-full min-h-[100px] p-3 rounded-md border bg-background"
                  defaultValue={result.tailored_resume.summary}
                />
              ) : (
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {result.tailored_resume.summary}
                </p>
              )}
            </div>
          </div>

          {/* Experience Section */}
          <div className="space-y-3">
            <h3 className="text-xl font-semibold">Professional Experience</h3>
            {result.tailored_resume.experience.map((exp, index) => (
              <div key={index} className="bg-muted/30 rounded-lg p-4 space-y-2">
                <div>
                  <h4 className="font-semibold">{exp.title}</h4>
                  <p className="text-sm text-muted-foreground">
                    {exp.company} | {exp.duration}
                  </p>
                </div>
                <ul className="space-y-1">
                  {exp.achievements.map((achievement, achievementIndex) => (
                    <li key={achievementIndex} className="flex items-start gap-2">
                      <span className="text-primary mt-0.5">•</span>
                      {editMode ? (
                        <input
                          type="text"
                          className="flex-1 p-1 rounded border bg-background text-sm"
                          defaultValue={achievement}
                        />
                      ) : (
                        <span className="text-sm">{achievement}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Skills Section */}
          <div className="space-y-3">
            <h3 className="text-xl font-semibold">Technical Skills</h3>
            <div className="bg-muted/30 rounded-lg p-4 space-y-3">
              {Object.entries(result.tailored_resume.skills).map(([category, skills]) => (
                <div key={category} className="space-y-2">
                  <h4 className="font-medium capitalize">
                    {category.replace('_', ' ')}:
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {skills.map((skill, skillIndex) => (
                      <Badge key={skillIndex} variant="secondary">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Education Section */}
          <div className="space-y-3">
            <h3 className="text-xl font-semibold">Education</h3>
            {result.tailored_resume.education.map((edu, index) => (
              <div key={index} className="bg-muted/30 rounded-lg p-4">
                <h4 className="font-semibold">{edu.degree}</h4>
                <p className="text-sm text-muted-foreground">
                  {edu.institution} | {edu.year}
                </p>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}