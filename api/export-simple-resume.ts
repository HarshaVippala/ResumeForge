import { VercelRequest, VercelResponse } from '@vercel/node';
import { createSimpleResumePDF, createSimpleResumeDOCX } from './_lib/pdf';

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
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { tailored_resume, company, role, format = 'pdf' } = req.body;

    // Validate input
    if (!tailored_resume) {
      return res.status(400).json({ 
        error: 'Missing tailored_resume data' 
      });
    }

    const companyName = company || 'Company';
    const roleName = role || 'Position';

    console.log(`Exporting simple resume for: ${companyName} - ${roleName} as ${format}`);

    // Convert tailored resume to document format
    const documentData = {
      name: process.env.USER_NAME || 'Your Name',
      email: process.env.USER_EMAIL || 'your.email@example.com',
      phone: process.env.USER_PHONE || '(555) 123-4567',
      linkedin: process.env.USER_LINKEDIN || 'linkedin.com/in/yourprofile',
      location: process.env.USER_LOCATION || 'City, State',
      summary: tailored_resume.summary || '',
      experience: formatExperience(tailored_resume.experience || []),
      skills: formatSkills(tailored_resume.skills || {}),
      education: getEducation(),
      targetCompany: companyName,
      targetRole: roleName
    };

    let fileBuffer: Buffer;
    let contentType: string;
    let fileName: string;

    if (format.toLowerCase() === 'pdf') {
      fileBuffer = await createSimpleResumePDF(documentData);
      contentType = 'application/pdf';
      fileName = `${companyName}_${roleName}_Resume.pdf`;
    } else if (format.toLowerCase() === 'docx') {
      fileBuffer = await createSimpleResumeDOCX(documentData);
      contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      fileName = `${companyName}_${roleName}_Resume.docx`;
    } else {
      return res.status(400).json({ 
        error: `Unsupported format: ${format}` 
      });
    }

    // Set headers for file download
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', fileBuffer.length);

    return res.status(200).send(fileBuffer);

  } catch (error) {
    console.error('Error in export-simple-resume:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    });
  }
}

/**
 * Format experience section for document
 */
function formatExperience(experience: any[]): any[] {
  // Get base experience from environment or use defaults
  const baseExperience = getBaseExperience();
  
  // If we have tailored experience, use the first one's bullets for the current role
  if (experience.length > 0 && experience[0].achievements) {
    baseExperience[0].bullets = experience[0].achievements;
  }
  
  return baseExperience;
}

/**
 * Format skills for document
 */
function formatSkills(skills: any): string {
  const skillCategories = [];
  
  if (skills.languages?.length) {
    skillCategories.push(`Languages: ${skills.languages.join(', ')}`);
  }
  if (skills.frameworks?.length) {
    skillCategories.push(`Frameworks: ${skills.frameworks.join(', ')}`);
  }
  if (skills.tools?.length) {
    skillCategories.push(`Tools: ${skills.tools.join(', ')}`);
  }
  if (skills.technical?.length) {
    skillCategories.push(`Technical: ${skills.technical.join(', ')}`);
  }
  
  return skillCategories.join(' • ');
}

/**
 * Get base experience data
 */
function getBaseExperience(): any[] {
  // This would typically come from database or env
  // Simplified for personal use
  return [
    {
      title: 'Senior Software Engineer',
      company: 'Current Company',
      duration: '2020 - Present',
      bullets: [
        'Led development of microservices architecture',
        'Implemented CI/CD pipelines',
        'Mentored junior developers'
      ]
    },
    {
      title: 'Software Engineer',
      company: 'Previous Company',
      duration: '2018 - 2020',
      bullets: [
        'Developed full-stack web applications',
        'Optimized database performance',
        'Collaborated with cross-functional teams'
      ]
    }
  ];
}

/**
 * Get education data
 */
function getEducation(): any {
  // This would typically come from database or env
  return {
    degree: 'Bachelor of Science in Computer Science',
    school: 'University Name',
    year: '2018'
  };
}