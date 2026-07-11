import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ptBR } from "@clerk/localizations";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ZaionVest — Robôs de Trading Automático para MetaTrader 5",
  description:
    "Vitrine de robôs (Expert Advisors) validados para MetaTrader 5. Revalidação mensal, kill-switch remoto e drawdown real e transparente.",
  metadataBase: new URL("https://zaionvest.com.br"),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider
      localization={ptBR}
      appearance={{
        variables: {
          colorPrimary: "#2563EB",
          colorBackground: "#0A0A0A",
          colorText: "#F5F5F5",
          colorInputBackground: "#1F1F1F",
          colorInputText: "#F5F5F5",
          borderRadius: "10px",
        },
      }}
    >
      <html lang="pt-BR" className={`${inter.variable} ${jetbrains.variable}`}>
        <body className="min-h-screen bg-charcoal text-offwhite antialiased">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
