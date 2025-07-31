import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/api/_lib/db';
import { ResumeInsert } from '@/api/_lib/db/types';

export const runtime = 'edge';

/**
 * Import Master Resume API Route
 * Created: 2025-01-10
 * 
 * POST /api/master-resume/import - Import existing resume data as master resume
 * 
 * This endpoint allows importing from:
 * 1. Existing hardcoded JSON files (for migration)
 * 2. An existing tailored resume
 * 3. Manual JSON input
 */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { source, resumeId, resumeData, name } = body;

    const db = getSupabase();
    let importedContent: any = null;

    // Handle different import sources
    if (source === 'hardcoded') {
      // Import from hardcoded files (for initial migration)
      // This creates a default master resume with the existing data
      importedContent = {
        contact: {
          name: "HARSHA VIPPALA",
          email: "harsha.vippala1@gmail.com",
          phone: "+1(929)620-7227",
          linkedin: "linkedin.com/in/harsha-vippala",
          github: "github.com/HarshaVippala",
          location: "New York, NY"
        },
        summary: "Senior Software Engineer with 5+ years of experience in building scalable applications, leading technical initiatives, and mentoring teams. Expert in React, TypeScript, Node.js, and cloud technologies. Proven track record of delivering high-impact projects and improving system performance.",
        experience: [
          {
            company: "UMG Stores",
            title: "Senior Software Engineer",
            dates: "May 2023 - Present",
            location: "New York, NY",
            bullets: [
              "Led the development of e-commerce platforms for major music artists, resulting in 40% increase in conversion rates",
              "Architected and implemented a scalable microservices infrastructure using Node.js and AWS",
              "Mentored a team of 4 junior developers, improving team velocity by 25%",
              "Optimized frontend performance using React 18 features, reducing load times by 35%",
              "Established CI/CD pipelines and automated testing, reducing deployment time from 2 hours to 15 minutes"
            ]
          },
          {
            company: "Freelance",
            title: "Full Stack Developer",
            dates: "May 2021 - April 2023",
            location: "New York, NY",
            bullets: [
              "Delivered 15+ web applications for diverse clients using React, Next.js, and Node.js",
              "Built a real-time analytics dashboard processing 1M+ events daily using WebSocket and Redis",
              "Developed custom e-commerce solutions resulting in $2M+ in client revenue",
              "Implemented SEO optimizations that improved client site rankings by 60%",
              "Managed end-to-end project lifecycle from requirements gathering to deployment"
            ]
          },
          {
            company: "PurpleTalk Inc",
            title: "Software Engineer",
            dates: "February 2020 - March 2021",
            location: "Hyderabad, India",
            bullets: [
              "Developed responsive web applications using React and TypeScript serving 100K+ users",
              "Integrated third-party APIs and payment gateways for seamless user experiences",
              "Reduced API response times by 50% through query optimization and caching strategies",
              "Collaborated with cross-functional teams in Agile environment to deliver features on time",
              "Implemented unit and integration tests achieving 85% code coverage"
            ]
          },
          {
            company: "PurpleTalk Inc",
            title: "Software Engineer Intern",
            dates: "June 2019 - January 2020",
            location: "Hyderabad, India",
            bullets: [
              "Built RESTful APIs using Node.js and Express.js handling 50K+ daily requests",
              "Developed interactive UI components with React, improving user engagement by 30%",
              "Participated in code reviews and implemented feedback to improve code quality",
              "Created comprehensive documentation for APIs and frontend components"
            ]
          }
        ],
        education: [
          {
            degree: "Master of Science in Computer Engineering",
            school: "New York University",
            location: "New York, NY",
            dates: "2019 - 2021",
            gpa: "3.8/4.0",
            achievements: [
              "Specialized in Software Engineering and Web Development",
              "Graduate Teaching Assistant for Web Development course"
            ]
          },
          {
            degree: "Bachelor of Technology in Computer Science & Engineering",
            school: "K L University",
            location: "Vijayawada, India",
            dates: "2015 - 2019",
            gpa: "3.7/4.0",
            achievements: [
              "Published research paper on Machine Learning applications",
              "Led university tech club as President"
            ]
          }
        ],
        skills: {
          categories: [
            {
              name: "Programming Languages",
              items: ["JavaScript", "TypeScript", "Python", "Java", "SQL", "HTML/CSS"]
            },
            {
              name: "Frontend Technologies",
              items: ["React", "Next.js", "Redux", "React Query", "Tailwind CSS", "Material-UI", "Webpack", "Vite"]
            },
            {
              name: "Backend Technologies",
              items: ["Node.js", "Express.js", "NestJS", "GraphQL", "REST APIs", "PostgreSQL", "MongoDB", "Redis"]
            },
            {
              name: "Cloud & DevOps",
              items: ["AWS (EC2, S3, Lambda)", "Docker", "Kubernetes", "CI/CD", "GitHub Actions", "Vercel", "Netlify"]
            },
            {
              name: "Tools & Practices",
              items: ["Git", "Agile/Scrum", "Test-Driven Development", "Code Review", "Performance Optimization", "System Design"]
            }
          ]
        },
        projects: [
          {
            name: "ResumeForge",
            description: "AI-powered resume builder that creates tailored resumes for specific job applications",
            technologies: ["Next.js", "TypeScript", "Supabase", "Google Gemini AI", "Tailwind CSS"],
            bullets: [
              "Built full-stack application with real-time Gmail integration for job tracking",
              "Implemented AI-driven resume optimization achieving 85%+ ATS scores",
              "Created automated job discovery system processing 1000+ emails daily"
            ],
            link: "github.com/HarshaVippala/ResumeForge"
          }
        ]
      };
    } else if (source === 'existing' && resumeId) {
      // Import from an existing resume
      const { data: existingResume, error } = await db
        .from('resumes')
        .select('content')
        .eq('id', resumeId)
        .single();

      if (error || !existingResume) {
        return NextResponse.json(
          { error: 'Resume not found' },
          { status: 404 }
        );
      }

      importedContent = existingResume.content;
    } else if (source === 'manual' && resumeData) {
      // Import from manual JSON input
      importedContent = resumeData;
    } else {
      return NextResponse.json(
        { error: 'Invalid import source or missing data' },
        { status: 400 }
      );
    }

    // Validate the imported content
    if (!importedContent || !importedContent.contact || !importedContent.experience || !importedContent.education) {
      return NextResponse.json(
        { error: 'Invalid resume format. Must include contact, experience, and education sections.' },
        { status: 400 }
      );
    }

    // Extract skills for indexing
    const mainSkills = [];
    const techStack = [];
    
    if (importedContent.skills) {
      if (Array.isArray(importedContent.skills)) {
        mainSkills.push(...importedContent.skills);
      } else if (importedContent.skills.categories) {
        importedContent.skills.categories.forEach((category: any) => {
          mainSkills.push(...(category.items || []));
        });
      } else if (importedContent.skills.all) {
        mainSkills.push(...importedContent.skills.all);
      }
    }

    // Extract tech stack from skills
    const techKeywords = ['react', 'node', 'typescript', 'javascript', 'python', 'aws', 'docker', 'kubernetes', 'graphql', 'postgresql', 'mongodb'];
    techStack.push(...mainSkills.filter((skill: string) => 
      techKeywords.some(tech => skill.toLowerCase().includes(tech))
    ));

    // Check if any master resume already exists
    const { count: existingCount } = await db
      .from('resumes')
      .select('id', { count: 'exact', head: true })
      .eq('is_master', true)
      .eq('is_active', true);

    // Create the master resume
    const newMasterResume: ResumeInsert = {
      name: name || `Master Resume - ${new Date().toLocaleDateString()}`,
      content: importedContent,
      main_skills: mainSkills.slice(0, 20), // Top 20 skills
      tech_stack: techStack.slice(0, 10), // Top 10 tech stack items
      focus_area: 'fullstack', // Default, can be updated later
      tags: ['master', 'imported'],
      is_master: true,
      is_active: true,
      version: 1,
      submission_count: 0,
      tailoring_notes: `Master resume imported from ${source}`
    };

    const { data: createdResume, error: createError } = await db
      .from('resumes')
      .insert(newMasterResume)
      .select()
      .single();

    if (createError) {
      console.error('Error creating master resume:', createError);
      return NextResponse.json(
        { error: 'Failed to create master resume' },
        { status: 500 }
      );
    }

    // Log activity
    await db
      .from('activity_log')
      .insert({
        event_type: 'master_resume_imported',
        entity_type: 'resume',
        entity_id: createdResume.id,
        description: `Imported master resume from ${source}`,
        metadata: {
          source,
          resume_name: createdResume.name,
          skills_count: mainSkills.length,
          experience_count: importedContent.experience?.length || 0
        },
        source: 'user'
      });

    return NextResponse.json({
      success: true,
      message: 'Master resume imported successfully',
      masterResume: {
        id: createdResume.id,
        name: createdResume.name,
        isMaster: createdResume.is_master,
        content: createdResume.content,
        mainSkills: createdResume.main_skills,
        techStack: createdResume.tech_stack,
        createdAt: createdResume.created_at
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Master resume import error:', error);
    return NextResponse.json(
      { error: 'Internal server error during import' },
      { status: 500 }
    );
  }
}