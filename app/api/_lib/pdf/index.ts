import jsPDF from 'jspdf';

export interface ResumeData {
  name: string;
  email: string;
  phone: string;
  linkedin: string;
  location: string;
  summary: string;
  experience: Array<{
    title: string;
    company: string;
    duration: string;
    bullets: string[];
  }>;
  skills: string;
  education: {
    degree: string;
    school: string;
    year: string;
  };
  targetCompany: string;
  targetRole: string;
}

/**
 * Create a simple PDF resume using jsPDF
 * For personal use - single page, clean format
 * 
 * Note: This is used as a fallback when LaTeX compilation is not available.
 * The primary PDF generation method is now LaTeX-based (see /api/_lib/latex/)
 * 
 * Updated: 2025-01-10 - Added LaTeX fallback note
 */
export async function createSimpleResumePDF(data: ResumeData): Promise<Buffer> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4'
  });

  const margin = 40;
  const pageWidth = doc.internal.pageSize.width;
  const contentWidth = pageWidth - (2 * margin);
  let yPosition = margin;

  // Helper function to add text with word wrap
  const addText = (text: string, fontSize: number, isBold: boolean = false) => {
    doc.setFontSize(fontSize);
    if (isBold) {
      doc.setFont('helvetica', 'bold');
    } else {
      doc.setFont('helvetica', 'normal');
    }
    
    const lines = doc.splitTextToSize(text, contentWidth);
    doc.text(lines, margin, yPosition);
    yPosition += lines.length * fontSize * 1.2;
  };

  // Header - Name and Contact
  addText(data.name, 24, true);
  yPosition += 5;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const contactInfo = `${data.email} • ${data.phone} • ${data.location} • ${data.linkedin}`;
  doc.text(contactInfo, margin, yPosition);
  yPosition += 20;

  // Divider
  doc.setLineWidth(0.5);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 15;

  // Professional Summary
  addText('PROFESSIONAL SUMMARY', 12, true);
  yPosition += 5;
  addText(data.summary, 10);
  yPosition += 15;

  // Experience
  addText('EXPERIENCE', 12, true);
  yPosition += 5;

  for (const exp of data.experience) {
    // Job title and company
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(exp.title, margin, yPosition);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const durationWidth = doc.getTextWidth(exp.duration);
    doc.text(exp.duration, pageWidth - margin - durationWidth, yPosition);
    yPosition += 14;

    doc.setFont('helvetica', 'italic');
    doc.text(exp.company, margin, yPosition);
    yPosition += 14;

    // Bullets
    doc.setFont('helvetica', 'normal');
    for (const bullet of exp.bullets) {
      const bulletText = `• ${bullet}`;
      const lines = doc.splitTextToSize(bulletText, contentWidth - 15);
      doc.text(lines, margin + 10, yPosition);
      yPosition += lines.length * 12;
    }
    yPosition += 10;
  }

  // Skills
  addText('TECHNICAL SKILLS', 12, true);
  yPosition += 5;
  addText(data.skills, 10);
  yPosition += 15;

  // Education
  addText('EDUCATION', 12, true);
  yPosition += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(data.education.degree, margin, yPosition);
  yPosition += 12;
  doc.setFont('helvetica', 'normal');
  doc.text(`${data.education.school}, ${data.education.year}`, margin, yPosition);

  // Convert to buffer
  const pdfOutput = doc.output('arraybuffer');
  return Buffer.from(pdfOutput);
}

/**
 * Create a simple DOCX resume
 * This is a placeholder - in production, use a proper DOCX library
 */
export async function createSimpleResumeDOCX(data: ResumeData): Promise<Buffer> {
  // For now, return a simple text representation
  // In production, use libraries like docx or PizZip
  const content = `
${data.name}
${data.email} • ${data.phone} • ${data.location} • ${data.linkedin}

PROFESSIONAL SUMMARY
${data.summary}

EXPERIENCE
${data.experience.map(exp => `
${exp.title} | ${exp.duration}
${exp.company}
${exp.bullets.map(b => `• ${b}`).join('\n')}
`).join('\n')}

TECHNICAL SKILLS
${data.skills}

EDUCATION
${data.education.degree}
${data.education.school}, ${data.education.year}
  `.trim();

  return Buffer.from(content, 'utf-8');
}