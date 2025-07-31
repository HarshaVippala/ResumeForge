import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/api/_lib/db';
import { createSimpleResumePDF, createSimpleResumeDOCX } from '@/api/_lib/pdf';

/**
 * Export resume from database by ID
 * GET /api/resume/[id]/export?format=pdf
 * 
 * Updated: 2025-01-09 - Export saved resumes from database
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const resumeId = params.id;
    const searchParams = req.nextUrl.searchParams;
    const format = searchParams.get('format') || 'pdf';

    console.log(`📄 Exporting resume ${resumeId} as ${format}`);

    // Fetch resume from database
    const db = getSupabase();
    const { data: resume, error } = await db
      .from('resumes')
      .select('*')
      .eq('id', resumeId)
      .single();

    if (error || !resume) {
      console.error('Resume not found:', error);
      return NextResponse.json({ 
        error: 'Resume not found' 
      }, { status: 404 });
    }

    // Extract resume content
    const resumeContent = resume.content;
    if (!resumeContent) {
      return NextResponse.json({ 
        error: 'Resume has no content' 
      }, { status: 400 });
    }

    // Parse company and role from name (format: "Company - Role")
    const [company, role] = resume.name.split(' - ').map(s => s.trim());

    // Format the resume data for PDF/DOCX generation
    const documentData = {
      name: resumeContent.contact?.name || 'HARSHA VIPPALA',
      email: resumeContent.contact?.email || 'harsha.vippala1@gmail.com',
      phone: resumeContent.contact?.phone || '+1(929)620-7227',
      linkedin: resumeContent.contact?.linkedin || 'linkedin.com/in/harsha-vippala',
      location: resumeContent.contact?.location || 'Texas, USA',
      summary: resumeContent.summary || '',
      experience: formatExperience(resumeContent.experience || []),
      skills: formatSkills(resumeContent.skills || {}),
      education: formatEducation(resumeContent.education || []),
      targetCompany: company || 'Company',
      targetRole: role || 'Position'
    };

    let fileBuffer: Buffer;
    let contentType: string;
    let fileName: string;

    if (format.toLowerCase() === 'pdf') {
      fileBuffer = await createSimpleResumePDF(documentData);
      contentType = 'application/pdf';
      fileName = `${company}_${role}_Resume.pdf`.replace(/[^a-zA-Z0-9_\-.]/g, '_');
    } else if (format.toLowerCase() === 'docx') {
      fileBuffer = await createSimpleResumeDOCX(documentData);
      contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      fileName = `${company}_${role}_Resume.docx`.replace(/[^a-zA-Z0-9_\-.]/g, '_');
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
    headers.set('Cache-Control', 'no-cache');

    console.log(`✅ Exported ${fileName} (${fileBuffer.length} bytes)`);

    return new NextResponse(fileBuffer, { status: 200, headers });

  } catch (error) {
    console.error('Error exporting resume:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Export failed' 
    }, { status: 500 });
  }
}

/**
 * Format experience section for document
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
 */
function formatSkills(skills: any): string {
  // Handle different skill formats
  if (typeof skills === 'string') {
    return skills;
  }

  const skillCategories = [];
  
  // Check for categorized skills
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
 */
function formatEducation(education: any[]): any {
  if (education.length > 0) {
    const latest = education[0];
    return {
      degree: latest.degree,
      school: latest.institution,
      year: latest.year
    };
  }
  
  // Fallback
  return {
    degree: 'Master of Science in Computer Engineering',
    school: 'New York University',
    year: '2021'
  };
}