import { ReactNode } from "react";
import { Jua, Noto_Sans_KR } from "next/font/google";

const displayFont = Jua({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display"
});

const bodyFont = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-body"
});

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko" className={`${displayFont.variable} ${bodyFont.variable}`}>
      <body>{children}</body>
    </html>
  );
}
