import { Link } from "react-router-dom";
import { monthLabel } from "@/lib/blog";

/** Month list with post counts. A wrapping chip row on phones, a stacked list in a sidebar on wider screens. */
const MonthArchive = ({ months, current, className }: { months: { key: string; count: number }[]; current?: string; className?: string }) => {
  if (months.length === 0) return null;
  return (
    <nav aria-label="Blog archive" className={className}>
      <h2 className="mb-2 text-sm font-semibold text-foreground">Archive</h2>
      <ul className="flex flex-wrap gap-2 lg:flex-col lg:gap-1">
        {months.map((m) => (
          <li key={m.key}>
            <Link
              to={`/blog/month/${m.key}`}
              aria-current={current === m.key ? "page" : undefined}
              className={`flex items-center justify-between gap-3 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                current === m.key ? "bg-primary text-primary-foreground" : "border border-border bg-card text-foreground hover:border-primary"
              } lg:border-0 lg:bg-transparent lg:px-2 ${current === m.key ? "lg:bg-primary lg:text-primary-foreground" : "lg:hover:bg-muted"}`}
            >
              <span>{monthLabel(m.key)}</span>
              <span className="text-xs opacity-70">{m.count}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default MonthArchive;
