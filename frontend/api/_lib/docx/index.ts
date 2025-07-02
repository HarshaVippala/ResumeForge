import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import fs from 'fs';
import path from 'path';

export interface DocxResumeData {
  // Header
  name: string;
  email: string;
  phone: string;
  linkedin: string;
  github: string;
  
  // Summary
  summary: string;
  
  // Skills (organized by category)
  skills: {
    fullStackDevelopment: string;
    cloudDevOps: string;
    apisIntegration: string;
    architectureDesign: string;
    databasesStorage: string;
    monitoringObservability: string;
    testingCICD: string;
    generativeAIML: string;
    certifications: string;
  };
  
  // Experience (array of jobs)
  experience: Array<{
    title: string;
    company: string;
    location: string;
    duration: string;
    bullets: string[]; // Array of achievement bullets
  }>;
  
  // Education
  education: {
    degree: string;
    school: string;
    location: string;
    graduation: string;
  };
}

/**
 * Generate a resume using the DOCX template
 * This preserves the exact formatting from the template
 */
export async function generateResumeFromTemplate(data: DocxResumeData): Promise<Buffer> {
  try {
    // Load the template
    const templatePath = path.join(process.cwd(), 'backend/data/placeholder_resume.docx');
    const content = fs.readFileSync(templatePath, 'binary');
    
    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });
    
    // Prepare data for template
    const templateData = {
      // Header info
      name: data.name.toUpperCase(),
      email: data.email,
      phone: data.phone,
      linkedin: data.linkedin,
      github: data.github,
      
      // Summary
      summary: data.summary,
      
      // Skills - each as a separate field
      skill_fullstack: data.skills.fullStackDevelopment,
      skill_cloud: data.skills.cloudDevOps,
      skill_apis: data.skills.apisIntegration,
      skill_architecture: data.skills.architectureDesign,
      skill_databases: data.skills.databasesStorage,
      skill_monitoring: data.skills.monitoringObservability,
      skill_testing: data.skills.testingCICD,
      skill_ai: data.skills.generativeAIML,
      skill_certifications: data.skills.certifications,
      
      // Experience - format for template
      experiences: data.experience.map(exp => ({
        title: exp.title,
        company: exp.company,
        location: exp.location,
        duration: exp.duration,
        // Join bullets with proper formatting
        bullets: exp.bullets.map(bullet => ({ text: bullet }))
      })),
      
      // Education
      edu_degree: data.education.degree,
      edu_school: data.education.school,
      edu_location: data.education.location,
      edu_graduation: data.education.graduation
    };
    
    // Render the document
    doc.render(templateData);
    
    // Get the generated document as a buffer
    const buf = doc.getZip().generate({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    });
    
    return buf;
  } catch (error) {
    console.error('Error generating DOCX:', error);
    throw new Error(`Failed to generate resume from template: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Convert tailored resume data to DOCX template format
 */
export function convertToDocxFormat(
  tailoredResume: any,
  personalInfo: any,
  targetCompany: string,
  targetRole: string
): DocxResumeData {
  // Extract and organize skills by category
  const skills = tailoredResume.skills || {};
  
  return {
    // Header - from personal info
    name: personalInfo.name || process.env.USER_NAME || 'Your Name',
    email: personalInfo.email || process.env.USER_EMAIL || 'email@example.com',
    phone: personalInfo.phone || process.env.USER_PHONE || '(555) 123-4567',
    linkedin: personalInfo.linkedin || process.env.USER_LINKEDIN || 'linkedin.com/in/profile',
    github: personalInfo.github || process.env.USER_GITHUB || 'github.com/username',
    
    // Summary - tailored for the role
    summary: tailoredResume.summary || '',
    
    // Skills - organized by your resume categories
    skills: {
      fullStackDevelopment: formatSkillsList(skills.languages, skills.frameworks),
      cloudDevOps: formatSkillsList(skills.cloud, skills.devops),
      apisIntegration: formatSkillsList(skills.apis, skills.integration),
      architectureDesign: formatSkillsList(skills.architecture, skills.design),
      databasesStorage: formatSkillsList(skills.databases, skills.storage),
      monitoringObservability: formatSkillsList(skills.monitoring, skills.observability),
      testingCICD: formatSkillsList(skills.testing, skills.cicd),
      generativeAIML: formatSkillsList(skills.ai, skills.ml),
      certifications: skills.certifications?.join(', ') || personalInfo.certifications || ''
    },
    
    // Experience - merge tailored bullets with base experience
    experience: mergeExperienceData(personalInfo.experience, tailoredResume.experience),
    
    // Education - from personal info
    education: personalInfo.education || {
      degree: 'Bachelor of Science in Computer Science',
      school: 'University Name',
      location: 'City, State',
      graduation: 'May 2020'
    }
  };
}

/**
 * Format skills lists into comma-separated strings
 */
function formatSkillsList(...skillArrays: string[][]): string {
  const allSkills = skillArrays
    .filter(arr => arr && arr.length > 0)
    .flat()
    .filter((skill, index, self) => self.indexOf(skill) === index); // Remove duplicates
  
  return allSkills.join(', ');
}

/**
 * Merge base experience with tailored achievements
 */
function mergeExperienceData(baseExperience: any[], tailoredExperience: any[]): any[] {
  if (!baseExperience || baseExperience.length === 0) {
    // If no base experience, use default structure
    return [{
      title: 'Software Engineer',
      company: 'Current Company',
      location: 'City, State',
      duration: '2020 - Present',
      bullets: tailoredExperience?.[0]?.achievements || [
        'Led development of key features',
        'Improved system performance',
        'Collaborated with cross-functional teams'
      ]
    }];
  }
  
  // Merge tailored achievements into base experience
  return baseExperience.map((job, index) => ({
    title: job.title,
    company: job.company,
    location: job.location,
    duration: job.duration,
    // Use tailored bullets if available, otherwise use base bullets
    bullets: tailoredExperience?.[index]?.achievements || job.bullets || []
  }));
}