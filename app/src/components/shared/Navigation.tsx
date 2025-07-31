'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  FileText, 
  Library, 
  Briefcase, 
  BarChart3, 
  Settings,
  Menu,
  X,
  Search,
  Bell,
  Sparkles,
  Home,
  ChevronDown
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme/theme-toggle'
import { ServiceStatus } from '@/components/shared/ServiceStatus'
import { SettingsPopover } from '@/components/dashboard/SettingsPopover'
import { staggerContainer, staggerItem, hoverScale, tapScale, fadeIn } from '@/lib/animations'

const navigationItems = [
  {
    name: 'DASHBOARD',
    href: '/dashboard',
    icon: null,
    color: 'from-blue-500 via-blue-600 to-blue-700',
    hoverColor: 'from-blue-400 via-blue-500 to-blue-600',
    bgColor: 'bg-gradient-to-r from-blue-500/10 via-blue-600/10 to-blue-700/10',
    borderColor: 'border-blue-500/20',
    glowColor: 'shadow-blue-500/20'
  },
  {
    name: 'TRACKER',
    href: '/dashboard/tracker',
    icon: null,
    color: 'from-emerald-500 via-teal-500 to-cyan-500',
    hoverColor: 'from-emerald-400 via-teal-400 to-cyan-400',
    bgColor: 'bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-cyan-500/10',
    borderColor: 'border-emerald-500/20',
    glowColor: 'shadow-emerald-500/20'
  },
  {
    name: 'GENERATOR',
    href: '/dashboard/generator',
    icon: null,
    color: 'from-amber-500 via-orange-500 to-red-500',
    hoverColor: 'from-amber-400 via-orange-400 to-red-400',
    bgColor: 'bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-red-500/10',
    borderColor: 'border-amber-500/20',
    glowColor: 'shadow-amber-500/20'
  },
  {
    name: 'LIBRARY',
    href: '/dashboard/library',
    icon: null,
    color: 'from-purple-500 via-violet-500 to-pink-500',
    hoverColor: 'from-purple-400 via-violet-400 to-pink-400',
    bgColor: 'bg-gradient-to-r from-purple-500/10 via-violet-500/10 to-pink-500/10',
    borderColor: 'border-purple-500/20',
    glowColor: 'shadow-purple-500/20'
  }
]

export function Navigation() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [activeTrigger, setActiveTrigger] = useState<'desktop' | 'mobile'>('desktop')
  const [currentTime, setCurrentTime] = useState(new Date())
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)
  const [hasNotifications, setHasNotifications] = useState(true)
  const settingsButtonRef = useRef<HTMLButtonElement>(null)
  const mobileSettingsRef = useRef<HTMLButtonElement>(null)
  const pathname = usePathname()
  
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  return (
    <nav className="relative bg-gradient-to-r from-background/95 via-background/98 to-background/95 dark:from-background/80 dark:via-background/85 dark:to-background/80 backdrop-blur-2xl border-b border-border/40 sticky top-0 z-50 shadow-sm">
      {/* Enhanced premium gradient accent line */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/30 via-indigo-500/30 via-purple-500/30 via-pink-500/30 to-transparent" />
      
      {/* Subtle inner gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/5 via-transparent to-black/5 dark:from-white/2 dark:via-transparent dark:to-black/10 pointer-events-none" />
      
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Left side - Minimal Brand */}
          <div className="flex items-center">
            <Link href="/dashboard" className="group flex-shrink-0">
              <motion.h1 
                className="text-xl font-bold tracking-tight"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <span className="text-foreground">
                  WorkOS
                </span>
              </motion.h1>
            </Link>
          </div>

          {/* Desktop Navigation - Center with Premium Design */}
          <div className="hidden lg:flex items-center gap-1 absolute left-1/2 transform -translate-x-1/2">
            {navigationItems.map((item) => {
              const isActive = pathname === item.href
              const isHovered = hoveredItem === item.name
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onMouseEnter={() => setHoveredItem(item.name)}
                  onMouseLeave={() => setHoveredItem(null)}
                  className="relative group"
                >
                  <div className={cn(
                    'relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300',
                    isActive
                      ? 'text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}>
                    {/* Active/Hover Background with enhanced gradients */}
                    {(isActive || isHovered) && (
                      <motion.div
                        layoutId="navIndicator"
                        className={cn(
                          'absolute inset-0 rounded-xl border border-white/10',
                          isActive 
                            ? `${item.bgColor} shadow-lg ${item.glowColor}` 
                            : 'bg-gradient-to-r from-white/10 via-white/5 to-white/10 dark:from-white/5 dark:via-white/2 dark:to-white/5'
                        )}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                      />
                    )}
                    
                    {/* Text with gradient on hover */}
                    <span className={cn(
                      'relative z-10 text-xs tracking-wider font-bold transition-all duration-300',
                      isHovered && !isActive && 'bg-gradient-to-r bg-clip-text text-transparent',
                      isHovered && !isActive && item.hoverColor
                    )}>
                      {item.name}
                    </span>
                    
                    {/* Enhanced active indicator dot with gradient */}
                    {isActive && (
                      <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className={cn(
                          'absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-1 h-1 rounded-full',
                          `bg-gradient-to-r ${item.color}`
                        )}
                      />
                    )}
                  </div>
                </Link>
              )
            })}
          </div>

          {/* Right side - Premium Actions */}
          <div className="flex items-center gap-2">
            {/* Date Badge - Hidden on mobile */}
            <div className="hidden xl:flex items-center px-2.5 py-1 rounded-full bg-secondary/50 border border-border/50">
              <p className="text-xs font-medium text-muted-foreground">
                {currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </p>
            </div>
            
            {/* Premium Notification Button */}
            <motion.div 
              className="relative"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Button 
                variant="ghost" 
                size="sm" 
                className="relative h-9 w-9 p-0 rounded-xl hover:bg-secondary/50 border border-transparent hover:border-border/50 transition-all"
                onClick={() => setHasNotifications(false)}
              >
                <Bell className="h-4 w-4" />
                {hasNotifications && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 border border-background" />
                  </span>
                )}
              </Button>
            </motion.div>
            
            {/* Premium Theme Toggle */}
            <div className="relative">
              <ThemeToggle />
            </div>
            
            {/* Premium Settings Button */}
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Button 
                ref={settingsButtonRef}
                variant="ghost" 
                size="sm" 
                className="hidden lg:flex h-9 w-9 p-0 rounded-xl hover:bg-secondary/50 border border-transparent hover:border-border/50 transition-all"
                onClick={() => {
                  setActiveTrigger('desktop')
                  setIsSettingsOpen(!isSettingsOpen)
                }}
              >
                <Settings className="h-4 w-4" />
              </Button>
            </motion.div>
            
            {/* Mobile menu button with animation */}
            <motion.div
              className="lg:hidden"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Button
                variant="ghost"
                size="sm"
                className="h-9 w-9 p-0 rounded-xl hover:bg-secondary/50 border border-transparent hover:border-border/50 transition-all"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              >
                <AnimatePresence mode="wait">
                  {isMobileMenuOpen ? (
                    <motion.div
                      key="close"
                      initial={{ rotate: -90, opacity: 0 }}
                      animate={{ rotate: 0, opacity: 1 }}
                      exit={{ rotate: 90, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <X className="h-4 w-4" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="menu"
                      initial={{ rotate: 90, opacity: 0 }}
                      animate={{ rotate: 0, opacity: 1 }}
                      exit={{ rotate: -90, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Menu className="h-4 w-4" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </Button>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Menu - Premium Sliding Panel */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="lg:hidden overflow-hidden border-t border-border/50 bg-gradient-to-b from-background/98 via-background/95 to-background/98 backdrop-blur-2xl"
          >
            <div className="px-4 py-3 space-y-1.5">
              {navigationItems.map((item, index) => {
                const isActive = pathname === item.href
                return (
                  <motion.div
                    key={item.name}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Link
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all border',
                        isActive
                          ? cn(
                              'text-foreground shadow-lg',
                              item.bgColor,
                              item.borderColor,
                              item.glowColor
                            )
                          : 'text-muted-foreground hover:text-foreground hover:bg-gradient-to-r hover:from-white/10 hover:via-white/5 hover:to-white/10 dark:hover:from-white/5 dark:hover:via-white/2 dark:hover:to-white/5 border-transparent hover:border-white/10'
                      )}
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <p className="font-bold flex-1 text-sm tracking-wider">{item.name}</p>
                      {isActive && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className={cn(
                            'w-1.5 h-1.5 rounded-full',
                            `bg-gradient-to-r ${item.color}`
                          )}
                        />
                      )}
                    </Link>
                  </motion.div>
                )
              })}
              
              <motion.div
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: navigationItems.length * 0.05 }}
                className="border-t border-border/50 pt-3 mt-3"
              >
                <button
                  ref={mobileSettingsRef}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/50 w-full text-left border border-transparent hover:border-border/50 transition-all"
                  onClick={() => {
                    setIsMobileMenuOpen(false)
                    setActiveTrigger('mobile')
                    setIsSettingsOpen(true)
                  }}
                >
                  <div className="w-7 h-7 rounded-lg bg-secondary/50 flex items-center justify-center">
                    <Settings className="h-4 w-4" />
                  </div>
                  <p className="font-medium flex-1">Settings</p>
                </button>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Settings Popover */}
      <SettingsPopover 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)}
        triggerRef={activeTrigger === 'desktop' ? settingsButtonRef : mobileSettingsRef}
      />
    </nav>
  )
}