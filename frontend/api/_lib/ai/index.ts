import { OpenAI } from 'openai';

// Initialize OpenAI client
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

export interface JobAnalysisRequest {
  jobDescription: string;
  role: string;
  company?: string;
}

export interface JobAnalysis {
  technical_requirements: string[];
  soft_skills: string[];
  core_responsibilities: string[];
  nice_to_have: string[];
  industry_keywords: string[];
  company_values?: string[];
}

export interface TailorResumeRequest {
  jobDescription: string;
  company: string;
  role: string;
}

export interface TailoredResume {
  summary: string;
  experience: Array<{
    title: string;
    company: string;
    achievements: string[];
  }>;
  skills: {
    languages?: string[];
    frameworks?: string[];
    tools?: string[];
    technical?: string[];
  };
}

/**
 * AI Service for resume generation and job analysis
 */
export class AIService {
  private openai: OpenAI;

  constructor() {
    this.openai = getOpenAIClient();
  }

  /**
   * Analyze job description with streaming response
   */
  async analyzeJobStream(jobDescription: string, role: string) {
    const prompt = `Analyze this job description and extract key requirements.

Role: ${role}
Job Description: ${jobDescription}

Return a JSON object with these categories:
{
  "technical_requirements": ["specific technical skills required"],
  "soft_skills": ["interpersonal and soft skills"],
  "core_responsibilities": ["main job duties"],
  "nice_to_have": ["preferred but not required skills"],
  "industry_keywords": ["industry-specific terms and keywords"]
}

Focus on extracting concrete, specific requirements. Be thorough but concise.`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'You are an expert resume writer and job requirement analyst. Extract key requirements from job descriptions in a structured format.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      stream: true,
      response_format: { type: 'json_object' }
    });

    // Return the OpenAI stream directly
    return response;
  }

  /**
   * Analyze job description (non-streaming)
   */
  async analyzeJob(request: JobAnalysisRequest): Promise<JobAnalysis> {
    const prompt = `Analyze this job description and extract key requirements.

Role: ${request.role}
${request.company ? `Company: ${request.company}` : ''}
Job Description: ${request.jobDescription}

Return a JSON object with these categories:
{
  "technical_requirements": ["specific technical skills required"],
  "soft_skills": ["interpersonal and soft skills"],
  "core_responsibilities": ["main job duties"],
  "nice_to_have": ["preferred but not required skills"],
  "industry_keywords": ["industry-specific terms and keywords"]
  ${request.company ? ',"company_values": ["values or culture fits mentioned"]' : ''}
}

Focus on extracting concrete, specific requirements. Be thorough but concise.`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'You are an expert resume writer and job requirement analyst. Extract key requirements from job descriptions in a structured format.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    return JSON.parse(content) as JobAnalysis;
  }

  /**
   * Tailor resume with streaming response
   */
  async tailorResumeStream(jobDescription: string, company: string, role: string) {
    // Get user's resume data from environment (simplified for personal use)
    const userResume = this.getUserResumeData();

    const prompt = `Create a tailored resume for this position.

Target Role: ${role}
Company: ${company}
Job Description: ${jobDescription}

Base Resume Data:
${JSON.stringify(userResume, null, 2)}

Generate a tailored resume that:
1. Customizes the summary to match the role and company
2. Selects and rewrites the most relevant experience bullets
3. Organizes skills to highlight what's most relevant
4. Uses keywords from the job description naturally

Return a JSON object with this structure:
{
  "summary": "A compelling 2-3 sentence summary",
  "experience": [
    {
      "title": "Job Title",
      "company": "Company Name", 
      "achievements": ["Tailored achievement bullets"]
    }
  ],
  "skills": {
    "languages": ["Programming languages"],
    "frameworks": ["Frameworks and libraries"],
    "tools": ["Tools and platforms"],
    "technical": ["Other technical skills"]
  }
}`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'You are an expert resume writer. Create compelling, ATS-friendly resumes tailored to specific positions. Focus on quantifiable achievements and relevant keywords.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.4,
      stream: true,
      response_format: { type: 'json_object' }
    });

    // Return the OpenAI stream directly
    return response;
  }

  /**
   * Tailor resume (non-streaming)
   */
  async tailorResume(request: TailorResumeRequest): Promise<TailoredResume> {
    // Get user's resume data from environment (simplified for personal use)
    const userResume = this.getUserResumeData();

    const prompt = `Create a tailored resume for this position.

Target Role: ${request.role}
Company: ${request.company}
Job Description: ${request.jobDescription}

Base Resume Data:
${JSON.stringify(userResume, null, 2)}

Generate a tailored resume that:
1. Customizes the summary to match the role and company
2. Selects and rewrites the most relevant experience bullets
3. Organizes skills to highlight what's most relevant
4. Uses keywords from the job description naturally

Return a JSON object with this structure:
{
  "summary": "A compelling 2-3 sentence summary",
  "experience": [
    {
      "title": "Job Title",
      "company": "Company Name", 
      "achievements": ["Tailored achievement bullets"]
    }
  ],
  "skills": {
    "languages": ["Programming languages"],
    "frameworks": ["Frameworks and libraries"],
    "tools": ["Tools and platforms"],
    "technical": ["Other technical skills"]
  }
}`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'You are an expert resume writer. Create compelling, ATS-friendly resumes tailored to specific positions. Focus on quantifiable achievements and relevant keywords.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.4,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    return JSON.parse(content) as TailoredResume;
  }

  /**
   * Get user's resume data from environment or database
   * For personal use, this can be hardcoded or loaded from env
   */
  private getUserResumeData() {
    // This is a simplified version - in production, load from database
    return {
      name: process.env.USER_NAME || 'Your Name',
      email: process.env.USER_EMAIL || 'your.email@example.com',
      summary: 'Experienced software engineer with expertise in full-stack development',
      experience: [
        {
          title: 'Senior Software Engineer',
          company: 'Tech Company',
          duration: '2020 - Present',
          bullets: [
            'Led development of microservices architecture serving 1M+ users',
            'Implemented CI/CD pipelines reducing deployment time by 70%',
            'Mentored team of 5 junior developers'
          ]
        }
      ],
      skills: {
        languages: ['Python', 'TypeScript', 'JavaScript', 'Java'],
        frameworks: ['React', 'Node.js', 'Flask', 'Spring Boot'],
        tools: ['AWS', 'Docker', 'Kubernetes', 'PostgreSQL'],
        technical: ['System Design', 'API Development', 'Cloud Architecture']
      }
    };
  }
}