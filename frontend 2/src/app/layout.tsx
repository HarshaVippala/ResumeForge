import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme/theme-provider";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

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
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider
          defaultTheme="system"
          storageKey="resume-builder-theme"
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
