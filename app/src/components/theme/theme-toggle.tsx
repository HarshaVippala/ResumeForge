'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from './theme-provider'
import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'
import { hoverScale, tapScale } from '@/lib/animations'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <motion.div
      whileHover={hoverScale}
      whileTap={tapScale}
    >
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        className="h-8 w-8 p-0 relative"
      >
        <Sun className="h-4 w-4 rotate-0 scale-100 transition-all duration-300 dark:-rotate-90 dark:scale-0" />
        <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all duration-300 dark:rotate-0 dark:scale-100" />
        <span className="sr-only">Toggle theme</span>
      </Button>
    </motion.div>
  )
}