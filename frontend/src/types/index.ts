export interface Resume {
  id: string
  title: string
  company: string
  role: string
  final_score?: number
  created_at: string
  updated_at: string
  file_paths?: {
    docx?: string
    pdf?: string
  }
  tags?: string[]
  metadata: ResumeMetadata
}

export interface ResumeMetadata {
  jobDetails: {
    jobPostingUrl?: string
    applicationDate?: string
    salaryRange?: string
    location?: string
    workType: 'remote' | 'hybrid' | 'onsite'
  }
  classification: {
    jobType: JobType
    experienceLevel: ExperienceLevel
    industry: Industry
    primaryTechnologies: string[]
  }
  performance: {
    atsScore: number
    keywordMatchPercentage: number
    interviewConversionRate?: number
    applicationStatus?: ApplicationStatus
  }
  customTags: string[]
}

export type JobType = 
  | 'full-stack'
  | 'backend'
  | 'frontend'
  | 'devops'
  | 'data-science'
  | 'mobile'
  | 'qa'
  | 'product'
  | 'design'
  | 'other'

export type ExperienceLevel = 
  | 'junior'
  | 'mid-level'
  | 'senior'
  | 'lead'
  | 'principal'
  | 'director'

export type Industry = 
  | 'technology'
  | 'finance'
  | 'healthcare'
  | 'e-commerce'
  | 'education'
  | 'government'
  | 'startup'
  | 'consulting'
  | 'other'

export type ApplicationStatus =
  | 'not-applied'
  | 'applied'
  | 'screening'
  | 'phone-interview'
  | 'technical-interview'
  | 'onsite-interview'
  | 'offer'
  | 'rejected'
  | 'accepted'
  | 'withdrawn'

export interface JobApplication {
  id: string
  company: string
  role: string
  department?: string
  salaryRange?: string
  location: string
  workType: 'remote' | 'hybrid' | 'onsite'
  applicationDate: string
  jobPostingUrl?: string
  deadline?: string
  referralSource?: string
  status: ApplicationStatus
  resumeId?: string
  contacts: Contact[]
  applicationMethod: 'company-website' | 'linkedin' | 'recruiter-email' | 'job-board' | 'referral'
  timeline: TimelineEvent[]
  notes: string
  nextAction?: string
  nextActionDate?: string
  metadata: {
    companySize?: string
    industry: Industry
    emailThreadId?: string
    responseTime?: number
    lastActivity?: string
  }
}

export interface Contact {
  id: string
  name: string
  role: string
  email?: string
  phone?: string
  linkedinUrl?: string
  notes?: string
}

export interface TimelineEvent {
  id: string
  date: string
  type: 'application' | 'email' | 'interview' | 'offer' | 'rejection' | 'follow-up' | 'note'
  title: string
  description?: string
  status?: ApplicationStatus
  metadata?: Record<string, unknown>
}

export interface JobAnalysis {
  keywords: {
    technical_skills: string[]
    soft_skills: string[]
    experience_requirements: string[]
    nice_to_have: string[]
  }
  categories: {
    programming_languages: string[]
    frameworks_tools: string[]
    methodologies: string[]
    soft_skills: string[]
  }
  critical_keywords: string[]
  job_info: {
    company: string
    role: string
    seniority: string
    department: string
  }
  session_id?: string // For backend API integration
}

export interface ResumeState {
  summary: SectionState
  skills: SectionState
  experience: SectionState
}

export interface SectionState {
  original: string | unknown[]
  current: string | unknown[]
  keywords: string[]
  status: 'pending' | 'editing' | 'complete'
}

export interface ResumeVersion {
  id: string
  timestamp: string
  description: string
  changes: {
    section: 'summary' | 'skills' | 'experience'
    type: 'create' | 'update' | 'regenerate'
    diff: {
      before: string | unknown[]
      after: string | unknown[]
    }
    keywords_used: string[]
  }[]
  resumeState: ResumeState
}

export interface VersionHistoryState {
  versions: ResumeVersion[]
  currentVersionId: string | null
  maxVersions: number
}

export interface FilterOptions {
  search: string
  companies: string[]
  jobTypes: JobType[]
  experiencelevels: ExperienceLevel[]
  industries: Industry[]
  technologies: string[]
  atsScoreRange: [number, number]
  applicationStatuses: ApplicationStatus[]
  workTypes: ('remote' | 'hybrid' | 'onsite')[]
  dateRange: [Date | null, Date | null]
}

export interface SortOptions {
  field: 'created_at' | 'company' | 'role' | 'final_score' | 'application_date'
  direction: 'asc' | 'desc'
}