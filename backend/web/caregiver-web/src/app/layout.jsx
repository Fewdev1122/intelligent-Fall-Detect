export const metadata = {
  title: "Caregiver Fall Alert",
  description: "Realtime fall detection alert for caregiver",
};

import "./globals.css";

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <body>
        {children}
      </body>
    </html>
  );
}