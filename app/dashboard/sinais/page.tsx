import { redirect } from "next/navigation";

// Feature "Sinais ao vivo" descontinuada (produto = vitrine de EAs).
// Mantido como redirect para não quebrar links/bookmarks antigos.
export default function SinaisPage() {
  redirect("/dashboard/vitrine");
}
