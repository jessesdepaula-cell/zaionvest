export const CHANNEL = "mt5-monitor";
export const EVENTS = {
  snapshot: "snapshot",
  trade: "trade",
  position: "position",
} as const;

export async function broadcast(event: string, payload: unknown) {
  // Mock fallback para usar polling simples em tempo real de alta performance no frontend.
  // Evita dependências do Pusher no bundle e custos extras por limite de requisições.
}
