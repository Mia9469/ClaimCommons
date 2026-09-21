import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://mia-helical-research-framework.tongtonghmy.chatgpt.site"),
  title: "Helical Research Framework · Claim Commons",
  description: "Browse research topics, claims and papers through four evidence modules in one connected research atlas.",
  openGraph: {
    title: "Helical Research Framework",
    description: "Explore different claim collections through one consistent helical research framework.",
    images: [{url: "/og-framework-v2.jpg", width: 1200, height: 630, alt: "Helical Research Framework"}],
  },
  twitter: {
    card: "summary_large_image",
    title: "Helical Research Framework",
    description: "Explore different claim collections through one consistent helical research framework.",
    images: ["/og-framework-v2.jpg"],
  },
};

export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
