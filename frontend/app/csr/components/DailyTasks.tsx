export default function DailyTasks() {
  return (
    <div className="bg-white border rounded-[28px] p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-[#0F172A]">
            Daily Tasks
          </h3>

          <p className="text-gray-500 mt-1">
            Your today's follow-ups.
          </p>
        </div>

        <button className="bg-[#C8102E] text-white px-5 py-3 rounded-2xl font-medium">
          View All
        </button>
      </div>

      <div className="space-y-4 mt-6">
        {[1, 2, 3].map((item) => (
          <div
            key={item}
            className="border rounded-2xl p-4 flex items-center justify-between"
          >
            <div>
              <h4 className="font-semibold">
                Follow-up Client #{item}
              </h4>

              <p className="text-sm text-gray-500 mt-1">
                Pending response from client.
              </p>
            </div>

            <span className="bg-yellow-100 text-yellow-700 px-4 py-2 rounded-xl text-sm font-medium">
              Pending
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}