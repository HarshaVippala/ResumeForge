'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  X, 
  Settings, 
  Clock, 
  Search, 
  Bell, 
  BellOff,
  Brain,
  ChevronRight,
  RefreshCw,
  Check,
  Zap,
  LogOut
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSessionManager } from '@/hooks/useSessionManager'
import { motion, AnimatePresence } from 'framer-motion'
import { fadeIn, scaleIn, hoverScale, tapScale } from '@/lib/animations'

interface SettingsPopoverProps {
  isOpen: boolean
  onClose: () => void
  triggerRef: React.RefObject<HTMLButtonElement | null>
}

interface SettingsState {
  emailSyncFrequency: string
  jobScrapingFrequency: string
  emailNotifications: boolean
  lmStudioModel: string
  lmStudioPort: string
}

const EMAIL_SYNC_OPTIONS = [
  { value: '30min', label: '30m', fullLabel: '30 minutes', ms: 30 * 60 * 1000 },
  { value: '1hr', label: '1h', fullLabel: '1 hour', ms: 60 * 60 * 1000 },
  { value: '3hr', label: '3h', fullLabel: '3 hours', ms: 3 * 60 * 60 * 1000 },
  { value: '6hr', label: '6h', fullLabel: '6 hours', ms: 6 * 60 * 60 * 1000 },
  { value: '12hr', label: '12h', fullLabel: '12 hours', ms: 12 * 60 * 60 * 1000 }
]

const JOB_SCRAPING_OPTIONS = [
  { value: '1hr', label: '1h', fullLabel: '1 hour', ms: 60 * 60 * 1000 },
  { value: '3hr', label: '3h', fullLabel: '3 hours', ms: 3 * 60 * 60 * 1000 },
  { value: '6hr', label: '6h', fullLabel: '6 hours', ms: 6 * 60 * 60 * 1000 },
  { value: '12hr', label: '12h', fullLabel: '12 hours', ms: 12 * 60 * 60 * 1000 },
  { value: '24hr', label: '24h', fullLabel: '24 hours', ms: 24 * 60 * 60 * 1000 }
]

const LM_STUDIO_MODELS = [
  { value: 'deepseek/deepseek-r1-0528-qwen3-8b', label: 'DeepSeek R1', description: 'Recommended for general use' },
  { value: 'deepseek/deepseek-coder-v2', label: 'DeepSeek Coder V2', description: 'Optimized for code analysis' },
  { value: 'llama/llama-3.2-8b', label: 'Llama 3.2 8B', description: 'Fast and efficient' },
  { value: 'qwen/qwen2.5-7b', label: 'Qwen 2.5 7B', description: 'Balanced performance' }
]

export function SettingsPopover({ isOpen, onClose, triggerRef }: SettingsPopoverProps) {
  const { logout } = useSessionManager()
  const [settings, setSettings] = useState<SettingsState>({
    emailSyncFrequency: '1hr',
    jobScrapingFrequency: '6hr',
    emailNotifications: true,
    lmStudioModel: 'deepseek/deepseek-r1-0528-qwen3-8b',
    lmStudioPort: '1234'
  })
  
  const [hasChanges, setHasChanges] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0, placement: 'bottom-right' })
  const [isDarkMode, setIsDarkMode] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  // Check for dark mode
  useEffect(() => {
    const checkDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'))
    }
    
    checkDarkMode()
    
    // Watch for theme changes
    const observer = new MutationObserver(checkDarkMode)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    })
    
    return () => observer.disconnect()
  }, [])

  // Calculate position relative to trigger
  useEffect(() => {
    if (isOpen && triggerRef.current && popoverRef.current) {
      const trigger = triggerRef.current.getBoundingClientRect()
      const popover = popoverRef.current.getBoundingClientRect()
      const viewport = {
        width: window.innerWidth,
        height: window.innerHeight
      }

      let top = trigger.bottom + 8
      let left = trigger.right - 400 // Popover width is 400px
      let placement = 'bottom-right'

      // Adjust if popover would go off-screen
      if (left < 8) {
        left = trigger.left
        placement = 'bottom-left'
      }
      
      if (top + 600 > viewport.height) { // Estimated popover height
        top = trigger.top - 600 - 8
        placement = placement.replace('bottom', 'top')
      }

      setPosition({ top, left, placement })
    }
  }, [isOpen, triggerRef])

  // Load settings from localStorage on mount
  useEffect(() => {
    if (isOpen) {
      const savedSettings = localStorage.getItem('dashboard-settings')
      if (savedSettings) {
        try {
          const parsed = JSON.parse(savedSettings)
          setSettings(parsed)
        } catch (error) {
          console.warn('Failed to parse saved settings:', error)
        }
      }
    }
  }, [isOpen])

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isOpen && popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        if (triggerRef.current && !triggerRef.current.contains(event.target as Node)) {
          onClose()
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, onClose, triggerRef])

  const handleSettingChange = (key: keyof SettingsState, value: string | boolean) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }))
    setHasChanges(true)
  }

  const handleSave = async () => {
    setIsSaving(true)
    
    try {
      // Save to localStorage
      localStorage.setItem('dashboard-settings', JSON.stringify(settings))
      
      // Apply settings to background services
      await applySettings(settings)
      
      setHasChanges(false)
      
      // Show success feedback briefly then close
      setTimeout(() => {
        onClose()
      }, 800)
    } catch (error) {
      console.error('Failed to save settings:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const applySettings = async (newSettings: SettingsState) => {
    const syncService = (window as any).backgroundSyncService
    if (syncService && syncService.updateSyncFrequency) {
      syncService.updateSyncFrequency(
        EMAIL_SYNC_OPTIONS.find(opt => opt.value === newSettings.emailSyncFrequency)?.ms || 60 * 60 * 1000
      )
    }
    
    const jobScraper = (window as any).backgroundJobScraper
    if (jobScraper && jobScraper.updateScrapeFrequency) {
      jobScraper.updateScrapeFrequency(
        JOB_SCRAPING_OPTIONS.find(opt => opt.value === newSettings.jobScrapingFrequency)?.ms || 6 * 60 * 60 * 1000
      )
    }
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop - invisible, just for click outside */}
      <div className="fixed inset-0 z-40" onClick={onClose} />
      
      {/* Popover */}
      <div
        ref={popoverRef}
        className="fixed z-50 w-[400px] border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl"
        style={{
          top: position.top,
          left: position.left,
          backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
        } as React.CSSProperties}
      >
        {/* Arrow */}
        <div 
          className={cn(
            "absolute w-3 h-3 border-l border-t border-gray-200 dark:border-gray-700 rotate-45",
            position.placement.includes('bottom') ? "-top-1.5 right-6" : "-bottom-1.5 right-6"
          )}
          style={{ backgroundColor: isDarkMode ? '#1f2937' : '#ffffff' }}
        />
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/10">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-primary/10 rounded-lg">
              <Settings className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Dashboard Settings</h3>
              <p className="text-xs text-muted-foreground">Customize your experience</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-6 w-6 p-0">
            <X className="h-3 w-3" />
          </Button>
        </div>
        
        {/* Content */}
        <div className="p-4 space-y-6 max-h-[500px] overflow-y-auto">
          {/* Email Sync Frequency */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-500" />
                <span className="font-medium text-sm">Email Sync</span>
              </div>
              <Badge variant="secondary" className="text-xs">
                {EMAIL_SYNC_OPTIONS.find(opt => opt.value === settings.emailSyncFrequency)?.fullLabel}
              </Badge>
            </div>
            
            <div className="grid grid-cols-5 gap-1.5">
              {EMAIL_SYNC_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  variant={settings.emailSyncFrequency === option.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleSettingChange('emailSyncFrequency', option.value)}
                  className="h-8 text-xs font-medium relative"
                >
                  {settings.emailSyncFrequency === option.value && (
                    <Check className="h-3 w-3 absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full p-0.5" />
                  )}
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Job Scraping Frequency */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-purple-500" />
                <span className="font-medium text-sm">Job Scraping</span>
              </div>
              <Badge variant="secondary" className="text-xs">
                {JOB_SCRAPING_OPTIONS.find(opt => opt.value === settings.jobScrapingFrequency)?.fullLabel}
              </Badge>
            </div>
            
            <div className="grid grid-cols-5 gap-1.5">
              {JOB_SCRAPING_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  variant={settings.jobScrapingFrequency === option.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleSettingChange('jobScrapingFrequency', option.value)}
                  className="h-8 text-xs font-medium relative"
                >
                  {settings.jobScrapingFrequency === option.value && (
                    <Check className="h-3 w-3 absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full p-0.5" />
                  )}
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Email Notifications */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-green-500" />
                <span className="font-medium text-sm">Notifications</span>
              </div>
              <Badge variant={settings.emailNotifications ? "default" : "secondary"} className="text-xs">
                {settings.emailNotifications ? "On" : "Off"}
              </Badge>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant={settings.emailNotifications ? "default" : "outline"}
                size="sm"
                onClick={() => handleSettingChange('emailNotifications', true)}
                className="flex-1 h-8 text-xs relative"
              >
                {settings.emailNotifications && (
                  <Check className="h-3 w-3 absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full p-0.5" />
                )}
                <Bell className="h-3 w-3 mr-1" />
                Enable
              </Button>
              <Button
                variant={!settings.emailNotifications ? "default" : "outline"}
                size="sm"
                onClick={() => handleSettingChange('emailNotifications', false)}
                className="flex-1 h-8 text-xs relative"
              >
                {!settings.emailNotifications && (
                  <Check className="h-3 w-3 absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full p-0.5" />
                )}
                <BellOff className="h-3 w-3 mr-1" />
                Disable
              </Button>
            </div>
          </div>

          {/* LM Studio Configuration */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-orange-500" />
              <span className="font-medium text-sm">AI Model</span>
            </div>
            
            <div className="space-y-2">
              {LM_STUDIO_MODELS.map((model) => (
                <div
                  key={model.value}
                  className={cn(
                    "p-3 rounded-lg border cursor-pointer transition-all hover:border-primary/50",
                    settings.lmStudioModel === model.value
                      ? "border-primary bg-primary/5 dark:bg-primary/10"
                      : "border-border/50 hover:bg-accent/30"
                  )}
                  onClick={() => handleSettingChange('lmStudioModel', model.value)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        settings.lmStudioModel === model.value ? "bg-primary" : "bg-muted-foreground/30"
                      )} />
                      <div>
                        <div className="font-medium text-sm">{model.label}</div>
                        <div className="text-xs text-muted-foreground">{model.description}</div>
                      </div>
                    </div>
                    {settings.lmStudioModel === model.value && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Port Configuration */}
            <div className="flex items-center gap-2 pt-2">
              <Zap className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Port:</span>
              <input
                type="text"
                value={settings.lmStudioPort}
                onChange={(e) => handleSettingChange('lmStudioPort', e.target.value)}
                className="flex-1 h-7 px-2 text-xs border border-border/50 rounded bg-background focus:border-primary focus:outline-none"
                placeholder="1234"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border/10 space-y-3">
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onClose}
              className="flex-1 h-8 text-xs"
            >
              Cancel
            </Button>
            <Button 
              size="sm" 
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              className="flex-1 h-8 text-xs"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="h-3 w-3 mr-1" />
                  Save
                </>
              )}
            </Button>
          </div>
          
          {/* Logout Button */}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={logout}
            className="w-full h-8 text-xs border-destructive/50 text-destructive hover:bg-destructive/10"
          >
            <LogOut className="h-3 w-3 mr-1" />
            Logout
          </Button>
        </div>
      </div>
    </>
  )
}