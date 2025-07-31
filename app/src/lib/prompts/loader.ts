/**
 * Prompt Loader Utility
 * Loads AI prompts from markdown files for easy management and testing
 */

import fs from 'fs/promises';
import path from 'path';

export interface PromptMetadata {
  purpose: string;
  inputVariables: string[];
  outputFormat: string;
}

export interface LoadedPrompt {
  content: string;
  metadata: PromptMetadata;
  path: string;
}

/**
 * Load a prompt from the prompts directory
 * @param promptPath - Path relative to prompts directory (e.g., 'email/classification')
 * @returns The prompt content and metadata
 */
export async function loadPrompt(promptPath: string): Promise<LoadedPrompt> {
  const basePath = path.join(process.cwd(), 'prompts');
  const fullPath = path.join(basePath, `${promptPath}.md`);
  
  try {
    const fileContent = await fs.readFile(fullPath, 'utf-8');
    
    // Extract prompt content between ```
    const promptMatch = fileContent.match(/## Prompt Content\n```[^`]*\n([\s\S]*?)\n```/);
    if (!promptMatch) {
      throw new Error(`No prompt content found in ${promptPath}`);
    }
    
    const promptContent = promptMatch[1].trim();
    
    // Extract metadata
    const purposeMatch = fileContent.match(/## Purpose\n(.*?)(?=\n##)/s);
    const inputMatch = fileContent.match(/## Input Variables\n([\s\S]*?)(?=\n##)/);
    const outputMatch = fileContent.match(/## Output Format\n```[^`]*\n([\s\S]*?)\n```/);
    
    const metadata: PromptMetadata = {
      purpose: purposeMatch ? purposeMatch[1].trim() : '',
      inputVariables: extractInputVariables(inputMatch ? inputMatch[1] : ''),
      outputFormat: outputMatch ? outputMatch[1].trim() : ''
    };
    
    return {
      content: promptContent,
      metadata,
      path: promptPath
    };
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      throw new Error(`Prompt not found: ${promptPath}`);
    }
    throw error;
  }
}

/**
 * Load a prompt and replace variables with actual values
 * @param promptPath - Path to the prompt file
 * @param variables - Object containing variable values
 * @returns The processed prompt ready for use
 */
export async function loadAndProcessPrompt(
  promptPath: string,
  variables: Record<string, any>
): Promise<string> {
  const { content } = await loadPrompt(promptPath);
  
  let processedPrompt = content;
  
  // Replace variables in the format {variableName}
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`\\{${key}\\}`, 'g');
    processedPrompt = processedPrompt.replace(regex, String(value));
  });
  
  return processedPrompt;
}

/**
 * List all available prompts
 * @returns Array of prompt paths
 */
export async function listPrompts(): Promise<string[]> {
  const basePath = path.join(process.cwd(), 'prompts');
  const prompts: string[] = [];
  
  async function scanDirectory(dir: string, prefix = ''): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
      
      if (entry.isDirectory()) {
        await scanDirectory(fullPath, relativePath);
      } else if (entry.name.endsWith('.md')) {
        prompts.push(relativePath.replace('.md', ''));
      }
    }
  }
  
  await scanDirectory(basePath);
  return prompts;
}

/**
 * Extract input variables from the markdown content
 */
function extractInputVariables(content: string): string[] {
  const variables: string[] = [];
  const lines = content.split('\n');
  
  lines.forEach(line => {
    const match = line.match(/^[-*]\s*`([^`]+)`/);
    if (match) {
      variables.push(match[1]);
    }
  });
  
  return variables;
}

/**
 * Cache for loaded prompts to avoid repeated file reads
 */
const promptCache = new Map<string, LoadedPrompt>();

/**
 * Load a prompt with caching
 */
export async function loadPromptCached(promptPath: string): Promise<LoadedPrompt> {
  if (promptCache.has(promptPath)) {
    return promptCache.get(promptPath)!;
  }
  
  const prompt = await loadPrompt(promptPath);
  promptCache.set(promptPath, prompt);
  return prompt;
}

/**
 * Clear the prompt cache (useful for development)
 */
export function clearPromptCache(): void {
  promptCache.clear();
}