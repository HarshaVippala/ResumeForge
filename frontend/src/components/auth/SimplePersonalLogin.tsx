'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, Zap, Coffee, Rocket, Heart, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

// Simple personal access - just for you!
const PERSONAL_ACCESS_PATTERNS = [
  { name: 'Magic Knock', pattern: ['click', 'click', 'click'], icon: Sparkles, color: 'text-purple-500' },
  { name: 'Developer Mode', pattern: ['KeyH', 'KeyV'], icon: Zap, color: 'text-blue-500' },
  { name: 'Coffee Break', pattern: ['click', 'Space'], icon: Coffee, color: 'text-amber-500' },
  { name: 'Launch Sequence', pattern: ['Enter', 'Enter'], icon: Rocket, color: 'text-green-500' }
]

const GREETING_MESSAGES = [
  "Welcome back, Harsha! ✨",
  "Ready to build something amazing? 🚀",
  "Your resume empire awaits! 👑",
  "Time to make careers happen! 💼",
  "Let's craft the perfect resume! ✍️"
]

export function SimplePersonalLogin() {
  const [selectedPattern, setSelectedPattern] = useState(PERSONAL_ACCESS_PATTERNS[0])
  const [inputSequence, setInputSequence] = useState<string[]>([])
  const [isShaking, setIsShaking] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [greeting, setGreeting] = useState(GREETING_MESSAGES[0])
  const [showEasterEgg, setShowEasterEgg] = useState(false)
  
  const router = useRouter()
  const cardRef = useRef<HTMLDivElement>(null)

  // Rotate greeting message
  useEffect(() => {
    const interval = setInterval(() => {
      setGreeting(GREETING_MESSAGES[Math.floor(Math.random() * GREETING_MESSAGES.length)])
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  // Handle keyboard input
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        setInputSequence([])
        return
      }
      
      const newSequence = [...inputSequence, e.code].slice(-3)
      setInputSequence(newSequence)
      
      // Check if pattern matches
      if (checkPattern(newSequence)) {
        handleSuccess()
      }
      
      // Easter egg: Konami code start
      if (newSequence.join(',').includes('ArrowUp,ArrowUp,ArrowDown')) {
        setShowEasterEgg(true)
        setTimeout(() => setShowEasterEgg(false), 2000)
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [inputSequence, selectedPattern])

  // Handle click pattern
  const handleCardClick = () => {
    const newSequence = [...inputSequence, 'click'].slice(-3)
    setInputSequence(newSequence)
    
    if (checkPattern(newSequence)) {
      handleSuccess()
    } else if (newSequence.length >= selectedPattern.pattern.length) {
      // Wrong pattern
      setIsShaking(true)
      setTimeout(() => {
        setIsShaking(false)
        setInputSequence([])
      }, 500)
    }
  }

  const checkPattern = (sequence: string[]): boolean => {
    if (sequence.length !== selectedPattern.pattern.length) return false
    return sequence.every((input, index) => input === selectedPattern.pattern[index])
  }

  const handleSuccess = () => {
    setShowSuccess(true)
    
    // Store simple auth
    localStorage.setItem('harsha_access', 'granted')
    localStorage.setItem('access_time', new Date().toISOString())
    
    setTimeout(() => {
      router.push('/dashboard')
    }, 1500)
  }

  // Quick access for you (double-click the logo)
  const handleLogoDoubleClick = () => {
    handleSuccess()
  }

  const getSequenceDisplay = () => {
    return selectedPattern.pattern.map((step, index) => {
      const isCompleted = inputSequence[index] === step
      const isCurrent = inputSequence.length === index
      
      return (
        <div
          key={index}
          className={cn(
            "w-3 h-3 rounded-full border-2 transition-all duration-300",
            isCompleted 
              ? "bg-primary border-primary scale-110" 
              : isCurrent
              ? "border-primary animate-pulse"
              : "border-muted-foreground/30"
          )}
        />
      )
    })
  }

  if (showSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-primary/5 flex items-center justify-center">
        <div className="text-center space-y-6">
          <div className="relative">
            <div className="w-24 h-24 bg-primary/20 rounded-full flex items-center justify-center mx-auto animate-bounce">
              <Rocket className="w-12 h-12 text-primary animate-pulse" />
            </div>
            <div className="absolute -top-2 -right-2 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center animate-ping">
              ✓
            </div>
          </div>
          <h1 className="text-3xl font-bold text-foreground animate-pulse">
            Welcome back, Harsha! 🎉
          </h1>
          <p className="text-muted-foreground animate-fade-in">
            Launching your resume builder...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex flex-col relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 -left-1/4 w-96 h-96 bg-primary/3 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        {showEasterEgg && (
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-pink-500/20 animate-pulse" />
        )}
      </div>

      {/* Header */}
      <header className="p-6 z-10">
        <div 
          className="group cursor-pointer inline-flex items-center space-x-3"
          onDoubleClick={handleLogoDoubleClick}
        >
          <div className="flex items-center justify-center w-10 h-10 bg-primary rounded-xl group-hover:scale-110 transition-all duration-300 group-hover:rotate-12">
            <Sparkles className="w-6 h-6 text-primary-foreground" />
          </div>
          <span className="text-2xl font-bold text-foreground group-hover:text-primary transition-colors">
            JOBTRACKER
          </span>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-md space-y-8">
          {/* Welcome section */}
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-primary/10 rounded-2xl mb-6 group hover:scale-105 transition-all duration-300">
              <selectedPattern.icon className={cn("w-10 h-10 transition-all duration-300", selectedPattern.color)} />
            </div>
            <h1 className="text-4xl font-bold text-foreground mb-2">
              Personal Access
            </h1>
            <p className="text-lg text-muted-foreground animate-fade-in">
              {greeting}
            </p>
          </div>

          {/* Access method selector */}
          <div className="grid grid-cols-2 gap-3 mb-8">
            {PERSONAL_ACCESS_PATTERNS.map((pattern) => (
              <Button
                key={pattern.name}
                variant={selectedPattern.name === pattern.name ? "default" : "outline"}
                className="h-16 flex flex-col space-y-1 group"
                onClick={() => {
                  setSelectedPattern(pattern)
                  setInputSequence([])
                }}
              >
                <pattern.icon className={cn("w-5 h-5 transition-all", pattern.color)} />
                <span className="text-xs">{pattern.name}</span>
              </Button>
            ))}
          </div>

          {/* Interactive access card */}
          <Card 
            ref={cardRef}
            className={cn(
              "p-8 border-2 border-dashed border-primary/30 hover:border-primary/60 transition-all duration-300 cursor-pointer group",
              isShaking && "animate-shake",
              "hover:scale-105 hover:shadow-lg"
            )}
            onClick={handleCardClick}
          >
            <div className="text-center space-y-6">
              <div className="space-y-3">
                <h3 className="text-xl font-semibold text-foreground group-hover:text-primary transition-colors">
                  {selectedPattern.name}
                </h3>
                
                {/* Pattern visualization */}
                <div className="flex items-center justify-center space-x-2">
                  {getSequenceDisplay()}
                </div>
                
                {/* Instructions */}
                <div className="text-sm text-muted-foreground space-y-1">
                  {selectedPattern.pattern.includes('click') && (
                    <p>👆 Click this card {selectedPattern.pattern.filter(p => p === 'click').length} time(s)</p>
                  )}
                  {selectedPattern.pattern.some(p => p.startsWith('Key')) && (
                    <p>⌨️ Press: {selectedPattern.pattern.filter(p => p.startsWith('Key')).map(k => k.replace('Key', '')).join(' + ')}</p>
                  )}
                  {selectedPattern.pattern.includes('Enter') && (
                    <p>⏎ Press Enter {selectedPattern.pattern.filter(p => p === 'Enter').length} time(s)</p>
                  )}
                  {selectedPattern.pattern.includes('Space') && (
                    <p>␣ Press Space</p>
                  )}
                </div>
              </div>

              {/* Progress indicator */}
              {inputSequence.length > 0 && (
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-300 rounded-full"
                    style={{ width: `${(inputSequence.length / selectedPattern.pattern.length) * 100}%` }}
                  />
                </div>
              )}
            </div>
          </Card>

          {/* Quick tips */}
          <div className="text-center space-y-2">
            <p className="text-xs text-muted-foreground">
              💡 <strong>Pro tip:</strong> Double-click the JOBTRACKER logo for instant access
            </p>
            <p className="text-xs text-muted-foreground/60">
              Press <kbd className="px-1 py-0.5 bg-muted rounded text-xs">ESC</kbd> to reset • Try the Konami code for fun 🎮
            </p>
          </div>

          {/* Personal touch */}
          <div className="text-center">
            <p className="text-xs text-muted-foreground flex items-center justify-center space-x-1">
              <span>Made with</span>
              <Heart className="w-3 h-3 text-red-500 animate-pulse" />
              <span>for Harsha</span>
              <Star className="w-3 h-3 text-yellow-500 animate-pulse" />
            </p>
          </div>
        </div>
      </div>

      {/* Easter egg notification */}
      {showEasterEgg && (
        <div className="fixed top-4 right-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-2 rounded-lg shadow-lg animate-bounce z-50">
          🎮 Konami code detected! You're a true developer! 
        </div>
      )}
    </div>
  )
}