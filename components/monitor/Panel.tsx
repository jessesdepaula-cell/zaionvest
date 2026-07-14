import { ReactNode } from "react";

export function Panel({
  title,
  right,
  children,
  className = "",
}: {
  title: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-[#f5f5f5]/8 bg-[#0D0D0D] p-5 shadow-lg shadow-black/40 flex flex-col ${className}`}>
      <div className="flex items-center justify-between border-b border-[#f5f5f5]/5 pb-3 mb-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#F5F5F5]">
          {title}
        </h3>
        {right && <div className="text-zinc-500">{right}</div>}
      </div>
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}
