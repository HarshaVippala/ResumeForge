import { NextRequest, NextResponse } from 'next/server';
import { createSimpleResumePDF, createSimpleResumeDOCX } from '@/api/_lib/pdf';
import { processHarshaTemplate, ResumeData } from '@/api/_lib/latex/HarshaLatexTemplate';
import { compileLatexToPdf } from '@/api/_lib/latex/latex-pdf-compiler';

/**
 * Export resume directly from simple tailor results
 * POST /api/export-simple-resume
 * 
 * Expected payload:
 * {
 *   "tailored_resume": {...},  // The complete tailored resume object
 *   "company": "Google",
 *   "role": "Senior Software Engineer",
 *   "format": "pdf"  // "pdf" or "docx"
 * }
 */
export async function POST(
  req: NextRequest
) {
  try {
    const body = await req.json();
    const { tailored_resume, company, role, format = 'pdf' } = body;

    // Validate input
    if (!tailored_resume) {
      return NextResponse.json({ 
        error: 'Missing tailored_resume data' 
      }, { status: 400 });
    }

    const companyName = company || 'Company';
    const roleName = role || 'Position';

    console.log(`Exporting simple resume for: ${companyName} - ${roleName} as ${format}`);

    // Convert tailored resume to document format
    // Updated: 2025-01-09 - Use actual resume data instead of env vars
    const documentData = {
      name: tailored_resume.contact?.name || 'HARSHA VIPPALA',
      email: tailored_resume.contact?.email || 'harsha.vippala1@gmail.com',
      phone: tailored_resume.contact?.phone || '+1(929)620-7227',
      linkedin: tailored_resume.contact?.linkedin || 'linkedin.com/in/harsha-vippala',
      location: tailored_resume.contact?.location || 'Texas, USA',
      summary: tailored_resume.summary || '',
      experience: formatExperience(tailored_resume.experience || []),
      skills: formatSkills(tailored_resume.skills || {}),
      education: formatEducation(tailored_resume.education || []),
      targetCompany: companyName,
      targetRole: roleName
    };

    let fileBuffer: Buffer;
    let contentType: string;
    let fileName: string;

    if (format.toLowerCase() === 'pdf') {
      // Use LaTeX compilation for PDF generation
      try {
        const latexResumeData = convertToLatexFormat(tailored_resume);
        const latexCode = processHarshaTemplate(latexResumeData);
        fileBuffer = await compileLatexToPdf(latexCode, `${companyName}_${roleName}_Resume`);
        contentType = 'application/pdf';
        fileName = `${companyName}_${roleName}_Resume.pdf`;
      } catch (latexError) {
        console.warn('LaTeX compilation failed, falling back to PDF library:', latexError);
        // Fallback to the existing PDF generation
        fileBuffer = await createSimpleResumePDF(documentData);
        contentType = 'application/pdf';
        fileName = `${companyName}_${roleName}_Resume.pdf`;
      }
    } else if (format.toLowerCase() === 'docx') {
      fileBuffer = await createSimpleResumeDOCX(documentData);
      contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      fileName = `${companyName}_${roleName}_Resume.docx`;
    } else {
      return NextResponse.json({ 
        error: `Unsupported format: ${format}` 
      }, { status: 400 });
    }

    // Set headers for file download
    const headers = new Headers();
    headers.set('Content-Type', contentType);
    headers.set('Content-Disposition', `attachment; filename="${fileName}"`);
    headers.set('Content-Length', fileBuffer.length.toString());

    return new NextResponse(fileBuffer, { status: 200, headers });

  } catch (error) {
    console.error('Error in export-simple-resume:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }, { status: 500 });
  }
}

/**
 * Format experience section for document
 * Updated: 2025-01-09 - Use actual experience data
 */
function formatExperience(experience: any[]): any[] {
  return experience.map(exp => ({
    title: exp.title || exp.job_title,
    company: exp.company || exp.company_name,
    duration: exp.duration || exp.dates,
    bullets: exp.achievements || exp.experience_highlights || []
  }));
}

/**
 * Format skills for document
 * Updated: 2025-01-09 - Handle multiple skill formats
 */
function formatSkills(skills: any): string {
  // Handle different skill formats
  if (typeof skills === 'string') {
    return skills;
  }

  const skillCategories = [];
  
  // Check for categorized skills from base_resume_profile.json format
  if (skills.programming_languages || skills.languages) {
    const langs = skills.programming_languages || skills.languages;
    skillCategories.push(`Languages: ${Array.isArray(langs) ? langs.join(', ') : langs}`);
  }
  
  if (skills.frameworks_libraries_tools || skills.frameworks) {
    const frameworks = skills.frameworks_libraries_tools || skills.frameworks;
    skillCategories.push(`Frameworks: ${Array.isArray(frameworks) ? frameworks.join(', ') : frameworks}`);
  }
  
  if (skills.cloud_devops_tools || skills.tools) {
    const tools = skills.cloud_devops_tools || skills.tools;
    skillCategories.push(`Tools: ${Array.isArray(tools) ? tools.join(', ') : tools}`);
  }
  
  if (skills.databases) {
    skillCategories.push(`Databases: ${Array.isArray(skills.databases) ? skills.databases.join(', ') : skills.databases}`);
  }

  // If no categories found, try to format as a simple object
  if (skillCategories.length === 0 && typeof skills === 'object') {
    Object.entries(skills).forEach(([key, value]) => {
      if (Array.isArray(value) && value.length > 0) {
        const categoryName = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        skillCategories.push(`${categoryName}: ${value.join(', ')}`);
      }
    });
  }
  
  return skillCategories.join(' • ') || 'Various technical skills';
}

/**
 * Format education data
 * Updated: 2025-01-09 - Use actual education data
 */
function formatEducation(education: any[]): any {
  if (education && education.length > 0) {
    const latest = education[0];
    return {
      degree: latest.degree,
      school: latest.institution || latest.school,
      year: latest.year
    };
  }
  
  // Fallback to default
  return {
    degree: 'Master of Science in Computer Engineering',
    school: 'New York University',
    year: '2021'
  };
}

/**
 * Convert tailored resume to LaTeX format
 * Updated: 2025-01-10 - Added for LaTeX template processing
 */
function convertToLatexFormat(tailored_resume: any): ResumeData {
  return {
    name: tailored_resume.contact?.name || 'HARSHA VIPPALA',
    email: tailored_resume.contact?.email || 'harsha.vippala1@gmail.com',
    phone: tailored_resume.contact?.phone || '+1(929)620-7227',
    linkedin: tailored_resume.contact?.linkedin || 'linkedin.com/in/harsha-vippala',
    github: tailored_resume.contact?.github || 'github.com/harsha-vippala',
    location: tailored_resume.contact?.location || 'Texas, USA',
    summary: tailored_resume.summary || '',
    experience: formatExperienceForLatex(tailored_resume.experience || []),
    skills: tailored_resume.skills || {},
    education: formatEducationForLatex(tailored_resume.education || [])
  };
}

/**
 * Format experience for LaTeX template
 * Updated: 2025-01-10 - Added for LaTeX template processing
 */
function formatExperienceForLatex(experience: any[]): any[] {
  return experience.map(exp => ({
    title: exp.title || exp.job_title,
    company: exp.company || exp.company_name,
    duration: exp.duration || exp.dates,
    location: exp.location || '',
    bullets: exp.achievements || exp.experience_highlights || []
  }));
}

/**
 * Format education for LaTeX template
 * Updated: 2025-01-10 - Added for LaTeX template processing
 */
function formatEducationForLatex(education: any[]): any[] {
  return education.map(edu => ({
    degree: edu.degree,
    school: edu.institution || edu.school,
    location: edu.location || '',
    dates: edu.dates || edu.year,
    year: edu.year
  }));
} 