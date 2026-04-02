import type { Metadata } from "next";
import Link from "next/link";
import { Poppins } from "next/font/google";
import { ChatProvider } from "@/lib/chat-context";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "600", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "PromoAtlas | Product Catalog",
  description:
    "Browse promotional products with AI-powered search. PromoAtlas PIM by Sols.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${poppins.className} h-full`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ChatProvider>
          <header className="sticky top-0 z-40 border-b border-sols-border bg-white/80 backdrop-blur-md">
            <div className="mx-auto flex h-14 max-w-[1920px] items-center justify-between px-4 sm:px-6 lg:px-8">
              <Link href="/" className="flex items-center gap-2">
                <span className="text-xl font-extrabold tracking-tight text-sols-dark">
                  Promo<span className="text-sols-accent">Atlas</span>
                </span>
              </Link>
              <nav className="flex items-center gap-4 text-sm font-semibold text-sols-muted">
                <Link
                  href="/"
                  className="transition-colors hover:text-sols-dark"
                >
                  Catalog
                </Link>
              </nav>
            </div>
          </header>

          <main className="flex-1">{children}</main>
        </ChatProvider>
      </body>
    </html>
  );
}
