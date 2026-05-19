export default function ImportantCalls() {
  return (
    <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-gray-800">
            Important Calls
          </h3>

          <p className="text-sm text-gray-500 mt-1">
            High priority clients.
          </p>
        </div>

        <span className="bg-red-100 text-red-600 px-3 py-1 rounded-xl text-sm font-medium">
          4 Active
        </span>
      </div>

      <div className="space-y-4 mt-5">
        {[1, 2, 3].map((item) => (
          <div
            key={item}
            className="border border-gray-100 rounded-2xl p-4"
          >
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-semibold text-gray-800">
                  Premium Client #{item}
                </h4>

                <p className="text-sm text-gray-500 mt-1">
                  Needs urgent callback.
                </p>
              </div>

              <span className="bg-red-100 text-red-600 px-3 py-1 rounded-lg text-xs font-medium">
                Important
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}