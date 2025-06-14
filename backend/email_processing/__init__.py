"""
Email Processing Module
Multi-stage email analysis with modular architecture
"""

from .core.email_processor import EmailProcessor
from .models.email_data import EmailData
from .models.processing_result import ProcessingResult
from .services.dashboard_service import DashboardService

__all__ = ['EmailProcessor', 'EmailData', 'ProcessingResult', 'DashboardService']