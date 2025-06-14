"""
Core email processing stages
"""

from .email_processor import EmailProcessor

# Legacy processors moved to archive - now using OpenAI unified processor
# from .legacy.email_classifier import EmailClassifier
# from .legacy.content_extractor import ContentExtractor
# from .legacy.data_structurer import DataStructurer

__all__ = ['EmailProcessor']