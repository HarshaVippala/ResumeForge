'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  FileText,
  Download,
  Eye,
  BarChart3,
  Star,
  CheckCircle,
  AlertTriangle,
  Zap,
  RotateCcw
} from 'lucide-react'
import type { JobAnalysis, ResumeState } from '@/types'

interface ResumePreviewProps {
  resumeState: ResumeState
  jobAnalysis: JobAnalysis | null
  highlightKeywords?: boolean
}

export function ResumePreview({ resumeState, jobAnalysis, highlightKeywords = false }: ResumePreviewProps) {
  const [isGenerating, setIsGenerating] = useState(false)

  // Calculate ATS score based on keyword matches
  const calculateATSScore = () => {
    if (!jobAnalysis) return 65

    const allKeywords = [
      ...(jobAnalysis.critical_keywords || []),
      ...(jobAnalysis.keywords.technical_skills || []),
      ...(jobAnalysis.keywords.soft_skills || [])
    ]

    const resumeContent = [
      resumeState.summary.current,
      resumeState.skills.current,
      JSON.stringify(resumeState.experience.current)
    ].join(' ').toLowerCase()

    const matchedKeywords = allKeywords.filter(keyword =>
      resumeContent.includes(keyword.toLowerCase())
    )

    return Math.min(95, Math.max(45, Math.round((matchedKeywords.length / allKeywords.length) * 100)))
  }

  const atsScore = calculateATSScore()
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-100'
    if (score >= 60) return 'text-yellow-600 bg-yellow-100'
    return 'text-red-600 bg-red-100'
  }

  const handleGenerate = async () => {
    if (!jobAnalysis?.session_id) {
      alert('No session ID available. Please analyze the job description first.')
      return
    }

    setIsGenerating(true)

    try {
      // Call backend API for PDF generation using your resume template
      const response = await fetch('http://localhost:5001/api/template-export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: jobAnalysis.session_id,
          sections: {
            summary: resumeState.summary.current,
            skills: resumeState.skills.current,
            experience: resumeState.experience.current
          },
          template: 'Harsha_Master.docx' // Use your actual resume template
        })
      })

      if (!response.ok) {
        throw new Error(`Export failed: ${response.status} ${response.statusText}`)
      }

      // Download the generated file
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = url
      a.download = `${jobAnalysis.job_info.company}_${jobAnalysis.job_info.role}_Resume.docx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

    } catch (err) {
      console.error('Resume generation failed:', err)
      alert(`Failed to generate resume: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }

    setIsGenerating(false)
  }

  const highlightKeywordsInText = (text: string) => {
    if (!highlightKeywords || !jobAnalysis) return text

    let highlightedText = text
    const keywords = [
      ...(jobAnalysis.critical_keywords || []),
      ...(jobAnalysis.keywords.technical_skills || [])
    ]

    keywords.forEach(keyword => {
      const regex = new RegExp(`(${keyword})`, 'gi')
      highlightedText = highlightedText.replace(regex, '<mark class="bg-yellow-200 px-1 rounded">$1</mark>')
    })

    return highlightedText
  }

  return (
    <div className="bg-white h-full overflow-y-auto">
      {/* Simplified Header */}
      <div className="border-b p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Resume Preview
          </h2>

          <div className="flex items-center gap-3">
            {/* ATS Score */}
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">ATS Score:</span>
              <div className={`px-2 py-1 rounded text-xs font-medium ${getScoreColor(atsScore)}`}>
                {atsScore}%
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => window.location.reload()}
                size="sm"
                className="flex items-center gap-2"
              >
                <RotateCcw className="h-3 w-3" />
                Regenerate
              </Button>

              <Button
                onClick={handleGenerate}
                disabled={isGenerating}
                size="sm"
                className="flex items-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Download className="h-3 w-3" />
                    Download PDF
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <DocumentView
          resumeState={resumeState}
          jobAnalysis={jobAnalysis}
          highlightKeywords={highlightKeywords}
          highlightKeywordsInText={highlightKeywordsInText}
        />
      </div>
    </div>
  )
}

function DocumentView({
  resumeState,
  jobAnalysis,
  highlightKeywords,
  highlightKeywordsInText
}: {
  resumeState: ResumeState
  jobAnalysis: JobAnalysis | null
  highlightKeywords: boolean
  highlightKeywordsInText: (text: string) => string
}) {
  return (
    <div
      className="max-w-xl mx-auto bg-white border border-gray-200 rounded-lg shadow-sm"
      style={{
        fontSize: '9px',
        lineHeight: '1.2',
        fontFamily: 'Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        transform: 'scale(0.85)',
        transformOrigin: 'top center',
        marginBottom: '-10%'
      }}
    >
      {/* Header - Matching your resume format */}
      <div className="text-center border-b border-gray-400 pb-2 mb-3 px-4 pt-4">
        <h1 className="text-lg font-bold text-gray-900 mb-1 tracking-wide">HARSHA VIPPALA</h1>
        <div className="text-gray-700 text-xs">
          <span className="text-blue-600">harsha.vippala1@gmail.com</span> •
          <span className="mx-1">+1(909)620-7227</span> •
          <span className="text-blue-600 mx-1">www.linkedin.com/in/harsha-vippala</span> •
          <span className="text-blue-600 mx-1">www.github.com/HarshaVippala</span>
        </div>
      </div>

      <div className="px-6 pb-6 space-y-4">
        {/* Summary */}
        <div>
          <h2 className="text-sm font-bold text-gray-900 mb-2 border-b border-gray-400 pb-1">
            SUMMARY
          </h2>
          <div
            className="text-gray-800 text-xs leading-relaxed"
            dangerouslySetInnerHTML={{
              __html: highlightKeywords && resumeState.summary.current
                ? highlightKeywordsInText(resumeState.summary.current as string)
                : (resumeState.summary.current as string || 'Software engineer specializing in large-scale distributed systems, cloud-native backend infrastructure, and horizontally scalable architectures using Node.js, Python, and Go. Experienced in platform-agnostic system design and cross-functional collaboration to ship high-impact features across multi-cloud environments with measurable business impact.')
            }}
          />
        </div>

        {/* Skills */}
        <div>
          <h2 className="text-sm font-bold text-gray-900 mb-2 border-b border-gray-400 pb-1">
            SKILLS
          </h2>
          <div className="text-gray-800 text-xs space-y-1">
            {resumeState.skills.current && typeof resumeState.skills.current === 'string' ? (
              <div
                dangerouslySetInnerHTML={{
                  __html: highlightKeywords
                    ? highlightKeywordsInText(resumeState.skills.current)
                    : resumeState.skills.current
                }}
              />
            ) : (
              <div className="space-y-1">
                <div><strong>Languages & Frameworks:</strong> Python, Node.js, TypeScript, Go, React.js, NestJS, Express.js, C++</div>
                <div><strong>Cloud & DevOps:</strong> AWS, Google Cloud Platform, Pub/Sub, Kubernetes, Docker, Terraform, Protocol Buffers</div>
                <div><strong>APIs & Integration:</strong> RESTful APIs, GraphQL, gRPC, API Gateway, Swagger/OpenAPI, Webhooks</div>
                <div><strong>Architecture & Design:</strong> Microservices, Serverless, Distributed Systems, CAP Theorem, Auto Scaling, Parallel Computing</div>
                <div><strong>Databases & Storage:</strong> MongoDB, DynamoDB, MySQL, PostgreSQL, Redis, Elasticsearch, Redshift</div>
                <div><strong>Monitoring & Observability:</strong> New Relic, CloudWatch, Grafana, ELK, Open Telemetry</div>
                <div><strong>Testing & CI/CD:</strong> Jest, Cypress, Jenkins, GitLab CI/CD, GitHub Actions</div>
                <div><strong>Generative AI & ML:</strong> Vertex AI, AWS Bedrock, LMStudio, RAG, OpenAI APIs, LangGraph</div>
                <div><strong>Certifications:</strong> Google Cloud Engineer, AWS AI Practitioner</div>
              </div>
            )}
          </div>
        </div>

        {/* Experience */}
        <div>
          <h2 className="text-sm font-bold text-gray-900 mb-2 border-b border-gray-400 pb-1">
            EXPERIENCE
          </h2>
          <div className="space-y-3">
            {resumeState.experience.current && typeof resumeState.experience.current === 'string' ? (
              (() => {
                try {
                  const experiences = JSON.parse(resumeState.experience.current as string)
                  return experiences.map((exp: any, index: number) => (
                    <div key={index} className="mb-3">
                      <div className="flex justify-between items-start mb-1">
                        <div>
                          <h3 className="font-bold text-gray-900 text-xs">{exp.role} | {exp.company}</h3>
                          <p className="text-gray-700 text-xs">{exp.location}</p>
                        </div>
                        <p className="text-gray-700 text-xs font-medium">{exp.duration}</p>
                      </div>
                      <ul className="list-disc list-inside space-y-0.5 text-gray-800 text-xs ml-2">
                        {exp.achievements?.map((achievement: string, achIndex: number) => (
                          <li
                            key={achIndex}
                            dangerouslySetInnerHTML={{
                              __html: highlightKeywords
                                ? highlightKeywordsInText(achievement)
                                : achievement
                            }}
                          />
                        ))}
                      </ul>
                    </div>
                  ))
                } catch {
                  return (
                    <div className="space-y-3">
                      <div className="mb-3">
                        <div className="flex justify-between items-start mb-1">
                          <div>
                            <h3 className="font-bold text-gray-900 text-xs">Software Engineer II | 7-Eleven | Irving, TX</h3>
                          </div>
                          <p className="text-gray-700 text-xs font-medium">February 2024 – Present</p>
                        </div>
                        <ul className="list-disc list-inside space-y-0.5 text-gray-800 text-xs ml-2">
                          <li>Led the design and scaling of Node.js serverless functions and API gateway patterns, supporting a mobile checkout platform processing $500K monthly sales with sub-2sec p99 latency for end-to-end flow.</li>
                          <li>Integrated payment processing via Node.js and GraphQL, optimizing mobile order boosting mobile orders by 15%, with a focus on algorithms for tax exemption, split tender, and compliance-driven workflows.</li>
                          <li>Delivered a Node.js IoT payment framework using TypeScript and event-driven patterns, reducing integration time by 30% while enabling consistent implementation across future workflows.</li>
                        </ul>
                      </div>
                    </div>
                  )
                }
              })()
            ) : (
              <p className="text-gray-500 italic text-xs">Work experience will appear here...</p>
            )}
          </div>
        </div>

        {/* Education */}
        <div>
          <h2 className="text-sm font-bold text-gray-900 mb-2 border-b border-gray-400 pb-1">
            EDUCATION
          </h2>
          <div className="space-y-1">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-gray-900 text-xs">Master of Science in Computer Engineering | New York University</h3>
                <p className="text-gray-700 text-xs">New York, NY</p>
              </div>
              <p className="text-gray-700 text-xs">May 2021</p>
            </div>
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-gray-900 text-xs">Bachelor of Technology in Computer Science & Engineering | K L University</h3>
                <p className="text-gray-700 text-xs">Vijayawada, India</p>
              </div>
              <p className="text-gray-700 text-xs">May 2019</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

