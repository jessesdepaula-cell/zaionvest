import { redirect } from "next/navigation";

// Produto = vitrine de EAs. A antiga "Mesa de análise" (análise de prints) foi
// descontinuada; a home do painel agora leva direto à vitrine.
export default function DashboardPage() {
  redirect("/dashboard/vitrine");
}
