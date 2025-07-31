/**
 * Keyword Extractor Agent
 * Handles keyword extraction and analysis tasks
 * Created: 2025-01-10
 */

import { BaseAgent } from './base-agent';
import { AgentType, TaskPayload, KeywordExtractionTask, KeywordExtractionResult } from './types';
import { MessageQueue } from './message-queue';
import { EmbeddingService } from '../embedding-service';

export class KeywordExtractorAgent extends BaseAgent {
  private embeddingService: EmbeddingService;

  constructor(queue: MessageQueue, apiKey: string) {
    super(AgentType.KEYWORD_EXTRACTOR, queue);
    this.embeddingService = new EmbeddingService(apiKey);
  }

  protected async processTaskInternal(payload: TaskPayload): Promise<KeywordExtractionResult> {
    const task = payload.data as KeywordExtractionTask;
    
    // Extract keywords using the embedding service
    const keywords = this.embeddingService.extractKeywords(
      task.text,
      task.topN || 20
    );

    // Categorize keywords
    const technicalTerms = this.extractTechnicalTerms(task.text);
    const softSkills = this.extractSoftSkills(task.text);
    
    // Calculate frequencies
    const frequencies = this.calculateFrequencies(task.text, [...keywords, ...technicalTerms]);

    return {
      keywords,
      technicalTerms,
      softSkills,
      frequencies
    };
  }

  /**
   * Extract technical terms using patterns
   */
  private extractTechnicalTerms(text: string): string[] {
    const technicalPatterns = [
      // Programming languages
      /\b(JavaScript|TypeScript|Python|Java|C\+\+|C#|Ruby|Go|Rust|Swift|Kotlin|PHP|Scala)\b/gi,
      // Frameworks
      /\b(React|Angular|Vue|Next\.js|Express|Django|Flask|Spring|Rails|Laravel)\b/gi,
      // Databases
      /\b(MySQL|PostgreSQL|MongoDB|Redis|Elasticsearch|DynamoDB|Cassandra|Oracle)\b/gi,
      // Cloud & DevOps
      /\b(AWS|Azure|GCP|Docker|Kubernetes|Jenkins|GitLab|CI\/CD|Terraform)\b/gi,
      // Data Science & ML
      /\b(Machine Learning|Deep Learning|NLP|Computer Vision|TensorFlow|PyTorch|Scikit-learn)\b/gi,
      // Other technical terms
      /\b(API|REST|GraphQL|Microservices|Agile|Scrum|Git|Linux|DevOps)\b/gi
    ];

    const found = new Set<string>();
    
    technicalPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => found.add(match));
      }
    });

    // Also look for compound technical terms
    const compoundPatterns = [
      /machine\s+learning/gi,
      /artificial\s+intelligence/gi,
      /data\s+science/gi,
      /full[\s-]?stack/gi,
      /front[\s-]?end/gi,
      /back[\s-]?end/gi,
      /test[\s-]?driven\s+development/gi,
      /continuous\s+integration/gi,
      /continuous\s+deployment/gi
    ];

    compoundPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => found.add(match.replace(/\s+/g, ' ')));
      }
    });

    return Array.from(found);
  }

  /**
   * Extract soft skills from text
   */
  private extractSoftSkills(text: string): string[] {
    const softSkillPatterns = [
      /\b(leadership|communication|teamwork|problem[\s-]?solving|analytical|creative|innovative)\b/gi,
      /\b(collaborative|adaptable|flexible|organized|detail[\s-]?oriented|self[\s-]?motivated)\b/gi,
      /\b(time\s+management|project\s+management|critical\s+thinking|decision[\s-]?making)\b/gi,
      /\b(interpersonal|presentation|negotiation|conflict\s+resolution|mentoring)\b/gi
    ];

    const found = new Set<string>();
    
    softSkillPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => {
          found.add(match.toLowerCase().replace(/[\s-]+/g, ' '));
        });
      }
    });

    return Array.from(found);
  }

  /**
   * Calculate word frequencies
   */
  private calculateFrequencies(text: string, keywords: string[]): { [key: string]: number } {
    const frequencies: { [key: string]: number } = {};
    const textLower = text.toLowerCase();

    keywords.forEach(keyword => {
      const keywordLower = keyword.toLowerCase();
      const regex = new RegExp(`\\b${keywordLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      const matches = textLower.match(regex) || [];
      frequencies[keyword] = matches.length;
    });

    return frequencies;
  }
}