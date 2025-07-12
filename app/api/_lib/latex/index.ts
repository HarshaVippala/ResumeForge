/**
 * LaTeX Resume Generation System
 * Created: 2025-01-10
 * 
 * Complete LaTeX processing system for ResumeForge
 * Includes template processing, PDF compilation, and export functionality
 */

export { HarshaLatexTemplate, processHarshaTemplate, type ResumeData, type ExperienceItem, type SkillsData, type EducationItem } from './HarshaLatexTemplate';
export { LatexPdfCompiler, compileLatexToPdf, compileLatexToPdfWithDocker, type CompilationResult } from './latex-pdf-compiler';
export { JakesResumeGenerator, generateJakesResume, generateHarshaResumePDF, convertResumeContentToData } from './generator';

// Re-export for convenience
export type { ResumeContent } from '@/api/_lib/db/types';

/**
 * Main export function for LaTeX resume generation
 * This replaces the Python document service functionality
 */
export async function generateResumeLatexPDF(resumeData: ResumeData): Promise<Buffer> {
  const { processHarshaTemplate } = await import('./HarshaLatexTemplate');
  const { compileLatexToPdf } = await import('./latex-pdf-compiler');
  
  const latexCode = processHarshaTemplate(resumeData);
  return await compileLatexToPdf(latexCode, 'resume');
}

/**
 * Check if LaTeX compilation is available
 */
export async function checkLatexAvailability(): Promise<boolean> {
  const { LatexPdfCompiler } = await import('./latex-pdf-compiler');
  return await LatexPdfCompiler.checkPdflatex();
}