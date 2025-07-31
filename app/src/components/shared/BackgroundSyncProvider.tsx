'use client'

import { useEffect } from 'react'
import { backgroundSyncService } from '@/services/backgroundSyncService'
import { backgroundJobScraper } from '@/services/backgroundJobScraper'

/**
 * Background Services Provider
 * Ensures background services are initialized and persist across navigation
 */
export function BackgroundSyncProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Initialize background services with a small delay
    // This ensures the app is fully mounted before starting services
    const timer = setTimeout(() => {
      // Load saved settings and apply them
      const savedSettings = localStorage.getItem('dashboard-settings')
      let settings = {
        emailSyncFrequency: '1hr',
        jobScrapingFrequency: '6hr',
        emailNotifications: true,
        lmStudioModel: 'deepseek/deepseek-r1-0528-qwen3-8b',
        lmStudioPort: '1234'
      }
      
      if (savedSettings) {
        try {
          settings = { ...settings, ...JSON.parse(savedSettings) }
        } catch (error) {
          console.warn('Failed to parse saved settings:', error)
        }
      }
      
      // Initialize email sync service
      backgroundSyncService.initialize()
      
      // Initialize job scraping service
      backgroundJobScraper.initialize()
      
      // Apply saved frequency settings
      const EMAIL_SYNC_OPTIONS = [
        { value: '30min', ms: 30 * 60 * 1000 },
        { value: '1hr', ms: 60 * 60 * 1000 },
        { value: '3hr', ms: 3 * 60 * 60 * 1000 },
        { value: '6hr', ms: 6 * 60 * 60 * 1000 },
        { value: '12hr', ms: 12 * 60 * 60 * 1000 }
      ]
      
      const JOB_SCRAPING_OPTIONS = [
        { value: '1hr', ms: 60 * 60 * 1000 },
        { value: '3hr', ms: 3 * 60 * 60 * 1000 },
        { value: '6hr', ms: 6 * 60 * 60 * 1000 },
        { value: '12hr', ms: 12 * 60 * 60 * 1000 },
        { value: '24hr', ms: 24 * 60 * 60 * 1000 }
      ]
      
      // Apply email sync frequency after a short delay to ensure initialization is complete
      setTimeout(() => {
        const emailFreqMs = EMAIL_SYNC_OPTIONS.find(opt => opt.value === settings.emailSyncFrequency)?.ms || 60 * 60 * 1000
        const jobFreqMs = JOB_SCRAPING_OPTIONS.find(opt => opt.value === settings.jobScrapingFrequency)?.ms || 6 * 60 * 60 * 1000
        
        backgroundSyncService.updateSyncFrequency(emailFreqMs)
        backgroundJobScraper.updateScrapeFrequency(jobFreqMs)
        
        console.log(`⚙️ Applied settings - Email sync: ${settings.emailSyncFrequency}, Job scraping: ${settings.jobScrapingFrequency}`)
      }, 1000)
      
      // Make services globally available for settings
      if (typeof window !== 'undefined') {
        (window as any).backgroundSyncService = backgroundSyncService;
        (window as any).backgroundJobScraper = backgroundJobScraper;
      }
      
      console.log('🚀 Background services initialized')
    }, 100)

    // Cleanup on app unmount (though this rarely happens in Next.js)
    return () => {
      clearTimeout(timer)
      backgroundSyncService.destroy()
      backgroundJobScraper.destroy()
      console.log('🛑 Background services destroyed')
    }
  }, [])

  return <>{children}</>
}