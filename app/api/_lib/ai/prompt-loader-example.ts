/**
 * Example of using the prompt loader with AI processors
 * This shows how to migrate from inline prompts to file-based prompts
 */

import { loadAndProcessPrompt, loadPromptCached } from '@/lib/prompts/loader';
import type { ProcessedEmail } from '../gmail/types';

// Example 1: Simple prompt loading and variable replacement
export async function classifyEmailWithPromptLoader(email: ProcessedEmail) {
  // Load and process the prompt with variables
  const prompt = await loadAndProcessPrompt('email/classification', {
    subject: email.subject,
    senderName: email.senderName,
    senderEmail: email.senderEmail,
    bodyText: email.bodyText.substring(0, 800)
  });
  
  // Use the prompt with your AI model
  // ... AI model call with prompt
  
  return prompt;
}

// Example 2: Using cached prompts for better performance
export async function extractEmailEntitiesWithCache(email: ProcessedEmail) {
  // Load the prompt (cached after first load)
  const { content } = await loadPromptCached('email/entity-extraction');
  
  // Manual variable replacement for more control
  const prompt = content
    .replace('{subject}', email.subject)
    .replace('{senderName}', email.senderName)
    .replace('{senderEmail}', email.senderEmail)
    .replace('{bodyText}', email.bodyText.substring(0, 1200));
  
  // Use the prompt with your AI model
  // ... AI model call with prompt
  
  return prompt;
}

// Example 3: Loading prompt with metadata for validation
export async function analyzeConversationWithValidation(emails: any[]) {
  const { content, metadata } = await loadPromptCached('conversation/thread-analysis');
  
  // Validate we have all required inputs
  const requiredVars = metadata.inputVariables;
  console.log('Required variables:', requiredVars);
  
  // Build conversation flow
  const conversationFlow = emails
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map(email => `
[${email.date.toLocaleDateString()}] ${email.isFromUser ? 'Me' : email.sender}:
Subject: ${email.subject}
${email.body.slice(0, 500)}${email.body.length > 500 ? '...' : ''}
`).join('\n---\n');
  
  // Process the prompt
  const prompt = content.replace('{conversationFlow}', conversationFlow);
  
  return prompt;
}

// Example 4: Batch loading multiple prompts
export async function loadAllEmailPrompts() {
  const prompts = await Promise.all([
    loadPromptCached('email/classification'),
    loadPromptCached('email/entity-extraction'),
    loadPromptCached('email/summarization')
  ]);
  
  return {
    classification: prompts[0],
    extraction: prompts[1],
    summarization: prompts[2]
  };
}

// Example 5: Dynamic prompt selection based on email type
export async function getPromptForEmailType(emailType: string) {
  const promptMap: Record<string, string> = {
    'application_submitted': 'email/application-confirmation',
    'interview_request': 'email/interview-scheduling',
    'rejection': 'email/rejection-analysis',
    'offer': 'email/offer-analysis'
  };
  
  const promptPath = promptMap[emailType] || 'email/classification';
  
  try {
    return await loadPromptCached(promptPath);
  } catch (error) {
    // Fallback to default classification prompt
    console.warn(`Prompt not found for ${emailType}, using default`);
    return await loadPromptCached('email/classification');
  }
}