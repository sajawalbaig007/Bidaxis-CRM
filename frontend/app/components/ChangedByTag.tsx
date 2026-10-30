export default function ChangedByTag({ name }: { name?: string | null }) {
  const label = name?.trim();
  if (!label) return null;
  return (
    <span className="inline-flex items-center rounded-md bg-[#EAF5FF] px-1.5 py-0.5 text-[10px] font-bold text-[#0B84F3]">
      Changed by {label}
    </span>
  );
}
