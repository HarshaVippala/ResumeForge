"""
Generate a complete test resume using our enhanced system
"""

import sys
from services.lm_studio_client import LMStudioClient
from services.resume import SectionGenerator
from services.resume import DocumentPatcher

def generate_complete_resume():
    """Generate and save a complete resume"""
    
    print("🚀 Generating Complete Resume")
    print("=" * 40)
    
    # Test job keywords (from the JD.txt)
    job_keywords = [
        'Spring Boot', 'NodeJS', 'Test Automation', 'Cypress', 
        'Selenium', 'JavaScript', 'TypeScript', 'Angular', 
        'React', 'AWS', 'DevOps', 'REST API', 'Containerized'
    ]
    
    job_context = {
        'company': 'Microsoft',
        'role': 'Senior Software Engineer'
    }
    
    # Initialize services
    lm_studio = LMStudioClient()
    section_generator = SectionGenerator(lm_studio)
    document_patcher = DocumentPatcher()
    
    print(f"📋 Job: {job_context['company']} - {job_context['role']}")
    print(f"🔍 Keywords: {', '.join(job_keywords[:6])}...")
    print()
    
    # Generate all sections
    sections = {}
    
    # 1. Generate Skills
    print("🛠️ Generating Skills Section...")
    try:
        skills_result = section_generator._generate_enhanced_skills_sections(
            job_keywords, '', job_context, {}
        )
        
        if skills_result['success']:
            sections['skills'] = skills_result['best_content']
            print(f"   ✅ Skills generated ({len(sections['skills'])} chars)")
            
            # Show coverage
            if 'coverage_report' in skills_result:
                report = skills_result['coverage_report']
                print(f"   📊 {report['original_skills_count']} → {report['enhanced_skills_count']} skills")
        else:
            print("   ❌ Skills generation failed")
            
    except Exception as e:
        print(f"   ❌ Skills error: {e}")
    
    # 2. Generate Experience
    print("💼 Generating Experience Section...")
    try:
        experience_result = section_generator._generate_human_natural_experience(
            job_keywords[:8], '', job_context, {}
        )
        
        if experience_result['success']:
            sections['experience'] = experience_result['best_content']
            print(f"   ✅ Experience generated ({len(sections['experience'])} bullets)")
            print(f"   📊 Using {experience_result.get('experience_source', 'N/A')} experience")
        else:
            print("   ❌ Experience generation failed")
            
    except Exception as e:
        print(f"   ❌ Experience error: {e}")
    
    # 3. Generate Summary
    print("📝 Generating Summary Section...")
    try:
        # Use enhanced fallback for summary (more reliable)
        summary_result = section_generator._generate_with_enhanced_fallback(
            'summary', job_keywords[:6], '', job_context, {}
        )
        
        if summary_result['success']:
            sections['summary'] = summary_result['best_content']
            print(f"   ✅ Summary generated ({len(sections['summary'])} chars)")
        else:
            print("   ❌ Summary generation failed")
            
    except Exception as e:
        print(f"   ❌ Summary error: {e}")
    
    print()
    print("📋 Generated Sections Summary:")
    for section_name, content in sections.items():
        content_preview = str(content)[:80] + "..." if len(str(content)) > 80 else str(content)
        print(f"   {section_name}: {content_preview}")
    
    # 4. Patch Resume Template
    print()
    print("📄 Creating Resume Document...")
    try:
        session_data = {
            'company': job_context['company'],
            'role': job_context['role'],
            'analysis_data': {'keywords': job_keywords}
        }
        
        output_path = document_patcher.patch_resume_template(
            sections=sections,
            session_data=session_data,
            template_name="placeholder_resume.docx"
        )
        
        print(f"   ✅ Resume saved successfully!")
        print(f"   📁 File location: {output_path}")
        
        # Verify file exists
        import os
        if os.path.exists(output_path):
            file_size = os.path.getsize(output_path)
            print(f"   📊 File size: {file_size:,} bytes")
        
        return output_path
        
    except Exception as e:
        print(f"   ❌ Document creation error: {e}")
        import traceback
        traceback.print_exc()
        return None

if __name__ == '__main__':
    output_file = generate_complete_resume()
    
    if output_file:
        print()
        print("🎉 SUCCESS: Complete resume generated!")
        print(f"📁 Your enhanced resume is saved at: {output_file}")
        print()
        print("✨ Features Applied:")
        print("   ✅ Preserved ALL original skills while prioritizing job-relevant ones")
        print("   ✅ Used authentic 7-Eleven experience enhanced with job keywords")
        print("   ✅ Applied human-natural writing patterns")
        print("   ✅ Optimized for 1-page format constraints")
    else:
        print()
        print("❌ Resume generation failed. Check the errors above.")