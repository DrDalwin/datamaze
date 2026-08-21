import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DATAMAZE Digital Magazine",
  description: "DATAMAZE Digital Magazine Viewer",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js" async></script>
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
