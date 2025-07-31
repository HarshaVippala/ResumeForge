/**
 * LaTeX PDF Compiler
 * Created: 2025-01-10
 * 
 * Compiles LaTeX code to PDF using pdflatex
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, readFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const execAsync = promisify(exec);

export interface CompilationResult {
  success: boolean;
  pdfBuffer?: Buffer;
  error?: string;
  log?: string;
}

export class LatexPdfCompiler {
  private workingDir: string;
  
  constructor() {
    // Create a temporary working directory
    this.workingDir = join(tmpdir(), 'latex-compile-' + Date.now());
    if (!existsSync(this.workingDir)) {
      mkdirSync(this.workingDir, { recursive: true });
    }
  }

  /**
   * Compile LaTeX code to PDF
   */
  async compile(latexCode: string, filename: string = 'resume'): Promise<CompilationResult> {
    try {
      // Clean filename
      const cleanFilename = filename.replace(/[^a-zA-Z0-9-_]/g, '');
      const texFile = join(this.workingDir, `${cleanFilename}.tex`);
      const pdfFile = join(this.workingDir, `${cleanFilename}.pdf`);
      const logFile = join(this.workingDir, `${cleanFilename}.log`);
      
      // Write LaTeX code to file
      writeFileSync(texFile, latexCode, 'utf-8');
      
      // Compile with pdflatex
      const command = `cd "${this.workingDir}" && pdflatex -interaction=nonstopmode -output-directory="${this.workingDir}" "${texFile}"`;
      
      console.log(`Compiling LaTeX: ${command}`);
      
      const { stdout, stderr } = await execAsync(command, {
        timeout: 30000, // 30 second timeout
        cwd: this.workingDir
      });
      
      // Read compilation log
      let log = '';
      if (existsSync(logFile)) {
        log = readFileSync(logFile, 'utf-8');
      }
      
      // Check if PDF was generated
      if (existsSync(pdfFile)) {
        const pdfBuffer = readFileSync(pdfFile);
        this.cleanup();
        return {
          success: true,
          pdfBuffer,
          log
        };
      } else {
        this.cleanup();
        return {
          success: false,
          error: 'PDF file was not generated',
          log: log || stderr
        };
      }
    } catch (error) {
      this.cleanup();
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown compilation error',
        log: error instanceof Error ? error.stack : undefined
      };
    }
  }

  /**
   * Check if pdflatex is available
   */
  static async checkPdflatex(): Promise<boolean> {
    try {
      await execAsync('which pdflatex');
      return true;
    } catch {
      try {
        await execAsync('pdflatex --version');
        return true;
      } catch {
        return false;
      }
    }
  }

  /**
   * Clean up temporary files
   */
  private cleanup(): void {
    try {
      if (existsSync(this.workingDir)) {
        // Remove all files in the working directory
        const files = ['tex', 'pdf', 'aux', 'log', 'out', 'fls', 'fdb_latexmk'];
        files.forEach(ext => {
          const pattern = join(this.workingDir, `*.${ext}`);
          try {
            exec(`rm -f ${pattern}`);
          } catch {
            // Ignore cleanup errors
          }
        });
      }
    } catch (error) {
      console.warn('Cleanup error:', error);
    }
  }
}

/**
 * Compile LaTeX code to PDF buffer
 */
export async function compileLatexToPdf(latexCode: string, filename?: string): Promise<Buffer> {
  // Check if pdflatex is available
  const pdflatexAvailable = await LatexPdfCompiler.checkPdflatex();
  if (!pdflatexAvailable) {
    throw new Error('pdflatex is not available on this system. Please install a LaTeX distribution like TeX Live or MiKTeX.');
  }

  const compiler = new LatexPdfCompiler();
  const result = await compiler.compile(latexCode, filename);
  
  if (result.success && result.pdfBuffer) {
    return result.pdfBuffer;
  } else {
    throw new Error(`LaTeX compilation failed: ${result.error}\n\nLog:\n${result.log}`);
  }
}

/**
 * Alternative compilation using Docker (for systems without pdflatex)
 */
export async function compileLatexToPdfWithDocker(latexCode: string, filename?: string): Promise<Buffer> {
  try {
    // Check if Docker is available
    await execAsync('docker --version');
    
    const compiler = new LatexPdfCompiler();
    const cleanFilename = (filename || 'resume').replace(/[^a-zA-Z0-9-_]/g, '');
    const texFile = join(compiler.workingDir, `${cleanFilename}.tex`);
    
    // Write LaTeX code to file
    writeFileSync(texFile, latexCode, 'utf-8');
    
    // Use Docker to compile
    const command = `docker run --rm -v "${compiler.workingDir}:/workspace" -w /workspace texlive/texlive:latest pdflatex -interaction=nonstopmode "${cleanFilename}.tex"`;
    
    console.log(`Compiling LaTeX with Docker: ${command}`);
    
    const { stdout, stderr } = await execAsync(command, {
      timeout: 60000, // 60 second timeout for Docker
    });
    
    const pdfFile = join(compiler.workingDir, `${cleanFilename}.pdf`);
    
    if (existsSync(pdfFile)) {
      const pdfBuffer = readFileSync(pdfFile);
      return pdfBuffer;
    } else {
      throw new Error('PDF file was not generated by Docker compilation');
    }
  } catch (error) {
    throw new Error(`Docker LaTeX compilation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}