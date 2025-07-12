/**
 * Embedding Service for Resume Matching
 * Implements Resume Matcher's vector-based similarity approach
 * Created: 2025-01-09
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

export interface EmbeddingResult {
  text: string;
  embedding: number[];
}

export interface SimilarityScore {
  score: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  keywordDensity: { [key: string]: number };
}

export class EmbeddingService {
  private genAI: GoogleGenerativeAI;
  private model: any;
  private embeddingCache: Map<string, number[]> = new Map();

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    // Use embedding model if available, otherwise use text model
    this.model = this.genAI.getGenerativeModel({ model: 'embedding-001' });
  }

  /**
   * Generate embeddings for text using Google's embedding model
   * Falls back to simple TF-IDF style vectorization if API fails
   */
  async generateEmbedding(text: string): Promise<number[]> {
    // Check cache first
    const cacheKey = text.toLowerCase().trim();
    if (this.embeddingCache.has(cacheKey)) {
      return this.embeddingCache.get(cacheKey)!;
    }

    try {
      // Try to use Google's embedding API
      const result = await this.model.embedContent(text);
      const embedding = result.embedding.values;
      this.embeddingCache.set(cacheKey, embedding);
      return embedding;
    } catch (error) {
      console.warn('Google embedding API failed, using fallback vectorization');
      // Fallback to TF-IDF style vectorization
      const embedding = this.fallbackVectorization(text);
      this.embeddingCache.set(cacheKey, embedding);
      return embedding;
    }
  }

  /**
   * Fallback vectorization using TF-IDF approach
   * Creates a simple vector representation based on word frequencies
   */
  private fallbackVectorization(text: string): number[] {
    const words = text.toLowerCase().split(/\s+/);
    const wordFreq = new Map<string, number>();
    
    // Count word frequencies
    words.forEach(word => {
      const cleanWord = word.replace(/[^a-z0-9]/g, '');
      if (cleanWord.length > 2) {
        wordFreq.set(cleanWord, (wordFreq.get(cleanWord) || 0) + 1);
      }
    });

    // Create a fixed-size vector (simplified approach)
    const vectorSize = 300; // Standard embedding size
    const vector = new Array(vectorSize).fill(0);
    
    // Hash words to vector positions
    Array.from(wordFreq.entries()).forEach(([word, freq]) => {
      const hash = this.simpleHash(word);
      const position = Math.abs(hash) % vectorSize;
      vector[position] += freq / words.length; // Normalize by document length
    });

    return vector;
  }

  /**
   * Simple hash function for word to vector position mapping
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
  }

  /**
   * Calculate cosine similarity between two vectors
   * This is the core of Resume Matcher's approach
   */
  calculateCosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    norm1 = Math.sqrt(norm1);
    norm2 = Math.sqrt(norm2);

    if (norm1 === 0 || norm2 === 0) {
      return 0; // Avoid division by zero
    }

    return dotProduct / (norm1 * norm2);
  }

  /**
   * Calculate similarity between resume and job description
   * Implements Resume Matcher's algorithm
   */
  async calculateResumeSimilarity(
    resumeText: string,
    jobDescription: string,
    keywords: string[]
  ): Promise<SimilarityScore> {
    // Generate embeddings for both texts
    const [resumeEmbedding, jobEmbedding] = await Promise.all([
      this.generateEmbedding(resumeText),
      this.generateEmbedding(jobDescription)
    ]);

    // Calculate cosine similarity
    const cosineSimilarity = this.calculateCosineSimilarity(resumeEmbedding, jobEmbedding);

    // Check keyword presence
    const resumeLower = resumeText.toLowerCase();
    const matchedKeywords: string[] = [];
    const missingKeywords: string[] = [];
    const keywordDensity: { [key: string]: number } = {};

    keywords.forEach(keyword => {
      const keywordLower = keyword.toLowerCase();
      const matches = (resumeLower.match(new RegExp(`\\b${keywordLower}\\b`, 'g')) || []).length;
      
      if (matches > 0) {
        matchedKeywords.push(keyword);
        keywordDensity[keyword] = matches;
      } else {
        missingKeywords.push(keyword);
      }
    });

    // Calculate final score (combining cosine similarity and keyword matching)
    const keywordScore = keywords.length > 0 ? matchedKeywords.length / keywords.length : 0;
    const finalScore = (cosineSimilarity * 0.6) + (keywordScore * 0.4); // 60% semantic, 40% keyword

    return {
      score: Math.round(finalScore * 100) / 100, // Round to 2 decimal places
      matchedKeywords,
      missingKeywords,
      keywordDensity
    };
  }

  /**
   * Extract keywords from job description using TF-IDF approach
   * Based on Resume Matcher's keyword extraction
   */
  extractKeywords(text: string, topN: number = 20): string[] {
    const words = text.toLowerCase().split(/\s+/);
    const wordFreq = new Map<string, number>();
    
    // Common stop words to exclude
    const stopWords = new Set([
      'the', 'is', 'at', 'which', 'on', 'and', 'a', 'an', 'as', 'are',
      'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
      'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this',
      'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
      'what', 'which', 'who', 'when', 'where', 'why', 'how', 'all', 'each',
      'every', 'some', 'any', 'few', 'many', 'much', 'most', 'other', 'into',
      'for', 'from', 'up', 'down', 'in', 'out', 'off', 'over', 'under',
      'to', 'with', 'about', 'than', 'after', 'before', 'between'
    ]);

    // Count word frequencies (excluding stop words and short words)
    words.forEach(word => {
      const cleanWord = word.replace(/[^a-z0-9\+\#]/g, '');
      if (cleanWord.length > 2 && !stopWords.has(cleanWord)) {
        wordFreq.set(cleanWord, (wordFreq.get(cleanWord) || 0) + 1);
      }
    });

    // Also extract multi-word technical terms
    const technicalPatterns = [
      /machine\s+learning/gi,
      /artificial\s+intelligence/gi,
      /data\s+science/gi,
      /software\s+engineer/gi,
      /full\s+stack/gi,
      /react\s+native/gi,
      /node\s*\.?\s*js/gi,
      /\.net\s+core/gi,
      /aws\s+lambda/gi,
      /google\s+cloud/gi,
      /ci\s*\/?\s*cd/gi,
      /test\s+driven/gi,
      /agile\s+scrum/gi
    ];

    technicalPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => {
          wordFreq.set(match.toLowerCase(), (wordFreq.get(match.toLowerCase()) || 0) + 1);
        });
      }
    });

    // Sort by frequency and return top N
    const sortedWords = Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, topN)
      .map(([word]) => word);

    return sortedWords;
  }

  /**
   * Clear embedding cache
   */
  clearCache(): void {
    this.embeddingCache.clear();
  }
}