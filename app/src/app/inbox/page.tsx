'use client'

import { InboxEmails } from '@/components/dashboard/InboxEmails'

export default function InboxPage() {
  return (
    <div className="flex flex-col h-screen">
      {/* Optional header */}
      <header className="border-b border-border bg-background">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-semibold">Email Management</h1>
        </div>
      </header>
      
      {/* Main inbox component */}
      <main className="flex-1 overflow-hidden min-h-0">
        <InboxEmails />
      </main>
    </div>
  )
}