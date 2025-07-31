/**
 * LaTeX Resume Parser for Jake's Resume Template
 * Created: 2025-01-10
 * 
 * Parses LaTeX resume format into ResumeForge JSON structure
 */

import { ResumeContent } from '@/api/_lib/db/types';

interface LaTeXSection {
  type: string;
  content: string;
  children?: LaTeXSection[];
}

export class JakesResumeParser {
  private latex: string;
  
  constructor(latexContent: string) {
    this.latex = latexContent;
  }

  /**
   * Parse LaTeX resume into ResumeForge JSON format
   */
  parse(): ResumeContent {
    const resume: ResumeContent = {
      contact: this.extractContact(),
      summary: this.extractSummary(),
      experience: this.extractExperience(),
      education: this.extractEducation(),
      skills: this.extractSkills(),
      projects: this.extractProjects(),
      certifications: this.extractCertifications()
    };

    return resume;
  }

  /**
   * Extract contact information from header
   */
  private extractContact(): ResumeContent['contact'] {
    // Pattern for Jake's resume header format
    const namePattern = /\\begin{center}\s*\\textbf\{\\Huge\s+\\scshape\s+([^}]+)\}/;
    const emailPattern = /\\href\{mailto:([^}]+)\}/;
    const phonePattern = /\\small\s*([+\d\s()-]+)\s*~/;
    const linkedinPattern = /\\href\{https:\/\/linkedin\.com\/in\/([^}]+)\}/;
    const githubPattern = /\\href\{https:\/\/github\.com\/([^}]+)\}/;
    
    const nameMatch = this.latex.match(namePattern);
    const emailMatch = this.latex.match(emailPattern);
    const phoneMatch = this.latex.match(phonePattern);
    const linkedinMatch = this.latex.match(linkedinPattern);
    const githubMatch = this.latex.match(githubPattern);

    return {
      name: nameMatch?.[1]?.trim() || '',
      email: emailMatch?.[1]?.trim() || '',
      phone: phoneMatch?.[1]?.trim() || '',
      linkedin: linkedinMatch ? `linkedin.com/in/${linkedinMatch[1]}` : '',
      github: githubMatch ? `github.com/${githubMatch[1]}` : '',
      location: this.extractLocation()
    };
  }

  /**
   * Extract location from header
   */
  private extractLocation(): string {
    const locationPattern = /\\faMapMarker\*?\s*([^~]+)~/;
    const match = this.latex.match(locationPattern);
    return match?.[1]?.trim() || '';
  }

  /**
   * Extract summary/objective section
   */
  private extractSummary(): string {
    const summaryPattern = /\\section\{(?:Summary|Objective)\}([\s\S]*?)(?=\\section|$)/;
    const match = this.latex.match(summaryPattern);
    
    if (match) {
      return this.cleanLatexText(match[1]);
    }
    
    return '';
  }

  /**
   * Extract experience section
   */
  private extractExperience(): ResumeContent['experience'] {
    const experiencePattern = /\\section\{Experience\}([\s\S]*?)(?=\\section|$)/;
    const match = this.latex.match(experiencePattern);
    
    if (!match) return [];

    const experiences = [];
    const itemPattern = /\\resumeSubheading\{([^}]+)\}\{([^}]+)\}\{([^}]+)\}\{([^}]+)\}([\s\S]*?)(?=\\resumeSubheading|\\resumeSubHeadingListEnd)/g;
    
    let expMatch;
    while ((expMatch = itemPattern.exec(match[1])) !== null) {
      const bullets = this.extractBullets(expMatch[5]);
      
      experiences.push({
        company: expMatch[2].trim(),
        title: expMatch[1].trim(),
        dates: expMatch[4].trim(),
        location: expMatch[3].trim(),
        bullets: bullets
      });
    }

    return experiences;
  }

  /**
   * Extract bullet points from a section
   */
  private extractBullets(content: string): string[] {
    const bullets: string[] = [];
    const bulletPattern = /\\resumeItem\{([^}]+)\}/g;
    
    let match;
    while ((match = bulletPattern.exec(content)) !== null) {
      bullets.push(this.cleanLatexText(match[1]));
    }

    return bullets;
  }

  /**
   * Extract education section
   */
  private extractEducation(): ResumeContent['education'] {
    const educationPattern = /\\section\{Education\}([\s\S]*?)(?=\\section|$)/;
    const match = this.latex.match(educationPattern);
    
    if (!match) return [];

    const education = [];
    const itemPattern = /\\resumeSubheading\{([^}]+)\}\{([^}]+)\}\{([^}]+)\}\{([^}]+)\}/g;
    
    let eduMatch;
    while ((eduMatch = itemPattern.exec(match[1])) !== null) {
      education.push({
        degree: eduMatch[1].trim(),
        school: eduMatch[2].trim(),
        location: eduMatch[3].trim(),
        dates: eduMatch[4].trim(),
        gpa: this.extractGPA(match[1]),
        achievements: []
      });
    }

    return education;
  }

  /**
   * Extract GPA if present
   */
  private extractGPA(content: string): string | undefined {
    const gpaPattern = /GPA:\s*([\d.]+)/;
    const match = content.match(gpaPattern);
    return match?.[1];
  }

  /**
   * Extract skills section
   */
  private extractSkills(): ResumeContent['skills'] {
    const skillsPattern = /\\section\{Technical Skills\}([\s\S]*?)(?=\\section|$)/;
    const match = this.latex.match(skillsPattern);
    
    if (!match) return { categories: [] };

    const categories = [];
    const categoryPattern = /\\textbf\{([^}]+)\}\s*:\s*([^\\]+)/g;
    
    let catMatch;
    while ((catMatch = categoryPattern.exec(match[1])) !== null) {
      const items = catMatch[2]
        .split(',')
        .map(item => this.cleanLatexText(item))
        .filter(item => item.length > 0);
      
      categories.push({
        name: catMatch[1].trim(),
        items: items
      });
    }

    return { categories };
  }

  /**
   * Extract projects section
   */
  private extractProjects(): ResumeContent['projects'] {
    const projectsPattern = /\\section\{Projects\}([\s\S]*?)(?=\\section|$)/;
    const match = this.latex.match(projectsPattern);
    
    if (!match) return [];

    const projects = [];
    const projectPattern = /\\resumeProjectHeading\{([^}]+)\}\{([^}]+)\}([\s\S]*?)(?=\\resumeProjectHeading|\\resumeSubHeadingListEnd)/g;
    
    let projMatch;
    while ((projMatch = projectPattern.exec(match[1])) !== null) {
      const titleTechMatch = projMatch[1].match(/\\textbf\{([^}]+)\}\s*\|\s*\\emph\{([^}]+)\}/);
      const bullets = this.extractBullets(projMatch[3]);
      
      if (titleTechMatch) {
        projects.push({
          name: titleTechMatch[1].trim(),
          technologies: titleTechMatch[2].split(',').map(t => t.trim()),
          description: bullets[0] || '',
          bullets: bullets.slice(1),
          link: ''
        });
      }
    }

    return projects;
  }

  /**
   * Extract certifications if present
   */
  private extractCertifications(): string[] {
    const certPattern = /\\section\{Certifications?\}([\s\S]*?)(?=\\section|$)/;
    const match = this.latex.match(certPattern);
    
    if (!match) return [];

    const certs: string[] = [];
    const itemPattern = /\\item\s+([^\n]+)/g;
    
    let certMatch;
    while ((certMatch = itemPattern.exec(match[1])) !== null) {
      certs.push(this.cleanLatexText(certMatch[1]));
    }

    return certs;
  }

  /**
   * Clean LaTeX text by removing commands and special characters
   */
  private cleanLatexText(text: string): string {
    return text
      .replace(/\\textbf\{([^}]+)\}/g, '$1')
      .replace(/\\emph\{([^}]+)\}/g, '$1')
      .replace(/\\underline\{([^}]+)\}/g, '$1')
      .replace(/\\\w+/g, '') // Remove other LaTeX commands
      .replace(/~/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

/**
 * Helper function to parse Jake's Resume LaTeX format
 */
export async function parseJakesResume(latexContent: string): Promise<ResumeContent> {
  const parser = new JakesResumeParser(latexContent);
  return parser.parse();
}