import { LinkStatus } from "./types";

interface Props {
  status: LinkStatus;
}

export default function StatusBadge({
  status,
}: Props) {
  const styles = {
    pending: "bg-yellow-100 text-yellow-700",
    completed: "bg-green-100 text-green-700",
    important: "bg-red-100 text-red-700",
    followup: "bg-blue-100 text-blue-700",
    noresponse: "bg-gray-100 text-gray-700",
  };

  return (
    <span
      className={`px-3 py-1 rounded-full text-sm font-medium capitalize ${styles[status]}`}
    >
      {status}
    </span>
  );
}