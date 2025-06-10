# ResumeForge

A personal resume builder tool I built to help with job applications. Creates tailored resumes for specific jobs with keyword optimization and tracks applications - figured others might find it useful too.

## 🚀 What it does

- **Tailors resumes for specific jobs**: Paste a job description, and it analyzes keywords to optimize your resume
- **ATS scoring**: Shows how well your resume matches the job requirements
- **Resume library**: Keep track of all the different versions you've created
- **Real-time preview**: See exactly how your resume will look when exported
- **Export to PDF/DOCX**: Professional formatting that looks good
- **Job application tracking**: Keep track of where you've applied (coming soon)
- **Dark/light mode**: Because why not
- **Version history**: See what changes you made and revert if needed

## 🏗️ Architecture

### Technology Stack
- **Frontend**: Next.js 15, TypeScript, Tailwind CSS, Zustand
- **Backend**: Python Flask, RESTful API
- **Database**: PostgreSQL (Supabase), SQLite for development
- **Deployment**: Vercel (frontend), local deployment (backend)

### System Design
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│                 │    │                 │    │                 │
│   Frontend      │◄──►│   Backend API   │◄──►│   Database      │
│   (Next.js)     │    │   (Flask)       │    │   (PostgreSQL)  │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
    ┌────▼────┐             ┌────▼────┐             ┌────▼────┐
    │  Vercel │             │  Local  │             │Supabase │
    │Hosting  │             │Server   │             │ Cloud   │
    └─────────┘             └─────────┘             └─────────┘
```

### Core Components

#### Frontend Architecture
- **Pages**: Dashboard with Library, Generator, Tracker, and Analytics
- **Components**: Reusable UI components with consistent design system
- **State Management**: Zustand for global state with persistence
- **API Integration**: RESTful communication with backend services

#### Backend Services
- **Resume Processing**: Document generation and template management
- **Keyword Extraction**: Job description analysis and keyword categorization
- **Database Management**: Session handling and data persistence
- **Document Export**: PDF/DOCX generation with custom templates

#### Database Schema
- **Sessions**: Job analysis data and user sessions
- **Versions**: Resume section version control and history
- **Library**: Finalized resume storage with metadata
- **Analytics**: Performance tracking and usage statistics

## 💭 Why I built this

Job hunting sucks. I was tired of manually tweaking my resume for every application, trying to figure out which keywords to include, and losing track of which version I sent where. So I built this.

The idea is simple: paste a job description, let it analyze what keywords matter, then help you create a tailored resume that actually matches what they're looking for. Plus keep track of all your different versions because let's be honest, we all have like 15 different resume files by now.

## 🛠️ How to run it

You'll need:
- Node.js (18+) for the frontend
- Python (3.9+) for the backend  
- A Supabase account (free) for the database

### Get it running:

1. **Frontend** (the pretty UI):
```bash
cd frontend
npm install
npm run dev
```

2. **Backend** (the brain):
```bash
cd backend
pip install -r requirements.txt

# Set up your database connection
cp .env.example .env
# Edit .env with your Supabase details

python app.py
```

3. **Database**: Sign up for Supabase (free), grab your connection string, and put it in the `.env` file.

That's it. Frontend runs on `localhost:3000`, backend on `localhost:5001`.

## 📁 Project Structure

```
resume-forge/
├── frontend/                 # Next.js application
│   ├── src/
│   │   ├── app/             # App router pages
│   │   ├── components/      # Reusable UI components
│   │   ├── stores/          # Zustand state management
│   │   └── types/           # TypeScript definitions
│   └── public/              # Static assets
├── backend/                 # Flask API server
│   ├── services/            # Business logic modules
│   ├── config/              # Configuration management
│   ├── schemas/             # Data validation schemas
│   └── data/                # Template and reference files
└── docs/                    # Project documentation
```

## 🔄 API Endpoints

### Job Analysis
- `POST /api/analyze-job` - Analyze job description and extract keywords
- `GET /api/session/{id}` - Retrieve job analysis session

### Resume Generation
- `POST /api/generate-section` - Generate optimized resume sections
- `POST /api/template-export` - Export resume to PDF/DOCX

### Library Management
- `GET /api/library/resumes` - Retrieve resume library
- `POST /api/library/save` - Save resume to library
- `DELETE /api/library/{id}` - Remove resume from library

### System Health
- `GET /health` - Service health check and status

## 🔒 Security & Privacy

- Environment variables for sensitive configuration
- Database credentials stored securely
- No hardcoded API keys or passwords
- Input validation and sanitization
- CORS protection for API endpoints

## 🚀 Deployment

### Production Setup
1. **Frontend**: Deploy to Vercel with environment variables
2. **Backend**: Run locally or deploy to cloud provider
3. **Database**: Use Supabase PostgreSQL for cloud storage
4. **Environment**: Configure production environment variables

### Local Development
- Frontend runs on `http://localhost:3000`
- Backend API on `http://localhost:5001`
- Database can use local SQLite for development

## 📈 Performance

- **Frontend**: Static site generation with Next.js optimization
- **Backend**: Efficient database queries with connection pooling
- **Caching**: Strategic caching for improved response times
- **Scalability**: Modular architecture for horizontal scaling

## 🤝 Want to contribute?

Feel free to fork it, break it, fix it, whatever. If you find bugs or have ideas, open an issue. Pull requests welcome.

Just keep in mind this was built for my personal use, so some things might be hardcoded or specific to my setup. You'll probably want to customize it for your own resume data.

## 📄 License

MIT License - do whatever you want with it.

---

*Built by a guy who was tired of job hunting the hard way.*