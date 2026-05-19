export default function ActivityCard() {
  return (
    <div className="bg-white border rounded-[28px] p-6 shadow-sm">
      <div>
        <h3 className="text-2xl font-bold text-[#0F172A]">
          Recent Activity
        </h3>

        <p className="text-gray-500 mt-1">
          Latest CSR actions and updates.
        </p>
      </div>

      <div className="space-y-5 mt-6">
        {[1, 2, 3].map((item) => (
          <div
            key={item}
            className="flex items-start gap-4"
          >
            <div className="w-3 h-3 rounded-full bg-[#C8102E] mt-2" />

            <div>
              <h4 className="font-semibold text-[#0F172A]">
                Client marked as completed
              </h4>

              <p className="text-sm text-gray-500 mt-1">
                Updated 2 hours ago.
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}