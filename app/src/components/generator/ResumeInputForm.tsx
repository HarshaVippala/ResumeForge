'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Building2, User, FileText, Sparkles, BriefcaseIcon, Link } from 'lucide-react'

interface ResumeInputFormProps {
  formData: {
    company: string
    role: string
    jobDescription: string
    jobLink?: string
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
    <div className="w-full">
      {/* Header Section */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
          Resume Generator
        </h1>
      </div>

      {/* Form Card */}
      <Card className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700/50 rounded-xl shadow-lg dark:shadow-black/20">
        <CardContent className="p-6 md:p-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-6">
              {/* Job Title Field */}
              <div className="group">
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2 mb-2">
                  <User className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                  Job Title
                </label>
                <Input
                  placeholder="e.g., Senior Software Engineer, Product Manager"
                  value={formData.role}
                  onChange={(e) => onFormDataChange('role', e.target.value)}
                  className="h-10 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent transition-colors placeholder:text-gray-400 dark:placeholder:text-gray-500"
                />
              </div>

              {/* Company Name Field */}
              <div className="group">
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2 mb-2">
                  <Building2 className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                  Company Name
                </label>
                <Input
                  placeholder="e.g., Google, Microsoft, Apple"
                  value={formData.company}
                  onChange={(e) => onFormDataChange('company', e.target.value)}
                  className="h-10 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900 dark:focus:ring-gray-100 focus:border-gray-900 dark:focus:border-gray-100 transition-colors placeholder:text-gray-400"
                />
              </div>

              {/* Job Posting Link Field */}
              <div className="group">
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2 mb-2">
                  <Link className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                  Job Posting Link (Optional)
                </label>
                <Input
                  placeholder="https://careers.company.com/job/12345"
                  value={formData.jobLink || ''}
                  onChange={(e) => onFormDataChange('jobLink', e.target.value)}
                  className="h-10 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900 dark:focus:ring-gray-100 focus:border-gray-900 dark:focus:border-gray-100 transition-colors placeholder:text-gray-400"
                  type="url"
                />
              </div>
            </div>

            {/* Right Column - Job Description */}
            <div className="group">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                Job Description
              </label>
              <Textarea
                placeholder="Paste the complete job description here..."
                value={formData.jobDescription}
                onChange={(e) => onFormDataChange('jobDescription', e.target.value)}
                rows={20}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900 dark:focus:ring-gray-100 focus:border-gray-900 dark:focus:border-gray-100 transition-colors resize-none text-sm leading-relaxed h-full min-h-[400px] placeholder:text-gray-400"
              />
            </div>
          </div>

          {error && (
            <div className="mt-6 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/50 rounded-lg p-4">
              <p className="text-red-600 dark:text-red-400 text-sm font-medium">{error}</p>
            </div>
          )}

          <div className="mt-6">
            <Button 
              onClick={onGenerate}
              className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white font-medium rounded-md transition-colors shadow-md hover:shadow-lg"
              size="lg"
              disabled={!formData.company || !formData.role || !formData.jobDescription}
            >
              <Sparkles className="mr-2 h-5 w-5" />
              Generate Tailored Resume
            </Button>
          </div>

        </CardContent>
      </Card>
    </div>
  )
}