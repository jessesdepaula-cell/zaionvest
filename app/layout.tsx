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
  title: "ZaionVest — Análise Institucional em Segundos",
  description:
    "Plataforma de análise de gráficos com IA institucional. SMC, Price Action, planos de trade com R:R em segundos.",
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
          colorPrimary: "#D4A03B",
          colorBackground: "#3A2610",
          colorText: "#F0DDB0",
          colorInputBackground: "#4A3418",
          colorInputText: "#F0DDB0",
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
