type Props = {
  label: string;
  value: string;
  percent?: number;
  subtitle?: string;
};

export function MetricCard({ label, value, percent, subtitle }: Props) {
  return (
    <article className="metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      {typeof percent === "number" && (
        <div className="progress">
          <span style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
        </div>
      )}
      {subtitle && <div className="metric-subtitle">{subtitle}</div>}
    </article>
  );
}
