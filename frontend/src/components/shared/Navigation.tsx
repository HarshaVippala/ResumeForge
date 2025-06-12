'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  FileText, 
  Library, 
  Plus, 
  Briefcase, 
  BarChart3, 
  Settings,
  Menu,
  X,
  Search
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme/theme-toggle'
import { ServiceStatus } from '@/components/shared/ServiceStatus'
import { SettingsPopover } from '@/components/dashboard/SettingsPopover'

const navigationItems = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: BarChart3,
    description: 'Your home dashboard'
  },
  {
    name: 'Jobs',
    href: '/dashboard/jobs',
    icon: Search,
    description: 'Discover software engineering jobs'
  },
  {
    name: 'Job Tracker',
    href: '/dashboard/tracker',
    icon: Briefcase,
    description: 'Track your job applications'
  },
  {
    name: 'Generator',
    href: '/dashboard/generator',
    icon: Plus,
    description: 'Create new tailored resumes'
  },
  {
    name: 'Library',
    href: '/dashboard/library',
    icon: Library,
    description: 'Browse and manage your resumes'
  }
]

export function Navigation() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [activeTrigger, setActiveTrigger] = useState<'desktop' | 'mobile'>('desktop')
  const settingsButtonRef = useRef<HTMLButtonElement>(null)
  const mobileSettingsRef = useRef<HTMLButtonElement>(null)
  const pathname = usePathname()

  return (
    <nav className="bg-background dark:bg-elevation-1 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50 backdrop-blur-sm">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Brand */}
          <div className="flex items-center">
            <Link href="/dashboard" className="group">
              <span className="text-xl font-bold text-foreground group-hover:text-primary transition-colors duration-200">
                JOBTRACKER
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {navigationItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  )}
                >
                  <item.icon className="h-4 w-4 mr-2" />
                  {item.name}
                </Link>
              )
            })}
          </div>

          {/* Right side - Service Status, Theme Toggle, Settings and Mobile Menu */}
          <div className="flex items-center space-x-2">
            <ServiceStatus className="hidden md:flex" />
            
            {/* Separator */}
            <div className="hidden md:block w-px h-4 bg-border mx-2" />
            
            <ThemeToggle />
            
            <Button 
              ref={settingsButtonRef}
              variant="ghost" 
              size="icon" 
              className="hidden md:flex"
              onClick={() => {
                setActiveTrigger('desktop')
                setIsSettingsOpen(!isSettingsOpen)
              }}
            >
              <Settings className="h-4 w-4" />
            </Button>
            
            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-border">
          <div className="px-2 pt-2 pb-3 space-y-1 bg-background dark:bg-elevation-1">
            {navigationItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'flex items-center px-3 py-2 rounded-md text-base font-medium',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  )}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <item.icon className="h-5 w-5 mr-3" />
                  <div>
                    <div>{item.name}</div>
                    <div className="text-xs text-muted-foreground">{item.description}</div>
                  </div>
                </Link>
              )
            })}
            
            <div className="border-t border-border pt-2 mt-2 space-y-1">
              <div className="px-3 py-2">
                <div className="text-sm font-medium text-muted-foreground mb-2">Services</div>
                <ServiceStatus />
              </div>
              
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-base font-medium text-muted-foreground">Theme</span>
                <ThemeToggle />
              </div>
              
              <button
                ref={mobileSettingsRef}
                className="flex items-center px-3 py-2 rounded-md text-base font-medium text-muted-foreground hover:text-foreground hover:bg-accent w-full text-left"
                onClick={() => {
                  setIsMobileMenuOpen(false)
                  setActiveTrigger('mobile')
                  setIsSettingsOpen(true)
                }}
              >
                <Settings className="h-5 w-5 mr-3" />
                Settings
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Settings Popover */}
      <SettingsPopover 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)}
        triggerRef={activeTrigger === 'desktop' ? settingsButtonRef : mobileSettingsRef}
      />
    </nav>
  )
}