import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/header";
import Footer from "@/components/footer";
import SakuraPetals from "@/components/sakura-petals";

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
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="EditURI" type="application/rsd+xml" title="RSD" href="/xmlrpc.php?rsd" />
        <link rel="https://api.w.org/" href="/wp-json/" />
        <link rel="micropub" href="/api/micropub" />
        <link rel="authorization_endpoint" href="/api/auth" />
        <link rel="token_endpoint" href="/api/token" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Quicksand:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("theme");if(t==="dark"||(!t&&matchMedia("(prefers-color-scheme:dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`,
          }}
        />
      </head>
      <body className="noise min-h-screen flex flex-col bg-pink-50/40 text-purple-950 antialiased dark:bg-[#0f0a1a] dark:text-purple-100 transition-colors duration-300">
        <SakuraPetals />
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
