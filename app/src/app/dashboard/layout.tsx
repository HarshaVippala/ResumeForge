'use client'

import { Navigation } from "@/components/shared/Navigation"
import { BackgroundSyncProvider } from "@/components/shared/BackgroundSyncProvider"
import { AuthBypassIndicator } from "@/components/auth-bypass-indicator"
import { motion, AnimatePresence } from "framer-motion"
import { pageTransition } from "@/lib/animations"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <BackgroundSyncProvider>
      <div className="h-screen bg-background flex flex-col">
        <Navigation />
        <main className="flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={children?.toString()}
              variants={pageTransition}
              initial="initial"
              animate="animate"
              exit="exit"
              className="h-full"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
        <AuthBypassIndicator />
      </div>
    </BackgroundSyncProvider>
  )
}