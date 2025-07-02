import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { SessionProvider } from "@/components/providers/SessionProvider";

// Google Sans font weights
// 300: Light - for subtle text
// 400: Regular - for body text  
// 500: Medium - for labels, section titles
// 600: SemiBold - for headings, important text
// 700: Bold - for main titles, emphasis

export const metadata: Metadata = {
  title: "Resume Builder - AI-Powered Resume Generation",
  description: "Create ATS-optimized resumes tailored to specific job descriptions with AI-powered keyword analysis and optimization.",
  keywords: "resume builder, ATS optimization, job application, AI resume, career tools",
  authors: [{ name: "Resume Builder Team" }],
  openGraph: {
    title: "Resume Builder - AI-Powered Resume Generation",
    description: "Create ATS-optimized resumes tailored to specific job descriptions",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link 
          href="https://fonts.googleapis.com/css2?family=Google+Sans:wght@300;400;500;600;700&display=swap" 
          rel="stylesheet" 
        />
      </head>
      <body className="antialiased font-google-sans">
        <ThemeProvider
          defaultTheme="system"
          storageKey="resume-builder-theme"
        >
          <SessionProvider>
            {children}
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
