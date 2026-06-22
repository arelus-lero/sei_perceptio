import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from 'sonner';

import { SkipToContent } from '@/components/layout/skip-to-content';
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: 'SEI-Perceptio',
  description:
    'Plataforma de análise inteligente de processos administrativos do SEI da ANEEL, com consultas em linguagem natural sobre documentos indexados via RAG.',
  applicationName: 'SEI-Perceptio',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <SkipToContent />
        {children}
        <Toaster richColors closeButton position="top-center" />
      </body>
    </html>
  );
}
