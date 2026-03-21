import type { ReactNode } from "react";

import "@/app/globals.css";
import { SiteFooter } from "@/src/components/layout/site-footer";
import { SiteHeader } from "@/src/components/layout/site-header";
import { defaultMetadata } from "@/src/lib/seo/metadata";

export const metadata = defaultMetadata;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SiteHeader />
        <main className="site-main">
          <div className="shell">{children}</div>
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}

