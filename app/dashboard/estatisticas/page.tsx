import { redirect } from "next/navigation";

// Feature "Estatísticas" (métricas dos sinais ao vivo) descontinuada
// (produto = vitrine de EAs). Redirect para não quebrar links antigos.
export default function EstatisticasPage() {
  redirect("/dashboard/vitrine");
}
