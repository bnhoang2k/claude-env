import { Button } from '../ui/Button';

const card = { display: 'grid' };

export function Good({ pct, tierRgb }: { pct: number; tierRgb: string }) {
  // eslint-disable-next-line ui-lock/no-raw-values -- the partner's logo color is fixed by their brand guide
  const logo = '#ff6600';
  return (
    <div className="p-4 text-sm" data-logo={logo} style={card}>
      <a href="#top" className="data-[state=open]:bg-accent">Top</a>
      <a href="#add-item" className="group-data-[size=sm]/card:p-3 [&>svg]:size-4 has-[>svg]:px-3">Add</a>
      <span
        className="supports-[display:grid]:grid w-(--sidebar-width) group-hover/item:visible text-sm/6"
        style={{ width: `${pct}%`, '--tier-rgb': tierRgb, margin: 0, display: 'none', position: 'absolute', overflow: `hidden`, padding: 'var(--space-2)' }}
      >
        y
      </span>
      <span style={{ '--x': tierRgb } as React.CSSProperties}>v</span>
      <Button>Go</Button>
    </div>
  );
}
