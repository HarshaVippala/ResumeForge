/**
 * Harsha's LaTeX Template Processor
 * Created: 2025-01-10
 * 
 * Template processor that reads harsha-resume.tex and replaces placeholders
 * with actual resume data from ResumeForge JSON format.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

export interface ResumeData {
  name?: string;
  email?: string;
  phone?: string;
  linkedin?: string;
  github?: string;
  location?: string;
  summary?: string;
  experience?: ExperienceItem[];
  skills?: SkillsData;
  education?: EducationItem[];
}

export interface ExperienceItem {
  title: string;
  company: string;
  duration: string;
  location?: string;
  bullets: string[];
}

export interface SkillsData {
  languages_frameworks?: string[];
  cloud_devops?: string[];
  apis_integration?: string[];
  architecture_design?: string[];
  databases_storage?: string[];
  monitoring_observability?: string[];
  testing_cicd?: string[];
  // Alternative formats
  programming_languages?: string[];
  frameworks_libraries_tools?: string[];
  cloud_devops_tools?: string[];
  databases?: string[];
  categories?: { name: string; items: string[] }[];
}

export interface EducationItem {
  degree: string;
  school: string;
  location?: string;
  dates: string;
  year?: string;
}

export class HarshaLatexTemplate {
  private template: string;
  
  constructor() {
    // Load template from file
    const templatePath = join(process.cwd(), 'app', 'api', '_lib', 'latex', 'templates', 'harsha-resume.tex');
    this.template = readFileSync(templatePath, 'utf-8');
  }

  /**
   * Process template with resume data
   */
  process(resumeData: ResumeData): string {
    let latexCode = this.template;
    
    // Replace header information
    latexCode = this.replaceHeader(latexCode, resumeData);
    
    // Replace summary
    latexCode = this.replaceSummary(latexCode, resumeData);
    
    // Replace skills
    latexCode = this.replaceSkills(latexCode, resumeData);
    
    // Replace experience bullets
    latexCode = this.replaceExperience(latexCode, resumeData);
    
    return latexCode;
  }

  /**
   * Replace header placeholders
   */
  private replaceHeader(latex: string, data: ResumeData): string {
    // For now, we keep the hardcoded header from the template
    // In the future, we could make this dynamic
    return latex;
  }

  /**
   * Replace summary section
   */
  private replaceSummary(latex: string, data: ResumeData): string {
    const summary = data.summary || 'Experienced software engineer with expertise in full-stack development and cloud technologies.';
    const escapedSummary = this.escapeLatex(summary);
    return latex.replace('<SUMMARY>', escapedSummary);
  }

  /**
   * Replace skills placeholders
   */
  private replaceSkills(latex: string, data: ResumeData): string {
    const skills = this.categorizeSkills(data.skills || {});
    
    latex = latex.replace('<SKILLS_LANGUAGESFRAMEWORK>', this.escapeLatex(skills.languages_frameworks.join(', ')));
    latex = latex.replace('<SKILLS_CLOUDDEVOPS>', this.escapeLatex(skills.cloud_devops.join(', ')));
    latex = latex.replace('<SKILLS_APISINTEGRATION>', this.escapeLatex(skills.apis_integration.join(', ')));
    latex = latex.replace('<SKILLS_ARCHITECTUREDESIGN>', this.escapeLatex(skills.architecture_design.join(', ')));
    latex = latex.replace('<SKILLS_DATABASESSTORAGE>', this.escapeLatex(skills.databases_storage.join(', ')));
    latex = latex.replace('<SKILLS_MONITORINGOBSERVABILITY>', this.escapeLatex(skills.monitoring_observability.join(', ')));
    latex = latex.replace('<SKILLS_TESTINGCICD>', this.escapeLatex(skills.testing_cicd.join(', ')));
    
    return latex;
  }

  /**
   * Replace experience bullet points
   */
  private replaceExperience(latex: string, data: ResumeData): string {
    const experience = data.experience || [];
    
    // Handle job 1 (most recent)
    if (experience.length > 0) {
      const job1 = experience[0];
      const bullets = job1.bullets || [];
      
      latex = latex.replace('<JOB1_BULLET1>', this.escapeLatex(bullets[0] || ''));
      latex = latex.replace('<JOB1_BULLET2>', this.escapeLatex(bullets[1] || ''));
      latex = latex.replace('<JOB1_BULLET3>', this.escapeLatex(bullets[2] || ''));
      latex = latex.replace('<JOB1_BULLET4>', this.escapeLatex(bullets[3] || ''));
      latex = latex.replace('<JOB1_BULLET5>', this.escapeLatex(bullets[4] || ''));
    }
    
    // Handle job 2
    if (experience.length > 1) {
      const job2 = experience[1];
      const bullets = job2.bullets || [];
      
      latex = latex.replace('<JOB2_BULLET1>', this.escapeLatex(bullets[0] || ''));
      latex = latex.replace('<JOB2_BULLET2>', this.escapeLatex(bullets[1] || ''));
      latex = latex.replace('<JOB2_BULLET3>', this.escapeLatex(bullets[2] || ''));
      latex = latex.replace('<JOB2_BULLET4>', this.escapeLatex(bullets[3] || ''));
      latex = latex.replace('<JOB2_BULLET5>', this.escapeLatex(bullets[4] || ''));
    }
    
    // Handle job 3
    if (experience.length > 2) {
      const job3 = experience[2];
      const bullets = job3.bullets || [];
      
      latex = latex.replace('<JOB3_BULLET1>', this.escapeLatex(bullets[0] || ''));
      latex = latex.replace('<JOB3_BULLET2>', this.escapeLatex(bullets[1] || ''));
      latex = latex.replace('<JOB3_BULLET3>', this.escapeLatex(bullets[2] || ''));
    }
    
    // Clean up any remaining placeholders
    latex = latex.replace(/<JOB\d+_BULLET\d+>/g, '');
    
    return latex;
  }

  /**
   * Categorize skills into predefined categories
   */
  private categorizeSkills(skills: SkillsData): {
    languages_frameworks: string[];
    cloud_devops: string[];
    apis_integration: string[];
    architecture_design: string[];
    databases_storage: string[];
    monitoring_observability: string[];
    testing_cicd: string[];
  } {
    const result = {
      languages_frameworks: [] as string[],
      cloud_devops: [] as string[],
      apis_integration: [] as string[],
      architecture_design: [] as string[],
      databases_storage: [] as string[],
      monitoring_observability: [] as string[],
      testing_cicd: [] as string[]
    };

    // If skills are already categorized correctly
    if (skills.languages_frameworks) {
      result.languages_frameworks = skills.languages_frameworks;
    }
    if (skills.cloud_devops) {
      result.cloud_devops = skills.cloud_devops;
    }
    if (skills.apis_integration) {
      result.apis_integration = skills.apis_integration;
    }
    if (skills.architecture_design) {
      result.architecture_design = skills.architecture_design;
    }
    if (skills.databases_storage) {
      result.databases_storage = skills.databases_storage;
    }
    if (skills.monitoring_observability) {
      result.monitoring_observability = skills.monitoring_observability;
    }
    if (skills.testing_cicd) {
      result.testing_cicd = skills.testing_cicd;
    }

    // Map from alternative formats
    if (skills.programming_languages) {
      result.languages_frameworks.push(...skills.programming_languages);
    }
    if (skills.frameworks_libraries_tools) {
      result.languages_frameworks.push(...skills.frameworks_libraries_tools);
    }
    if (skills.cloud_devops_tools) {
      result.cloud_devops.push(...skills.cloud_devops_tools);
    }
    if (skills.databases) {
      result.databases_storage.push(...skills.databases);
    }

    // Handle categorized skills
    if (skills.categories) {
      for (const category of skills.categories) {
        const categoryName = category.name.toLowerCase();
        if (categoryName.includes('language') || categoryName.includes('framework')) {
          result.languages_frameworks.push(...category.items);
        } else if (categoryName.includes('cloud') || categoryName.includes('devops')) {
          result.cloud_devops.push(...category.items);
        } else if (categoryName.includes('api') || categoryName.includes('integration')) {
          result.apis_integration.push(...category.items);
        } else if (categoryName.includes('architecture') || categoryName.includes('design')) {
          result.architecture_design.push(...category.items);
        } else if (categoryName.includes('database') || categoryName.includes('storage')) {
          result.databases_storage.push(...category.items);
        } else if (categoryName.includes('monitoring') || categoryName.includes('observability')) {
          result.monitoring_observability.push(...category.items);
        } else if (categoryName.includes('testing') || categoryName.includes('ci') || categoryName.includes('cd')) {
          result.testing_cicd.push(...category.items);
        }
      }
    }

    // Apply defaults if categories are empty
    if (result.languages_frameworks.length === 0) {
      result.languages_frameworks = ['Python', 'JavaScript', 'TypeScript', 'Java', 'React', 'Node.js'];
    }
    if (result.cloud_devops.length === 0) {
      result.cloud_devops = ['AWS', 'Azure', 'Docker', 'Kubernetes', 'Terraform'];
    }
    if (result.apis_integration.length === 0) {
      result.apis_integration = ['REST APIs', 'GraphQL', 'gRPC', 'OAuth', 'JWT'];
    }
    if (result.architecture_design.length === 0) {
      result.architecture_design = ['Microservices', 'System Design', 'Design Patterns', 'Event-Driven Architecture'];
    }
    if (result.databases_storage.length === 0) {
      result.databases_storage = ['PostgreSQL', 'MongoDB', 'Redis', 'Elasticsearch'];
    }
    if (result.monitoring_observability.length === 0) {
      result.monitoring_observability = ['New Relic', 'Datadog', 'Prometheus', 'Grafana'];
    }
    if (result.testing_cicd.length === 0) {
      result.testing_cicd = ['Jest', 'Cypress', 'Jenkins', 'GitHub Actions'];
    }

    return result;
  }

  /**
   * Escape special LaTeX characters
   */
  private escapeLatex(text: string): string {
    if (!text) return '';
    
    return text
      .replace(/\\/g, '\\textbackslash{}')
      .replace(/#/g, '\\#')
      .replace(/\$/g, '\\\$')
      .replace(/%/g, '\\%')
      .replace(/&/g, '\\&')
      .replace(/_/g, '\\_')
      .replace(/\{/g, '\\{')
      .replace(/\}/g, '\\}')
      .replace(/~/g, '\\textasciitilde{}')
      .replace(/\^/g, '\\textasciicircum{}');
  }
}

/**
 * Process Harsha's LaTeX template with resume data
 */
export function processHarshaTemplate(resumeData: ResumeData): string {
  const processor = new HarshaLatexTemplate();
  return processor.process(resumeData);
}