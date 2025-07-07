import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Quiz World - Real-time Multiplayer Quiz Game",
  description: "A real-time multiplayer quiz game built with Next.js and Socket.io",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
