/**
 * Utility functions for semantic keyword matching between job descriptions and resumes
 */

interface ResumeContent {
  summary: string
  skills: string
  experience: string
}

/**
 * Extract all keywords from job analysis
 */
export function extractAllJDKeywords(analysis: any): string[] {
  if (!analysis) return []
  
  const allKeywords = [
    ...(analysis.critical_keywords || []),
    // Handle both nested (JobAnalysis interface) and flat (backend response) structures
    ...(analysis.keywords?.technical_skills || analysis.technical_skills || []),
    ...(analysis.keywords?.soft_skills || analysis.soft_skills || []),
    ...(analysis.keywords?.experience_requirements || analysis.experience_requirements || []),
    ...(analysis.keywords?.nice_to_have || []),
    ...(analysis.categories?.programming_languages || analysis.programming_languages || []),
    ...(analysis.categories?.frameworks_tools || analysis.frameworks_libraries_tools || []),
    ...(analysis.categories?.methodologies || analysis.methodologies_concepts || [])
  ]
  
  return [...new Set(allKeywords)] // Remove duplicates
}

/**
 * Extract text content from resume state
 */
export function extractResumeText(resumeState: any): string {
  if (!resumeState) return ''
  
  const parts = []
  
  if (resumeState.summary?.current) {
    parts.push(typeof resumeState.summary.current === 'string' 
      ? resumeState.summary.current 
      : JSON.stringify(resumeState.summary.current))
  }
  
  if (resumeState.skills?.current) {
    parts.push(typeof resumeState.skills.current === 'string' 
      ? resumeState.skills.current 
      : JSON.stringify(resumeState.skills.current))
  }
  
  if (resumeState.experience?.current) {
    parts.push(typeof resumeState.experience.current === 'string' 
      ? resumeState.experience.current 
      : JSON.stringify(resumeState.experience.current))
  }
  
  return parts.join(' ').toLowerCase()
}

/**
 * Check if a keyword exists in resume text using semantic matching
 */
export function isKeywordInResume(keyword: string, resumeText: string): boolean {
  if (!keyword || !resumeText) return false
  
  const normalizedKeyword = keyword.toLowerCase().trim()
  const normalizedResume = resumeText.toLowerCase()
  
  // Direct match
  if (normalizedResume.includes(normalizedKeyword)) {
    return true
  }
  
  // Check for partial matches and common variations
  const variations = getKeywordVariations(normalizedKeyword)
  
  return variations.some(variation => normalizedResume.includes(variation))
}

/**
 * Generate keyword variations for better matching
 */
function getKeywordVariations(keyword: string): string[] {
  const variations = [keyword]
  
  // Common tech variations
  const techVariations: Record<string, string[]> = {
    'javascript': ['js', 'node.js', 'nodejs', 'react', 'vue', 'angular'],
    'typescript': ['ts'],
    'python': ['py', 'django', 'flask', 'fastapi'],
    'kubernetes': ['k8s'],
    'docker': ['containerization', 'containers'],
    'aws': ['amazon web services', 'cloud'],
    'gcp': ['google cloud platform', 'google cloud'],
    'azure': ['microsoft azure'],
    'ci/cd': ['continuous integration', 'continuous deployment', 'devops'],
    'machine learning': ['ml', 'artificial intelligence', 'ai'],
    'database': ['sql', 'nosql', 'mongodb', 'postgresql', 'mysql'],
    'api': ['rest', 'restful', 'graphql'],
    'microservices': ['micro-services', 'service-oriented'],
    'agile': ['scrum', 'kanban'],
    'git': ['github', 'gitlab', 'version control']
  }
  
  // Add specific variations if they exist
  if (techVariations[keyword]) {
    variations.push(...techVariations[keyword])
  }
  
  // Add plurals/singulars
  if (keyword.endsWith('s') && keyword.length > 3) {
    variations.push(keyword.slice(0, -1)) // Remove 's'
  } else if (!keyword.endsWith('s')) {
    variations.push(keyword + 's') // Add 's'
  }
  
  // Add common suffixes/prefixes
  if (keyword.includes(' ')) {
    // For multi-word keywords, also check individual words
    const words = keyword.split(' ')
    variations.push(...words)
  }
  
  return variations
}

/**
 * Find common keywords between job description and resume
 */
export function findCommonKeywords(analysis: any, resumeState: any): string[] {
  const jdKeywords = extractAllJDKeywords(analysis)
  const resumeText = extractResumeText(resumeState)
  
  if (!jdKeywords.length || !resumeText) return []
  
  return jdKeywords.filter(keyword => isKeywordInResume(keyword, resumeText))
}

/**
 * Find missing keywords (in JD but not in resume)
 */
export function findMissingKeywords(analysis: any, resumeState: any): string[] {
  const jdKeywords = extractAllJDKeywords(analysis)
  const resumeText = extractResumeText(resumeState)
  
  if (!jdKeywords.length) return []
  if (!resumeText) return jdKeywords
  
  return jdKeywords.filter(keyword => !isKeywordInResume(keyword, resumeText))
}

/**
 * Calculate keyword coverage percentage
 */
export function calculateKeywordCoverage(analysis: any, resumeState: any): number {
  const jdKeywords = extractAllJDKeywords(analysis)
  const commonKeywords = findCommonKeywords(analysis, resumeState)
  
  if (!jdKeywords.length) return 0
  
  return Math.round((commonKeywords.length / jdKeywords.length) * 100)
}