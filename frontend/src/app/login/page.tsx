'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion'
import { ArrowRight, Fingerprint, Smartphone, AlertCircle, Sparkles, Moon, Sun } from 'lucide-react'
import { useTheme } from '@/components/theme/theme-provider'
import { authenticateWithPasskey } from '@/lib/webauthn'

export default function LoginPage() {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState<Date | null>(null)
  const [isHovering, setIsHovering] = useState(false)
  const [showGreeting, setShowGreeting] = useState(false)
  const [windowSize, setWindowSize] = useState({ width: 1920, height: 1080 })
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)

  useEffect(() => {
    setMounted(true)
    setWindowSize({
      width: window.innerWidth,
      height: window.innerHeight
    })
    
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight
      })
    }
    
    window.addEventListener('resize', handleResize)
    setCurrentTime(new Date())
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    
    return () => {
      window.removeEventListener('resize', handleResize)
      clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    // Trigger greeting animation
    setTimeout(() => setShowGreeting(true), 100)
  }, [])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseX.set(e.clientX)
      mouseY.set(e.clientY)
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [mouseX, mouseY])

  const getTimeBasedGreeting = () => {
    if (!currentTime) return 'Welcome'
    const hour = currentTime.getHours()
    if (hour >= 5 && hour < 12) return 'Good morning'
    if (hour >= 12 && hour < 17) return 'Good afternoon'
    if (hour >= 17 && hour < 22) return 'Good evening'
    return 'Good night'
  }

  const getTimeBasedEmoji = () => {
    if (!currentTime) return '👋'
    const hour = currentTime.getHours()
    if (hour >= 5 && hour < 12) return '☀️'
    if (hour >= 12 && hour < 17) return '🌤️'
    if (hour >= 17 && hour < 22) return '🌅'
    return '🌙'
  }

  const getTimeBasedGradient = () => {
    const hour = currentTime.getHours()
    if (hour >= 5 && hour < 12) return 'from-amber-500 via-orange-500 to-yellow-500'
    if (hour >= 12 && hour < 17) return 'from-blue-500 via-cyan-500 to-teal-500'
    if (hour >= 17 && hour < 22) return 'from-purple-500 via-pink-500 to-rose-500'
    return 'from-indigo-500 via-purple-500 to-pink-500'
  }

  const handlePasskeyAuth = async () => {
    setIsAuthenticating(true)
    setError(null)
    
    try {
      const authenticated = await authenticateWithPasskey()
      if (authenticated) {
        router.push('/dashboard')
      } else {
        setError('Authentication failed. Please try again.')
      }
    } catch (err: any) {
      console.error('Auth error:', err)
      if (err.message.includes('cancelled') || err.message.includes('approve the passkey prompt')) {
        // User cancelled - show helpful message
        setError('Please try again and approve the Touch ID prompt when it appears')
      } else {
        setError(err.message || 'Authentication failed. Please try again.')
      }
    } finally {
      setIsAuthenticating(false)
    }
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Dynamic time-based background */}
      <div className="absolute inset-0">
        <motion.div
          className={`absolute inset-0 bg-gradient-to-br ${getTimeBasedGradient()} opacity-5`}
          animate={{
            opacity: [0.05, 0.1, 0.05],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        
        {/* Interactive gradient that follows mouse */}
        <motion.div
          className="absolute w-96 h-96 bg-primary/10 rounded-full blur-3xl"
          style={{
            left: useTransform(mouseX, [0, windowSize.width], [-200, windowSize.width]),
            top: useTransform(mouseY, [0, windowSize.height], [-200, windowSize.height]),
          }}
        />
      </div>

      {/* Theme toggle - top right */}
      {mounted && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="absolute top-8 right-8 z-20 p-3 rounded-full bg-secondary/50 backdrop-blur-sm hover:bg-secondary/70 transition-colors"
        >
          {theme === 'dark' ? (
            <Sun className="w-5 h-5 text-foreground" />
          ) : (
            <Moon className="w-5 h-5 text-foreground" />
          )}
        </motion.button>
      )}

      <div className="relative z-10 min-h-screen flex items-center p-8 md:p-12 lg:p-16">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1 }}
          className="w-full max-w-7xl mx-auto"
        >

          {/* Centered layout with better spacing */}
          <div className="flex items-center justify-center min-h-[85vh]">
                <div className="flex items-center gap-12 lg:gap-20">
                  {/* Text content */}
                  <div>
                    <motion.div
                      initial={{ opacity: 0, y: 40 }}
                      animate={{ opacity: showGreeting ? 1 : 0, y: showGreeting ? 0 : 40 }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                    >
                      <h1 className="text-7xl md:text-8xl lg:text-9xl xl:text-[10rem] 2xl:text-[11rem] font-bold leading-[0.85] tracking-tighter">
                        <motion.span 
                          className={`bg-gradient-to-r ${getTimeBasedGradient()} bg-clip-text text-transparent`}
                          animate={{ 
                            backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
                          }}
                          transition={{ duration: 5, repeat: Infinity }}
                          style={{ backgroundSize: "200% 200%" }}
                        >
                          {getTimeBasedGreeting()},
                        </motion.span>
                      </h1>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 40 }}
                      animate={{ opacity: showGreeting ? 1 : 0, y: showGreeting ? 0 : 40 }}
                      transition={{ duration: 0.8, delay: 0.1, ease: "easeOut" }}
                    >
                      <h2 className="text-7xl md:text-8xl lg:text-9xl xl:text-[10rem] 2xl:text-[11rem] font-bold text-foreground leading-[0.85] tracking-tighter">
                        Harsha
                        <motion.span
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.5, delay: 0.8 }}
                          className="text-primary"
                        >
                          .
                        </motion.span>
                      </h2>
                    </motion.div>

                    {/* Subtle context info */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: showGreeting ? 0.7 : 0 }}
                      transition={{ duration: 0.8, delay: 0.5 }}
                      className="mt-6 space-y-1"
                    >
                      <p className="text-sm text-muted">
                        {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                      </p>
                      <p className="text-xs text-muted/70">
                        Personal Job Tracker
                      </p>
                    </motion.div>
                  </div>

                  {/* Arrow button - positioned to the right of text */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: showGreeting ? 1 : 0, scale: showGreeting ? 1 : 0.8 }}
                    transition={{ duration: 0.8, delay: 0.3, type: "spring" }}
                    className="relative"
                  >
                    {/* Glowing orb behind button */}
                    <motion.div
                      className="absolute inset-0 bg-primary/20 rounded-full blur-xl"
                      animate={{
                        scale: [1, 1.1, 1],
                        opacity: [0.2, 0.3, 0.2],
                      }}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                    />

                    {/* Main action button - smaller size */}
                    <motion.button
                      onClick={handlePasskeyAuth}
                      disabled={isAuthenticating}
                      onMouseEnter={() => setIsHovering(true)}
                      onMouseLeave={() => setIsHovering(false)}
                      className="relative group"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      <div className="relative bg-gradient-to-br from-primary to-primary/80 p-5 rounded-full shadow-xl">
                        {/* Inner glow */}
                        <motion.div
                          className="absolute inset-0 bg-white/20 rounded-full"
                          animate={{
                            opacity: isHovering ? 0.3 : 0,
                          }}
                        />
                        
                        {/* Icon - smaller */}
                        <motion.div
                          animate={{
                            x: isHovering ? 3 : 0,
                          }}
                          transition={{ type: "spring", stiffness: 400 }}
                        >
                          {isAuthenticating ? (
                            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <ArrowRight className="w-6 h-6 text-white" />
                          )}
                        </motion.div>
                      </div>
                    </motion.button>

                    {/* Floating hint */}
                    <motion.p
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: showGreeting ? 1 : 0, y: showGreeting ? 0 : 10 }}
                      transition={{ duration: 0.8, delay: 0.8 }}
                      className="absolute -bottom-12 left-1/2 -translate-x-1/2 text-sm text-muted whitespace-nowrap"
                    >
                      {isAuthenticating ? (
                        <span className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 animate-pulse" />
                          Authenticating
                        </span>
                      ) : (
                        'Unlock with Touch ID'
                      )}
                    </motion.p>
                  </motion.div>
                </div>
              </div>

              {/* Error Message - floating */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -20, scale: 0.9 }}
                    className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-destructive/90 text-destructive-foreground px-4 py-3 rounded-lg shadow-lg flex items-center gap-2"
                  >
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-sm">{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Bottom right status */}
              <div className="absolute bottom-8 right-8">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 1, delay: 1 }}
                  className="text-xs text-muted/50 flex items-center gap-2"
                >
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  Ready to authenticate
                </motion.div>
              </div>
        </motion.div>
      </div>
    </div>
  )
}