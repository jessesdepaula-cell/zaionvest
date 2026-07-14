// Converte qualquer bigint ou Date em estruturas amigáveis para JSON do Next.js.
export function serialize<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_k, v) => {
      if (typeof v === "bigint") return v.toString();
      if (v instanceof Date) return v.toISOString();
      return v;
    }),
  );
}
