export function PeriodFilter({
  value,
  onChange,
}: {
  value: string;
  onChange: (val: string) => void;
}) {
  const options = [
    { label: "Todo Período", val: "total" },
    { label: "Hoje", val: "today" },
    { label: "Ontem", val: "yesterday" },
    { label: "Esta Semana", val: "week" },
    { label: "Este Mês", val: "month" },
  ];

  return (
    <div className="flex rounded-lg border border-[#f5f5f5]/8 bg-[#070707] p-0.5 shadow-inner">
      {options.map((opt) => (
        <button
          key={opt.val}
          onClick={() => onChange(opt.val)}
          className={`rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition duration-200 ${
            value === opt.val
              ? "bg-[#2563EB] text-[#F5F5F5] shadow"
              : "text-zinc-500 hover:text-[#F5F5F5]"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
