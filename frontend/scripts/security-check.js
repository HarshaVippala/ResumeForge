#!/usr/bin/env node

/**
 * Security Check Script
 * 
 * Performs a comprehensive security audit of the environment configuration.
 * Run with: npm run security:check
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkFilePermissions() {
  log('\n📁 Checking File Permissions...', 'cyan');
  
  const envFile = path.join(process.cwd(), '.env.local');
  
  if (!fs.existsSync(envFile)) {
    log('  ❌ .env.local file not found', 'red');
    return false;
  }
  
  try {
    const stats = fs.statSync(envFile);
    const mode = (stats.mode & parseInt('777', 8)).toString(8);
    
    if (mode === '600') {
      log('  ✅ .env.local permissions are secure (600)', 'green');
      return true;
    } else {
      log(`  ⚠️  .env.local permissions are ${mode} (should be 600)`, 'yellow');
      log('     Run: chmod 600 .env.local', 'yellow');
      return false;
    }
  } catch (error) {
    log('  ❌ Could not check file permissions', 'red');
    return false;
  }
}

function checkGitIgnore() {
  log('\n🔒 Checking Git Configuration...', 'cyan');
  
  const gitignorePath = path.join(process.cwd(), '.gitignore');
  
  if (!fs.existsSync(gitignorePath)) {
    log('  ❌ .gitignore file not found', 'red');
    return false;
  }
  
  const gitignore = fs.readFileSync(gitignorePath, 'utf8');
  const patterns = ['.env', '.env.local', '.env*.local', '*.env'];
  const missing = patterns.filter(pattern => !gitignore.includes(pattern));
  
  if (missing.length === 0) {
    log('  ✅ Environment files are properly gitignored', 'green');
  } else {
    log('  ⚠️  Some env patterns missing from .gitignore:', 'yellow');
    missing.forEach(pattern => log(`     - ${pattern}`, 'yellow'));
  }
  
  // Check if .env.local is tracked
  try {
    execSync('git ls-files .env.local', { stdio: 'pipe' });
    log('  ❌ .env.local is tracked by git! Remove it immediately!', 'red');
    log('     Run: git rm --cached .env.local', 'red');
    return false;
  } catch {
    log('  ✅ .env.local is not tracked by git', 'green');
  }
  
  return true;
}

function searchForSecrets() {
  log('\n🔍 Searching for Hardcoded Secrets...', 'cyan');
  
  const secretPatterns = [
    { pattern: 'SUPABASE_SERVICE_ROLE_KEY', description: 'Supabase service role key' },
    { pattern: 'GOOGLE_CLIENT_SECRET', description: 'Google OAuth secret' },
    { pattern: 'ENCRYPTION_KEY', description: 'Encryption key' },
    { pattern: 'PERSONAL_API_KEY', description: 'Personal API key' },
    { pattern: 'eyJ[A-Za-z0-9]', description: 'JWT token' },
    { pattern: 'AIza[A-Za-z0-9]{35}', description: 'Google API key' }
  ];
  
  let found = false;
  
  const excludeDirs = ['node_modules', '.git', '.next', 'dist', 'build'];
  const excludeFiles = ['.env', '.env.local', '.env.template', '.env.local.template', 'security-check.js'];
  
  function searchDir(dir) {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        if (!excludeDirs.includes(file)) {
          searchDir(fullPath);
        }
      } else if (stat.isFile()) {
        if (excludeFiles.some(ef => fullPath.endsWith(ef))) continue;
        if (!['.js', '.ts', '.jsx', '.tsx', '.json'].some(ext => file.endsWith(ext))) continue;
        
        const content = fs.readFileSync(fullPath, 'utf8');
        
        for (const { pattern, description } of secretPatterns) {
          const regex = new RegExp(pattern, 'g');
          const matches = content.match(regex);
          
          if (matches) {
            log(`  ⚠️  Found potential ${description} in: ${fullPath}`, 'yellow');
            found = true;
          }
        }
      }
    }
  }
  
  try {
    searchDir(process.cwd());
    
    if (!found) {
      log('  ✅ No hardcoded secrets found in codebase', 'green');
    }
  } catch (error) {
    log('  ❌ Error searching for secrets: ' + error.message, 'red');
  }
  
  return !found;
}

function validateEnvFile() {
  log('\n🔐 Validating Environment Variables...', 'cyan');
  
  // Import and run the TypeScript validator (compile on the fly)
  try {
    require('esbuild-register/dist/node').register();
    const { validateEnv, logValidationResult } = require('../api/_lib/config/validate-env.ts');
    
    const result = validateEnv();
    logValidationResult(result);
    
    return result.valid;
  } catch (error) {
    log('  ❌ Could not run environment validator: ' + error.message, 'red');
    log('     Make sure all dependencies are installed', 'yellow');
    return false;
  }
}

function checkDependencies() {
  log('\n📦 Checking Security Dependencies...', 'cyan');
  
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const recommended = {
    'bcryptjs': 'Password hashing',
    'jsonwebtoken': 'JWT handling',
    'helmet': 'Security headers',
    'express-rate-limit': 'Rate limiting'
  };
  
  const installed = Object.keys(packageJson.dependencies || {})
    .concat(Object.keys(packageJson.devDependencies || {}));
  
  let allGood = true;
  
  for (const [pkg, description] of Object.entries(recommended)) {
    if (installed.includes(pkg)) {
      log(`  ✅ ${pkg} installed (${description})`, 'green');
    } else {
      log(`  ℹ️  Consider installing ${pkg} for ${description}`, 'blue');
      allGood = false;
    }
  }
  
  return allGood;
}

async function main() {
  log('\n🛡️  ResumeForge Security Check\n', 'magenta');
  log('This tool checks for common security issues in your configuration.\n');
  
  const checks = [
    { name: 'File Permissions', fn: checkFilePermissions },
    { name: 'Git Configuration', fn: checkGitIgnore },
    { name: 'Hardcoded Secrets', fn: searchForSecrets },
    { name: 'Environment Variables', fn: validateEnvFile },
    { name: 'Dependencies', fn: checkDependencies }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const check of checks) {
    try {
      const result = await check.fn();
      if (result) passed++;
      else failed++;
    } catch (error) {
      log(`\n❌ Error running ${check.name}: ${error.message}`, 'red');
      failed++;
    }
  }
  
  log('\n' + '='.repeat(60), 'cyan');
  log(`\n📊 Security Check Summary: ${passed} passed, ${failed} failed\n`, 'magenta');
  
  if (failed === 0) {
    log('✅ All security checks passed! Your configuration appears secure.\n', 'green');
    process.exit(0);
  } else {
    log('❌ Some security checks failed. Please address the issues above.\n', 'red');
    log('📚 See /docs/security-checklist.md for detailed instructions.\n', 'yellow');
    process.exit(1);
  }
}

// Run the security check
main().catch(error => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  process.exit(1);
});