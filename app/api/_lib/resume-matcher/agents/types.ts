/**
 * Common types for the agent system
 * Created: 2025-01-10
 */

export interface AgentMessage {
  id: string;
  type: 'task' | 'result' | 'error' | 'cancel' | 'status';
  agentType: AgentType;
  payload: any;
  timestamp: number;
  correlationId?: string;
}

export enum AgentType {
  ORCHESTRATOR = 'orchestrator',
  KEYWORD_EXTRACTOR = 'keyword-extractor',
  ATS_SCORER = 'ats-scorer',
  SIMILARITY_CALCULATOR = 'similarity-calculator',
  CONTENT_OPTIMIZER = 'content-optimizer'
}

export interface TaskPayload {
  taskId: string;
  priority: number;
  timeout?: number;
  data: any;
}

export interface ResultPayload {
  taskId: string;
  success: boolean;
  data?: any;
  error?: string;
  duration: number;
}

export interface StatusPayload {
  agentType: AgentType;
  status: 'idle' | 'busy' | 'error';
  tasksInQueue: number;
  currentTask?: string;
}

export interface OptimizationRequest {
  resume: any;
  jobDescription: string;
  targetScore?: number;
  maxIterations?: number;
  focusAreas?: ('keywords' | 'ats' | 'similarity' | 'content')[];
}

export interface OptimizationResult {
  optimizedResume: any;
  scores: {
    ats: number;
    similarity: number;
    keywordMatch: number;
  };
  improvements: string[];
  iterations: number;
  duration: number;
}

export interface KeywordExtractionTask {
  text: string;
  topN?: number;
  includeMultiWord?: boolean;
}

export interface KeywordExtractionResult {
  keywords: string[];
  technicalTerms: string[];
  softSkills: string[];
  frequencies: { [key: string]: number };
}

export interface ATSScoringTask {
  resume: any;
  keywords: string[];
  jobDescription: string;
}

export interface SimilarityTask {
  resumeText: string;
  jobDescription: string;
  keywords: string[];
}

export interface ContentOptimizationTask {
  section: string;
  currentContent: string;
  targetKeywords: string[];
  jobDescription: string;
  atsRecommendations: string[];
}

export interface ContentOptimizationResult {
  optimizedContent: string;
  addedKeywords: string[];
  improvements: string[];
  score: number;
}