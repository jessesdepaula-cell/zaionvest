import { prisma } from "./prisma";

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "re_Trdmvcjr_PrNwXRie28ekakSe3vJ8Jajy";
const SENDER_EMAIL = "ZaionVest <sinais@jessedepaula.com.br>";
const BACKUP_EMAIL = "JESSESDEPAULA@GMAIL.COM";

export type EmailSignalData = {
  symbol: string;
  timeframe: string;
  mode: string;
  direction: string;
  entryPrice: number | null;
  stopPrice: number | null;
  target1: number | null;
  target2: number | null;
  target3: number | null;
  riskReward: string | null;
  justification: string | null;
  tipoSetup: string | null;
};

/**
 * Envia um alerta de sinal por e-mail via Resend API
 */
export async function sendSignalEmail(toEmail: string, signal: EmailSignalData) {
  try {
    const isBuy = signal.direction.toUpperCase().includes("COMPRA");
    const dirText = isBuy ? "COMPRA" : "VENDA";
    const dirColor = isBuy ? "#2563EB" : "#1D4ED8"; // Dourado vs Rústico

    const formatPrice = (val: number | null) =>
      val !== null ? val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 5 }) : "N/A";

    const subject = `🚨 NOVO SINAL: ${dirText} em ${signal.symbol} (${signal.timeframe}) · ${signal.mode}`;

    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Novo Sinal de Trade</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: #000000;
            color: #e0d0a0;
            margin: 0;
            padding: 0;
            -webkit-font-smoothing: antialiased;
          }
          .container {
            max-width: 600px;
            margin: 40px auto;
            background-color: #0a0a0a;
            border-radius: 12px;
            overflow: hidden;
            border: 1px solid rgba(245,245,245,0.12);
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
          }
          .header {
            padding: 24px;
            text-align: center;
            border-bottom: 1px solid rgba(245,245,245,0.10);
            background: linear-gradient(180deg, #141414 0%, #0a0a0a 100%);
          }
          .logo {
            font-size: 18px;
            font-weight: 700;
            letter-spacing: 0.05em;
            color: #f5f5f5;
            margin: 0;
          }
          .logo span {
            color: #2563eb;
          }
          .content {
            padding: 32px 24px;
          }
          .badge-container {
            text-align: center;
            margin-bottom: 24px;
          }
          .badge {
            display: inline-block;
            padding: 6px 14px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.1em;
            text-transform: uppercase;
          }
          .card {
            background-color: #141414;
            border-left: 4px solid ${dirColor};
            border-radius: 6px;
            padding: 20px;
            margin-bottom: 24px;
          }
          .card-title {
            font-size: 20px;
            font-weight: 700;
            margin: 0 0 16px 0;
            color: #f5f5f5;
            display: flex;
            align-items: center;
            justify-content: space-between;
          }
          .symbol-badge {
            background-color: rgba(245,245,245,0.10);
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 14px;
            font-family: monospace;
          }
          .grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            margin-bottom: 20px;
          }
          .grid-item {
            font-size: 13px;
            color: rgba(245,245,245,0.65);
          }
          .grid-item strong {
            color: #f5f5f5;
            font-size: 14px;
            display: block;
            margin-top: 2px;
            font-family: monospace;
          }
          .justification-box {
            font-size: 13px;
            line-height: 1.6;
            color: rgba(245,245,245,0.75);
            background-color: rgba(0,0,0,0.25);
            padding: 14px;
            border-radius: 6px;
            border: 1px solid rgba(245,245,245,0.08);
            margin-top: 20px;
          }
          .justification-title {
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #2563eb;
            margin-bottom: 6px;
          }
          .btn-container {
            text-align: center;
            margin-top: 32px;
          }
          .btn {
            display: inline-block;
            background-color: #2563eb;
            color: #000000 !important;
            text-decoration: none;
            padding: 12px 30px;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 600;
            transition: background-color 0.2s;
          }
          .btn:hover {
            background-color: #b8871f;
          }
          .footer {
            padding: 24px;
            text-align: center;
            font-size: 11px;
            color: rgba(245,245,245,0.5);
            border-top: 1px solid rgba(245,245,245,0.08);
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 class="logo">ZAION<span>VEST</span></h1>
          </div>
          <div class="content">
            <div class="badge-container">
              <span class="badge" style="background-color: ${dirColor}20; color: ${dirColor};">
                ${signal.mode} · ${signal.timeframe}
              </span>
            </div>
            
            <div class="card">
              <div class="card-title">
                <span style="color: ${dirColor};">${dirText}</span>
                <span class="symbol-badge">${signal.symbol}</span>
              </div>
              
              <div class="grid">
                <div class="grid-item">Preço de Entrada <strong>${formatPrice(signal.entryPrice)}</strong></div>
                <div class="grid-item">Stop Loss <strong>${formatPrice(signal.stopPrice)}</strong></div>
                <div class="grid-item">Alvo 1 (Parcial) <strong>${formatPrice(signal.target1)}</strong></div>
                <div class="grid-item">Alvo 2 (Saída) <strong>${formatPrice(signal.target2)}</strong></div>
                <div class="grid-item">Alvo 3 <strong>${formatPrice(signal.target3)}</strong></div>
                <div class="grid-item">Relação R:R (Alvo 1) <strong>${signal.riskReward ?? "1:1+"}</strong></div>
              </div>

              ${signal.tipoSetup ? `<div style="font-size: 12px; color: #6b7280; margin-top: 8px;">Gatilho: <strong>${signal.tipoSetup}</strong></div>` : ""}
              
              ${
                signal.justification
                  ? `
                <div class="justification-box">
                  <div class="justification-title">Análise Estrutural da IA</div>
                  ${signal.justification}
                </div>
              `
                  : ""
              }
            </div>
            
            <div class="btn-container">
              <a href="https://zaionvest.com.br/dashboard" class="btn" target="_blank">Acessar Dashboard</a>
            </div>
          </div>
          <div class="footer">
            Você está recebendo este e-mail porque é um assinante ativo da ZaionVest.<br>
            © ${new Date().getFullYear()} ZaionVest. Todos os direitos reservados.
          </div>
        </div>
      </body>
      </html>
    `;

    // Dispara e-mail para o usuário final
    const recipients = [toEmail];
    
    // Adiciona o e-mail do admin como backup/cópia caso não seja o próprio destinatário
    if (toEmail.toLowerCase() !== BACKUP_EMAIL.toLowerCase()) {
      recipients.push(BACKUP_EMAIL);
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: SENDER_EMAIL,
        to: recipients,
        subject: subject,
        html: htmlBody,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[Resend Email Error] HTTP ${response.status}: ${errText}`);
    } else {
      console.log(`[Resend Email Success] E-mail enviado com sucesso para ${recipients.join(", ")}`);
    }
  } catch (error) {
    console.error("[Resend Email Exception]", error);
  }
}

// ─── EA Marketplace ───────────────────────────────────────────────────────────

export interface EARejectedEmailData {
  to: string;
  userName: string;
  eaName: string;
  eaSymbol: string;
  eaTimeframe: string;
}

/**
 * Notifica o assinante quando um EA que ele baixou foi reprovado na revalidação.
 */
export async function sendEARejectedEmail({
  to,
  userName,
  eaName,
  eaSymbol,
  eaTimeframe,
}: EARejectedEmailData) {
  const subject = `⚠️ Atenção: EA "${eaName}" reprovado na revalidação`;

  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
    </head>
    <body style="margin:0;padding:0;background:#000000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#000000;padding:40px 20px;">
        <tr><td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#0A0A0A;border:1px solid rgba(245,245,245,0.08);border-radius:16px;overflow:hidden;">
            <!-- Header -->
            <tr>
              <td style="background:#0A0A0A;border-bottom:1px solid rgba(245,245,245,0.06);padding:24px 32px;">
                <span style="font-size:18px;font-weight:700;color:#F5F5F5;letter-spacing:-0.01em;">
                  Zaion<span style="color:#2563EB;">Vest</span>
                </span>
              </td>
            </tr>

            <!-- Alerta -->
            <tr>
              <td style="padding:32px 32px 24px;">
                <div style="background:rgba(37,99,235,0.08);border:1px solid rgba(37,99,235,0.25);border-radius:10px;padding:16px 20px;margin-bottom:24px;">
                  <p style="margin:0;font-size:13px;font-weight:700;color:#2563EB;text-transform:uppercase;letter-spacing:0.08em;">
                    ⚠️ EA Reprovado na Revalidação
                  </p>
                </div>

                <p style="margin:0 0 16px;font-size:14px;color:#A1A1AA;">
                  Olá, <strong style="color:#F5F5F5;">${userName}</strong>
                </p>

                <p style="margin:0 0 20px;font-size:14px;color:#A1A1AA;line-height:1.6;">
                  O Expert Advisor que você baixou não passou nos critérios mínimos
                  de robustez da nossa <strong style="color:#F5F5F5;">Esteira DQ Labs</strong>
                  neste ciclo de revalidação:
                </p>

                <div style="background:#050505;border:1px solid rgba(245,245,245,0.06);border-radius:10px;padding:20px 24px;margin-bottom:24px;">
                  <p style="margin:0 0 4px;font-size:10px;color:#52525B;text-transform:uppercase;letter-spacing:0.16em;">
                    EA Reprovado
                  </p>
                  <p style="margin:0;font-size:18px;font-weight:700;color:#F5F5F5;">
                    ${eaName}
                  </p>
                  <p style="margin:4px 0 0;font-size:12px;color:#71717A;font-family:monospace;">
                    ${eaSymbol} · ${eaTimeframe}
                  </p>
                </div>

                <p style="margin:0 0 20px;font-size:14px;color:#A1A1AA;line-height:1.6;">
                  O robô já foi instruído a <strong style="color:#F5F5F5;">parar de abrir novas ordens</strong>
                  automaticamente. Operações já abertas continuarão sendo gerenciadas
                  normalmente até o fechamento.
                </p>

                <p style="margin:0 0 24px;font-size:14px;color:#A1A1AA;line-height:1.6;">
                  Acesse a vitrine e escolha outro EA aprovado para substituí-lo:
                </p>

                <a href="https://zaionvest.com.br/dashboard/vitrine"
                   style="display:inline-block;background:#2563EB;color:#FFFFFF;padding:14px 28px;border-radius:10px;font-size:13px;font-weight:700;text-decoration:none;letter-spacing:0.02em;">
                  Ver Vitrine de EAs →
                </a>
              </td>
            </tr>

            <!-- Info técnica -->
            <tr>
              <td style="border-top:1px solid rgba(245,245,245,0.06);padding:20px 32px;background:#050505;">
                <p style="margin:0;font-size:11px;color:#52525B;line-height:1.6;">
                  <strong style="color:#71717A;">Critérios de reprovação (DQ Labs):</strong><br>
                  WFE médio abaixo de 50% ou mais de 50% das janelas OOS negativas.
                  A revalidação é executada mensalmente com dados atualizados do mercado.
                </p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:20px 32px;border-top:1px solid rgba(245,245,245,0.04);">
                <p style="margin:0;font-size:10px;color:#3F3F46;text-align:center;">
                  ZaionVest · Você recebeu este e-mail porque baixou este EA.<br>
                  <a href="https://zaionvest.com.br/dashboard/configuracoes"
                     style="color:#52525B;text-decoration:underline;">
                    Gerenciar preferências de e-mail
                  </a>
                </p>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: SENDER_EMAIL,
        to: [to],
        subject,
        html: htmlBody,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[EA Email Error] HTTP ${response.status}: ${errText}`);
    } else {
      console.log(`[EA Email] Notificação enviada para ${to}`);
    }
  } catch (error) {
    console.error("[EA Email Exception]", error);
  }
}
