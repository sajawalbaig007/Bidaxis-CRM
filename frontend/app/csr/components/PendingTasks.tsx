export default function PendingTasks() {
  return (
    <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-gray-800">
            Pending Tasks
          </h3>

          <p className="text-sm text-gray-500 mt-1">
            Remaining follow-ups today.
          </p>
        </div>

        <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-xl text-sm font-medium">
          12 Pending
        </span>
      </div>

      <div className="space-y-4 mt-5">
        {[1, 2, 3].map((item) => (
          <div
            key={item}
            className="border border-gray-100 rounded-2xl p-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-gray-800">
                  Follow-up Client #{item}
                </h4>

                <p className="text-sm text-gray-500 mt-1">
                  Waiting for response from client.
                </p>
              </div>

              <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-lg text-xs font-medium">
                Pending
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}