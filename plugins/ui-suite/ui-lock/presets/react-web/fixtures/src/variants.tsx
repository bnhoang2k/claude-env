// Tailwind variants that wrap an arbitrary value are flagged; bare variants are not.
export function Variants() {
  return (
    <div className="group-data-[collapsible=icon]:hidden aria-[invalid=true]:border-accent">
      <span className="flex p-[13px] gap-2">a</span>
      <span className="hover:p-[13px]">b</span>
      <span className="md:max-w-[65ch]">c</span>
      <span className="data-[state=open]:w-[13px]">d</span>
      <span className="p-[13px]!">e</span>
      <span className="!p-[13px]">f</span>
      <span className="text-[13px]/[20px]">g</span>
      <span className="[margin:13px]">h</span>
      <span className="[grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]">i</span>
      <span className="bg-[var(--x)]">j</span>
      <span className="w-[var(--x,13px)]">k</span>
      <span className="[margin:var(--z)]">l</span>
      <span className="w-[calc(var(--x)*2)]">m</span>
    </div>
  );
}
