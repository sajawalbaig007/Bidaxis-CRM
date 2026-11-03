"use client";

import toast from "react-hot-toast";

const CONFIRM_ID = "crm-confirm-delete";

/** "Are you sure?" toast with Yes / Cancel. Runs `onConfirm` only after Yes. */
export function confirmDelete(message: string, onConfirm: () => void | Promise<unknown>): void {
  toast.dismiss(CONFIRM_ID);
  toast.custom(
    t => (
      <div
        className={`${t.visible ? "opacity-100" : "opacity-0"} transition-opacity w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-red-100 bg-white p-4 shadow-xl dark:border-crm-border dark:bg-crm-surface`}
        role="alertdialog"
        aria-live="assertive"
      >
        <p className="text-sm font-bold text-gray-900 dark:text-crm-text">Are you sure?</p>
        <p className="mt-1 text-[13px] text-gray-600 dark:text-crm-text-muted">{message}</p>
        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => toast.dismiss(t.id)}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-crm-border dark:text-crm-text dark:hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            type="button"
            autoFocus
            onClick={() => {
              toast.dismiss(t.id);
              void onConfirm();
            }}
            className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
          >
            Yes, delete
          </button>
        </div>
      </div>
    ),
    { id: CONFIRM_ID, duration: Infinity, position: "top-center" },
  );
}
