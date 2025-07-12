'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { InboxEmails } from '@/components/dashboard/InboxEmails'
import { DashboardOverview } from '@/components/dashboard/DashboardOverview'
import { UpcomingEventsCompact } from '@/components/dashboard/UpcomingEventsCompact'
import { 
  Inbox, 
  LayoutDashboard,
  Sparkles,
  TrendingUp,
  Activity
} from 'lucide-react'
import { pageTransition, fadeInUp, hoverScale, tapScale } from '@/lib/animations'

export default function DashboardPage() {
  const [selectedView, setSelectedView] = useState<'overview' | 'inbox'>('overview')
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const tabs = [
    { 
      id: 'overview', 
      label: 'Overview', 
      icon: LayoutDashboard,
      color: 'from-blue-500 via-indigo-500 to-purple-500',
      hoverColor: 'from-blue-400 via-indigo-400 to-purple-400',
      bgColor: 'bg-gradient-to-r from-blue-500/15 via-indigo-500/15 to-purple-500/15',
      borderColor: 'border-blue-500/30',
      glowColor: 'shadow-blue-500/25'
    },
    { 
      id: 'inbox', 
      label: 'Inbox', 
      icon: Inbox,
      color: 'from-emerald-500 via-teal-500 to-cyan-500',
      hoverColor: 'from-emerald-400 via-teal-400 to-cyan-400',
      bgColor: 'bg-gradient-to-r from-emerald-500/15 via-teal-500/15 to-cyan-500/15',
      borderColor: 'border-emerald-500/30',
      glowColor: 'shadow-emerald-500/25'
    }
  ]

  return (
    <div className="h-full bg-gradient-to-br from-background via-background/98 to-background/95 overflow-hidden">
      {/* Enhanced premium gradient accent */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/3 via-indigo-500/2 via-purple-500/2 to-pink-500/3 pointer-events-none" />
      
      {/* Subtle animated gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent dark:via-white/2 pointer-events-none animate-pulse" />
      
      {/* Mobile View - Premium Tabbed Interface */}
      <div className="block lg:hidden h-full relative">
        {/* Enhanced Premium Tab Switcher */}
        <div className="bg-gradient-to-r from-card/95 via-card/98 to-card/95 backdrop-blur-2xl border-b border-border/40 shadow-2xl">
          <div className="flex justify-around p-2 gap-2">
            {tabs.map((tab) => {
              const isActive = selectedView === tab.id
              return (
                <motion.button
                  key={tab.id}
                  onClick={() => setSelectedView(tab.id as any)}
                  className="relative flex-1 group"
                  whileHover={hoverScale}
                  whileTap={tapScale}
                >
                  <div className={cn(
                    "relative flex items-center justify-center gap-3 py-3 px-4 rounded-2xl text-sm font-medium transition-all duration-300 border",
                    isActive 
                      ? "text-foreground border-white/20 shadow-lg" 
                      : "text-muted-foreground hover:text-foreground border-transparent hover:border-white/10"
                  )}>
                    {/* Enhanced active background with gradient */}
                    {isActive && (
                      <motion.div
                        layoutId="activeMobileTab"
                        className={cn("absolute inset-0 rounded-2xl shadow-lg", tab.bgColor, tab.glowColor)}
                        transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                      />
                    )}
                    
                    {/* Enhanced icon with gradient */}
                    <div className="relative z-10">
                      {isActive ? (
                        <div className={cn('w-6 h-6 rounded-xl bg-gradient-to-br p-1 shadow-md', tab.color)}>
                          <tab.icon className="w-full h-full text-white" strokeWidth={2.5} />
                        </div>
                      ) : (
                        <motion.div
                          whileHover={{ scale: 1.1 }}
                          transition={{ duration: 0.2 }}
                        >
                          <tab.icon className="w-5 h-5" />
                        </motion.div>
                      )}
                    </div>
                    
                    <span className="relative z-10 hidden sm:inline font-semibold tracking-wide">{tab.label}</span>
                    
                    {/* Enhanced active indicator line */}
                    {isActive && (
                      <motion.div
                        initial={{ scaleX: 0, opacity: 0 }}
                        animate={{ scaleX: 1, opacity: 1 }}
                        className={cn("absolute bottom-0 left-4 right-4 h-0.5 bg-gradient-to-r rounded-full", tab.color)}
                      />
                    )}
                  </div>
                </motion.button>
              )
            })}
          </div>
        </div>

        {/* Mobile Content with Premium Animations */}
        <AnimatePresence mode="wait">
          {selectedView === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="h-[calc(100%-60px)] bg-gradient-to-b from-card/90 via-card/80 to-card/70 backdrop-blur-xl flex flex-col border-t border-white/10"
            >
              <div className="flex-1 overflow-y-auto">
                <DashboardOverview />
              </div>
            </motion.div>
          )}
          {selectedView === 'inbox' && (
            <motion.div
              key="inbox"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="h-[calc(100%-60px)] bg-gradient-to-b from-card/90 via-card/80 to-card/70 backdrop-blur-xl border-t border-white/10 overflow-hidden"
            >
              <InboxEmails />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Desktop View - Enhanced Premium Grid Layout */}
      <div className="hidden lg:grid lg:grid-cols-12 h-full gap-4 p-4 relative">
        {/* Left Column - Enhanced Premium Dashboard Card */}
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          className="lg:col-span-5 xl:col-span-5 flex flex-col gap-4 h-full"
        >
          {/* Enhanced Overview Card with Glass Effect */}
          <div className="flex-1 bg-gradient-to-br from-card/95 via-card/90 to-card/85 backdrop-blur-2xl rounded-3xl border border-border/30 shadow-2xl overflow-hidden flex flex-col relative">
            {/* Enhanced Premium Header Gradient */}
            <div className="h-1 bg-gradient-to-r from-blue-500 via-indigo-500 via-purple-500 to-pink-500 rounded-t-3xl" />
            
            {/* Subtle inner glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-white/5 dark:from-white/5 dark:via-transparent dark:to-white/2 pointer-events-none rounded-3xl" />
            
            <div className="flex-1 overflow-y-auto relative z-10">
              <DashboardOverview />
            </div>
          </div>
          
          {/* Enhanced Events Card with Glass Effect - Desktop only */}
          <motion.div 
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-br from-card/95 via-card/90 to-card/85 backdrop-blur-2xl rounded-3xl border border-border/30 shadow-2xl overflow-hidden relative"
          >
            {/* Enhanced header gradient */}
            <div className="h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 rounded-t-3xl" />
            
            {/* Subtle inner glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-white/5 dark:from-white/5 dark:via-transparent dark:to-white/2 pointer-events-none rounded-3xl" />
            
            <div className="relative z-10">
              <UpcomingEventsCompact />
            </div>
          </motion.div>
        </motion.div>

        {/* Right Column - Enhanced Premium Email Card */}
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.15 }}
          className="lg:col-span-7 xl:col-span-7 bg-gradient-to-br from-card/95 via-card/90 to-card/85 backdrop-blur-2xl rounded-3xl border border-border/30 shadow-2xl overflow-hidden relative"
        >
          {/* Enhanced Premium Header Gradient */}
          <div className="h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 rounded-t-3xl" />
          
          {/* Subtle inner glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-white/5 dark:from-white/5 dark:via-transparent dark:to-white/2 pointer-events-none rounded-3xl" />
          
          <div className="relative z-10 h-full overflow-hidden">
            <InboxEmails />
          </div>
        </motion.div>
      </div>
    </div>
  )
}