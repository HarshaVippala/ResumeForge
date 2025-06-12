import { Navigation } from "@/components/shared/Navigation"
import { BackgroundSyncProvider } from "@/components/shared/BackgroundSyncProvider"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <BackgroundSyncProvider>
      <div className="min-h-screen bg-gray-50 dark:bg-background">
        <Navigation />
        <main className="flex-1">
          {children}
        </main>
      </div>
    </BackgroundSyncProvider>
  )
}