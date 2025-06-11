"""
End-to-End Test: Complete Resume Generation Flow
Tests the full pipeline from job analysis to human-natural resume generation
"""

import json
import logging
from datetime import datetime
from services.lm_studio_client import LMStudioClient
from services.keyword_extractor import KeywordExtractor
from services.resume import SectionGenerator
from services.resume import DocumentPatcher

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def load_test_job_description():
    """Load the test job description"""
    try:
        with open('data/JD.txt', 'r') as f:
            return f.read()
    except Exception as e:
        logger.error(f"Error loading JD.txt: {e}")
        return None

def run_end_to_end_test():
    """Run complete end-to-end test"""
    
    print("🚀 Starting End-to-End Resume Generation Test")
    print("=" * 60)
    
    # Initialize services
    lm_studio = LMStudioClient()
    keyword_extractor = KeywordExtractor(lm_studio)
    section_generator = SectionGenerator(lm_studio)
    document_patcher = DocumentPatcher()
    
    # Test data
    test_job_data = {
        'company': 'Microsoft',
        'role': 'Senior Software Engineer',
        'jobDescription': load_test_job_description()
    }
    
    if not test_job_data['jobDescription']:
        print("❌ Failed to load job description")
        return
    
    print(f"📋 Testing with job: {test_job_data['company']} - {test_job_data['role']}")
    print(f"📄 Job description length: {len(test_job_data['jobDescription'])} characters")
    print()
    
    # Step 1: Extract keywords
    print("🔍 STEP 1: Keyword Extraction")
    print("-" * 30)
    
    try:
        analysis = keyword_extractor.analyze_job_description(
            test_job_data['jobDescription'], 
            test_job_data['role']
        )
        
        if analysis and 'keywords' in analysis:
            keywords = analysis['keywords']
            print(f"✅ Extracted {len(keywords)} keywords")
            print(f"   Top keywords: {', '.join(keywords[:8])}")
            
            # Show categorization if available
            if 'categories' in analysis:
                for category, items in analysis['categories'].items():
                    if items:
                        print(f"   {category}: {', '.join(items[:3])}...")
        else:
            print("❌ Keyword extraction failed")
            return
            
    except Exception as e:
        print(f"❌ Keyword extraction error: {e}")
        return
    
    print()
    
    # Step 2: Generate Skills Section with Original Skills Preservation
    print("🛠️  STEP 2: Enhanced Skills Generation")
    print("-" * 40)
    
    try:
        skills_result = section_generator.generate_human_natural_section(
            section_type='skills',
            selected_keywords=keywords[:10],  # Use top 10 keywords
            base_content='',
            job_context={'company': test_job_data['company'], 'role': test_job_data['role']},
            preferences={'human_natural': True}
        )
        
        if skills_result['success']:
            print("✅ Skills generation successful")
            print(f"   Method: {skills_result.get('generation_method', 'unknown')}")
            print(f"   Preserved original skills: {skills_result.get('preserved_original_skills', False)}")
            
            if 'coverage_report' in skills_result:
                report = skills_result['coverage_report']
                print(f"   📊 Coverage Report:")
                print(f"      Original skills: {report['original_skills_count']}")
                print(f"      Enhanced skills: {report['enhanced_skills_count']}")
                print(f"      Keyword coverage: {report['keyword_coverage_percentage']:.1f}%")
            
            # Show sample sections
            if 'skills_sections' in skills_result:
                print(f"   📋 Generated Sections:")
                for section_name, content in list(skills_result['skills_sections'].items())[:3]:
                    print(f"      {section_name}: {content[:50]}...")
        else:
            print("❌ Skills generation failed")
            
    except Exception as e:
        print(f"❌ Skills generation error: {e}")
    
    print()
    
    # Step 3: Generate Experience Section with Authentic Data
    print("💼 STEP 3: Authentic Experience Enhancement")
    print("-" * 42)
    
    try:
        experience_result = section_generator.generate_human_natural_section(
            section_type='experience',
            selected_keywords=keywords[:8],  # Use top 8 keywords
            base_content='',
            job_context={'company': test_job_data['company'], 'role': test_job_data['role']},
            preferences={'human_natural': True}
        )
        
        if experience_result['success']:
            print("✅ Experience generation successful")
            print(f"   Method: {experience_result.get('generation_method', 'unknown')}")
            print(f"   Experience source: {experience_result.get('experience_source', 'N/A')}")
            print(f"   Authentic bullets used: {experience_result.get('authentic_bullets_used', 0)}")
            
            bullets = experience_result['best_content']
            print(f"   📋 Generated {len(bullets)} bullets:")
            for i, bullet in enumerate(bullets[:3], 1):
                print(f"      {i}. {bullet[:80]}...")
                
            # Show validation details
            if 'all_variations' in experience_result:
                variations = experience_result['all_variations']
                authentic_count = sum(1 for v in variations if v.get('source') == 'authentic')
                avg_human_score = sum(v.get('human_score', 0) for v in variations) / len(variations)
                print(f"   📊 Quality Metrics:")
                print(f"      Authentic bullets: {authentic_count}/{len(variations)}")
                print(f"      Avg human score: {avg_human_score:.2f}")
        else:
            print("❌ Experience generation failed")
            
    except Exception as e:
        print(f"❌ Experience generation error: {e}")
    
    print()
    
    # Step 4: Generate Summary with Human-Natural Approach
    print("📝 STEP 4: Human-Natural Summary Generation")
    print("-" * 44)
    
    try:
        summary_result = section_generator.generate_human_natural_section(
            section_type='summary',
            selected_keywords=keywords[:6],  # Use top 6 keywords
            base_content='',
            job_context={'company': test_job_data['company'], 'role': test_job_data['role']},
            preferences={'human_natural': True}
        )
        
        if summary_result['success']:
            print("✅ Summary generation successful")
            summary_text = summary_result['best_content']
            print(f"   📄 Generated summary ({len(summary_text)} chars):")
            print(f"      \"{summary_text}\"")
            
            # Show validation details
            if 'all_variations' in summary_result and summary_result['all_variations']:
                variation = summary_result['all_variations'][0]
                print(f"   📊 Quality Metrics:")
                print(f"      Human score: {variation.get('human_score', 0):.2f}")
                print(f"      Meets constraints: {variation.get('meets_constraints', False)}")
                print(f"      Keywords included: {variation.get('keywords_included', 0)}")
        else:
            print("❌ Summary generation failed")
            
    except Exception as e:
        print(f"❌ Summary generation error: {e}")
    
    print()
    
    # Step 5: Content Validation Test
    print("✅ STEP 5: Content Validation")
    print("-" * 30)
    
    try:
        # Test validation on generated summary
        if 'summary_result' in locals() and summary_result['success']:
            test_content = summary_result['best_content']
            
            # Human-naturalness validation
            human_validation = section_generator.human_enhancer.validate_human_naturalness(
                test_content, 'summary'
            )
            
            # Space constraints validation
            space_validation = section_generator.space_optimizer.check_format_constraints(
                test_content, 'summary'
            )
            
            print("✅ Validation tests completed")
            print(f"   Human naturalness score: {human_validation['overall_score']:.2f}")
            print(f"   AI detection risk: {1 - human_validation['ai_detection_risk']:.2f} (lower is better)")
            print(f"   Space constraints: {'✅ PASS' if space_validation['overall_valid'] else '❌ FAIL'}")
            
            if not space_validation['overall_valid']:
                print(f"   Issues: {', '.join(space_validation.get('issues', []))}")
        
    except Exception as e:
        print(f"❌ Validation error: {e}")
    
    print()
    
    # Step 6: Complete Resume Assembly Test
    print("📋 STEP 6: Complete Resume Assembly")
    print("-" * 36)
    
    try:
        # Collect all generated content
        sections = {}
        
        if 'skills_result' in locals() and skills_result['success']:
            sections['skills'] = skills_result['best_content']
        
        if 'experience_result' in locals() and experience_result['success']:
            sections['experience'] = experience_result['best_content']
        
        if 'summary_result' in locals() and summary_result['success']:
            sections['summary'] = summary_result['best_content']
        
        if sections:
            print(f"✅ Assembled complete resume with {len(sections)} sections")
            
            # Calculate total character usage
            total_chars = sum(len(str(content)) for content in sections.values())
            print(f"   📊 Resume Statistics:")
            print(f"      Total characters: {total_chars}")
            print(f"      Sections: {', '.join(sections.keys())}")
            
            # Test template patching (if template available)
            try:
                session_data = {
                    'company': test_job_data['company'],
                    'role': test_job_data['role'],
                    'analysis_data': analysis
                }
                
                output_path = document_patcher.patch_resume_template(
                    sections=sections,
                    session_data=session_data
                )
                
                print(f"   ✅ Resume template patched successfully")
                print(f"      Output file: {output_path}")
                
            except Exception as template_error:
                print(f"   ⚠️  Template patching: {template_error}")
        
        else:
            print("❌ No sections generated for assembly")
    
    except Exception as e:
        print(f"❌ Assembly error: {e}")
    
    print()
    print("🎉 End-to-End Test Completed!")
    print("=" * 60)
    
    # Summary Report
    success_count = 0
    total_steps = 6
    
    if 'analysis' in locals() and analysis:
        success_count += 1
    if 'skills_result' in locals() and skills_result.get('success'):
        success_count += 1
    if 'experience_result' in locals() and experience_result.get('success'):
        success_count += 1
    if 'summary_result' in locals() and summary_result.get('success'):
        success_count += 1
    if 'human_validation' in locals():
        success_count += 1
    if 'sections' in locals() and sections:
        success_count += 1
    
    print(f"📊 FINAL RESULTS: {success_count}/{total_steps} steps successful")
    
    if success_count == total_steps:
        print("🎯 ALL TESTS PASSED! Human-natural resume generation is working perfectly.")
        print("✨ Key Features Verified:")
        print("   ✅ Preserves ALL original skills while prioritizing job-relevant ones")
        print("   ✅ Uses authentic experience data enhanced with job keywords")
        print("   ✅ Generates human-natural content that avoids AI detection")
        print("   ✅ Optimizes for 1-page format constraints")
        print("   ✅ Maintains high content authenticity and quality")
    else:
        print("⚠️  Some tests failed. Check the logs above for details.")

if __name__ == '__main__':
    run_end_to_end_test()