/**
 * Integração oficial com a Web API de Parceiros da RoboForex.
 * Verifica se um número de conta MT5 pertence ao Grupo de Parceiros ZAION.
 */
export async function isAccountInPartnerTree(accountNumber: string | number): Promise<boolean> {
  const partnerAccount = process.env.ROBOFOREX_PARTNER_ACCOUNT;
  const apiKey = process.env.ROBOFOREX_API_KEY;

  // Se o parceiro ainda não cadastrou a API Key nas ENVs, permite por fallback (somente checagem de corretora RoboForex).
  if (!partnerAccount || !apiKey) {
    return true;
  }

  try {
    const url = `https://my.roboforex.com/api/partners/tree?account_id=${encodeURIComponent(partnerAccount)}&api_key=${encodeURIComponent(apiKey)}&referral_account_id=${encodeURIComponent(accountNumber)}`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "application/xml, text/xml, */*"
      },
      next: { revalidate: 300 } // cache de 5 minutos por performance
    });

    if (!res.ok) return false;
    const xmlText = await res.text();

    // Se a conta pertence ao grupo do parceiro, a resposta XML contém o número da conta
    const accountStr = String(accountNumber).trim();
    return xmlText.includes(accountStr);
  } catch (err) {
    console.error("Erro ao validar conta na API do RoboForex Partner:", err);
    // Em caso de instabilidade na API da RoboForex, por segurança mantém o serviço rodando
    return true;
  }
}
