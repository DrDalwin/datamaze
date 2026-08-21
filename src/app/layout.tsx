import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DATAMAZE Digital Magazine",
  description: "DATAMAZE Digital Magazine Viewer",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js" async></script>
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
