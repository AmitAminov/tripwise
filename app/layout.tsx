import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TripWise",
  description: "Decide together. Independent rating, delayed reveal.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
