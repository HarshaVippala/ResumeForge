#!/usr/bin/env python3
"""
Test script for the new LM Studio keyword extraction schema
"""

import json
from services.keyword_extractor import KeywordExtractor
from services.lm_studio_client import LMStudioClient

def test_schema_validation():
    """Test that the new schema validation works"""
    extractor = KeywordExtractor()
    
    # Test valid schema
    valid_result = {
        "technical_skills": {
            "programming_languages": ["Python", "JavaScript"],
            "frameworks_libraries": ["React", "Node.js"],
            "databases": ["PostgreSQL", "MongoDB"],
            "cloud_devops": ["AWS", "Docker"],
            "ai_ml": ["TensorFlow"],
            "tools_platforms": ["Git", "VS Code"],
            "methodologies": ["Agile", "REST"]
        },
        "soft_skills": ["Leadership", "Communication"],
        "certifications": ["AWS Certified"],
        "experience_requirements": {
            "years_required": 5,
            "years_preferred": 7,
            "leadership_indicators": ["Team lead"],
            "team_size_mentioned": 5,
            "project_scope_indicators": ["Large scale"]
        },
        "requirement_priority": {
            "must_have": ["Python", "React"],
            "nice_to_have": ["GraphQL"]
        },
        "ats_keywords": {
            "high_impact_keywords": ["Python", "React", "AWS"],
            "keyword_variations": {"React": ["ReactJS", "React.js"]}
        }
    }
    
    print("Testing schema validation...")
    is_valid = extractor._validate_extraction_result(valid_result)
    print(f"✅ Valid schema test: {'PASSED' if is_valid else 'FAILED'}")
    
    # Test invalid schema (missing required key)
    invalid_result = {
        "technical_skills": {
            "programming_languages": ["Python"]
        }
        # Missing other required keys
    }
    
    is_invalid = extractor._validate_extraction_result(invalid_result)
    print(f"✅ Invalid schema test: {'PASSED' if not is_invalid else 'FAILED'}")
    
    return is_valid and not is_invalid

def test_conversion():
    """Test that the conversion to legacy format works"""
    extractor = KeywordExtractor()
    
    ai_result = {
        "technical_skills": {
            "programming_languages": ["Python", "JavaScript"],
            "frameworks_libraries": ["React", "Node.js"],
            "databases": ["PostgreSQL"],
            "cloud_devops": ["AWS", "Docker"],
            "ai_ml": ["TensorFlow"],
            "tools_platforms": ["Git"],
            "methodologies": ["Agile"]
        },
        "soft_skills": ["Leadership"],
        "certifications": ["AWS Certified"],
        "experience_requirements": {
            "years_required": 5,
            "years_preferred": 7,
            "leadership_indicators": ["Team lead"],
            "team_size_mentioned": 5,
            "project_scope_indicators": ["Large scale"]
        },
        "requirement_priority": {
            "must_have": ["Python", "React"],
            "nice_to_have": ["GraphQL"]
        },
        "ats_keywords": {
            "high_impact_keywords": ["Python", "React", "AWS"],
            "keyword_variations": {"React": ["ReactJS", "React.js"]}
        }
    }
    
    print("\nTesting conversion to legacy format...")
    legacy_result = extractor._convert_ai_result_to_legacy_format(ai_result, "Test Company", "Software Engineer")
    
    # Check that expected fields are present
    expected_fields = [
        "programming_languages", "frameworks_libraries_tools", "databases",
        "cloud_devops", "ai_ml_data_tech", "methodologies_concepts",
        "experience_requirements", "certifications_education", "technical_skills",
        "soft_skills", "critical_keywords", "job_info"
    ]
    
    all_present = all(field in legacy_result for field in expected_fields)
    print(f"✅ Legacy format conversion: {'PASSED' if all_present else 'FAILED'}")
    
    if all_present:
        print(f"   - Programming languages: {legacy_result['programming_languages']}")
        print(f"   - Technical skills count: {len(legacy_result['technical_skills'])}")
        print(f"   - Critical keywords: {legacy_result['critical_keywords'][:3]}")
        print(f"   - Seniority: {legacy_result['job_info']['seniority']}")
    
    return all_present

def test_lm_studio_connection():
    """Test LM Studio connection"""
    print("\nTesting LM Studio connection...")
    client = LMStudioClient()
    
    if client.test_connection():
        print("✅ LM Studio connection: PASSED")
        return True
    else:
        print("❌ LM Studio connection: FAILED (make sure LM Studio is running)")
        return False

def main():
    """Run all tests"""
    print("=" * 50)
    print("Testing New LM Studio Keyword Extraction Schema")
    print("=" * 50)
    
    # Run tests
    schema_test = test_schema_validation()
    conversion_test = test_conversion()
    connection_test = test_lm_studio_connection()
    
    print("\n" + "=" * 50)
    print("Test Summary:")
    print(f"Schema Validation: {'✅ PASSED' if schema_test else '❌ FAILED'}")
    print(f"Legacy Conversion: {'✅ PASSED' if conversion_test else '❌ FAILED'}")
    print(f"LM Studio Connection: {'✅ PASSED' if connection_test else '❌ FAILED'}")
    
    all_passed = schema_test and conversion_test
    print(f"\nOverall: {'✅ ALL TESTS PASSED' if all_passed else '❌ SOME TESTS FAILED'}")
    
    if connection_test and all_passed:
        print("\n🎉 Ready to test with real job descriptions!")
    elif all_passed:
        print("\n⚠️  Schema is ready, but LM Studio needs to be started for full testing")
    
    return all_passed

if __name__ == "__main__":
    main()
