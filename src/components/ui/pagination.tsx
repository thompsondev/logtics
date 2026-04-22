"use client";

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, total, pageSize, onPageChange }: PaginationProps) {
  const from = Math.min((page - 1) * pageSize + 1, total);
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between px-1 py-3">
      <p className="text-xs text-gray-500">
        Showing <span className="text-gray-300 font-medium">{from}–{to}</span> of{" "}
        <span className="text-gray-300 font-medium">{total}</span>
      </p>
      <div className="flex items-center gap-1">
        <PageBtn onClick={() => onPageChange(1)} disabled={page === 1} label="«" />
        <PageBtn onClick={() => onPageChange(page - 1)} disabled={page === 1} label="‹" />
        {getPages(page, totalPages).map((p, i) =>
          p === "…" ? (
            <span key={`ellipsis-${i}`} className="w-8 text-center text-gray-600 text-sm">…</span>
          ) : (
            <PageBtn
              key={p}
              onClick={() => onPageChange(p as number)}
              disabled={p === page}
              active={p === page}
              label={String(p)}
            />
          ),
        )}
        <PageBtn onClick={() => onPageChange(page + 1)} disabled={page === totalPages} label="›" />
        <PageBtn onClick={() => onPageChange(totalPages)} disabled={page === totalPages} label="»" />
      </div>
    </div>
  );
}

function PageBtn({
  onClick,
  disabled,
  active,
  label,
}: {
  onClick: () => void;
  disabled: boolean;
  active?: boolean;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-8 h-8 rounded-lg text-sm transition-colors
        ${active ? "bg-blue-600 text-white font-semibold" : ""}
        ${!active && !disabled ? "text-gray-400 hover:bg-gray-800 hover:text-white" : ""}
        ${disabled && !active ? "text-gray-700 cursor-not-allowed" : ""}
      `}
    >
      {label}
    </button>
  );
}

function getPages(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, "…", total];
  if (current >= total - 3) return [1, "…", total - 4, total - 3, total - 2, total - 1, total];
  return [1, "…", current - 1, current, current + 1, "…", total];
}
