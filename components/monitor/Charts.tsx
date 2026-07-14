"use client";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const AXIS = { fontSize: 9, fill: "#71717a", fontFamily: "monospace" };
const GRID = "rgba(245,245,245,0.05)";

function CompactTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-[#f5f5f5]/10 bg-[#070707] px-3 py-2 font-mono text-[10px] shadow-2xl shadow-black/85 text-[#F5F5F5]">
      <div className="text-zinc-500 mb-1">{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="tabular-nums font-bold" style={{ color: p.color }}>
          {p.name}: {Number(p.value).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
        </div>
      ))}
    </div>
  );
}

export function CapitalCurveChart({
  data,
}: {
  data: { ts: string; balance: number; equity: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 6, right: 8, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="eq" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#2563EB" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="bl" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} strokeDasharray="3 6" vertical={false} />
        <XAxis dataKey="ts" tick={AXIS} tickFormatter={(v) => v?.slice(5, 16)} minTickGap={50} />
        <YAxis tick={AXIS} domain={["auto", "auto"]} />
        <Tooltip content={<CompactTip />} />
        <Area type="monotone" dataKey="balance" name="Saldo Fechado" stroke="#2563EB" fill="url(#eq)" strokeWidth={2} />
        <Area type="monotone" dataKey="equity" name="Capital Flutuante" stroke="#06b6d4" fill="url(#bl)" strokeWidth={1.2} strokeDasharray="4 4" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function DrawdownChart({ data }: { data: { ts: string; ddPct: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 6, right: 8, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="dd" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} strokeDasharray="3 6" vertical={false} />
        <XAxis dataKey="ts" tick={AXIS} tickFormatter={(v) => v?.slice(5, 16)} minTickGap={50} />
        <YAxis tick={AXIS} />
        <Tooltip content={<CompactTip />} />
        <Area type="monotone" dataKey="ddPct" name="Drawdown %" stroke="#f43f5e" fill="url(#dd)" strokeWidth={1.5} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function ReturnChart({ data }: { data: { ts: string; returnPct: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 6, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="3 6" vertical={false} />
        <XAxis dataKey="ts" tick={AXIS} tickFormatter={(v) => v?.slice(5, 16)} minTickGap={50} />
        <YAxis tick={AXIS} />
        <Tooltip content={<CompactTip />} />
        <Line type="monotone" dataKey="returnPct" name="Retorno %" stroke="#2563EB" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function ProfitBarChart({
  data,
  dataKey = "profit",
  label = "Lucro",
  tickFormatter,
}: {
  data: { date: string; profit: number }[];
  dataKey?: string;
  label?: string;
  tickFormatter?: (v: string) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 6, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="3 6" vertical={false} />
        <XAxis dataKey="date" tick={AXIS} minTickGap={20} tickFormatter={tickFormatter} />
        <YAxis tick={AXIS} />
        <Tooltip content={<CompactTip />} />
        <Bar dataKey={dataKey} name={label} radius={[3, 3, 0, 0]}>
          {data.map((d, i) => {
            const val = Number(d[dataKey as keyof typeof d] ?? d.profit ?? 0);
            const fill = val >= 0 ? "#10b981" : "#f43f5e";
            return <Cell key={i} fill={fill} />;
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function RobotPerformanceChart({
  data,
}: {
  data: { label: string; netProfit: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 30 + 40)}>
      <BarChart layout="vertical" data={data} margin={{ top: 6, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="3 6" horizontal={false} />
        <XAxis type="number" tick={AXIS} />
        <YAxis type="category" dataKey="label" tick={AXIS} width={110} />
        <Tooltip content={<CompactTip />} />
        <Bar dataKey="netProfit" name="Lucro líquido" fill="#2563EB" radius={[0, 3, 3, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
