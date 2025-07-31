/**
 * Download Resume by ID
 * Usage: node scripts/download-resume.js <resume-id> [format]
 * Example: node scripts/download-resume.js 123e4567-e89b-12d3-a456-426614174000 pdf
 */

const fs = require('fs');
const path = require('path');

async function downloadResume(resumeId, format = 'pdf') {
  if (!resumeId) {
    console.error('❌ Please provide a resume ID');
    console.log('Usage: node scripts/download-resume.js <resume-id> [format]');
    console.log('Example: node scripts/download-resume.js 123e4567-e89b-12d3-a456-426614174000 pdf');
    process.exit(1);
  }

  const apiUrl = `http://localhost:3000/api/resume/${resumeId}/export?format=${format}`;
  
  try {
    console.log(`📥 Downloading resume ${resumeId} as ${format.toUpperCase()}...`);
    
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }

    // Get filename from Content-Disposition header
    const contentDisposition = response.headers.get('content-disposition');
    let filename = `resume_${resumeId}.${format}`;
    
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="(.+)"/);
      if (filenameMatch) {
        filename = filenameMatch[1];
      }
    }

    // Create downloads directory if it doesn't exist
    const downloadsDir = path.join(process.cwd(), 'downloads');
    if (!fs.existsSync(downloadsDir)) {
      fs.mkdirSync(downloadsDir);
    }

    // Save the file
    const buffer = await response.arrayBuffer();
    const filePath = path.join(downloadsDir, filename);
    fs.writeFileSync(filePath, Buffer.from(buffer));

    console.log(`✅ Resume downloaded successfully!`);
    console.log(`📁 Saved to: ${filePath}`);
    console.log(`📄 Size: ${(buffer.byteLength / 1024).toFixed(2)} KB`);

  } catch (error) {
    console.error('❌ Download failed:', error.message);
    process.exit(1);
  }
}

// Get command line arguments
const [,, resumeId, format] = process.argv;

// Run the download
downloadResume(resumeId, format);