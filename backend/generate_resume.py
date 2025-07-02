#!/usr/bin/env python3
"""
Generate resume from DOCX template by replacing placeholders
Outputs PDF or DOCX based on format parameter
"""

import sys
import json
import os
from utils.docx_resume_generator import DocxResumeGenerator, format_tailored_resume_for_docx

def main():
    try:
        # Read input from stdin
        input_data = json.loads(sys.stdin.read())
        
        # Extract data
        personal_info = input_data['personalInfo']
        tailored_resume = input_data['tailoredResume']
        company = input_data['company']
        role = input_data['role']
        output_format = input_data.get('format', 'pdf')
        
        # Format data for DOCX template
        resume_data = format_tailored_resume_for_docx(
            tailored_resume,
            personal_info,
            company,
            role
        )
        
        # Initialize generator with template
        generator = DocxResumeGenerator()
        
        # Generate document
        output_bytes = generator.generate_resume(resume_data, output_format)
        
        # Write output to stdout (binary mode)
        sys.stdout.buffer.write(output_bytes)
        
    except Exception as e:
        sys.stderr.write(f"Error generating resume: {str(e)}\n")
        sys.exit(1)

if __name__ == "__main__":
    main()