/**
 * URLs assinadas do Supabase Storage via REST (sem depender do SDK).
 * Usado para servir o .ex5 licenciado: o link expira, então não dá pra
 * compartilhar e furar a assinatura.
 *
 * Envs necessárias:
 *   SUPABASE_URL                — ex: https://xxxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY   — service role (nunca exposta ao client)
 *   SUPABASE_EA_BUCKET          — bucket dos .ex5 (default: "ea-files")
 */
export async function createSignedUrl(
  objectPath: string,
  expiresInSeconds = 300
): Promise<string | null> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_EA_BUCKET ?? "ea-files";

  if (!supabaseUrl || !serviceKey) return null;

  const cleanPath = objectPath.replace(/^\/+/, "");
  const endpoint = `${supabaseUrl}/storage/v1/object/sign/${bucket}/${cleanPath}`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ expiresIn: expiresInSeconds }),
  });

  if (!res.ok) return null;

  const data = (await res.json()) as { signedURL?: string };
  if (!data.signedURL) return null;

  // signedURL vem relativo (ex: "/object/sign/bucket/arquivo.ex5?token=...")
  return `${supabaseUrl}/storage/v1${data.signedURL}`;
}
