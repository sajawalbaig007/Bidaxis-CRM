/** Short status-update time: `25 Jun, 14:32:05` */
export function formatStatusTimestamp(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  return `${date}, ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
