export default function AnnouncementBanner() {
  return (
    <div className="mt-5 bg-gradient-to-r from-[#B8112D] to-[#911126] rounded-3xl p-5 text-white">
      <h3 className="font-semibold text-lg">
        Daily Follow-up Reminder
      </h3>

      <p className="text-sm mt-1 opacity-90">
        You have 12 pending follow-up calls today.
      </p>
    </div>
  );
}