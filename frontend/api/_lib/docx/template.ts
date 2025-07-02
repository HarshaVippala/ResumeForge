import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';

const execAsync = promisify(exec);

export interface TemplateData {
  // Header
  NAME: string;
  EMAIL: string;
  PHONE: string;
  LINKEDIN: string;
  GITHUB: string;
  
  // Summary
  SUMMARY: string;
  
  // Skills
  SKILL_FULLSTACK: string;
  SKILL_CLOUD: string;
  SKILL_API: string;
  SKILL_ARCHITECTURE: string;
  SKILL_DATABASE: string;
  SKILL_MONITORING: string;
  SKILL_TESTING: string;
  SKILL_AI: string;
  CERTIFICATIONS: string;
  
  // Experience 1
  EXP1_TITLE: string;
  EXP1_COMPANY: string;
  EXP1_LOCATION: string;
  EXP1_DURATION: string;
  EXP1_BULLETS: string;
  
  // Experience 2
  EXP2_TITLE: string;
  EXP2_COMPANY: string;
  EXP2_LOCATION: string;
  EXP2_DURATION: string;
  EXP2_BULLETS: string;
  
  // Experience 3
  EXP3_TITLE: string;
  EXP3_COMPANY: string;
  EXP3_LOCATION: string;
  EXP3_DURATION: string;
  EXP3_BULLETS: string;
  
  // Education
  EDU_DEGREE: string;
  EDU_SCHOOL: string;
  EDU_LOCATION: string;
  EDU_GRADUATION: string;
}

/**
 * Generate resume using DOCX template with placeholders
 */
export async function generateFromTemplate(
  tailoredResume: any,
  personalInfo: any,
  format: 'pdf' | 'docx' = 'pdf'
): Promise<Buffer> {
  try {
    // Load the template
    const templatePath = path.join(process.cwd(), 'backend/data/placeholder_resume.docx');
    const content = fs.readFileSync(templatePath, 'binary');
    
    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: {
        start: '{{',
        end: '}}'
      }
    });
    
    // Prepare template data
    const templateData = prepareTemplateData(tailoredResume, personalInfo);
    
    // Set the data
    doc.setData(templateData);
    
    // Render the document
    doc.render();
    
    // Generate DOCX buffer
    const docxBuffer = doc.getZip().generate({
      type: 'nodebuffer',
      compression: 'DEFLATE'
    });
    
    if (format === 'docx') {
      return docxBuffer;
    }
    
    // Convert to PDF
    return await convertToPDF(docxBuffer);
    
  } catch (error) {
    console.error('Error generating from template:', error);
    throw new Error(`Failed to generate resume: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Prepare data for template replacement
 */
function prepareTemplateData(tailoredResume: any, personalInfo: any): TemplateData {
  const skills = tailoredResume.skills || {};
  const experience = personalInfo.experience || [];
  const tailoredExp = tailoredResume.experience || [];
  
  return {
    // Header
    NAME: personalInfo.name.toUpperCase(),
    EMAIL: personalInfo.email,
    PHONE: personalInfo.phone,
    LINKEDIN: personalInfo.linkedin,
    GITHUB: personalInfo.github,
    
    // Summary - use tailored summary
    SUMMARY: tailoredResume.summary || personalInfo.summary,
    
    // Skills - combine tailored skills with proper formatting
    SKILL_FULLSTACK: formatSkillList([
      ...(skills.languages || []),
      ...(skills.frameworks || [])
    ]),
    SKILL_CLOUD: formatSkillList([
      'AWS', 'Docker', 'Kubernetes', 'Terraform',
      ...(skills.tools || []).filter((t: string) => t.includes('AWS') || t.includes('Cloud'))
    ]),
    SKILL_API: formatSkillList([
      'RESTful APIs', 'GraphQL', 'gRPC', 'OAuth 2.0', 'JWT',
      ...(skills.technical || []).filter((t: string) => t.includes('API'))
    ]),
    SKILL_ARCHITECTURE: 'Microservices, Serverless, Event-Driven, LangGraph',
    SKILL_DATABASE: formatSkillList(skills.databases || personalInfo.skills?.databases || []),
    SKILL_MONITORING: 'New Relic, Datadog, CloudWatch, ELK, Open Telemetry, Grafana',
    SKILL_TESTING: 'Jest, Cypress, Postman, Jenkins, GitLab CI/CD, GitHub Actions',
    SKILL_AI: formatSkillList(skills.ai || ['AWS Bedrock', 'Vertex AI', 'RAG', 'NLP', 'OpenAI APIs']),
    CERTIFICATIONS: personalInfo.certifications || 'AWS AI Practitioner',
    
    // Experience 1 - merge with tailored bullets
    EXP1_TITLE: experience[0]?.title || 'Software Engineer II',
    EXP1_COMPANY: experience[0]?.company || '7-Eleven',
    EXP1_LOCATION: experience[0]?.location || 'Irving, TX',
    EXP1_DURATION: experience[0]?.duration || 'February 2024 – Present',
    EXP1_BULLETS: formatBullets(tailoredExp[0]?.achievements || experience[0]?.bullets || []),
    
    // Experience 2
    EXP2_TITLE: experience[1]?.title || 'Senior Software Engineer',
    EXP2_COMPANY: experience[1]?.company || 'Liberty Mutual Insurance',
    EXP2_LOCATION: experience[1]?.location || 'Boston, MA',
    EXP2_DURATION: experience[1]?.duration || 'February 2023 - February 2024',
    EXP2_BULLETS: formatBullets(tailoredExp[1]?.achievements || experience[1]?.bullets || []),
    
    // Experience 3
    EXP3_TITLE: experience[2]?.title || 'Software Engineer',
    EXP3_COMPANY: experience[2]?.company || 'Liberty Mutual Insurance',
    EXP3_LOCATION: experience[2]?.location || 'Boston, MA',
    EXP3_DURATION: experience[2]?.duration || 'January 2021 - February 2023',
    EXP3_BULLETS: formatBullets(tailoredExp[2]?.achievements || experience[2]?.bullets || []),
    
    // Education
    EDU_DEGREE: personalInfo.education?.degree || 'Master of Science in Computer Engineering',
    EDU_SCHOOL: personalInfo.education?.school || 'New York University',
    EDU_LOCATION: personalInfo.education?.location || 'New York, NY',
    EDU_GRADUATION: personalInfo.education?.year || 'May 2021'
  };
}

/**
 * Format skills into comma-separated list
 */
function formatSkillList(skills: string[]): string {
  // Remove duplicates and join
  const unique = [...new Set(skills)];
  return unique.join(', ');
}

/**
 * Format bullets with proper symbols
 */
function formatBullets(bullets: string[]): string {
  return bullets
    .map(bullet => `● ${bullet}`)
    .join('\n');
}

/**
 * Convert DOCX to PDF using LibreOffice
 */
async function convertToPDF(docxBuffer: Buffer): Promise<Buffer> {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'resume-'));
  const docxPath = path.join(tempDir, 'resume.docx');
  const pdfPath = path.join(tempDir, 'resume.pdf');
  
  try {
    // Write DOCX to temp file
    fs.writeFileSync(docxPath, docxBuffer);
    
    // Try different LibreOffice paths
    const commands = [
      `/Applications/LibreOffice.app/Contents/MacOS/soffice --headless --convert-to pdf --outdir ${tempDir} ${docxPath}`,
      `soffice --headless --convert-to pdf --outdir ${tempDir} ${docxPath}`,
      `libreoffice --headless --convert-to pdf --outdir ${tempDir} ${docxPath}`
    ];
    
    let success = false;
    for (const cmd of commands) {
      try {
        await execAsync(cmd);
        success = true;
        break;
      } catch (e) {
        // Try next command
        continue;
      }
    }
    
    if (!success) {
      throw new Error('LibreOffice not found. Please install LibreOffice for PDF conversion.');
    }
    
    // Read PDF
    const pdfBuffer = fs.readFileSync(pdfPath);
    return pdfBuffer;
    
  } finally {
    // Cleanup
    try {
      fs.unlinkSync(docxPath);
      fs.unlinkSync(pdfPath);
      fs.rmdirSync(tempDir);
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}