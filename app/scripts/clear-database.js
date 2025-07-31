#!/usr/bin/env node

/**
 * Script to clear all email data from the database
 * Run with: node scripts/clear-database.js
 * 
 * WARNING: This will delete all email data!
 */

const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function clearDatabase() {
  console.log('\n⚠️  WARNING: This will delete ALL email data from the database!');
  console.log('This includes:');
  console.log('  • All emails in email_communications table');
  console.log('  • All job opportunities');
  console.log('  • All email sync state');
  console.log('');
  
  rl.question('Are you sure you want to continue? Type "yes" to confirm: ', async (answer) => {
    if (answer.toLowerCase() !== 'yes') {
      console.log('\n❌ Operation cancelled');
      rl.close();
      return;
    }

    console.log('\n🗑️  Clearing database...');
    
    try {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
      
      // Call a special endpoint to clear the database
      const response = await fetch(`${siteUrl}/api/admin/clear-emails`, {
        method: 'DELETE',
        headers: { 
          'Content-Type': 'application/json',
          'X-Admin-Action': 'clear-all-emails' 
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('\n✅ Database cleared successfully!');
      console.log(`Deleted ${result.deletedEmails || 0} emails`);
      console.log(`Deleted ${result.deletedOpportunities || 0} job opportunities`);
      
    } catch (error) {
      console.error('\n❌ Error clearing database:', error);
    }
    
    rl.close();
  });
}

// Run the script
clearDatabase();