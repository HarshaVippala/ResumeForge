import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import type { Resume, JobApplication, FilterOptions, SortOptions, JobAnalysis, ResumeState } from '@/types'

interface ResumeStore {
  // Resume Library State
  resumes: Resume[]
  filteredResumes: Resume[]
  filters: FilterOptions
  sort: SortOptions
  isLoading: boolean
  error: string | null

  // Job Tracker State
  jobApplications: JobApplication[]
  filteredApplications: JobApplication[]

  // Generator State
  generatorStep: 'analysis' | 'editing'
  jobAnalysis: JobAnalysis | null
  resumeState: ResumeState
  currentSection: 'summary' | 'skills' | 'experience'
  
  // Actions
  setResumes: (resumes: Resume[]) => void
  addResume: (resume: Resume) => void
  updateResume: (id: string, updates: Partial<Resume>) => void
  deleteResume: (id: string) => void
  setFilters: (filters: Partial<FilterOptions>) => void
  setSort: (sort: SortOptions) => void
  applyFiltersAndSort: () => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  
  // Job Application Actions
  setJobApplications: (applications: JobApplication[]) => void
  addJobApplication: (application: JobApplication) => void
  updateJobApplication: (id: string, updates: Partial<JobApplication>) => void
  deleteJobApplication: (id: string) => void

  // Generator Actions
  setGeneratorStep: (step: 'analysis' | 'editing') => void
  setJobAnalysis: (analysis: JobAnalysis | null) => void
  setResumeState: (state: ResumeState) => void
  setCurrentSection: (section: 'summary' | 'skills' | 'experience') => void
  resetGenerator: () => void
  loadBaseResumeContent: () => Promise<void>
}

const defaultFilters: FilterOptions = {
  search: '',
  companies: [],
  jobTypes: [],
  experiencelevels: [],
  industries: [],
  technologies: [],
  atsScoreRange: [0, 100],
  applicationStatuses: [],
  workTypes: [],
  dateRange: [null, null]
}

const defaultSort: SortOptions = {
  field: 'created_at',
  direction: 'desc'
}

const defaultResumeState: ResumeState = {
  summary: { original: '', current: '', keywords: [], status: 'pending' },
  skills: { original: '', current: '', keywords: [], status: 'pending' },
  experience: { original: [], current: [], keywords: [], status: 'pending' }
}

export const useResumeStore = create<ResumeStore>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        resumes: [],
        filteredResumes: [],
        filters: defaultFilters,
        sort: defaultSort,
        isLoading: false,
        error: null,
        jobApplications: [],
        filteredApplications: [],

        // Generator state
        generatorStep: 'analysis',
        jobAnalysis: null,
        resumeState: defaultResumeState,
        currentSection: 'summary',

        // Resume actions
        setResumes: (resumes) => {
          set({ resumes })
          get().applyFiltersAndSort()
        },

        addResume: (resume) => {
          set((state) => ({
            resumes: [...state.resumes, resume]
          }))
          get().applyFiltersAndSort()
        },

        updateResume: (id, updates) => {
          set((state) => ({
            resumes: state.resumes.map((resume) =>
              resume.id === id ? { ...resume, ...updates } : resume
            )
          }))
          get().applyFiltersAndSort()
        },

        deleteResume: (id) => {
          set((state) => ({
            resumes: state.resumes.filter((resume) => resume.id !== id)
          }))
          get().applyFiltersAndSort()
        },

        setFilters: (newFilters) => {
          set((state) => ({
            filters: { ...state.filters, ...newFilters }
          }))
          get().applyFiltersAndSort()
        },

        setSort: (sort) => {
          set({ sort })
          get().applyFiltersAndSort()
        },

        applyFiltersAndSort: () => {
          const { resumes, filters, sort } = get()
          let filtered = [...resumes]

          // Apply search filter
          if (filters.search) {
            const searchLower = filters.search.toLowerCase()
            filtered = filtered.filter((resume) =>
              resume.title.toLowerCase().includes(searchLower) ||
              resume.company.toLowerCase().includes(searchLower) ||
              resume.role.toLowerCase().includes(searchLower) ||
              resume.tags?.some(tag => tag.toLowerCase().includes(searchLower))
            )
          }

          // Apply company filter
          if (filters.companies.length > 0) {
            filtered = filtered.filter((resume) =>
              filters.companies.includes(resume.company)
            )
          }

          // Apply job type filter
          if (filters.jobTypes.length > 0) {
            filtered = filtered.filter((resume) =>
              filters.jobTypes.includes(resume.metadata.classification.jobType)
            )
          }

          // Apply experience level filter
          if (filters.experiencelevels.length > 0) {
            filtered = filtered.filter((resume) =>
              filters.experiencelevels.includes(resume.metadata.classification.experienceLevel)
            )
          }

          // Apply ATS score filter - Use real ATS score from metadata
          filtered = filtered.filter((resume) => {
            const score = resume.metadata?.performance?.atsScore || resume.final_score || 0
            return score >= filters.atsScoreRange[0] && score <= filters.atsScoreRange[1]
          })

          // Apply sorting
          filtered.sort((a, b) => {
            let aValue: unknown, bValue: unknown

            switch (sort.field) {
              case 'company':
                aValue = a.company.toLowerCase()
                bValue = b.company.toLowerCase()
                break
              case 'role':
                aValue = a.role.toLowerCase()
                bValue = b.role.toLowerCase()
                break
              case 'final_score':
                aValue = a.final_score || 0
                bValue = b.final_score || 0
                break
              case 'created_at':
              default:
                aValue = new Date(a.created_at)
                bValue = new Date(b.created_at)
                break
            }

            if ((aValue as any) < (bValue as any)) return sort.direction === 'asc' ? -1 : 1
            if ((aValue as any) > (bValue as any)) return sort.direction === 'asc' ? 1 : -1
            return 0
          })

          set({ filteredResumes: filtered })
        },

        setLoading: (isLoading) => set({ isLoading }),
        setError: (error) => set({ error }),

        // Job Application actions
        setJobApplications: (jobApplications) => {
          set({ jobApplications, filteredApplications: jobApplications })
        },

        addJobApplication: (application) => {
          set((state) => ({
            jobApplications: [...state.jobApplications, application],
            filteredApplications: [...state.filteredApplications, application]
          }))
        },

        updateJobApplication: (id, updates) => {
          set((state) => ({
            jobApplications: state.jobApplications.map((app) =>
              app.id === id ? { ...app, ...updates } : app
            ),
            filteredApplications: state.filteredApplications.map((app) =>
              app.id === id ? { ...app, ...updates } : app
            )
          }))
        },

        deleteJobApplication: (id) => {
          set((state) => ({
            jobApplications: state.jobApplications.filter((app) => app.id !== id),
            filteredApplications: state.filteredApplications.filter((app) => app.id !== id)
          }))
        },

        // Generator actions
        setGeneratorStep: (generatorStep) => set({ generatorStep }),
        setJobAnalysis: (jobAnalysis) => set({ jobAnalysis }),
        setResumeState: (resumeState) => set({ resumeState }),
        setCurrentSection: (currentSection) => set({ currentSection }),
        resetGenerator: () => set({ 
          generatorStep: 'analysis',
          jobAnalysis: null,
          resumeState: defaultResumeState,
          currentSection: 'summary'
        }),

        loadBaseResumeContent: async () => {
          try {
            const response = await fetch('/api/master-resume/default')
            if (!response.ok) {
              throw new Error(`Failed to load base resume: ${response.status}`)
            }
            
            const data = await response.json()
            if (!data.success) {
              throw new Error('Failed to load base resume content')
            }
            
            const baseResume = data.resume
            
            // Structure experience data for the preview component
            const structuredExperience = baseResume.experience ? 
              baseResume.experience.map((job: any) => ({
                company: job.company || 'Company',
                role: job.role || 'Role',
                location: job.location || 'Location',
                duration: job.duration || 'Duration',
                achievements: job.achievements || []
              })) : []
            
            // Update resume state with base content
            set((state) => ({
              resumeState: {
                summary: { 
                  original: baseResume.summary || '', 
                  current: baseResume.summary || '', 
                  keywords: [], 
                  status: 'pending' 
                },
                skills: { 
                  original: baseResume.skills || '', 
                  current: baseResume.skills || '', 
                  keywords: [], 
                  status: 'pending' 
                },
                experience: { 
                  original: JSON.stringify(structuredExperience, null, 2), 
                  current: JSON.stringify(structuredExperience, null, 2), 
                  keywords: [], 
                  status: 'pending' 
                }
              }
            }))
          } catch (error) {
            console.error('Error loading base resume content:', error)
            // Keep the default empty state if loading fails
          }
        }
      }),
      { 
        name: 'resume-store',
        partialize: (state) => ({
          generatorStep: state.generatorStep,
          jobAnalysis: state.jobAnalysis,
          resumeState: state.resumeState,
          currentSection: state.currentSection
        })
      }
    ),
    { name: 'resume-store' }
  )
)