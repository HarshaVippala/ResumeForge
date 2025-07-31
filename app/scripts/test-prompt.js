#!/usr/bin/env node

/**
 * Script to test prompts independently
 * Usage: npm run test:prompt <prompt-path> [--vars key=value]
 * Example: npm run test:prompt email/classification --vars subject="Job Opportunity" senderEmail="recruiter@company.com"
 */

const fs = require('fs').promises;
const path = require('path');

async function loadPrompt(promptPath) {
  const basePath = path.join(process.cwd(), 'prompts');
  const fullPath = path.join(basePath, `${promptPath}.md`);
  
  try {
    const fileContent = await fs.readFile(fullPath, 'utf-8');
    
    // Extract prompt content
    const promptMatch = fileContent.match(/## Prompt Content\n```[^`]*\n([\s\S]*?)\n```/);
    if (!promptMatch) {
      throw new Error(`No prompt content found in ${promptPath}`);
    }
    
    // Extract metadata sections
    const sections = {
      purpose: fileContent.match(/## Purpose\n([\s\S]*?)(?=\n##)/)?.[1]?.trim(),
      inputVars: fileContent.match(/## Input Variables\n([\s\S]*?)(?=\n##)/)?.[1]?.trim(),
      outputFormat: fileContent.match(/## Output Format\n```[^`]*\n([\s\S]*?)\n```/)?.[1]?.trim(),
      prompt: promptMatch[1].trim()
    };
    
    return sections;
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Prompt not found: ${promptPath}`);
    }
    throw error;
  }
}

function parseVariables(args) {
  const vars = {};
  let collectingVars = false;
  
  args.forEach((arg, index) => {
    if (arg === '--vars') {
      collectingVars = true;
      return;
    }
    
    if (collectingVars && arg.includes('=')) {
      const [key, ...valueParts] = arg.split('=');
      vars[key] = valueParts.join('=');
    }
  });
  
  return vars;
}

function replaceVariables(prompt, variables) {
  let processedPrompt = prompt;
  
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`\\{${key}\\}`, 'g');
    processedPrompt = processedPrompt.replace(regex, value);
  });
  
  return processedPrompt;
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === '--help') {
    console.log(`
Prompt Testing Tool

Usage: npm run test:prompt <prompt-path> [--vars key=value ...]

Examples:
  npm run test:prompt email/classification
  npm run test:prompt email/classification --vars subject="Interview Request" senderEmail="hr@company.com"
  npm run test:prompt job-analysis/comprehensive-analysis --vars jobDescription="Senior Engineer role..."

Available prompts:
    `);
    
    // List available prompts
    const promptsDir = path.join(process.cwd(), 'prompts');
    const listPrompts = async (dir, prefix = '') => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          await listPrompts(path.join(dir, entry.name), prefix + entry.name + '/');
        } else if (entry.name.endsWith('.md')) {
          console.log(`  - ${prefix}${entry.name.replace('.md', '')}`);
        }
      }
    };
    
    await listPrompts(promptsDir);
    process.exit(0);
  }
  
  const promptPath = args[0];
  const variables = parseVariables(args);
  
  try {
    console.log(`\n📄 Loading prompt: ${promptPath}\n`);
    
    const sections = await loadPrompt(promptPath);
    
    // Display prompt information
    console.log('═══ PURPOSE ═══');
    console.log(sections.purpose || 'No purpose specified');
    
    console.log('\n═══ INPUT VARIABLES ═══');
    console.log(sections.inputVars || 'No input variables specified');
    
    console.log('\n═══ OUTPUT FORMAT ═══');
    console.log(sections.outputFormat || 'No output format specified');
    
    console.log('\n═══ RAW PROMPT ═══');
    console.log(sections.prompt);
    
    // If variables provided, show processed prompt
    if (Object.keys(variables).length > 0) {
      console.log('\n═══ PROCESSED PROMPT (with variables) ═══');
      console.log('Variables:', JSON.stringify(variables, null, 2));
      console.log('\nProcessed:');
      console.log(replaceVariables(sections.prompt, variables));
    }
    
    console.log('\n═══ TESTING TIPS ═══');
    console.log('1. Copy the prompt above to test with your AI tool');
    console.log('2. Check if the output matches the expected format');
    console.log('3. Verify all variables are properly replaced');
    console.log('4. Test edge cases (empty inputs, long texts, special characters)');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);