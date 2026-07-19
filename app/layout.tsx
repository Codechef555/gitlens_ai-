import type { Metadata } from "next";
import "@xyflow/react/dist/style.css";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://gitlens-ai.example.com"),
  title: { default: "GitLens AI — Repository Intelligence", template: "%s | GitLens AI" },
  description: "Understand any codebase like the engineer who built it.",
  keywords: ["repository intelligence", "codebase analysis", "developer tools", "architecture visualization"],
  openGraph: { title: "GitLens AI", description: "Understand any codebase like the engineer who built it.", type: "website" },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
