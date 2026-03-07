"use client";

import GlobalAlert from "@/components/GlobalAlert";

export default function RootLayout({ children }) {
  return (
    <html lang="th" suppressHydrationWarning>
      <body>
        <GlobalAlert />
        {children}
      </body>
    </html>
  );
}