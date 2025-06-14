# Changelog

All notable changes to ResumeForge will be documented in this file.

## [2.2.0] - 2025-06-14

### Added
- **Redesigned Jobs Page**: Complete UI/UX overhaul for job discovery
  - Responsive job grid layout with compact, information-rich cards
  - Real-time scraping status indicator with live backend API integration
  - Time-based filtering with inline button pills (1hr, 6hr, 24hr, 1 week)
  - URL state management for persistent filters across navigation
  - Lightning icon for resume tailoring actions
  - Prominent time-ago labels with color coding for competitive advantage

- **Enhanced Job Components**: Modular, reusable job interface components
  - JobCard component with enhanced information hierarchy
  - JobCardSkeleton for smooth loading states
  - FilterBar with integrated search and status monitoring
  - JobGrid with responsive layout and error handling
  - ScrapingStatusIndicator with real-time platform monitoring

- **Real-time Data Integration**: Complete elimination of mock data
  - Live API connections to `/api/scraping/stats` and `/api/scraping/platforms`
  - Real platform reliability metrics and job counts
  - Proper error handling for rate limiting (429 errors) and API failures
  - Accurate job source status with platform-specific indicators

### Enhanced
- **Job Discovery Experience**: Improved usability and visual design
  - Better utilization of page width with multi-column responsive layout
  - Clean white theme matching application design standards
  - Enhanced text contrast for improved accessibility (WCAG compliance)
  - Time-sensitive job application timing with color-coded labels
  - Integrated job statistics and scraping metrics

- **URL State Management**: Persistent filter state
  - Custom `useQueryParamState` hook for Next.js integration
  - Search, view mode, and time filter persistence across navigation
  - Improved user experience with maintained filter preferences

### Technical Improvements
- **Component Architecture**: Modern React patterns and TypeScript
  - Modular component design with clear separation of concerns
  - Custom hooks for state management and API integration
  - Responsive CSS Grid layouts for optimal display
  - Error boundaries and loading states throughout

- **API Integration**: Real-time data fetching and error handling
  - Elimination of all mock data in favor of live backend connections
  - Comprehensive error handling for network failures and rate limits
  - Polling for real-time updates every 2 minutes
  - Platform-specific status indicators based on actual reliability metrics

## [2.1.0] - 2025-01-14

### Added
- **Strategic Context System**: Advanced job analysis with rich context preservation
  - StrategicContext Pydantic model for comprehensive job analysis
  - ExperiencePrioritizer for intelligent experience selection and scoring
  - Strategic positioning, requirement criticality, and skill emphasis analysis
  
- **Prompt Management System**: External prompt configuration for easy customization
  - All prompts moved to `backend/prompts/` directory as .txt files
  - PromptManager class for dynamic prompt loading and validation
  - Hot-reload capability for prompt updates without code changes
  
- **Enhanced Job Processing**: Comprehensive job tracking and analysis
  - Enhanced jobs API with strategic resume generation
  - Groq analytics API for system monitoring
  - Applications API for advanced tracking
  - OAuth API for secure authentication

- **Email Integration**: Complete email-based job tracking system
  - Gmail OAuth 2.0 integration with secure authentication
  - Real-time email processing and job extraction
  - Threaded conversation support
  - Dashboard integration for email-based applications

- **Web Scraping Foundation**: URL-based job autofill infrastructure
  - Scraping API with anti-detection capabilities
  - Stealth scraper service with Playwright support
  - Domain allowlist for security (SSRF protection)
  - Prepared for LinkedIn, Greenhouse, and other job boards

- **Frontend Enhancements**: Improved user experience
  - Enhanced dashboard with better layouts and navigation
  - New UI components: dialog, label, scroll-area, select, textarea
  - Thread list and summary components for email integration
  - Quick add modal for job applications
  - Improved job kanban board and tracker statistics

### Enhanced
- **Resume Generation**: More natural and authentic content
  - Human-natural content generation with anti-AI detection
  - Space optimization for single-page resumes
  - Skills merger for intelligent keyword integration
  - Professional headline generator
  
- **API Architecture**: Modular and extensible design
  - Separation of concerns with dedicated service modules
  - Strategy pattern for scraper implementations
  - Comprehensive error handling with granular states
  
- **Database**: Enhanced schema for new features
  - Email sync enhancement migrations
  - Enhanced job data structure
  - Support for application tracking

### Technical Improvements
- **Code Organization**: Cleaner, more maintainable structure
  - Removed obsolete email processing files
  - Consolidated services with clear responsibilities
  - Modular email processing system
  
- **Infrastructure**: Better development workflow
  - Migration runner for database updates
  - Utility scripts for automation
  - Improved error handling throughout

### Security
- **Authentication**: OAuth 2.0 implementation for Gmail
- **SSRF Protection**: Domain allowlist for URL scraping
- **Credential Management**: Enhanced .env configuration
- **Anti-Detection**: Stealth scraping capabilities

## [2.0.0] - 2025-01-10

### Added
- **Modern Next.js Frontend**: Complete rewrite with TypeScript and Tailwind CSS
- **Database Integration**: Supabase PostgreSQL for cloud storage
- **Real-time Preview**: WYSIWYG resume preview with exact PDF formatting
- **Resume Library**: Complete library management with search and filtering
- **Version Control**: Track resume section changes and history
- **Theme Support**: Light/dark mode toggle
- **Mobile Responsive**: Full responsive design for all screen sizes
- **ATS Scoring**: Real-time ATS compatibility scoring
- **Keyword Optimization**: Intelligent keyword placement and highlighting

### Enhanced
- **User Interface**: Modern, clean design with improved navigation
- **State Management**: Persistent state with Zustand store
- **API Architecture**: RESTful API design with comprehensive endpoints
- **Document Export**: Enhanced template system with multiple formats
- **Security**: Environment-based configuration and credential protection

### Technical Improvements
- **Architecture**: Hybrid deployment (Vercel frontend + local backend)
- **Database**: PostgreSQL with migration support from SQLite
- **Performance**: Optimized loading and caching strategies
- **Code Quality**: TypeScript throughout frontend with strict typing
- **Component Library**: Reusable UI components with consistent design system

### Infrastructure
- **Cloud Database**: Supabase integration for scalable data storage
- **Deployment**: Vercel-ready frontend with production optimization
- **Environment Management**: Comprehensive configuration system
- **Development**: Improved local development workflow

---

## [1.0.0] - 2024-12-01

### Initial Release
- Basic React frontend with Vite
- Flask backend with local processing
- SQLite database for local storage
- Job description analysis
- Resume section generation
- Template-based document export
- Local LM Studio integration