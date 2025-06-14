import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Building2, 
  MapPin, 
  Calendar, 
  DollarSign, 
  ExternalLink, 
  Heart, 
  Play, 
  RefreshCw,
  Shield,
  ShieldCheck,
  ShieldX,
  Clock,
  Code,
  Database,
  Cloud,
  Wrench
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Job } from '@/services/backgroundJobScraper';

interface EnhancedJobCardProps {
  job: Job;
  isGeneratingResume: boolean;
  onJobClick: (job: Job, event: React.MouseEvent) => void;
  onTailorResume: (job: Job, event: React.MouseEvent) => void;
  onSaveJob: (jobId: string) => void;
}

export const EnhancedJobCard: React.FC<EnhancedJobCardProps> = ({
  job,
  isGeneratingResume,
  onJobClick,
  onTailorResume,
  onSaveJob
}) => {
  
  // Helper functions
  const formatJobDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays} days ago`;
      return date.toLocaleDateString();
    } catch {
      return 'Unknown';
    }
  };

  const formatSalary = (minSalary: number | null, maxSalary: number | null, currency: string = 'USD') => {
    if (!minSalary && !maxSalary) return null;
    
    const formatNumber = (num: number) => {
      if (num >= 1000) {
        return `${(num / 1000).toFixed(0)}K`;
      }
      return num.toString();
    };

    if (minSalary && maxSalary && minSalary !== maxSalary) {
      return `$${formatNumber(minSalary)} - $${formatNumber(maxSalary)}`;
    }
    
    return `$${formatNumber(minSalary || maxSalary || 0)}`;
  };

  const getExperienceLevelColor = (level: string) => {
    switch (level) {
      case 'entry': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'mid': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'senior': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getSponsorshipBadge = () => {
    if (!job.sponsorship_status) return null;
    
    const configs = {
      'SPONSORS_H1B': {
        icon: ShieldCheck,
        color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
        text: 'Sponsors H1B'
      },
      'NO_SPONSORSHIP': {
        icon: ShieldX,
        color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
        text: 'No Sponsorship'
      },
      'UNCERTAIN': {
        icon: Shield,
        color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
        text: 'Sponsorship Unclear'
      }
    };

    const config = configs[job.sponsorship_status];
    const Icon = config.icon;
    
    return (
      <Badge className={cn("text-xs h-6 px-2 flex items-center gap-1", config.color)}>
        <Icon className="h-3 w-3" />
        {config.text}
        {job.sponsorship_confidence && job.sponsorship_confidence < 0.8 && (
          <span className="text-xs opacity-70">({Math.round(job.sponsorship_confidence * 100)}%)</span>
        )}
      </Badge>
    );
  };

  const getTechnologyIcon = (category: string) => {
    switch (category) {
      case 'LANGUAGE': return Code;
      case 'DATABASE': return Database;
      case 'CLOUD_PLATFORM': return Cloud;
      case 'DEVOPS_TOOL': return Wrench;
      default: return Code;
    }
  };

  const getTechnologies = () => {
    if (job.enhanced_tech_stack?.technologies) {
      return job.enhanced_tech_stack.technologies;
    }
    
    // Fallback to basic skills
    return job.skills.map(skill => ({
      name: skill,
      category: 'SOFTWARE' as const,
      level: 'REQUIRED' as const
    }));
  };

  const requiredTech = getTechnologies().filter(tech => tech.level === 'REQUIRED').slice(0, 4);
  const preferredTech = getTechnologies().filter(tech => tech.level === 'PREFERRED').slice(0, 2);
  const totalTechCount = getTechnologies().length;

  const getPlatformColor = (platform: string) => {
    switch (platform) {
      case 'indeed': return 'bg-blue-500';
      case 'glassdoor': return 'bg-green-500';
      case 'ziprecruiter': return 'bg-orange-500';
      case 'linkedin': return 'bg-blue-600';
      default: return 'bg-gray-500';
    }
  };

  return (
    <Card 
      className="p-4 hover:shadow-md hover:border-primary/20 transition-all duration-200 cursor-pointer group"
      onClick={(e) => onJobClick(job, e)}
    >
      <div className="space-y-4">
        {/* Header Section */}
        <div className="flex justify-between items-start">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2">
                {job.title}
              </h3>
              <div className="flex items-center gap-1 flex-shrink-0">
                <div className={cn("w-1.5 h-1.5 rounded-full", getPlatformColor(job.platform))}></div>
                <span className="text-xs text-muted-foreground capitalize">{job.platform}</span>
              </div>
            </div>
            
            <div className="flex items-center gap-3 text-sm text-muted-foreground mb-3">
              <div className="flex items-center gap-1.5">
                <Building2 className="h-4 w-4" />
                <span className="font-medium">{job.company}</span>
              </div>
              {job.location && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  <span>{job.location}</span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>{formatJobDate(job.date_posted || job.scraped_at)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Key Indicators Row */}
        <div className="flex flex-wrap gap-2 items-center">
          {/* Experience Level */}
          <Badge className={cn("text-xs h-6 px-2", getExperienceLevelColor(job.experience_level))}>
            {job.experience_level}
          </Badge>

          {/* Remote/Job Type */}
          {job.remote && (
            <Badge variant="secondary" className="text-xs h-6 px-2">
              Remote
            </Badge>
          )}
          
          <Badge variant="outline" className="text-xs h-6 px-2">
            {job.job_type}
          </Badge>

          {/* Sponsorship Badge */}
          {getSponsorshipBadge()}

          {/* Salary */}
          {(job.salary_min || job.salary_max) && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground ml-auto">
              <DollarSign className="h-4 w-4" />
              <span className="text-xs font-medium">
                {formatSalary(job.salary_min ?? null, job.salary_max ?? null, job.salary_currency)}
              </span>
            </div>
          )}
        </div>

        {/* Technology Stack Section */}
        {totalTechCount > 0 && (
          <div className="space-y-2">
            {/* Required Technologies */}
            {requiredTech.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground">Required</div>
                <div className="flex flex-wrap gap-1">
                  {requiredTech.map((tech, index) => {
                    const Icon = getTechnologyIcon(tech.category);
                    return (
                      <Badge 
                        key={index} 
                        variant="default" 
                        className="text-xs h-6 px-2 flex items-center gap-1"
                      >
                        <Icon className="h-3 w-3" />
                        {tech.name}
                        {tech.experience_years && (
                          <span className="text-xs opacity-70">({tech.experience_years})</span>
                        )}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Preferred Technologies */}
            {preferredTech.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground">Preferred</div>
                <div className="flex flex-wrap gap-1">
                  {preferredTech.map((tech, index) => {
                    const Icon = getTechnologyIcon(tech.category);
                    return (
                      <Badge 
                        key={index} 
                        variant="outline" 
                        className="text-xs h-6 px-2 flex items-center gap-1"
                      >
                        <Icon className="h-3 w-3" />
                        {tech.name}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tech Count Summary */}
            {totalTechCount > 6 && (
              <div className="text-xs text-muted-foreground">
                +{totalTechCount - 6} more technologies
              </div>
            )}
          </div>
        )}

        {/* Job Description Preview */}
        <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
          {job.description_preview || job.description?.substring(0, 200) + '...'}
        </p>

        {/* Actions Section */}
        <div className="flex justify-between items-center pt-2 border-t job-actions">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onSaveJob(job.job_id);
              }}
              className="h-8 w-8 p-0"
            >
              <Heart className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                window.open(job.application_url, '_blank');
              }}
              className="h-8 w-8 p-0"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </div>

          <Button
            size="sm"
            onClick={(e) => onTailorResume(job, e)}
            disabled={isGeneratingResume}
            className="h-8 px-3 flex items-center gap-1.5"
          >
            {isGeneratingResume ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                <span className="text-xs font-medium">Generating...</span>
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">Tailor Resume</span>
              </>
            )}
          </Button>
        </div>

        {/* Processing Status Indicator */}
        {job.processing_status && job.processing_status !== 'completed' && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1 border-t">
            <Clock className="h-3 w-3" />
            <span>
              {job.processing_status === 'processing' ? 'Enhancing job data...' : 
               job.processing_status === 'new' ? 'Pending enhancement' : 
               'Enhancement failed'}
            </span>
          </div>
        )}
      </div>
    </Card>
  );
};