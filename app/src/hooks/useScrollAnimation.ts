import { useEffect, useRef } from 'react'
import { useInView, useAnimation, AnimationControls } from 'framer-motion'

interface UseScrollAnimationOptions {
  threshold?: number
  once?: boolean
  rootMargin?: string
}

export function useScrollAnimation(options?: UseScrollAnimationOptions) {
  const ref = useRef(null)
  const controls = useAnimation()
  const isInView = useInView(ref, {
    once: options?.once ?? true,
    margin: options?.rootMargin ?? "0px 0px -100px 0px"
  })

  useEffect(() => {
    if (isInView) {
      controls.start("visible")
    } else if (!options?.once) {
      controls.start("hidden")
    }
  }, [isInView, controls, options?.once])

  return {
    ref,
    controls,
    isInView
  }
}

// Preset animation variants
export const scrollAnimationVariants = {
  fadeUp: {
    hidden: { opacity: 0, y: 30 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.6, ease: "easeOut" }
    }
  },
  fadeIn: {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { duration: 0.5 }
    }
  },
  slideInLeft: {
    hidden: { opacity: 0, x: -50 },
    visible: { 
      opacity: 1, 
      x: 0,
      transition: { duration: 0.5, ease: "easeOut" }
    }
  },
  slideInRight: {
    hidden: { opacity: 0, x: 50 },
    visible: { 
      opacity: 1, 
      x: 0,
      transition: { duration: 0.5, ease: "easeOut" }
    }
  },
  scale: {
    hidden: { opacity: 0, scale: 0.8 },
    visible: { 
      opacity: 1, 
      scale: 1,
      transition: { duration: 0.5, ease: "easeOut" }
    }
  },
  stagger: {
    visible: {
      transition: {
        staggerChildren: 0.1
      }
    }
  }
}