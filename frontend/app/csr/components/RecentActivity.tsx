export default function RecentActivity() {
  return (
    <div>
      <h3 className="text-xl font-semibold text-gray-800">
        Recent Activity
      </h3>

      <div className="space-y-4 mt-5">
        {[1, 2, 3].map((item) => (
          <div
            key={item}
            className="flex items-start gap-3"
          >
            <div className="w-3 h-3 rounded-full bg-[#B8112D] mt-2" />

            <div>
              <h4 className="font-medium text-gray-800">
                Client status updated
              </h4>

              <p className="text-sm text-gray-500 mt-1">
                Follow-up call marked completed.
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}