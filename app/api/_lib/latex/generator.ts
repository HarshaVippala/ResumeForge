/**
 * LaTeX Resume Generator for Jake's Resume Template
 * Created: 2025-01-10
 * Updated: 2025-01-10 - Added compatibility with Harsha's template system
 * 
 * Generates LaTeX code in Jake's Resume format from ResumeForge JSON
 */

import { ResumeContent } from '@/api/_lib/db/types';
import { processHarshaTemplate, ResumeData } from './HarshaLatexTemplate';
import { compileLatexToPdf } from './latex-pdf-compiler';

export class JakesResumeGenerator {
  private resume: ResumeContent;
  
  constructor(resume: ResumeContent) {
    this.resume = resume;
  }

  /**
   * Generate complete LaTeX document
   */
  generate(): string {
    return `%-------------------------
% Resume in Latex
% Based on: https://github.com/jakegut/resume
%------------------------

\\documentclass[letterpaper,11pt]{article}

\\usepackage{latexsym}
\\usepackage[empty]{fullpage}
\\usepackage{titlesec}
\\usepackage{marvosym}
\\usepackage[usenames,dvipsnames]{color}
\\usepackage{verbatim}
\\usepackage{enumitem}
\\usepackage[hidelinks]{hyperref}
\\usepackage{fancyhdr}
\\usepackage[english]{babel}
\\usepackage{tabularx}
\\input{glyphtounicode}

%----------FONT OPTIONS----------
% sans-serif
% \\usepackage[sfdefault]{FiraSans}
% \\usepackage[sfdefault]{roboto}
% \\usepackage[sfdefault]{noto-sans}
% \\usepackage[default]{sourcesanspro}

% serif
% \\usepackage{CormorantGaramond}
% \\usepackage{charter}

\\pagestyle{fancy}
\\fancyhf{} % clear all header and footer fields
\\fancyfoot{}
\\renewcommand{\\headrulewidth}{0pt}
\\renewcommand{\\footrulewidth}{0pt}

% Adjust margins
\\addtolength{\\oddsidemargin}{-0.5in}
\\addtolength{\\evensidemargin}{-0.5in}
\\addtolength{\\textwidth}{1in}
\\addtolength{\\topmargin}{-.5in}
\\addtolength{\\textheight}{1.0in}

\\urlstyle{same}

\\raggedbottom
\\raggedright
\\setlength{\\tabcolsep}{0in}

% Sections formatting
\\titleformat{\\section}{
  \\vspace{-4pt}\\scshape\\raggedright\\large
}{}{0em}{}[\\color{black}\\titlerule \\vspace{-5pt}]

% Ensure that generate pdf is machine readable/ATS parsable
\\pdfgentounicode=1

%-------------------------
% Custom commands
\\newcommand{\\resumeItem}[1]{
  \\item\\small{
    {#1 \\vspace{-2pt}}
  }
}

\\newcommand{\\resumeSubheading}[4]{
  \\vspace{-2pt}\\item
    \\begin{tabular*}{0.97\\textwidth}[t]{l@{\\extracolsep{\\fill}}r}
      \\textbf{#1} & #2 \\\\
      \\textit{\\small#3} & \\textit{\\small #4} \\\\
    \\end{tabular*}\\vspace{-7pt}
}

\\newcommand{\\resumeSubSubheading}[2]{
    \\item
    \\begin{tabular*}{0.97\\textwidth}{l@{\\extracolsep{\\fill}}r}
      \\textit{\\small#1} & \\textit{\\small #2} \\\\
    \\end{tabular*}\\vspace{-7pt}
}

\\newcommand{\\resumeProjectHeading}[2]{
    \\item
    \\begin{tabular*}{0.97\\textwidth}{l@{\\extracolsep{\\fill}}r}
      \\small#1 & #2 \\\\
    \\end{tabular*}\\vspace{-7pt}
}

\\newcommand{\\resumeSubItem}[1]{\\resumeItem{#1}\\vspace{-4pt}}

\\renewcommand\\labelitemii{$\\vcenter{\\hbox{\\tiny$\\bullet$}}$}

\\newcommand{\\resumeSubHeadingListStart}{\\begin{itemize}[leftmargin=0.15in, label={}]}
\\newcommand{\\resumeSubHeadingListEnd}{\\end{itemize}}
\\newcommand{\\resumeItemListStart}{\\begin{itemize}}
\\newcommand{\\resumeItemListEnd}{\\end{itemize}\\vspace{-5pt}}

%-------------------------------------------
%%%%%%  RESUME STARTS HERE  %%%%%%%%%%%%%%%%%%%%%%%%%%%%

\\begin{document}

${this.generateHeader()}

${this.generateEducation()}

${this.generateExperience()}

${this.generateProjects()}

${this.generateSkills()}

\\end{document}`;
  }

  /**
   * Generate header section
   */
  private generateHeader(): string {
    const { contact } = this.resume;
    
    // Clean and escape special characters
    const name = this.escapeLatex(contact.name);
    const email = contact.email;
    const phone = this.escapeLatex(contact.phone);
    const location = this.escapeLatex(contact.location || '');
    
    let header = `\\begin{center}
    \\textbf{\\Huge \\scshape ${name}} \\\\ \\vspace{1pt}
    \\small `;

    const parts = [];
    if (phone) parts.push(phone);
    if (email) parts.push(`\\href{mailto:${email}}{\\underline{${email}}}`);
    if (contact.linkedin) {
      const linkedinHandle = contact.linkedin.replace(/.*linkedin\.com\/in\//, '');
      parts.push(`\\href{https://${contact.linkedin}}{\\underline{linkedin.com/in/${linkedinHandle}}}`);
    }
    if (contact.github) {
      const githubHandle = contact.github.replace(/.*github\.com\//, '');
      parts.push(`\\href{https://${contact.github}}{\\underline{github.com/${githubHandle}}}`);
    }
    if (location) parts.push(location);

    header += parts.join(' $|$ ');
    header += `
\\end{center}`;

    return header;
  }

  /**
   * Generate education section
   */
  private generateEducation(): string {
    if (!this.resume.education || this.resume.education.length === 0) return '';

    let section = `\\section{Education}
  \\resumeSubHeadingListStart\n`;

    for (const edu of this.resume.education) {
      section += `    \\resumeSubheading
      {${this.escapeLatex(edu.school)}}{${this.escapeLatex(edu.location || '')}}
      {${this.escapeLatex(edu.degree)}}{${this.escapeLatex(edu.dates)}}`;
      
      if (edu.gpa || (edu.achievements && edu.achievements.length > 0)) {
        section += `\n      \\resumeItemListStart\n`;
        if (edu.gpa) {
          section += `        \\resumeItem{GPA: ${edu.gpa}}\n`;
        }
        if (edu.achievements) {
          for (const achievement of edu.achievements) {
            section += `        \\resumeItem{${this.escapeLatex(achievement)}}\n`;
          }
        }
        section += `      \\resumeItemListEnd\n`;
      }
    }

    section += `  \\resumeSubHeadingListEnd\n`;
    return section;
  }

  /**
   * Generate experience section
   */
  private generateExperience(): string {
    if (!this.resume.experience || this.resume.experience.length === 0) return '';

    let section = `\\section{Experience}
  \\resumeSubHeadingListStart\n`;

    for (const exp of this.resume.experience) {
      section += `\n    \\resumeSubheading
      {${this.escapeLatex(exp.title)}}{${this.escapeLatex(exp.dates)}}
      {${this.escapeLatex(exp.company)}}{${this.escapeLatex(exp.location || '')}}
      \\resumeItemListStart\n`;
      
      for (const bullet of exp.bullets) {
        section += `        \\resumeItem{${this.escapeLatex(bullet)}}\n`;
      }
      
      section += `      \\resumeItemListEnd\n`;
    }

    section += `\n  \\resumeSubHeadingListEnd\n`;
    return section;
  }

  /**
   * Generate projects section
   */
  private generateProjects(): string {
    if (!this.resume.projects || this.resume.projects.length === 0) return '';

    let section = `\\section{Projects}
    \\resumeSubHeadingListStart\n`;

    for (const project of this.resume.projects) {
      const techString = project.technologies ? project.technologies.join(', ') : '';
      section += `      \\resumeProjectHeading
          {\\textbf{${this.escapeLatex(project.name)}} $|$ \\emph{${this.escapeLatex(techString)}}}{}\n`;
      
      section += `          \\resumeItemListStart\n`;
      
      if (project.description) {
        section += `            \\resumeItem{${this.escapeLatex(project.description)}}\n`;
      }
      
      if (project.bullets) {
        for (const bullet of project.bullets) {
          section += `            \\resumeItem{${this.escapeLatex(bullet)}}\n`;
        }
      }
      
      section += `          \\resumeItemListEnd\n`;
    }

    section += `    \\resumeSubHeadingListEnd\n`;
    return section;
  }

  /**
   * Generate skills section
   */
  private generateSkills(): string {
    if (!this.resume.skills) return '';

    let section = `\\section{Technical Skills}
 \\begin{itemize}[leftmargin=0.15in, label={}]
    \\small{\\item{\n`;

    const skillLines = [];
    
    if (this.resume.skills.categories) {
      for (const category of this.resume.skills.categories) {
        const items = category.items.join(', ');
        skillLines.push(`     \\textbf{${this.escapeLatex(category.name)}}{: ${this.escapeLatex(items)}}`);
      }
    } else if (Array.isArray(this.resume.skills)) {
      // Handle flat skills array
      skillLines.push(`     \\textbf{Skills}{: ${this.escapeLatex(this.resume.skills.join(', '))}}`);
    }

    section += skillLines.join(' \\\\\n');
    section += `\n    }}
 \\end{itemize}`;

    return section;
  }

  /**
   * Escape special LaTeX characters
   */
  private escapeLatex(text: string): string {
    if (!text) return '';
    
    return text
      .replace(/\\/g, '\\textbackslash{}')
      .replace(/#/g, '\\#')
      .replace(/\$/g, '\\$')
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
 * Generate Jake's Resume LaTeX format
 */
export async function generateJakesResume(resume: ResumeContent): Promise<string> {
  const generator = new JakesResumeGenerator(resume);
  return generator.generate();
}

/**
 * Generate PDF using Harsha's template system
 */
export async function generateHarshaResumePDF(resumeData: ResumeData): Promise<Buffer> {
  const latexCode = processHarshaTemplate(resumeData);
  return await compileLatexToPdf(latexCode, 'harsha-resume');
}

/**
 * Convert ResumeContent to ResumeData format
 */
export function convertResumeContentToData(resume: ResumeContent): ResumeData {
  return {
    name: resume.contact?.name,
    email: resume.contact?.email,
    phone: resume.contact?.phone,
    linkedin: resume.contact?.linkedin,
    github: resume.contact?.github,
    location: resume.contact?.location,
    summary: resume.summary,
    experience: resume.experience?.map(exp => ({
      title: exp.title,
      company: exp.company,
      duration: exp.dates,
      location: exp.location,
      bullets: exp.bullets
    })),
    skills: resume.skills,
    education: resume.education?.map(edu => ({
      degree: edu.degree,
      school: edu.school,
      location: edu.location,
      dates: edu.dates,
      year: edu.year
    }))
  };
}