/**
 * ATS Scoring Service
 * Implements Resume Matcher's ATS scoring algorithm
 * Created: 2025-01-09
 */

export interface ATSScore {
  totalScore: number;
  breakdown: {
    keywordMatch: number;
    formatting: number;
    readability: number;
    sectionPresence: number;
  };
  recommendations: string[];
  missingKeywords: string[];
  keywordCoverage: number;
}

export interface SectionCheck {
  section: string;
  present: boolean;
  quality: 'good' | 'needs_improvement' | 'missing';
}

export class ATSScorer {
  private readonly requiredSections = [
    'summary',
    'experience',
    'skills',
    'education'
  ];

  private readonly optionalSections = [
    'certifications',
    'projects',
    'achievements'
  ];

  /**
   * Calculate comprehensive ATS score
   * Based on Resume Matcher's approach
   */
  calculateATSScore(
    resume: any,
    jobKeywords: string[],
    jobDescription: string
  ): ATSScore {
    const scores = {
      keywordMatch: this.calculateKeywordScore(resume, jobKeywords),
      formatting: this.calculateFormattingScore(resume),
      readability: this.calculateReadabilityScore(resume),
      sectionPresence: this.calculateSectionScore(resume)
    };

    // Weight the scores (Resume Matcher approach)
    const weights = {
      keywordMatch: 0.4,    // 40% - Most important for ATS
      formatting: 0.2,      // 20% - Clean format matters
      readability: 0.2,     // 20% - Length and clarity
      sectionPresence: 0.2  // 20% - Having right sections
    };

    const totalScore = Object.entries(scores).reduce((total, [key, score]) => {
      return total + (score * weights[key as keyof typeof weights]);
    }, 0);

    const recommendations = this.generateRecommendations(scores, resume, jobKeywords);
    const missingKeywords = this.findMissingKeywords(resume, jobKeywords);

    return {
      totalScore: Math.round(totalScore),
      breakdown: scores,
      recommendations,
      missingKeywords,
      keywordCoverage: scores.keywordMatch
    };
  }

  /**
   * Calculate keyword matching score
   */
  private calculateKeywordScore(resume: any, keywords: string[]): number {
    if (keywords.length === 0) return 100;

    const resumeText = this.resumeToText(resume).toLowerCase();
    let matchedCount = 0;
    let totalWeight = 0;

    keywords.forEach(keyword => {
      const keywordLower = keyword.toLowerCase();
      const matches = (resumeText.match(new RegExp(`\\b${keywordLower}\\b`, 'g')) || []).length;
      
      if (matches > 0) {
        // Give higher weight to keywords that appear multiple times (up to a limit)
        const weight = Math.min(matches, 3); // Cap at 3 to avoid keyword stuffing
        matchedCount += weight;
      }
      totalWeight += 3; // Max possible weight per keyword
    });

    return Math.round((matchedCount / totalWeight) * 100);
  }

  /**
   * Calculate formatting score
   */
  private calculateFormattingScore(resume: any): number {
    let score = 100;

    // Check for ATS-friendly formatting
    const resumeText = this.resumeToText(resume);

    // Penalize special characters that might confuse ATS
    const specialChars = resumeText.match(/[↗→◆▪►❖]/g) || [];
    if (specialChars.length > 5) {
      score -= 10;
    }

    // Check for tables or columns (bad for ATS)
    if (resumeText.includes('|') || resumeText.includes('│')) {
      score -= 15;
    }

    // Check for consistent bullet points
    const bullets = resumeText.match(/^[\•\-\*]\s/gm) || [];
    if (bullets.length < 3) {
      score -= 10; // Too few bullet points
    }

    // Check section headers
    const hasProperHeaders = this.requiredSections.every(section => 
      resumeText.toLowerCase().includes(section)
    );
    if (!hasProperHeaders) {
      score -= 20;
    }

    return Math.max(score, 0);
  }

  /**
   * Calculate readability score
   */
  private calculateReadabilityScore(resume: any): number {
    const resumeText = this.resumeToText(resume);
    const words = resumeText.split(/\s+/).filter(w => w.length > 0);
    const sentences = resumeText.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    let score = 100;

    // Check word count (ideal: 400-600 words for 1 page)
    if (words.length < 300) {
      score -= 20; // Too short
    } else if (words.length > 700) {
      score -= 15; // Too long
    }

    // Check average sentence length (ideal: 15-20 words)
    const avgSentenceLength = words.length / sentences.length;
    if (avgSentenceLength > 25) {
      score -= 10; // Sentences too long
    }

    // Check for action verbs in experience section
    const actionVerbs = ['led', 'managed', 'developed', 'implemented', 'created', 
                        'designed', 'built', 'improved', 'achieved', 'delivered'];
    const actionVerbCount = actionVerbs.filter(verb => 
      resumeText.toLowerCase().includes(verb)
    ).length;
    
    if (actionVerbCount < 3) {
      score -= 10; // Not enough action verbs
    }

    return Math.max(score, 0);
  }

  /**
   * Calculate section presence score
   */
  private calculateSectionScore(resume: any): number {
    let score = 0;
    const maxScore = 100;
    const requiredWeight = 60 / this.requiredSections.length;
    const optionalWeight = 40 / this.optionalSections.length;

    // Check required sections
    this.requiredSections.forEach(section => {
      if (this.hasSection(resume, section)) {
        score += requiredWeight;
      }
    });

    // Check optional sections
    this.optionalSections.forEach(section => {
      if (this.hasSection(resume, section)) {
        score += optionalWeight;
      }
    });

    return Math.min(Math.round(score), maxScore);
  }

  /**
   * Generate recommendations based on scores
   */
  private generateRecommendations(
    scores: ATSScore['breakdown'],
    resume: any,
    keywords: string[]
  ): string[] {
    const recommendations: string[] = [];

    // Keyword recommendations
    if (scores.keywordMatch < 70) {
      recommendations.push('Add more relevant keywords from the job description');
      const missing = this.findMissingKeywords(resume, keywords).slice(0, 5);
      if (missing.length > 0) {
        recommendations.push(`Consider adding: ${missing.join(', ')}`);
      }
    }

    // Formatting recommendations
    if (scores.formatting < 80) {
      recommendations.push('Use standard section headers (Experience, Skills, Education)');
      recommendations.push('Avoid tables, columns, or special characters');
      recommendations.push('Use simple bullet points (• or -) for lists');
    }

    // Readability recommendations
    if (scores.readability < 80) {
      const resumeText = this.resumeToText(resume);
      const wordCount = resumeText.split(/\s+/).length;
      
      if (wordCount > 700) {
        recommendations.push('Reduce content to fit on one page (aim for 500-600 words)');
      } else if (wordCount < 300) {
        recommendations.push('Add more detail to your experiences and achievements');
      }
      
      recommendations.push('Start bullet points with strong action verbs');
    }

    // Section recommendations
    if (scores.sectionPresence < 80) {
      const missing = this.requiredSections.filter(section => 
        !this.hasSection(resume, section)
      );
      if (missing.length > 0) {
        recommendations.push(`Add missing sections: ${missing.join(', ')}`);
      }
    }

    return recommendations;
  }

  /**
   * Find keywords missing from resume
   */
  private findMissingKeywords(resume: any, keywords: string[]): string[] {
    const resumeText = this.resumeToText(resume).toLowerCase();
    
    return keywords.filter(keyword => {
      const keywordLower = keyword.toLowerCase();
      return !resumeText.includes(keywordLower);
    });
  }

  /**
   * Check if resume has a specific section
   */
  private hasSection(resume: any, sectionName: string): boolean {
    const resumeText = this.resumeToText(resume).toLowerCase();
    
    // Common variations of section names
    const variations: { [key: string]: string[] } = {
      'summary': ['summary', 'objective', 'profile', 'about'],
      'experience': ['experience', 'work history', 'employment', 'professional experience'],
      'skills': ['skills', 'technical skills', 'core competencies', 'expertise'],
      'education': ['education', 'academic', 'qualifications'],
      'certifications': ['certifications', 'certificates', 'credentials'],
      'projects': ['projects', 'portfolio', 'key projects'],
      'achievements': ['achievements', 'accomplishments', 'awards']
    };

    const sectionVariations = variations[sectionName] || [sectionName];
    
    return sectionVariations.some(variation => 
      resumeText.includes(variation)
    );
  }

  /**
   * Convert resume object to text for analysis
   */
  private resumeToText(resume: any): string {
    if (typeof resume === 'string') {
      return resume;
    }

    // Handle different resume formats
    let text = '';
    
    if (resume.summary) text += resume.summary + '\n';
    
    if (resume.experience) {
      resume.experience.forEach((exp: any) => {
        text += `${exp.title} at ${exp.company}\n`;
        if (exp.achievements) {
          exp.achievements.forEach((achievement: string) => {
            text += `• ${achievement}\n`;
          });
        }
      });
    }
    
    if (resume.skills) {
      Object.values(resume.skills).forEach((skillList: any) => {
        if (Array.isArray(skillList)) {
          text += skillList.join(', ') + '\n';
        }
      });
    }
    
    if (resume.education) {
      resume.education.forEach((edu: any) => {
        text += `${edu.degree} - ${edu.institution}\n`;
      });
    }

    return text;
  }

  /**
   * Check sections and return detailed analysis
   */
  checkSections(resume: any): SectionCheck[] {
    const allSections = [...this.requiredSections, ...this.optionalSections];
    
    return allSections.map(section => {
      const present = this.hasSection(resume, section);
      const isRequired = this.requiredSections.includes(section);
      
      let quality: SectionCheck['quality'] = 'missing';
      if (present) {
        // Could add more sophisticated quality checks here
        quality = 'good';
      } else if (!isRequired) {
        quality = 'missing'; // Optional sections can be missing
      }
      
      return {
        section,
        present,
        quality
      };
    });
  }
}