#!/usr/bin/env python3
"""
Simple test script to generate a resume and check format
"""

import os
from services.lm_studio_client import LMStudioClient
from services.resume import SectionGenerator, DocumentPatcher

def test_resume_generation():
    """Generate a complete resume and check output"""
    
    print("🔄 Testing Resume Generation with 1-Page Optimization")
    print("=" * 55)
    
    # Read the job description
    jd_path = "tests/JD.txt"
    if os.path.exists(jd_path):
        with open(jd_path, 'r') as f:
            job_description = f.read()
        print(f"✅ Loaded job description ({len(job_description)} chars)")
    else:
        job_description = "Senior Software Engineer position requiring NodeJS, React, AWS, TypeScript experience"
        print(f"⚠️  Using fallback job description")
    
    # Job context
    job_context = {
        'company': 'Microsoft',
        'role': 'Senior Software Engineer',
        'job_description': job_description
    }
    
    # Test job keywords (simulating keyword extraction)
    job_keywords = ['TypeScript', 'React', 'Node.js', 'AWS', 'Python', 'API', 'microservices', 'CI/CD']
    
    print(f"🎯 Target: {job_context['company']} - {job_context['role']}")
    print(f"🔑 Keywords: {', '.join(job_keywords)}")
    print()
    
    # Initialize services
    try:
        lm_studio = LMStudioClient()
        section_generator = SectionGenerator(lm_studio)
        document_patcher = DocumentPatcher()
        
        print("✅ Services initialized")
    except Exception as e:
        print(f"❌ Error initializing services: {e}")
        return False
    
    # Generate sections
    print("🔄 Generating resume sections...")
    
    sections = {}
    
    try:
        # Generate Summary
        summary_result = section_generator.generate_human_natural_section(
            'summary', job_keywords, job_description, job_context, {}
        )
        if summary_result['success']:
            sections['summary'] = summary_result['best_content']
            print(f"✅ Summary ({len(sections['summary'])} chars): {sections['summary'][:80]}...")
        else:
            print(f"❌ Summary generation failed: {summary_result.get('error', 'Unknown error')}")
        
        # Generate Skills
        skills_result = section_generator.generate_human_natural_section(
            'skills', job_keywords, job_description, job_context, {}
        )
        if skills_result['success']:
            sections['skills'] = skills_result['best_content']
            print(f"✅ Skills ({len(sections['skills'])} chars): {sections['skills'][:80]}...")
            print(f"   Full skills content: {sections['skills']}")
            # Test parsing right here
            if " | " in sections['skills']:
                parts = sections['skills'].split(" | ")
                print(f"   ✅ Skills parsing: Found {len(parts)} parts")
            else:
                print(f"   ❌ Skills parsing: No ' | ' separator found")
        else:
            print(f"❌ Skills generation failed: {skills_result.get('error', 'Unknown error')}")
        
        # Generate Experience
        experience_result = section_generator.generate_human_natural_section(
            'experience', job_keywords, job_description, job_context, {}
        )
        if experience_result['success']:
            sections['experience'] = experience_result['best_content']
            print(f"✅ Experience ({len(sections['experience'])} bullets)")
            for i, bullet in enumerate(sections['experience'][:3], 1):
                print(f"   • Point {i} ({len(bullet)} chars): {bullet[:60]}...")
        else:
            print(f"❌ Experience generation failed: {experience_result.get('error', 'Unknown error')}")
        
    except Exception as e:
        print(f"❌ Error during section generation: {e}")
        return False
    
    print()
    
    # Generate document
    print("📄 Generating final resume document...")
    
    try:
        session_data = {
            'company': job_context['company'],
            'role': job_context['role'],
            'id': 'test_session'
        }
        
        output_path = document_patcher.patch_resume_template(
            sections, session_data, "placeholder_resume.docx"
        )
        
        print(f"✅ Resume generated: {output_path}")
        
        # Check if file exists and get size
        if os.path.exists(output_path):
            file_size = os.path.getsize(output_path)
            print(f"📊 File size: {file_size:,} bytes")
            return output_path
        else:
            print(f"❌ Output file not found: {output_path}")
            return False
            
    except Exception as e:
        print(f"❌ Error during document generation: {e}")
        return False

if __name__ == '__main__':
    result = test_resume_generation()
    
    if result:
        print()
        print("🎉 SUCCESS: Resume generated successfully!")
        print(f"📁 Location: {result}")
        print()
        print("🔍 Next steps:")
        print("   1. Open the generated .docx file")
        print("   2. Check if it fits on one page")
        print("   3. Verify no em-dashes are present")
        print("   4. Confirm all placeholders are filled")
    else:
        print()
        print("❌ FAILED: Resume generation encountered errors")
        print("   Check the error messages above for details")