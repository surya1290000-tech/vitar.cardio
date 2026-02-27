import type { Metadata } from "next";
import "./globals.css";
import ToastProvider from "@/components/ui/ToastProvider";
import PageTransition from "@/components/ui/PageTransition";

export const metadata: Metadata = {
  title: "VITAR — Your Heart. Protected. Always.",
  description: "Medical-grade cardiac wearable that detects early signs of heart attack and alerts instantly.",
  keywords: ["cardiac monitor", "heart health", "wearable", "ECG", "emergency alert"],
  openGraph: {
    title: "VITAR — Your Heart. Protected. Always.",
    description: "Medical-grade cardiac wearable that detects early signs of heart attack and alerts instantly.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>
          <PageTransition>{children}</PageTransition>
        </ToastProvider>
      </body>
    </html>
  );
}
