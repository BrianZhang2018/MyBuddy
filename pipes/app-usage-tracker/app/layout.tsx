import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "App Usage Tracker",
  description: "Track your app usage and achieve your goals with AI insights",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
