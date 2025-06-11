import { redirect } from 'next/navigation'

export default function DashboardPage() {
  // Redirect to library by default
  redirect('/dashboard/library')
}