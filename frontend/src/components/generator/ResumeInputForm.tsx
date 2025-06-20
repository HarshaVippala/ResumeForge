'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Building2, User, FileText, Sparkles } from 'lucide-react'

interface ResumeInputFormProps {
  formData: {
    company: string
    role: string
    jobDescription: string
  }
  onFormDataChange: (field: string, value: string) => void
  onGenerate: () => void
  error: string | null
}

export function ResumeInputForm({ 
  formData, 
  onFormDataChange, 
  onGenerate, 
  error 
}: ResumeInputFormProps) {
  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-center">
          Resume Generator
        </CardTitle>
        <p className="text-center text-muted-foreground">
          Enter job details below to generate a tailored resume
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Company Name
            </label>
            <Input
              placeholder="e.g., Google, Microsoft, Apple"
              value={formData.company}
              onChange={(e) => onFormDataChange('company', e.target.value)}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <User className="h-4 w-4" />
              Job Title
            </label>
            <Input
              placeholder="e.g., Senior Software Engineer, Product Manager"
              value={formData.role}
              onChange={(e) => onFormDataChange('role', e.target.value)}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Job Description
            </label>
            <Textarea
              placeholder="Paste the complete job description here..."
              value={formData.jobDescription}
              onChange={(e) => onFormDataChange('jobDescription', e.target.value)}
              rows={10}
              className="w-full resize-none font-mono text-sm"
            />
          </div>
        </div>

        {error && (
          <div className="bg-destructive/15 border border-destructive/20 rounded-lg p-3">
            <p className="text-destructive text-sm">{error}</p>
          </div>
        )}

        <Button 
          onClick={onGenerate}
          className="w-full"
          size="lg"
          disabled={!formData.company || !formData.role || !formData.jobDescription}
        >
          <Sparkles className="mr-2 h-4 w-4" />
          Generate Tailored Resume
        </Button>
      </CardContent>
    </Card>
  )
}