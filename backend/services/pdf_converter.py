"""
PDF Converter Service
Handles converting DOCX files to PDF format using various conversion methods
"""

import os
import logging
import subprocess
import platform
from typing import Optional
from pathlib import Path

logger = logging.getLogger(__name__)

class PDFConverter:
    """Convert documents to PDF format"""
    
    def __init__(self):
        self.conversion_method = self._detect_best_conversion_method()
        logger.info(f"Using PDF conversion method: {self.conversion_method}")
    
    def _detect_best_conversion_method(self) -> str:
        """Detect the best available PDF conversion method"""
        
        # Try different conversion methods in order of preference
        methods = [
            ('libreoffice', self._check_libreoffice),
            ('docx2pdf', self._check_docx2pdf),
            ('pandoc', self._check_pandoc),
        ]
        
        for method_name, check_func in methods:
            if check_func():
                return method_name
        
        logger.warning("No PDF conversion method available - will return DOCX files")
        return 'none'
    
    def _check_libreoffice(self) -> bool:
        """Check if LibreOffice is available for PDF conversion"""
        try:
            # Try different LibreOffice command names
            commands = ['libreoffice', 'soffice']
            for cmd in commands:
                result = subprocess.run(
                    [cmd, '--version'], 
                    capture_output=True, 
                    text=True, 
                    timeout=10
                )
                if result.returncode == 0:
                    return True
            return False
        except (subprocess.TimeoutExpired, FileNotFoundError, subprocess.SubprocessError):
            return False
    
    def _check_docx2pdf(self) -> bool:
        """Check if docx2pdf Python library is available"""
        try:
            import docx2pdf
            return True
        except ImportError:
            return False
    
    def _check_pandoc(self) -> bool:
        """Check if Pandoc is available for PDF conversion"""
        try:
            result = subprocess.run(
                ['pandoc', '--version'], 
                capture_output=True, 
                text=True, 
                timeout=10
            )
            return result.returncode == 0
        except (subprocess.TimeoutExpired, FileNotFoundError, subprocess.SubprocessError):
            return False
    
    def convert_docx_to_pdf(self, docx_path: str, output_dir: Optional[str] = None) -> str:
        """
        Convert DOCX file to PDF
        
        Args:
            docx_path: Path to the DOCX file
            output_dir: Output directory (optional, defaults to same dir as input)
            
        Returns:
            Path to the generated PDF file
        """
        
        if not os.path.exists(docx_path):
            raise FileNotFoundError(f"DOCX file not found: {docx_path}")
        
        # Generate PDF path
        docx_path_obj = Path(docx_path)
        if output_dir:
            pdf_path = Path(output_dir) / f"{docx_path_obj.stem}.pdf"
        else:
            pdf_path = docx_path_obj.with_suffix('.pdf')
        
        # Use the detected conversion method
        if self.conversion_method == 'libreoffice':
            return self._convert_with_libreoffice(docx_path, pdf_path)
        elif self.conversion_method == 'docx2pdf':
            return self._convert_with_docx2pdf(docx_path, pdf_path)
        elif self.conversion_method == 'pandoc':
            return self._convert_with_pandoc(docx_path, pdf_path)
        else:
            logger.warning("No PDF conversion available - returning original DOCX file")
            return docx_path
    
    def _convert_with_libreoffice(self, docx_path: str, pdf_path: Path) -> str:
        """Convert using LibreOffice headless mode"""
        try:
            # Try different LibreOffice command names
            commands = ['libreoffice', 'soffice']
            
            for cmd in commands:
                try:
                    # Convert to PDF using LibreOffice headless mode
                    result = subprocess.run([
                        cmd,
                        '--headless',
                        '--convert-to', 'pdf',
                        '--outdir', str(pdf_path.parent),
                        docx_path
                    ], capture_output=True, text=True, timeout=60)
                    
                    if result.returncode == 0:
                        logger.info(f"Successfully converted {docx_path} to PDF using {cmd}")
                        return str(pdf_path)
                    else:
                        logger.error(f"LibreOffice conversion failed: {result.stderr}")
                        
                except FileNotFoundError:
                    continue
            
            raise Exception("LibreOffice conversion failed")
            
        except Exception as e:
            logger.error(f"LibreOffice PDF conversion error: {e}")
            raise
    
    def _convert_with_docx2pdf(self, docx_path: str, pdf_path: Path) -> str:
        """Convert using docx2pdf Python library"""
        try:
            import docx2pdf
            
            # Convert DOCX to PDF
            docx2pdf.convert(docx_path, str(pdf_path))
            
            if pdf_path.exists():
                logger.info(f"Successfully converted {docx_path} to PDF using docx2pdf")
                return str(pdf_path)
            else:
                raise Exception("PDF file was not created")
                
        except Exception as e:
            logger.error(f"docx2pdf conversion error: {e}")
            raise
    
    def _convert_with_pandoc(self, docx_path: str, pdf_path: Path) -> str:
        """Convert using Pandoc"""
        try:
            result = subprocess.run([
                'pandoc',
                docx_path,
                '-o', str(pdf_path),
                '--pdf-engine=wkhtmltopdf'  # or xelatex, pdflatex
            ], capture_output=True, text=True, timeout=60)
            
            if result.returncode == 0 and pdf_path.exists():
                logger.info(f"Successfully converted {docx_path} to PDF using Pandoc")
                return str(pdf_path)
            else:
                logger.error(f"Pandoc conversion failed: {result.stderr}")
                raise Exception("Pandoc conversion failed")
                
        except Exception as e:
            logger.error(f"Pandoc PDF conversion error: {e}")
            raise
    
    def is_pdf_conversion_available(self) -> bool:
        """Check if PDF conversion is available"""
        return self.conversion_method != 'none'
    
    def get_conversion_method(self) -> str:
        """Get the current conversion method"""
        return self.conversion_method

# Global instance
pdf_converter = PDFConverter() 