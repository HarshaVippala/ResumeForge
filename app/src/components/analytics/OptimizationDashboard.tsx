'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, TrendingUp, TrendingDown, Award, Clock, Target, Zap } from 'lucide-react';

/**
 * Optimization Performance Dashboard
 * Created: 2025-01-10
 * 
 * Visualizes resume optimization performance metrics
 */

interface OptimizationStats {
  summary: {
    totalOptimizations: number;
    avgInitialScore: number;
    avgFinalScore: number;
    avgImprovement: number;
    avgIterations: number;
    avgTimeSeconds: number;
    convergenceRate: number;
  };
  scoreDistribution: Record<string, number>;
  performanceOverTime: Array<{
    period: string;
    optimizations: number;
    avgInitialScore: number;
    avgFinalScore: number;
    avgImprovement: number;
    convergenceRate: number;
  }>;
  topAddedKeywords: Array<{ keyword: string; count: number }>;
}

interface KeywordPerformance {
  topPerformingKeywords: Array<{
    keyword: string;
    metrics: {
      totalApplications: number;
      responseRate: number;
      interviewRate: number;
      offerRate: number;
    };
  }>;
  keywordCombinations: Array<{
    combination: string;
    applications: number;
    successRate: number;
  }>;
  trendingKeywords: Array<{ keyword: string; recentUses: number }>;
}

interface ResumePerformance {
  summary: {
    totalResumes: number;
    avgResponseRate: number;
    avgInterviewRate: number;
    avgOfferRate: number;
  };
  performanceByScore: Array<{
    scoreRange: string;
    responseRate: number;
    interviewRate: number;
    offerRate: number;
  }>;
  topPerformingResumes: Array<{
    name: string;
    atsScore: number;
    metrics: {
      responseRate: number;
      interviewRate: number;
      offerRate: number;
    };
  }>;
}

export default function OptimizationDashboard() {
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30d');
  const [activeTab, setActiveTab] = useState('overview');
  
  const [optimizationStats, setOptimizationStats] = useState<OptimizationStats | null>(null);
  const [keywordPerformance, setKeywordPerformance] = useState<KeywordPerformance | null>(null);
  const [resumePerformance, setResumePerformance] = useState<ResumePerformance | null>(null);
  
  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [optStats, keyPerf, resPerf] = await Promise.all([
          fetch(`/api/analytics/optimization-stats?timeRange=${timeRange}`).then(r => r.json()),
          fetch(`/api/analytics/keyword-performance`).then(r => r.json()),
          fetch(`/api/analytics/resume-performance?timeRange=${timeRange}`).then(r => r.json())
        ]);
        
        setOptimizationStats(optStats);
        setKeywordPerformance(keyPerf);
        setResumePerformance(resPerf);
      } catch (error) {
        console.error('Failed to fetch analytics:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [timeRange]);
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Optimization Analytics</h2>
          <p className="text-muted-foreground">
            Track resume optimization performance and outcomes
          </p>
        </div>
        
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select time range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
            <SelectItem value="all">All time</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      {/* Summary Cards */}
      {optimizationStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Optimizations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {optimizationStats.summary.totalOptimizations}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Resumes optimized
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Average Improvement</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div className="text-2xl font-bold">
                  +{optimizationStats.summary.avgImprovement}%
                </div>
                <TrendingUp className="h-4 w-4 text-green-500" />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Score increase
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Convergence Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div className="text-2xl font-bold">
                  {optimizationStats.summary.convergenceRate}%
                </div>
                <Target className="h-4 w-4 text-blue-500" />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Reached target score
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Avg Optimization Time</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div className="text-2xl font-bold">
                  {optimizationStats.summary.avgTimeSeconds}s
                </div>
                <Clock className="h-4 w-4 text-purple-500" />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Processing time
              </p>
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3 w-full max-w-md">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="keywords">Keywords</TabsTrigger>
          <TabsTrigger value="resumes">Resumes</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-4 mt-6">
          {/* Score Distribution */}
          {optimizationStats && (
            <Card>
              <CardHeader>
                <CardTitle>Score Distribution</CardTitle>
                <CardDescription>
                  Final scores after optimization
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(optimizationStats.scoreDistribution).map(([range, count]) => {
                    const total = optimizationStats.summary.totalOptimizations;
                    const percentage = total > 0 ? (count / total) * 100 : 0;
                    
                    return (
                      <div key={range} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>{range}</span>
                          <span className="text-muted-foreground">{count} resumes</span>
                        </div>
                        <Progress value={percentage} className="h-2" />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Performance Over Time */}
          {optimizationStats && optimizationStats.performanceOverTime.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Performance Trends</CardTitle>
                <CardDescription>
                  Average scores and improvements over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {optimizationStats.performanceOverTime.slice(0, 5).map((period) => (
                    <div key={period.period} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">
                          {new Date(period.period).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric' 
                          })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {period.optimizations} optimizations
                        </p>
                      </div>
                      <div className="flex gap-4 text-sm">
                        <div className="text-right">
                          <p className="font-medium">{period.avgFinalScore}%</p>
                          <p className="text-xs text-muted-foreground">Avg Score</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-green-600">+{period.avgImprovement}%</p>
                          <p className="text-xs text-muted-foreground">Improvement</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        
        <TabsContent value="keywords" className="space-y-4 mt-6">
          {/* Top Performing Keywords */}
          {keywordPerformance && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Top Performing Keywords</CardTitle>
                  <CardDescription>
                    Keywords with highest success rates
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {keywordPerformance.topPerformingKeywords.slice(0, 10).map((kw) => (
                      <div key={kw.keyword} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{kw.keyword}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {kw.metrics.totalApplications} applications
                          </span>
                        </div>
                        <div className="flex gap-3 text-sm">
                          <div className="text-right">
                            <p className="font-medium">{kw.metrics.responseRate}%</p>
                            <p className="text-xs text-muted-foreground">Response</p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-blue-600">{kw.metrics.interviewRate}%</p>
                            <p className="text-xs text-muted-foreground">Interview</p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-green-600">{kw.metrics.offerRate}%</p>
                            <p className="text-xs text-muted-foreground">Offer</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              
              {/* Trending Keywords */}
              <Card>
                <CardHeader>
                  <CardTitle>Trending Keywords</CardTitle>
                  <CardDescription>
                    Most frequently added in recent optimizations
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {keywordPerformance.trendingKeywords.map((kw) => (
                      <Badge key={kw.keyword} variant="outline" className="flex items-center gap-1">
                        <Zap className="h-3 w-3" />
                        {kw.keyword}
                        <span className="text-xs ml-1">({kw.recentUses})</span>
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
        
        <TabsContent value="resumes" className="space-y-4 mt-6">
          {/* Resume Performance by Score */}
          {resumePerformance && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Performance by ATS Score</CardTitle>
                  <CardDescription>
                    How different score ranges perform in applications
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {resumePerformance.performanceByScore.map((range) => (
                      <div key={range.scoreRange} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">{range.scoreRange}</span>
                          <div className="flex gap-4 text-sm">
                            <span>Response: {range.responseRate}%</span>
                            <span className="text-blue-600">Interview: {range.interviewRate}%</span>
                            <span className="text-green-600">Offer: {range.offerRate}%</span>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Progress value={range.responseRate} className="h-1.5 flex-1" />
                          <Progress value={range.interviewRate} className="h-1.5 flex-1" />
                          <Progress value={range.offerRate} className="h-1.5 flex-1" />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              
              {/* Top Performing Resumes */}
              <Card>
                <CardHeader>
                  <CardTitle>Top Performing Resumes</CardTitle>
                  <CardDescription>
                    Resumes with best application outcomes
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {resumePerformance.topPerformingResumes.map((resume, index) => (
                      <div key={index} className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                          <p className="font-medium">{resume.name}</p>
                          <p className="text-sm text-muted-foreground">
                            ATS Score: {resume.atsScore}%
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {resume.metrics.offerRate > 0 && (
                            <Award className="h-4 w-4 text-green-600" />
                          )}
                          <div className="text-sm text-right">
                            <p>{resume.metrics.responseRate}% → {resume.metrics.interviewRate}% → {resume.metrics.offerRate}%</p>
                            <p className="text-xs text-muted-foreground">Response → Interview → Offer</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}