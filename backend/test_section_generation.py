#!/usr/bin/env python3
"""
Test script to validate section generation with backend
"""

import requests
import json

def test_job_analysis():
    """Test job analysis first"""
    print("=== Testing Job Analysis ===")
    
    payload = {
        "company": "Microsoft",
        "role": "Senior Software Engineer",
        "jobDescription": """
        We are looking for a Senior Software Engineer to join our team. 
        Requirements:
        - 5+ years experience with Python, Node.js, and React
        - Experience with AWS, Docker, and Kubernetes
        - Strong problem-solving skills and leadership abilities
        - Experience with microservices and API development
        """
    }
    
    response = requests.post("http://localhost:5001/api/analyze-job", json=payload)
    print(f"Status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        session_id = data.get('session_id')
        print(f"Session ID: {session_id}")
        print("Analysis successful!")
        return session_id, data.get('analysis', {})
    else:
        print(f"Error: {response.text}")
        return None, None

def test_section_generation(session_id, keywords):
    """Test section generation"""
    print("\n=== Testing Section Generation ===")
    
    # Test summary generation
    payload = {
        "session_id": session_id,
        "section_type": "summary",
        "selected_keywords": keywords[:5],  # Use first 5 keywords
        "base_content": "",
        "preferences": {
            "tone": "professional",
            "length": "medium"
        }
    }
    
    response = requests.post("http://localhost:5001/api/generate-section", json=payload)
    print(f"Summary generation status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"Generated summary: {data.get('content', 'No content')[:100]}...")
        return True
    else:
        print(f"Error: {response.text}")
        return False

def test_base_resume():
    """Test base resume endpoint"""
    print("\n=== Testing Base Resume ===")
    
    response = requests.get("http://localhost:5001/api/base-resume")
    print(f"Status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        base_resume = data.get('base_resume', {})
        print(f"Summary: {base_resume.get('summary', 'No summary')[:100]}...")
        print(f"Experience bullets: {len(base_resume.get('experience', []))}")
        print(f"Skills: {base_resume.get('skills', 'No skills')[:100]}...")
        return True
    else:
        print(f"Error: {response.text}")
        return False

if __name__ == "__main__":
    # Test base resume first
    test_base_resume()
    
    # Test job analysis
    session_id, analysis = test_job_analysis()
    
    if session_id and analysis:
        # Extract keywords for testing
        technical_skills = analysis.get('technical_skills', [])
        critical_keywords = analysis.get('critical_keywords', [])
        all_keywords = critical_keywords + technical_skills
        
        if all_keywords:
            test_section_generation(session_id, all_keywords[:10])
        else:
            print("No keywords found to test section generation")