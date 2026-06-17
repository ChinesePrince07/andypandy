import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import Header from "@/components/header";
import Footer from "@/components/footer";

export const metadata: Metadata = {
  title: {
    default: "Andy Zhang",
    template: "%s | Andy Zhang",
  },
  description: "Personal site & blog",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <head>
        <link rel="EditURI" type="application/rsd+xml" title="RSD" href="/xmlrpc.php?rsd" />
        <link rel="https://api.w.org/" href="/wp-json/" />
        <link rel="micropub" href="/api/micropub" />
        <link rel="authorization_endpoint" href="/api/auth" />
        <link rel="token_endpoint" href="/api/token" />
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("theme");if(t==="dark"||(!t&&matchMedia("(prefers-color-scheme:dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`,
          }}
        />
      </head>
      <body className="noise min-h-screen flex flex-col bg-white text-gray-900 antialiased dark:bg-gray-950 dark:text-gray-100 transition-colors duration-300">
        <div className="relative flex flex-col min-h-screen">
          <Header />
          <main className="flex-1 mx-auto w-full max-w-2xl px-6 py-16">
            {children}
          </main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
