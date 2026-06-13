"use client";

import { useState } from "react";
import { Check, MessageSquare } from "lucide-react";

interface CommentCellProps {
  id: string;
  comment: string;
  onSave: (id: string, comment: string) => Promise<void>;
}

export default function CommentCell({ id, comment, onSave }: CommentCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(comment);
  const [saving,  setSaving]  = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(id, draft);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="flex flex-col gap-1.5 sm:gap-2 w-full max-w-[180px] sm:max-w-[240px]">
        <textarea
          autoFocus value={draft}
          onChange={e => setDraft(e.target.value)} rows={2}
          placeholder="Type your comment..."
          className="w-full rounded-xl border border-[#B8112D] px-2.5 sm:px-3 py-2 text-[12px] sm:text-[13px] outline-none resize-none text-[#0F172A]"
        />
        <div className="flex gap-1.5 sm:gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 h-8 rounded-xl bg-[#B8112D] text-white text-[11px] sm:text-[12px] font-semibold flex items-center justify-center gap-1"
          >
            <Check size={11} />{saving ? "Saving..." : "Save"}
          </button>
          <button
            onClick={() => { setEditing(false); setDraft(comment); }}
            className="flex-1 h-8 rounded-xl bg-[#F5F6FA] text-gray-500 text-[11px] sm:text-[12px] font-semibold"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => { setEditing(true); setDraft(comment); }}
      className="group cursor-pointer flex items-start gap-2 max-w-[160px] sm:max-w-[220px]"
    >
      {comment ? (
        <div className="bg-[#F5F6FA] rounded-xl px-2.5 sm:px-3 py-2 w-full">
          <p className="text-[12px] sm:text-[13px] text-[#0F172A] leading-snug line-clamp-2">{comment}</p>
          <p className="text-[10px] sm:text-[11px] text-[#B8112D] mt-1 opacity-0 group-hover:opacity-100 transition-opacity">Click to edit</p>
        </div>
      ) : (
        <div className="flex items-center gap-1 text-gray-400 hover:text-[#B8112D] transition-colors">
          <MessageSquare size={12} className="sm:w-[14px] sm:h-[14px]" />
          <span className="text-[12px] sm:text-[13px]">Add comment</span>
        </div>
      )}
    </div>
  );
}
