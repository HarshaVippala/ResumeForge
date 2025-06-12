"""
Model Configuration for LM Studio Integration
Optimized settings for resume generation tasks
"""

# Recommended model for resume tasks - Qwen3 MLX (working model)
RECOMMENDED_MODEL = "qwen3-8b-mlx"

# Model configurations optimized for different tasks using Qwen3 MLX
MODEL_CONFIGS = {
    "email_extraction": {
        "model": "qwen3-8b-mlx",  # Working MLX model
        "max_tokens": 300,  # Optimized for email analysis
        "temperature": 0.1,  # Very low for structured extraction
        "description": "Qwen3 8B MLX model for email information extraction"
    },
    
    "keyword_extraction": {
        "model": "qwen3-8b-mlx",
        "max_tokens": 1500,
        "temperature": 0.2,  # Balanced for keyword extraction
        "description": "Qwen3 MLX optimized for structured keyword extraction and categorization"
    },
    
    "section_generation": {
        "model": "qwen3-8b-mlx", 
        "max_tokens": 1200,  # Increased for better content generation
        "temperature": 0.3,  # Balanced reasoning and creativity
        "description": "Qwen3 MLX balanced reasoning and creativity for resume sections"
    },
    
    "experience_bullets": {
        "model": "qwen3-8b-mlx",
        "max_tokens": 1000,
        "temperature": 0.3,  # Consistent generation
        "description": "Qwen3 MLX optimized for generating varied experience bullets"
    }
}

# Model selection guide based on LM Studio models
MODEL_RECOMMENDATIONS = {
    "best_overall": {
        "name": "DeepSeek R1 Qwen3 8B",
        "model_id": "deepseek/deepseek-r1-0528-qwen3-8b",
        "reason": "Advanced reasoning, excellent for ATS optimization and content generation"
    },
    
    "alternative_small": {
        "name": "Qwen2.5 0.5B Instruct", 
        "model_id": "qwen2.5-0.5b-instruct",
        "reason": "Lighter model, faster generation, good for simple tasks"
    },
    
    "alternative_large": {
        "name": "Qwen3 1.7B",
        "model_id": "qwen3-1.7b", 
        "reason": "Larger model, better reasoning, use if speed not critical"
    }
}

# Task-specific prompting strategies
PROMPTING_STRATEGIES = {
    "resume_sections": {
        "system_role": "CareerForgeAI",
        "focus": "ATS optimization + authenticity",
        "key_principles": [
            "Maximum 5 years experience",
            "Build on real background", 
            "Natural keyword integration",
            "Quantified achievements",
            "Single-page format"
        ]
    },
    
    "keyword_analysis": {
        "system_role": "ATS Expert",
        "focus": "Keyword extraction + categorization",
        "key_principles": [
            "Exact keyword extraction",
            "Technical vs soft skill categorization",
            "Impact scoring",
            "Match with base resume skills"
        ]
    }
}

def get_model_config(task_type: str = "section_generation") -> dict:
    """Get optimized model configuration for specific task"""
    return MODEL_CONFIGS.get(task_type, MODEL_CONFIGS["section_generation"])

def get_recommended_model() -> str:
    """Get the recommended model for resume tasks"""
    return RECOMMENDED_MODEL