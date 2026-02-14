import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/header";
import Footer from "@/components/footer";

export const metadata: Metadata = {
  title: {
    default: "Andy",
    template: "%s | Andy",
  },
  description: "Personal site & blog",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
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
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen flex flex-col bg-white text-gray-900 antialiased">
        <div className="fixed inset-0 dot-grid opacity-40 pointer-events-none" />
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
