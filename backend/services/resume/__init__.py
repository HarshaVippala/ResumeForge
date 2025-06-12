"""
Resume Services Package
Contains all resume-related services and components
"""

# Core resume services
from .resume_parser import ResumeParser
from .resume_processor import ResumeProcessor
from .section_generator import SectionGenerator
from .document_patcher import DocumentPatcher
from .template_preview import TemplatePreviewService as TemplatePreview

# Enhancement services
from .enhancers.human_natural_enhancer import HumanNaturalEnhancer
from .enhancers.professional_headline_generator import ProfessionalHeadlineGenerator
from .enhancers.skills_merger import SkillsMerger
from .enhancers.space_optimizer import SpaceOptimizer

# Prompt services
from .prompts.human_voice_prompts import HumanVoicePrompts

__all__ = [
    'ResumeParser',
    'ResumeProcessor', 
    'SectionGenerator',
    'DocumentPatcher',
    'TemplatePreview',
    'HumanNaturalEnhancer',
    'ProfessionalHeadlineGenerator',
    'SkillsMerger',
    'SpaceOptimizer',
    'HumanVoicePrompts'
]