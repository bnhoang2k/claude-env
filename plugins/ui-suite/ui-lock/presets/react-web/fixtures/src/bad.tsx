export function Bad() {
  // eslint-disable-next-line ui-lock/no-raw-values
  const brand = '#000000';
  const n = 4;
  const k = 'to right';
  return (
    <div style={{ color: '#f00', fontWeight: '600' }} className="p-[13px] text-sm" data-brand={brand}>
      <span className="text-[#123456]">x</span>
      <span style={{ width: 13, margin: `4px`, padding: 0, top: -4 }}>y</span>
      <span style={{ boxShadow: `0 0 ${n}px #ff0000`, background: `linear-gradient(${k}, rgb(255 0 0))` }}>z</span>
      <span style={{ width: 12 } as React.CSSProperties}>w</span>
      <span style={{ height: 12 } satisfies React.CSSProperties}>h</span>
      <button type="button">Go</button>
      <input />
      {'#ff0000'}
      {`rgb(1, 2, 3)`}
    </div>
  );
}
