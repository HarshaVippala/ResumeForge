'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion'
import { ArrowRight, ChevronRight, Fingerprint, Smartphone, AlertCircle, Sparkles, Moon, Sun, Mail, Bell, Plus } from 'lucide-react'
import { useTheme } from '@/components/theme/theme-provider'
import { authenticateWithPasskey, registerPasskey } from '@/lib/webauthn'

export default function LoginPage() {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState<Date | null>(null)
  const [isHovering, setIsHovering] = useState(false)
  const [showGreeting, setShowGreeting] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [windowSize, setWindowSize] = useState({ width: 1920, height: 1080 })
  const [showRegistration, setShowRegistration] = useState(false)
  const [hasCheckedPasskeys, setHasCheckedPasskeys] = useState(false)
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
    if (!currentTime) return ''
    const hour = currentTime.getHours()
    if (hour >= 5 && hour < 12) return ''
    if (hour >= 12 && hour < 17) return ''
    if (hour >= 17 && hour < 22) return ''
    return ''
  }

  const getTimeBasedGradient = () => {
    if (!currentTime) return 'from-blue-500 via-purple-500 to-pink-500'
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
      // If in registration mode, register a new passkey
      if (showRegistration) {
        const registered = await registerPasskey()
        if (registered) {
          // Registration successful, navigate to dashboard
          router.push('/dashboard')
        } else {
          setError('Registration failed. Please try again.')
        }
      } else {
        // Try to authenticate
        const authenticated = await authenticateWithPasskey()
        if (authenticated) {
          // Navigate directly to dashboard
          router.push('/dashboard')
        } else {
          setError('Authentication failed. Please try again.')
        }
      }
    } catch (err: any) {
      console.error('Auth error:', err)
      if (err.message.includes('cancelled') || err.message.includes('approve the passkey prompt')) {
        // User cancelled - show helpful message
        setError('Please try again and approve the Touch ID prompt when it appears')
      } else if (err.message.includes('No passkey found') || err.message.includes('InvalidStateError')) {
        // No passkey found, show registration option
        setShowRegistration(true)
        setError('No passkey found. Click to register a new passkey.')
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
          className={`absolute inset-0 bg-gradient-to-br ${getTimeBasedGradient()} ${mounted && theme === 'dark' ? 'opacity-[0.02]' : 'opacity-5'}`}
          animate={{
            opacity: mounted && theme === 'dark' ? [0.01, 0.03, 0.01] : [0.05, 0.1, 0.05],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        
        {/* Interactive gradient that follows mouse */}
        <motion.div
          className={`absolute w-96 h-96 rounded-full blur-3xl ${mounted && theme === 'dark' ? 'bg-primary/5' : 'bg-primary/10'}`}
          style={{
            left: useTransform(mouseX, [0, windowSize.width], [-200, windowSize.width]),
            top: useTransform(mouseY, [0, windowSize.height], [-200, windowSize.height]),
          }}
        />
      </div>


      <div className="relative z-10 min-h-screen flex items-center p-4 sm:p-8 md:p-12 lg:p-16">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1 }}
          className="w-full"
        >

          {/* Responsive layout */}
          <div className="relative min-h-[85vh] max-w-7xl mx-auto">
                {/* Top bar with date and theme toggle */}
                <div className="fixed top-0 left-0 right-0 z-20 p-4 sm:p-8 md:p-12 lg:p-16">
                  <div className="flex justify-between items-center">
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.8 }}
                    >
                      <p className="text-base sm:text-lg md:text-xl font-normal text-muted-foreground">
                        {currentTime ? currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : ''}
                      </p>
                    </motion.div>

                    {/* Theme toggle - moved here */}
                    {mounted && (
                      <motion.button
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.5 }}
                        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                        className="p-3 rounded-full bg-secondary/50 backdrop-blur-sm hover:bg-secondary/70 transition-colors"
                      >
                        {theme === 'dark' ? (
                          <Sun className="w-5 h-5 text-foreground" />
                        ) : (
                          <Moon className="w-5 h-5 text-foreground" />
                        )}
                      </motion.button>
                    )}
                  </div>
                </div>

                {/* Main content container */}
                <div className="flex flex-col md:flex-row items-center justify-between min-h-[85vh]">
                  {/* Greeting and name */}
                  <div className="text-center md:text-left flex-1 flex flex-col justify-center">
                    <motion.div
                      initial={{ opacity: 0, y: 40 }}
                      animate={{ opacity: showGreeting ? 1 : 0, y: showGreeting ? 0 : 40 }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                    >
                      <h1 className="text-[3rem] leading-[0.9] sm:text-5xl md:text-6xl lg:text-7xl xl:text-[7.5rem] 2xl:text-[8rem] font-semibold sm:leading-[0.85] tracking-tighter">
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
                      <h2 className="text-[2.5rem] leading-[0.9] sm:text-4xl md:text-5xl lg:text-6xl xl:text-[6.5rem] 2xl:text-[7rem] font-semibold text-foreground sm:leading-[0.85] tracking-tighter">
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

                    {/* Notification icons below name */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: showGreeting ? 1 : 0, y: 0 }}
                      transition={{ duration: 0.8, delay: 0.6 }}
                      className="flex gap-6 mt-12 justify-center md:justify-start items-center"
                    >
                      {/* Email notification */}
                      <div className="relative">
                        <Mail className="w-7 h-7 md:w-8 md:h-8 text-muted-foreground" strokeWidth={1} />
                        <span className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground text-xs w-5 h-5 rounded-full flex items-center justify-center font-medium">
                          3
                        </span>
                      </div>

                      {/* Activity notification */}
                      <div className="relative">
                        <Bell className="w-7 h-7 md:w-8 md:h-8 text-muted-foreground" strokeWidth={1} />
                        <span className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground text-xs w-5 h-5 rounded-full flex items-center justify-center font-medium">
                          2
                        </span>
                      </div>
                    </motion.div>
                  </div>

                  {/* Arrow button with registration state */}
                  <motion.div
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: showGreeting ? 1 : 0, x: showGreeting ? 0 : 50 }}
                    transition={{ duration: 0.8, delay: 0.3, type: "spring" }}
                    className="relative mt-auto mb-8 md:mt-0 md:mb-0 md:ml-auto"
                  >
                    <div className="flex flex-col items-center gap-4">
                      {showRegistration && (
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-center"
                        >
                          <p className="text-sm text-muted-foreground mb-2">No passkey found</p>
                          <p className="text-lg font-medium">Register your device</p>
                        </motion.div>
                      )}
                      
                      <motion.button
                        onClick={handlePasskeyAuth}
                        disabled={isAuthenticating}
                        onMouseEnter={() => setIsHovering(true)}
                        onMouseLeave={() => setIsHovering(false)}
                        className={`relative group transition-all duration-300 p-4 ${
                          showRegistration 
                            ? 'bg-primary/10 rounded-full hover:bg-primary/20' 
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <motion.div
                          animate={{
                            x: isHovering && !showRegistration ? 12 : 0,
                          }}
                          transition={{ type: "spring", stiffness: 400 }}
                        >
                          {isAuthenticating ? (
                            <motion.div 
                              className="w-10 h-10 sm:w-12 sm:h-12 border-2 border-muted-foreground/30 border-t-foreground rounded-full"
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            />
                          ) : showRegistration ? (
                            <Fingerprint className="w-10 h-10 sm:w-12 sm:h-12 text-primary" strokeWidth={1.5} />
                          ) : (
                            <ChevronRight className="w-10 h-10 sm:w-12 sm:h-12 md:w-20 md:h-20 lg:w-24 lg:h-24" strokeWidth={1} />
                          )}
                        </motion.div>
                      </motion.button>
                      
                      {showRegistration && (
                        <motion.button
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          onClick={() => {
                            setShowRegistration(false)
                            setError(null)
                          }}
                          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                          Try authentication instead
                        </motion.button>
                      )}
                    </div>
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
                    className="fixed bottom-4 sm:bottom-8 left-4 right-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 max-w-sm mx-auto sm:mx-0 bg-destructive/90 text-destructive-foreground px-4 py-3 rounded-lg shadow-lg flex items-center gap-2"
                  >
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span className="text-sm">{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

        </motion.div>
      </div>
    </div>
  )
}