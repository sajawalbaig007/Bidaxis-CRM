"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { visibleInterval } from "@/lib/visibleInterval";
import {
  Send, Plus, Search, X, MessageSquare, Hash, User2,
  Check, CheckCheck, ChevronLeft, Loader2, Paperclip,
  Mic, StopCircle, Play, Pause, Download, FileText,
  Film, Music, Bell, BellOff, Image as ImageIcon,
  Trash2, Reply, Copy, Pin, PinOff, CheckSquare, Pencil,
  Archive, ArchiveRestore, Volume2, VolumeX,
} from "lucide-react";
import API from "@/lib/api";
import { pollChatUnread } from "@/lib/chatUnreadStore";
import { playChatSound } from "@/lib/chatSound";
import { addToOfflineQueue, getOfflineQueue, removeFromOfflineQueue } from "@/lib/chatOfflineQueue";
import { MentionText, PdfPreview, ReactionBar, ReactionPicker } from "./MessageExtras";

/* ΓöÇΓöÇΓöÇ Types ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */
interface ChatUser { id: string; name: string; email?: string; csrCode?: string | null; isOnline?: boolean; role?: string; }
type MsgType   = "text" | "file" | "image" | "voice";
type MsgStatus = "sending" | "sent" | "delivered" | "read";
interface ReplyQuote { id: string; text: string; senderName: string; type: MsgType; }
interface Message {
  id: string; senderId: string; senderName: string; text: string; type: MsgType;
  fileUrl?: string; fileName?: string; fileSize?: number; fileMimeType?: string;
  createdAt: string; editedAt?: string | null; isOwn: boolean; status: MsgStatus;
  replyTo?: ReplyQuote | null; mentions?: string[];
  reactions?: Record<string, string[]>;
  readBy?: string[];
}
interface Conversation {
  id: string; type: "direct" | "group"; name: string;
  lastMessage?: string; lastMessageAt?: string;
  unreadCount: number; memberCount?: number; isOnline?: boolean; otherUserId?: string;
  pinnedMessageId?: string | null; archived?: boolean;
}
interface CtxMenu { x: number; y: number; msg: Message; }

/* ΓöÇΓöÇΓöÇ Helpers ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */
const MAX_FILE_BYTES = 200 * 1024 * 1024;
function deduplicateConvs(convs: Conversation[]): Conversation[] {
  const seenDm = new Map<string, number>(); const result: Conversation[] = [];
  for (const c of convs) {
    if (c.type === "group") { result.push(c); continue; }
    const key = c.otherUserId ?? c.name; const idx = seenDm.get(key);
    if (idx === undefined) { seenDm.set(key, result.length); result.push(c); }
    else if ((c.lastMessageAt ?? "") > (result[idx]?.lastMessageAt ?? "")) { result[idx] = c; }
  }
  return result;
}
function initials(name: string) { return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase(); }
function fmtConvTime(iso: string) {
  try {
    const d = new Date(iso), now = new Date();
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    if (d.toDateString() === new Date(Date.now() - 86400000).toDateString()) return "Yesterday";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch { return ""; }
}
function fmtMsgTime(iso: string) {
  try { return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }); } catch { return ""; }
}
function fmtDateSep(iso: string) {
  try {
    const d = new Date(iso), now = new Date();
    if (d.toDateString() === now.toDateString()) return "Today";
    if (d.toDateString() === new Date(Date.now() - 86400000).toDateString()) return "Yesterday";
    return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  } catch { return ""; }
}
function fmtAudio(secs: number) { const s = Math.floor(secs), m = Math.floor(s / 60); return `${m}:${String(s % 60).padStart(2, "0")}`; }
function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}
function mimeIcon(mime = "") {
  if (mime.startsWith("image/")) return <ImageIcon size={18} />;
  if (mime.startsWith("video/")) return <Film size={18} />;
  if (mime.startsWith("audio/")) return <Music size={18} />;
  return <FileText size={18} />;
}
function truncate(text: string, n = 60) { return text.length > n ? text.slice(0, n) + "ΓÇª" : text; }

/* ΓöÇΓöÇΓöÇ Avatar ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */
const COLORS = ["bg-[#B8112D]","bg-[#1D4ED8]","bg-[#15803D]","bg-[#B45309]","bg-[#7C3AED]","bg-[#0891B2]"];
function Avatar({ name, size = "md", online }: { name: string; size?: "sm"|"md"|"lg"; online?: boolean }) {
  const c  = COLORS[name.charCodeAt(0) % COLORS.length];
  const sz = size === "sm" ? "w-8 h-8 text-[10px]" : size === "lg" ? "w-11 h-11 text-sm" : "w-9 h-9 text-xs";
  return (
    <div className="relative shrink-0">
      <div className={`${sz} ${c} rounded-full text-white flex items-center justify-center font-bold`}>{initials(name)}</div>
      {online !== undefined && (
        <div className="absolute -bottom-0.5 -right-0.5">
          {online && <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-green-400 animate-ping opacity-75" />}
          <div className={`w-2.5 h-2.5 rounded-full border-2 border-white ${online ? "bg-green-500" : "bg-gray-300"}`} />
        </div>
      )}
    </div>
  );
}

/* ΓöÇΓöÇΓöÇ Ticks ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */
function Ticks({ status }: { status: MsgStatus }) {
  if (status === "sending")   return <Loader2 size={10} className="text-white/50 animate-spin" />;
  if (status === "sent")      return <Check size={10} className="text-white/60" />;
  if (status === "delivered") return <CheckCheck size={10} className="text-white/70" />;
  return <CheckCheck size={10} className="text-blue-300" />;
}

/* ΓöÇΓöÇΓöÇ FileCard ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */
function FileCard({ fileName, fileSize, fileUrl, fileMimeType, isOwn }: { fileName: string; fileSize: number; fileUrl: string; fileMimeType?: string; isOwn: boolean; }) {
  if (fileMimeType === "application/pdf" || fileName.toLowerCase().endsWith(".pdf")) {
    return <PdfPreview url={fileUrl} fileName={fileName} />;
  }
  return (
    <a href={fileUrl} target="_blank" rel="noopener noreferrer" download={fileName}
      className={`flex items-center gap-2.5 p-2.5 rounded-xl min-w-[160px] max-w-[220px] group transition-colors ${isOwn ? "bg-white/15 hover:bg-white/25" : "bg-[#F5F6FA] hover:bg-gray-100"}`}>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isOwn ? "bg-white/20 text-white" : "bg-[#B8112D]/10 text-[#B8112D]"}`}>{mimeIcon(fileMimeType)}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold truncate">{fileName}</p>
        <p className={`text-[10px] ${isOwn ? "text-white/60" : "text-gray-400"}`}>{fmtSize(fileSize)}</p>
      </div>
      <Download size={13} className={`shrink-0 opacity-60 group-hover:opacity-100 ${isOwn ? "text-white" : "text-gray-400"}`} />
    </a>
  );
}

/* ΓöÇΓöÇΓöÇ VoicePlayer ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */
function VoicePlayer({ fileUrl, isOwn }: { fileUrl: string; isOwn: boolean }) {
  const [playing,  setPlaying]  = useState(false);
  const [progress, setProgress] = useState(0);
  const [curTime,  setCurTime]  = useState(0);
  const [dur,      setDur]      = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const toggle = () => {
    const a = audioRef.current; if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { a.play().then(() => setPlaying(true)).catch(() => {}); }
  };
  return (
    <div className="flex items-center gap-2.5 min-w-[160px] max-w-[220px] py-0.5">
      <audio ref={audioRef} src={fileUrl}
        onTimeUpdate={e => { const a = e.currentTarget; setCurTime(a.currentTime); setProgress(a.duration ? (a.currentTime/a.duration)*100 : 0); }}
        onLoadedMetadata={e => setDur(e.currentTarget.duration)}
        onEnded={() => { setPlaying(false); setProgress(0); setCurTime(0); }} />
      <button onClick={toggle} className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors ${isOwn ? "bg-white/20 hover:bg-white/30" : "bg-[#B8112D]/10 hover:bg-[#B8112D]/20"}`}>
        {playing ? <Pause size={13} className={isOwn ? "text-white" : "text-[#B8112D]"} /> : <Play size={13} className={isOwn ? "text-white" : "text-[#B8112D]"} />}
      </button>
      <div className="flex-1 flex flex-col gap-1">
        <div className={`h-1 rounded-full overflow-hidden ${isOwn ? "bg-white/30" : "bg-gray-200"}`}>
          <div className={`h-full rounded-full ${isOwn ? "bg-white" : "bg-[#B8112D]"}`} style={{ width: `${progress}%`, transition: "width 0.1s linear" }} />
        </div>
        <span className={`text-[9px] ${isOwn ? "text-white/60" : "text-gray-400"}`}>{fmtAudio(curTime)} / {fmtAudio(dur)}</span>
      </div>
    </div>
  );
}

/* ΓöÇΓöÇΓöÇ MessageBubble ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */
function MessageBubble({ msg, isGroup, showAvatar, myId, onCtxMenu, onReply, onJumpToReply, onReact }: {
  msg: Message; isGroup: boolean; showAvatar: boolean; myId?: string;
  onCtxMenu: (e: React.MouseEvent, msg: Message) => void;
  onReply:   (msg: Message) => void;
  onJumpToReply: (id: string) => void;
  onReact: (msg: Message, emoji: string) => void;
}) {
  const own = msg.isOwn;
  const body = () => {
    if (msg.type === "image" && msg.fileUrl) return (
      <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={msg.fileUrl} alt={msg.fileName ?? "image"} className="max-w-[200px] max-h-[200px] rounded-xl object-cover" />
      </a>
    );
    if (msg.type === "voice" && msg.fileUrl) return <VoicePlayer fileUrl={msg.fileUrl} isOwn={own} />;
    if (msg.type === "file"  && msg.fileUrl) return <FileCard fileName={msg.fileName ?? "File"} fileSize={msg.fileSize ?? 0} fileUrl={msg.fileUrl} fileMimeType={msg.fileMimeType} isOwn={own} />;
    return <MentionText text={msg.text} className="text-sm leading-relaxed break-words whitespace-pre-wrap" />;
  };
  return (
    <div id={`msg-${msg.id}`}
      className={`flex items-end gap-2 group ${own ? "flex-row-reverse" : "flex-row"} ${!showAvatar ? (own ? "pr-11" : "pl-11") : ""}`}
      onContextMenu={e => onCtxMenu(e, msg)}>
      {!own && showAvatar  && <Avatar name={msg.senderName} size="sm" />}
      {!own && !showAvatar && <div className="w-8 shrink-0" />}
      <div className={`flex flex-col ${own ? "items-end" : "items-start"} max-w-[72%]`}>
        {isGroup && !own && showAvatar && <span className="text-[10px] font-bold text-[#B8112D] mb-0.5 ml-1">{msg.senderName}</span>}
        {msg.replyTo && (
          <button onClick={() => onJumpToReply(msg.replyTo!.id)}
            className={`mb-1 text-left rounded-xl px-2.5 py-1.5 border-l-4 text-[11px] max-w-full transition-colors ${own ? "bg-white/10 border-white/40 text-white/80 hover:bg-white/20" : "bg-gray-100 border-[#B8112D]/40 text-gray-500 hover:bg-gray-200"}`}>
            <p className="font-bold text-[10px] mb-0.5 opacity-80">{msg.replyTo.senderName}</p>
            <p className="truncate max-w-[160px]">{msg.replyTo.type !== "text" ? `≡ƒôÄ ${msg.replyTo.type}` : truncate(msg.replyTo.text, 40)}</p>
          </button>
        )}
        <div className={`rounded-2xl ${msg.type === "text" ? "px-3.5 py-2.5" : "p-2"} ${own ? "bg-[#B8112D] text-white rounded-br-sm" : "bg-white text-[#0F172A] shadow-sm border border-gray-100 rounded-bl-sm"}`}>
          {body()}
        </div>
        {msg.reactions && Object.keys(msg.reactions).length > 0 && (
          <ReactionBar reactions={msg.reactions} myId={myId} onToggle={emoji => onReact(msg, emoji)} />
        )}
        <div className={`flex items-center gap-1 mt-0.5 px-1 ${own ? "flex-row-reverse" : ""}`}>
          <span className="text-[9px] text-gray-400">{fmtMsgTime(msg.createdAt)}{msg.editedAt ? " ┬╖ edited" : ""}</span>
          {own && <Ticks status={msg.status} />}
        </div>
        {own && msg.readBy && msg.readBy.length > 0 && (
          <p className="text-[9px] text-gray-400 mt-0.5 px-1" title={msg.readBy.join(", ")}>
            Read by {msg.readBy.slice(0, 3).join(", ")}{msg.readBy.length > 3 ? ` +${msg.readBy.length - 3}` : ""}
          </p>
        )}
      </div>
      <button onClick={() => onReply(msg)}
        className="opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center shrink-0 mb-6 hover:bg-gray-50">
        <Reply size={12} className="text-gray-500" />
      </button>
    </div>
  );
}

/* ΓöÇΓöÇΓöÇ ConvItem ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */
function ConvItem({ conv, active, onClick, selectMode, selected, onSelect, pinned, onPin }: {
  conv: Conversation; active: boolean; onClick: () => void;
  selectMode: boolean; selected: boolean; onSelect: () => void; pinned: boolean; onPin: () => void;
}) {
  return (
    <div className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all cursor-pointer group ${active ? "bg-[#FFF1F3]" : "hover:bg-[#F9FAFB]"} ${selected ? "bg-[#FFF1F3] ring-1 ring-[#B8112D]/20" : ""}`}
      onClick={selectMode ? onSelect : onClick}>
      {selectMode ? (
        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${selected ? "bg-[#B8112D] border-[#B8112D]" : "border-gray-300"}`}>
          {selected && <Check size={10} className="text-white" />}
        </div>
      ) : (
        conv.type === "group"
          ? <div className="w-9 h-9 rounded-full bg-[#B8112D]/10 text-[#B8112D] flex items-center justify-center shrink-0"><Hash size={16} /></div>
          : <Avatar name={conv.name} size="sm" online={conv.isOnline} />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <span className={`text-[13px] font-semibold truncate ${active ? "text-[#B8112D]" : "text-[#0F172A]"}`}>
            {pinned && <Pin size={9} className="inline mr-1 text-[#B8112D]" />}{conv.name}
          </span>
          {conv.lastMessageAt && <span className="text-[10px] text-gray-400 shrink-0">{fmtConvTime(conv.lastMessageAt)}</span>}
        </div>
        <div className="flex items-center justify-between gap-1 mt-0.5">
          <p className="text-[11px] text-gray-400 truncate">{conv.lastMessage ?? (conv.type === "group" ? `${conv.memberCount ?? 0} members` : "No messages yet")}</p>
          {conv.unreadCount > 0 && (
            <span className="bg-[#B8112D] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[16px] text-center shrink-0">
              {conv.unreadCount > 9 ? "9+" : conv.unreadCount}
            </span>
          )}
        </div>
      </div>
      {!selectMode && (
        <button onClick={e => { e.stopPropagation(); onPin(); }}
          className="opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 rounded-lg flex items-center justify-center hover:bg-gray-100 shrink-0" title={pinned ? "Unpin" : "Pin"}>
          {pinned ? <PinOff size={12} className="text-gray-400" /> : <Pin size={12} className="text-gray-400" />}
        </button>
      )}
    </div>
  );
}

/* ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ */
export default function ChatPanel({ onClose }: { onClose: () => void }) {
  const [me,             setMe]             = useState<ChatUser | null>(null);
  const [conversations,  setConversations]  = useState<Conversation[]>([]);
  const [activeConvId,   setActiveConvId]   = useState<string | null>(null);
  const [messages,       setMessages]       = useState<Message[]>([]);
  const [loadingConvs,   setLoadingConvs]   = useState(true);
  const [loadingMsgs,    setLoadingMsgs]    = useState(false);
  const [sendingMsg,     setSendingMsg]     = useState(false);
  const [msgText,        setMsgText]        = useState("");
  const [convSearch,     setConvSearch]     = useState("");
  const [mobileSideOpen, setMobileSideOpen] = useState(true);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName,      setGroupName]      = useState("");
  const [allUsers,       setAllUsers]       = useState<ChatUser[]>([]);
  const [selectedUsers,  setSelectedUsers]  = useState<string[]>([]);
  const [userSearch,     setUserSearch]     = useState("");
  const [creatingGroup,  setCreatingGroup]  = useState(false);
  const [showDmModal,    setShowDmModal]    = useState(false);
  const [dmSearch,       setDmSearch]       = useState("");
  const [pendingFile,    setPendingFile]    = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading,      setUploading]      = useState(false);
  const [isRecording,    setIsRecording]    = useState(false);
  const [recTime,        setRecTime]        = useState(0);
  const [notifGranted,   setNotifGranted]   = useState(() => typeof Notification !== "undefined" && Notification.permission === "granted");
  const [selectMode,     setSelectMode]     = useState(false);
  const [selectedConvs,  setSelectedConvs]  = useState<string[]>([]);
  const [pinnedIds,      setPinnedIds]      = useState<Set<string>>(new Set());
  const [replyTo,        setReplyTo]        = useState<Message | null>(null);
  const [ctxMenu,        setCtxMenu]        = useState<CtxMenu | null>(null);
  const [typingName,     setTypingName]     = useState<string | null>(null);
  const [msgSearchOpen,  setMsgSearchOpen]  = useState(false);
  const [msgSearchText,  setMsgSearchText]  = useState("");
  const [pinnedMessage,  setPinnedMessage]  = useState<Message | null>(null);
  const [groupMembers,   setGroupMembers]   = useState<ChatUser[]>([]);
  const [showArchived,   setShowArchived]   = useState(false);
  const [archivedConvs,  setArchivedConvs]  = useState<Conversation[]>([]);
  const [editingMsg,     setEditingMsg]     = useState<Message | null>(null);
  const [editText,       setEditText]       = useState("");
  const [mentionQuery,   setMentionQuery]   = useState<string | null>(null);
  const [soundOn,        setSoundOn]        = useState(true);
  const [showReactPicker,setShowReactPicker]= useState<string | null>(null);

  const messagesEndRef   = useRef<HTMLDivElement>(null);
  const inputRef         = useRef<HTMLTextAreaElement>(null);
  const fileInputRef     = useRef<HTMLInputElement>(null);
  const lastMsgCount     = useRef(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef        = useRef<Blob[]>([]);
  const streamRef        = useRef<MediaStream | null>(null);
  const recTimerRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const isCancelRef      = useRef(false);
  const notifRef         = useRef(typeof Notification !== "undefined" && Notification.permission === "granted");
  const meRef            = useRef<ChatUser | null>(null);
  const recConvRef       = useRef<string | null>(null);
  const dmLoadingRef     = useRef<string | null>(null);
  const typingDebRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const msgsContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void (async () => {
      try { const r = await API.get("/auth/me"); const u = r.data?.user ?? null; setMe(u); meRef.current = u; } catch {}
    })();
  }, []);

  const askNotif = async () => {
    if (typeof Notification === "undefined") return;
    const r = await Notification.requestPermission(); const ok = r === "granted";
    setNotifGranted(ok); notifRef.current = ok;
  };

  useEffect(() => {
    void (async () => {
      try { const r = await API.get("/chat/conversations"); setConversations(deduplicateConvs(r.data.conversations ?? r.data ?? [])); }
      catch { setConversations([]); } finally { setLoadingConvs(false); }
    })();
    void (async () => {
      try { const r = await API.get("/chat/conversations?archived=1"); setArchivedConvs(deduplicateConvs(r.data.conversations ?? r.data ?? [])); } catch {}
    })();
  }, []);

  useEffect(() => {
    const flush = async () => {
      for (const q of getOfflineQueue()) {
        try {
          await API.post(`/chat/conversations/${q.conversationId}/messages`, { text: q.text, ...(q.replyToId ? { replyToId: q.replyToId } : {}) });
          removeFromOfflineQueue(q.id);
        } catch { break; }
      }
    };
    void flush();
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
  }, []);

  useEffect(() => {
    return visibleInterval(async () => {
      try {
        const [active, archived] = await Promise.all([
          API.get("/chat/conversations"),
          API.get("/chat/conversations?archived=1").catch(() => ({ data: { conversations: [] } })),
        ]);
        setConversations(deduplicateConvs(active.data.conversations ?? active.data ?? []));
        setArchivedConvs(deduplicateConvs(archived.data.conversations ?? archived.data ?? []));
        void pollChatUnread();
      } catch {}
    }, 10_000);
  }, []);

  useEffect(() => {
    const ping = () => void API.post("/chat/status", { online: true }).catch(() => {});
    ping(); const t = setInterval(ping, 30000);
    return () => { clearInterval(t); void API.post("/chat/status", { online: false }).catch(() => {}); };
  }, []);

  useEffect(() => {
    if (!activeConvId) return;
    const cid = activeConvId;
    lastMsgCount.current = 0;
    void (async () => {
      await Promise.resolve();
      setTypingName(null); setMsgSearchOpen(false); setMsgSearchText(""); setMessages([]); setLoadingMsgs(true);
      try {
        const r = await API.get(`/chat/conversations/${cid}/messages`);
        const msgs: Message[] = r.data.messages ?? r.data ?? [];
        setMessages(msgs);
        setPinnedMessage(r.data.pinnedMessage ?? null);
        lastMsgCount.current = msgs.length;
        setConversations(p => p.map(c => c.id === cid ? { ...c, unreadCount: 0 } : c));
        void API.post(`/chat/conversations/${cid}/read`).catch(() => {});
        void pollChatUnread();
        void API.get(`/chat/conversations/${cid}/members`).then(res => {
          setGroupMembers((res.data.members ?? []) as ChatUser[]);
        }).catch(() => setGroupMembers([]));
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "auto" }), 60);
      } catch { setMessages([]); setPinnedMessage(null); } finally { setLoadingMsgs(false); }
    })();
    const stopMsgPoll = visibleInterval(async () => {
      try {
        const [msgRes, typingRes] = await Promise.all([
          API.get(`/chat/conversations/${cid}/messages`),
          API.get(`/chat/conversations/${cid}/typing`).catch(() => ({ data: { names: [] } })),
        ]);
        setTypingName((typingRes.data.names as string[])?.[0] ?? null);
        const msgs: Message[] = msgRes.data.messages ?? [];
        setMessages(msgs);
        if (msgRes.data.pinnedMessage !== undefined) setPinnedMessage(msgRes.data.pinnedMessage ?? null);
        if (msgs.length !== lastMsgCount.current) {
          const hadNew = msgs.length > lastMsgCount.current;
          lastMsgCount.current = msgs.length;
          setConversations(p => p.map(c => c.id === cid ? { ...c, unreadCount: 0 } : c));
          void API.post(`/chat/conversations/${cid}/read`).catch(() => {});
        void pollChatUnread();
          const newest = msgs[msgs.length - 1];
          if (hadNew && newest && !newest.isOwn) {
            if (soundOn) playChatSound();
            if (notifRef.current && !document.hasFocus()) {
              new Notification(newest.senderName, { body: newest.type !== "text" ? `Sent a ${newest.type}` : newest.text.slice(0, 80), icon: "/images/image.png" });
            }
          }
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 40);
        }
      } catch {}
    }, 3_000);
    return stopMsgPoll;
  }, [activeConvId, soundOn]);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (recTimerRef.current) clearInterval(recTimerRef.current);
  }, []);

  const parseMentionIds = (text: string): string[] => {
    const ids: string[] = [];
    for (const m of groupMembers) {
      if (text.includes(`@${m.name}`)) ids.push(m.id);
    }
    return ids;
  };

  const sendText = async () => {
    if (!msgText.trim() || !activeConvId || sendingMsg) return;
    const text = msgText.trim(); const reply = replyTo;
    const mentionIds = activeConv?.type === "group" ? parseMentionIds(text) : [];
    setMsgText(""); setReplyTo(null); setMentionQuery(null); setSendingMsg(true);
    const opt: Message = { id: `opt-${Date.now()}`, senderId: meRef.current?.id ?? "", senderName: meRef.current?.name ?? "You", text, type: "text", createdAt: new Date().toISOString(), isOwn: true, status: "sending", replyTo: reply ? { id: reply.id, text: reply.text, senderName: reply.senderName, type: reply.type } : null };
    setMessages(p => [...p, opt]);
    setConversations(p => p.map(c => c.id === activeConvId ? { ...c, lastMessage: text, lastMessageAt: new Date().toISOString() } : c));
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 30);
    try {
      await API.post(`/chat/conversations/${activeConvId}/messages`, { text, ...(reply ? { replyToId: reply.id } : {}), ...(mentionIds.length ? { mentionIds } : {}) });
      setMessages(p => p.map(m => m.id === opt.id ? { ...m, status: "sent" } : m));
      void pollChatUnread();
    } catch {
      addToOfflineQueue({ id: opt.id, conversationId: activeConvId, text, replyToId: reply?.id, createdAt: new Date().toISOString() });
      setMessages(p => p.map(m => m.id === opt.id ? { ...m, status: "sent" } : m));
    }
    finally { setSendingMsg(false); inputRef.current?.focus(); }
  };

  const saveEdit = async () => {
    if (!editingMsg || !editText.trim()) return;
    try {
      const r = await API.patch(`/chat/messages/${editingMsg.id}`, { text: editText.trim() });
      const updated = r.data.message as Message;
      setMessages(p => p.map(m => m.id === editingMsg.id ? { ...m, ...updated } : m));
      setEditingMsg(null); setEditText("");
    } catch { /* ignore */ }
  };

  const toggleReaction = async (msg: Message, emoji: string) => {
    try {
      const r = await API.post(`/chat/messages/${msg.id}/reactions`, { emoji });
      const reactions = r.data.reactions as Record<string, string[]>;
      setMessages(p => p.map(m => m.id === msg.id ? { ...m, reactions } : m));
    } catch { /* ignore */ }
    setShowReactPicker(null); setCtxMenu(null);
  };

  const pinMessage = async (msg: Message | null) => {
    if (!activeConvId) return;
    try {
      await API.post(`/chat/conversations/${activeConvId}/pin`, { messageId: msg?.id ?? null });
      setPinnedMessage(msg);
      setConversations(p => p.map(c => c.id === activeConvId ? { ...c, pinnedMessageId: msg?.id ?? null } : c));
    } catch { /* ignore */ }
    setCtxMenu(null);
  };

  const archiveConversation = async (archive: boolean) => {
    if (!activeConvId) return;
    try {
      await API.post(`/chat/conversations/${activeConvId}/${archive ? "archive" : "unarchive"}`);
      if (archive) {
        const conv = conversations.find(c => c.id === activeConvId);
        if (conv) { setArchivedConvs(p => [{ ...conv, archived: true }, ...p]); setConversations(p => p.filter(c => c.id !== activeConvId)); }
        setActiveConvId(null);
      } else {
        const conv = archivedConvs.find(c => c.id === activeConvId);
        if (conv) { setConversations(p => [{ ...conv, archived: false }, ...p]); setArchivedConvs(p => p.filter(c => c.id !== activeConvId)); }
      }
    } catch { /* ignore */ }
  };

  const canEdit = (msg: Message) => msg.isOwn && msg.type === "text" && Date.now() - new Date(msg.createdAt).getTime() < 10 * 60 * 1000;

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendText(); } };
  const onMsgTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setMsgText(val);
    if (activeConv?.type === "group") {
      const match = val.match(/@([\w\s.-]*)$/);
      setMentionQuery(match ? match[1].trim().toLowerCase() : null);
    } else setMentionQuery(null);
    if (activeConvId && val.trim()) {
      if (typingDebRef.current) clearTimeout(typingDebRef.current);
      typingDebRef.current = setTimeout(() => { void API.post(`/chat/conversations/${activeConvId}/typing`).catch(() => {}); }, 400);
    }
  };

  const insertMention = (name: string) => {
    setMsgText(prev => prev.replace(/@[\w\s.-]*$/, `@${name} `));
    setMentionQuery(null);
    inputRef.current?.focus();
  };

  const mentionSuggestions = useMemo(() => {
    if (mentionQuery === null) return [];
    return groupMembers.filter(m => m.id !== me?.id && m.name.toLowerCase().includes(mentionQuery)).slice(0, 5);
  }, [mentionQuery, groupMembers, me?.id]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (file.size > MAX_FILE_BYTES) { alert(`Max 200 MB. File is ${fmtSize(file.size)}.`); e.target.value = ""; return; }
    setPendingFile(file); setPendingPreview(file.type.startsWith("image/") ? URL.createObjectURL(file) : null); e.target.value = "";
  };
  const clearPending = () => { if (pendingPreview) URL.revokeObjectURL(pendingPreview); setPendingFile(null); setPendingPreview(null); };

  const sendFile = async () => {
    if (!pendingFile || !activeConvId || uploading) return;
    const file = pendingFile; const type: MsgType = file.type.startsWith("image/") ? "image" : "file";
    clearPending(); setUploading(true); setUploadProgress(0);
    const opt: Message = { id: `opt-${Date.now()}`, senderId: meRef.current?.id ?? "", senderName: meRef.current?.name ?? "You", text: "", type, fileName: file.name, fileSize: file.size, fileMimeType: file.type, createdAt: new Date().toISOString(), isOwn: true, status: "sending" };
    setMessages(p => [...p, opt]); setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 30);
    const fd = new FormData(); fd.append("file", file); fd.append("type", type);
    try {
      await API.post(`/chat/conversations/${activeConvId}/messages`, fd, { headers: { "Content-Type": "multipart/form-data" }, onUploadProgress: (ev: { loaded: number; total?: number }) => { if (ev.total) setUploadProgress(Math.round((ev.loaded / ev.total) * 100)); } });
      setMessages(p => p.map(m => m.id === opt.id ? { ...m, status: "sent" } : m));
    } catch { setMessages(p => p.filter(m => m.id !== opt.id)); }
    finally { setUploading(false); setUploadProgress(0); }
  };

  const startRec = async () => {
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices) { alert("Not supported."); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream; isCancelRef.current = false; recConvRef.current = activeConvId;
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/ogg";
      const rec = new MediaRecorder(stream, { mimeType: mime }); chunksRef.current = [];
      rec.ondataavailable = (e: BlobEvent) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        if (isCancelRef.current) { chunksRef.current = []; return; }
        const blob = new Blob(chunksRef.current, { type: mime }); if (blob.size === 0) return;
        await sendVoice(blob, mime);
      };
      rec.start(100); mediaRecorderRef.current = rec; setIsRecording(true); setRecTime(0);
      recTimerRef.current = setInterval(() => setRecTime(t => t + 1), 1000);
    } catch { alert("Microphone access denied."); }
  };
  const stopRec = () => { if (recTimerRef.current) clearInterval(recTimerRef.current); isCancelRef.current = false; mediaRecorderRef.current?.stop(); setIsRecording(false); setRecTime(0); };
  const cancelRec = () => { if (recTimerRef.current) clearInterval(recTimerRef.current); isCancelRef.current = true; mediaRecorderRef.current?.stop(); streamRef.current?.getTracks().forEach(t => t.stop()); setIsRecording(false); setRecTime(0); };
  const sendVoice = async (blob: Blob, mime: string) => {
    const cid = recConvRef.current ?? activeConvId; if (!cid) return;
    const opt: Message = { id: `opt-${Date.now()}`, senderId: meRef.current?.id ?? "", senderName: meRef.current?.name ?? "You", text: "", type: "voice", fileName: "Voice message", fileSize: blob.size, fileMimeType: mime, createdAt: new Date().toISOString(), isOwn: true, status: "sending" };
    setMessages(p => [...p, opt]); setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 30);
    const fd = new FormData(); fd.append("file", blob, "voice.webm"); fd.append("type", "voice");
    try {
      await API.post(`/chat/conversations/${cid}/messages`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      setMessages(p => p.map(m => m.id === opt.id ? { ...m, status: "sent" } : m));
    } catch { setMessages(p => p.filter(m => m.id !== opt.id)); }
  };

  const parseUsers = (data: unknown): ChatUser[] => {
    const raw = Array.isArray(data) ? data : ((data as Record<string, unknown>)?.users ?? data ?? []) as unknown[];
    return (raw as Record<string, unknown>[]).map(u => ({ id: String(u.id), name: String(u.name ?? "Unknown"), email: u.email ? String(u.email) : undefined, csrCode: u.csrCode ? String(u.csrCode) : null, role: u.role ? String(u.role) : undefined, isOnline: Boolean(u.isOnline) }));
  };
  const fetchUsers = async () => {
    if (allUsers.length > 0) return;
    try {
      const r = await API.get("/chat/users");
      const users = parseUsers(r.data.users ?? r.data);
      setAllUsers(users.filter(u => u.id !== meRef.current?.id));
    } catch {
      try {
        const r = await API.get("/users");
        setAllUsers(parseUsers(r.data).filter(u => u.id !== meRef.current?.id));
      } catch { setAllUsers([]); }
    }
  };
  useEffect(() => {
    if (allUsers.length === 0) return;
    const t = setInterval(async () => {
      try { const r = await API.get("/users"); const fresh = parseUsers(r.data); setAllUsers(prev => prev.map(u => { const up = fresh.find(f => f.id === u.id); return up ? { ...u, isOnline: up.isOnline } : u; })); } catch {}
    }, 10000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allUsers.length === 0 ? 0 : 1]);

  const createGroup = async () => {
    if (!groupName.trim() || creatingGroup) return; setCreatingGroup(true);
    try {
      const r = await API.post("/chat/conversations", { type: "group", name: groupName.trim(), memberIds: selectedUsers });
      const conv: Conversation = r.data.conversation ?? { id: r.data.id ?? `grp-${Date.now()}`, type: "group", name: groupName.trim(), unreadCount: 0, memberCount: selectedUsers.length + 1 };
      setConversations(p => [conv, ...p]); setActiveConvId(conv.id);
      setShowGroupModal(false); setGroupName(""); setSelectedUsers([]); setUserSearch(""); setMobileSideOpen(false);
    } catch {}
    setCreatingGroup(false);
  };

  const startDm = async (user: ChatUser) => {
    if (dmLoadingRef.current) return; dmLoadingRef.current = user.id;
    setShowDmModal(false); setDmSearch(""); setMobileSideOpen(false);
    const existing = conversations.find(c => c.type === "direct" && c.otherUserId === user.id);
    if (existing) { setActiveConvId(existing.id); dmLoadingRef.current = null; return; }
    const tempId = `temp-${user.id}`;
    const placeholder: Conversation = { id: tempId, type: "direct", name: user.name, unreadCount: 0, isOnline: user.isOnline, otherUserId: user.id };
    setConversations(p => [placeholder, ...p]); setActiveConvId(tempId);
    try {
      const r = await API.post("/chat/conversations", { type: "direct", userId: user.id }); const cid = r.data.id ?? r.data.conversation?.id; if (!cid) return;
      setConversations(p => { const merged = p.map(c => c.id === tempId ? { ...c, id: cid } : c); const seen = new Set<string>(); return merged.filter(c => { if (seen.has(c.id)) return false; seen.add(c.id); return true; }); });
      setActiveConvId(cid);
    } catch { setConversations(p => p.filter(c => c.id !== tempId)); setActiveConvId(null); }
    finally { dmLoadingRef.current = null; }
  };

  const deleteConversations = async (ids: string[]) => {
    setConversations(p => p.filter(c => !ids.includes(c.id)));
    if (ids.includes(activeConvId ?? "")) setActiveConvId(null);
    setSelectedConvs([]); setSelectMode(false);
    await Promise.all(ids.map(id => API.delete(`/chat/conversations/${id}`).catch(() => {})));
  };
  const deleteMsg = async (msgId: string, forEveryone: boolean) => {
    setMessages(p => p.filter(m => m.id !== msgId)); setCtxMenu(null);
    if (forEveryone) await API.delete(`/chat/messages/${msgId}`).catch(() => {});
  };
  const handleCtxMenu = (e: React.MouseEvent, msg: Message) => {
    e.preventDefault();
    const x = Math.min(e.clientX, window.innerWidth - 200); const y = Math.min(e.clientY, window.innerHeight - 200);
    setCtxMenu({ x, y, msg });
  };
  const handleReply = (msg: Message) => { setReplyTo(msg); setCtxMenu(null); setTimeout(() => inputRef.current?.focus(), 50); };
  const copyText = async (text: string) => { await navigator.clipboard.writeText(text).catch(() => {}); setCtxMenu(null); };
  const jumpToReply = (id: string) => {
    const el = document.getElementById(`msg-${id}`); if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" }); el.classList.add("bg-yellow-50"); setTimeout(() => el.classList.remove("bg-yellow-50"), 1200);
  };
  const togglePin = (convId: string) => setPinnedIds(prev => { const next = new Set(prev); if (next.has(convId)) next.delete(convId); else next.add(convId); return next; });

  /* ΓöÇΓöÇΓöÇ Derived ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */
  const activeConv = useMemo(() => conversations.find(c => c.id === activeConvId) ?? null, [conversations, activeConvId]);
  const filteredConvs = useMemo(() => { const q = convSearch.toLowerCase(); return !q ? conversations : conversations.filter(c => c.name.toLowerCase().includes(q)); }, [conversations, convSearch]);
  const filteredUsers = useMemo(() => { const q = (showGroupModal ? userSearch : dmSearch).toLowerCase(); return !q ? allUsers : allUsers.filter(u => u.name.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || (u.csrCode ?? "").toLowerCase().includes(q)); }, [allUsers, userSearch, dmSearch, showGroupModal]);
  const visibleMessages = useMemo(() => { if (!msgSearchText.trim()) return messages; const q = msgSearchText.toLowerCase(); return messages.filter(m => m.text.toLowerCase().includes(q) || m.fileName?.toLowerCase().includes(q)); }, [messages, msgSearchText]);
  const msgGroups = useMemo(() => { const groups: { date: string; msgs: Message[] }[] = []; visibleMessages.forEach(msg => { const date = fmtDateSep(msg.createdAt); const last = groups[groups.length - 1]; if (!last || last.date !== date) groups.push({ date, msgs: [msg] }); else last.msgs.push(msg); }); return groups; }, [visibleMessages]);
  const totalUnread = useMemo(() => conversations.reduce((s, c) => s + c.unreadCount, 0), [conversations]);
  const sortedConvs = useMemo(() => [...(showArchived ? archivedConvs : filteredConvs)].sort((a, b) => { const ap = pinnedIds.has(a.id) ? 1 : 0; const bp = pinnedIds.has(b.id) ? 1 : 0; return ap !== bp ? bp - ap : 0; }), [filteredConvs, archivedConvs, showArchived, pinnedIds]);
  const directConvs = useMemo(() => sortedConvs.filter(c => c.type === "direct").sort((a, b) => { if (pinnedIds.has(a.id) !== pinnedIds.has(b.id)) return pinnedIds.has(a.id) ? -1 : 1; if (a.isOnline && !b.isOnline) return -1; if (!a.isOnline && b.isOnline) return 1; return 0; }), [sortedConvs, pinnedIds]);
  const groupConvs   = useMemo(() => sortedConvs.filter(c => c.type === "group"), [sortedConvs]);
  const onlineDirects = useMemo(() => conversations.filter(c => c.type === "direct" && c.isOnline), [conversations]);

  /* ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ RENDER ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ */
  return (
    <div className="fixed inset-0 top-[64px] z-[45] pointer-events-none">
      {/* Light backdrop ΓÇö only blocks clicks behind panel area */}
      <div
        className="absolute inset-0 bg-black/20 pointer-events-auto sm:left-auto sm:w-[720px] sm:max-w-full sm:right-0"
        onClick={onClose}
        aria-hidden
      />

      {/* Panel */}
      <div className="absolute top-0 right-0 bottom-0 z-[46] flex bg-white shadow-2xl border-l border-gray-200 w-full sm:w-[720px] max-w-full pointer-events-auto overflow-hidden">

        {/* ── CONVERSATIONS SIDEBAR ── */}
        <aside className={`${mobileSideOpen ? "flex" : "hidden"} sm:flex w-full sm:w-[280px] shrink-0 flex-col bg-white border-r border-gray-100 sm:relative min-h-0 overflow-hidden`}>
          <div className="px-3 py-3 border-b border-gray-100 shrink-0 overflow-hidden">
            {selectMode ? (
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <button onClick={() => { setSelectMode(false); setSelectedConvs([]); }} className="w-7 h-7 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"><X size={13} /></button>
                  <span className="text-sm font-bold text-[#0F172A]">{selectedConvs.length} selected</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setSelectedConvs(conversations.map(c => c.id))} className="text-[11px] font-semibold text-[#B8112D] hover:underline px-1">All</button>
                  {selectedConvs.length > 0 && (
                    <button onClick={() => void deleteConversations(selectedConvs)} className="flex items-center gap-1 h-7 px-2.5 rounded-xl bg-[#B8112D] text-white text-[11px] font-bold hover:bg-[#a30f27] transition-colors"><Trash2 size={11} />Del</button>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <h2 className="text-[15px] font-bold text-[#0F172A] truncate">Messages</h2>
                    {totalUnread > 0 && <span className="bg-[#B8112D] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center shrink-0">{totalUnread}</span>}
                  </div>
                  <button onClick={onClose} className="sm:hidden w-7 h-7 rounded-xl bg-gray-100 text-gray-500 hover:bg-gray-200 flex items-center justify-center transition-colors shrink-0" title="Close"><X size={13} /></button>
                </div>
                <div className="flex items-center gap-1 flex-wrap mb-2.5">
                  <button onClick={() => void askNotif()} title={notifGranted ? "Notifications on" : "Enable notifications"} className={`w-7 h-7 rounded-xl flex items-center justify-center transition-colors shrink-0 ${notifGranted ? "bg-green-50 text-green-600" : "bg-amber-50 text-amber-500 hover:bg-amber-100"}`}>
                    {notifGranted ? <Bell size={13} /> : <BellOff size={13} />}
                  </button>
                  <button type="button" onClick={() => setSoundOn(v => !v)} title={soundOn ? "Sound on" : "Sound off"} className={`w-7 h-7 rounded-xl flex items-center justify-center transition-colors shrink-0 ${soundOn ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-400"}`}>
                    {soundOn ? <Volume2 size={13} /> : <VolumeX size={13} />}
                  </button>
                  <button type="button" onClick={() => setShowArchived(v => !v)} title={showArchived ? "Show active" : "Show archived"} className={`w-7 h-7 rounded-xl flex items-center justify-center transition-colors shrink-0 ${showArchived ? "bg-[#B8112D] text-white" : "bg-[#F3F4F6] text-gray-500 hover:bg-gray-200"}`}>
                    {showArchived ? <ArchiveRestore size={13} /> : <Archive size={13} />}
                  </button>
                  <button onClick={() => setSelectMode(true)} title="Select" className="w-7 h-7 rounded-xl bg-[#F3F4F6] text-gray-500 hover:bg-gray-200 flex items-center justify-center transition-colors shrink-0"><CheckSquare size={13} /></button>
                  <button onClick={() => { setShowDmModal(true); void fetchUsers(); }} className="w-7 h-7 rounded-xl bg-[#F3F4F6] text-gray-500 hover:bg-[#FFF1F3] hover:text-[#B8112D] flex items-center justify-center transition-colors shrink-0" title="New DM"><User2 size={13} /></button>
                  <button onClick={() => { setShowGroupModal(true); void fetchUsers(); }} className="w-7 h-7 rounded-xl bg-[#B8112D] text-white hover:bg-[#a30f27] flex items-center justify-center transition-colors shrink-0" title="New Group"><Plus size={13} /></button>
                </div>
              </>
            )}
            <div className="relative">
              <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="SearchΓÇª" value={convSearch} onChange={e => setConvSearch(e.target.value)} className="w-full h-8 rounded-xl bg-[#F3F4F6] pl-7 pr-3 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-[#B8112D]/20 transition-all" />
            </div>
          </div>

          {!selectMode && onlineDirects.length > 0 && (
            <div className="px-3 pt-2.5 pb-2.5 border-b border-gray-100 shrink-0">
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block animate-pulse" />Online ┬╖ {onlineDirects.length}</p>
              <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
                {onlineDirects.map(c => (
                  <button key={c.id} onClick={() => { setActiveConvId(c.id); setMobileSideOpen(false); }} className="flex flex-col items-center gap-1 shrink-0 group" title={c.name}>
                    <Avatar name={c.name} size="sm" online />
                    <span className="text-[9px] text-gray-500 font-medium max-w-[36px] truncate">{c.name.split(" ")[0]}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto py-1.5 px-1">
            {loadingConvs ? (
              <div className="space-y-0.5">{[1,2,3,4].map(i => (<div key={i} className="flex items-center gap-3 px-3 py-2.5 animate-pulse"><div className="w-8 h-8 rounded-full bg-gray-100 shrink-0" /><div className="flex-1 space-y-1.5"><div className="h-2.5 bg-gray-100 rounded w-20" /><div className="h-2 bg-gray-100 rounded w-28" /></div></div>))}</div>
            ) : conversations.length === 0 && !showArchived ? (
              <div className="py-14 text-center px-3"><MessageSquare size={28} className="text-gray-200 mx-auto mb-2" /><p className="text-sm font-semibold text-gray-500">No conversations</p><p className="text-xs text-gray-400 mt-0.5">Start a DM or create a group</p></div>
            ) : (
              <>
                {directConvs.length > 0 && (<><p className="px-3 pt-1.5 pb-1 text-[9px] font-bold text-gray-400 uppercase tracking-wider">Direct Messages</p>{directConvs.map(conv => (<ConvItem key={conv.id} conv={conv} active={activeConvId === conv.id} selectMode={selectMode} selected={selectedConvs.includes(conv.id)} pinned={pinnedIds.has(conv.id)} onSelect={() => setSelectedConvs(p => p.includes(conv.id) ? p.filter(id => id !== conv.id) : [...p, conv.id])} onPin={() => togglePin(conv.id)} onClick={() => { setActiveConvId(conv.id); setMobileSideOpen(false); }} />))}</>)}
                {groupConvs.length > 0 && (<><p className="px-3 pt-2.5 pb-1 text-[9px] font-bold text-gray-400 uppercase tracking-wider">Groups</p>{groupConvs.map(conv => (<ConvItem key={conv.id} conv={conv} active={activeConvId === conv.id} selectMode={selectMode} selected={selectedConvs.includes(conv.id)} pinned={pinnedIds.has(conv.id)} onSelect={() => setSelectedConvs(p => p.includes(conv.id) ? p.filter(id => id !== conv.id) : [...p, conv.id])} onPin={() => togglePin(conv.id)} onClick={() => { setActiveConvId(conv.id); setMobileSideOpen(false); }} />))}</>)}
                {filteredConvs.length === 0 && convSearch && (<p className="py-8 text-center text-xs text-gray-400">No results for &ldquo;{convSearch}&rdquo;</p>)}
              </>
            )}
          </div>

          {me && (
            <div className="px-3 py-2.5 border-t border-gray-100 shrink-0 flex items-center gap-2">
              <Avatar name={me.name} size="sm" online />
              <div className="flex-1 min-w-0"><p className="text-xs font-semibold text-[#0F172A] truncate">{me.name}</p><p className="text-[10px] text-gray-400">{me.csrCode ?? me.role ?? "Online"}</p></div>
              <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
            </div>
          )}
        </aside>

        {/* ΓöÇΓöÇ CHAT AREA ΓöÇΓöÇ */}
        <section className={`${!mobileSideOpen ? "flex" : "hidden"} sm:flex flex-1 flex-col min-w-0 min-h-0 overflow-hidden`}>
          {activeConv ? (
            <>
              <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-gray-100 bg-white shrink-0 shadow-sm">
                <button onClick={() => setMobileSideOpen(true)} className="sm:hidden w-7 h-7 rounded-xl bg-gray-100 flex items-center justify-center shrink-0"><ChevronLeft size={14} /></button>
                {activeConv.type === "group" ? <div className="w-8 h-8 rounded-full bg-[#B8112D]/10 text-[#B8112D] flex items-center justify-center shrink-0"><Hash size={15} /></div> : <Avatar name={activeConv.name} size="sm" online={activeConv.isOnline} />}
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-[#0F172A] truncate">{activeConv.name}</h3>
                  {typingName ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#B8112D]"><span className="flex gap-0.5">{[0,1,2].map(i => <span key={i} className="w-1 h-1 rounded-full bg-[#B8112D] animate-bounce" style={{ animationDelay: `${i*150}ms` }} />)}</span>{typingName} is typingΓÇª</span>
                  ) : activeConv.type === "group" ? <p className="text-[10px] text-gray-400">{activeConv.memberCount ?? "ΓÇö"} members</p>
                    : activeConv.isOnline ? <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-600"><span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block animate-pulse" />Active now</span>
                    : <p className="text-[10px] text-gray-400">Offline</p>}
                </div>
                <button onClick={() => { setMsgSearchOpen(v => !v); if (msgSearchOpen) setMsgSearchText(""); }} className={`w-7 h-7 rounded-xl flex items-center justify-center transition-colors ${msgSearchOpen ? "bg-[#B8112D] text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}><Search size={13} /></button>
                <button type="button" onClick={() => void archiveConversation(!showArchived)} title={showArchived ? "Unarchive" : "Archive chat"} className="w-7 h-7 rounded-xl bg-gray-100 text-gray-400 hover:bg-amber-50 hover:text-amber-600 flex items-center justify-center transition-colors">{showArchived ? <ArchiveRestore size={13} /> : <Archive size={13} />}</button>
                <button onClick={() => void deleteConversations([activeConv.id])} className="w-7 h-7 rounded-xl bg-gray-100 text-gray-400 hover:bg-red-50 hover:text-[#B8112D] flex items-center justify-center transition-colors"><Trash2 size={13} /></button>
                <button onClick={onClose} className="hidden sm:flex w-7 h-7 rounded-xl bg-gray-100 text-gray-500 hover:bg-gray-200 items-center justify-center transition-colors"><X size={13} /></button>
              </div>

              {pinnedMessage && (
                <div className="px-3 py-2 bg-amber-50 border-b border-amber-100 shrink-0 flex items-center gap-2">
                  <Pin size={12} className="text-amber-600 shrink-0" />
                  <button type="button" onClick={() => jumpToReply(pinnedMessage.id)} className="flex-1 min-w-0 text-left">
                    <p className="text-[10px] font-bold text-amber-700">Pinned</p>
                    <p className="text-[11px] text-gray-600 truncate">{pinnedMessage.type !== "text" ? `≡ƒôÄ ${pinnedMessage.type}` : pinnedMessage.text}</p>
                  </button>
                  <button type="button" onClick={() => void pinMessage(null)} className="text-gray-400 hover:text-gray-600"><X size={12} /></button>
                </div>
              )}

              {msgSearchOpen && (
                <div className="px-3 py-2 border-b border-gray-100 bg-white shrink-0">
                  <div className="relative">
                    <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input autoFocus type="text" placeholder="Search messagesΓÇª" value={msgSearchText} onChange={e => setMsgSearchText(e.target.value)} className="w-full h-8 rounded-xl bg-[#F3F4F6] pl-7 pr-7 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-[#B8112D]/20 transition-all" />
                    {msgSearchText && <button onClick={() => setMsgSearchText("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={11} /></button>}
                  </div>
                  {msgSearchText && <p className="text-[10px] text-gray-400 mt-1 ml-1">{visibleMessages.length} result{visibleMessages.length !== 1 ? "s" : ""}</p>}
                </div>
              )}

              <div ref={msgsContainerRef} className="flex-1 overflow-y-auto px-3 py-3 bg-[#F5F6FA]">
                {loadingMsgs ? (
                  <div className="flex items-center justify-center h-full"><Loader2 size={20} className="text-gray-300 animate-spin" /></div>
                ) : visibleMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <div className="w-12 h-12 rounded-2xl bg-white border border-gray-100 shadow-sm flex items-center justify-center mb-2.5"><MessageSquare size={20} className="text-gray-300" /></div>
                    <p className="text-sm font-semibold text-gray-500">{msgSearchText ? "No matches" : "No messages yet"}</p>
                    {!msgSearchText && <p className="text-xs text-gray-400 mt-0.5">Say hello ≡ƒæï</p>}
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {msgGroups.map(group => (
                      <div key={group.date}>
                        <div className="flex items-center gap-2 my-3"><div className="flex-1 h-px bg-gray-200" /><span className="text-[9px] font-semibold text-gray-400 whitespace-nowrap px-2 bg-[#F5F6FA]">{group.date}</span><div className="flex-1 h-px bg-gray-200" /></div>
                        <div className="space-y-0.5">{group.msgs.map((msg, idx) => { const prev = group.msgs[idx - 1]; const showAvatar = !prev || prev.senderId !== msg.senderId; return <MessageBubble key={msg.id} msg={msg} isGroup={activeConv.type === "group"} showAvatar={showAvatar} myId={me?.id} onCtxMenu={handleCtxMenu} onReply={handleReply} onJumpToReply={jumpToReply} onReact={toggleReaction} />; })}</div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {uploading && (<div className="px-3 pt-2 shrink-0 bg-white"><div className="flex items-center gap-2"><div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden"><div className="h-full bg-[#B8112D] rounded-full transition-all duration-200" style={{ width: `${uploadProgress}%` }} /></div><span className="text-[10px] font-bold text-[#B8112D] shrink-0">{uploadProgress}%</span></div></div>)}
              {pendingFile && (
                <div className="px-3 pb-2 pt-2 shrink-0 bg-white">
                  <div className="flex items-center gap-2.5 bg-[#F5F6FA] rounded-2xl border border-gray-100 px-3 py-2">
                    {pendingPreview ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={pendingPreview} alt="" className="w-10 h-10 rounded-xl object-cover shrink-0" /> : <div className="w-10 h-10 rounded-xl bg-[#B8112D]/10 text-[#B8112D] flex items-center justify-center shrink-0">{mimeIcon(pendingFile.type)}</div>}
                    <div className="flex-1 min-w-0"><p className="text-xs font-semibold text-[#0F172A] truncate">{pendingFile.name}</p><p className="text-[10px] text-gray-400">{fmtSize(pendingFile.size)}</p></div>
                    <button onClick={clearPending} className="w-6 h-6 rounded-full bg-gray-200 hover:bg-red-100 hover:text-red-500 flex items-center justify-center shrink-0 transition-colors"><X size={10} /></button>
                  </div>
                </div>
              )}
              {replyTo && (
                <div className="px-3 pt-2 shrink-0 bg-white">
                  <div className="flex items-center gap-2 bg-[#FFF1F3] border border-[#B8112D]/20 rounded-xl px-3 py-1.5">
                    <Reply size={12} className="text-[#B8112D] shrink-0" />
                    <div className="flex-1 min-w-0"><p className="text-[10px] font-bold text-[#B8112D]">{replyTo.senderName}</p><p className="text-[11px] text-gray-500 truncate">{replyTo.type !== "text" ? `≡ƒôÄ ${replyTo.type}` : truncate(replyTo.text, 50)}</p></div>
                    <button onClick={() => setReplyTo(null)} className="w-5 h-5 rounded-full hover:bg-[#B8112D]/10 flex items-center justify-center shrink-0 text-gray-400"><X size={10} /></button>
                  </div>
                </div>
              )}

              {editingMsg ? (
                <div className="px-3 py-2.5 bg-white border-t border-gray-100 shrink-0">
                  <p className="text-[10px] font-bold text-[#B8112D] mb-1">Edit message</p>
                  <div className="flex items-end gap-1.5">
                    <textarea value={editText} onChange={e => setEditText(e.target.value)} rows={2} className="flex-1 bg-[#F3F4F6] rounded-xl px-3 py-2 text-sm outline-none resize-none" />
                    <button type="button" onClick={() => { setEditingMsg(null); setEditText(""); }} className="h-8 px-3 rounded-xl bg-gray-100 text-xs font-semibold">Cancel</button>
                    <button type="button" onClick={() => void saveEdit()} className="h-8 px-3 rounded-xl bg-[#B8112D] text-white text-xs font-semibold">Save</button>
                  </div>
                </div>
              ) : (
              <div className="px-3 py-2.5 bg-white border-t border-gray-100 shrink-0 relative">
                <input ref={fileInputRef} type="file" className="hidden" accept="*/*" onChange={onFileChange} />
                {isRecording ? (
                  <div className="flex items-center gap-2.5 bg-[#FFF1F3] rounded-2xl px-3 py-2.5 border border-[#B8112D]/20">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                    <div className="flex items-end gap-0.5 flex-1 h-5">{[4,7,3,9,5,8,2,6,4,7].map((h,i) => <div key={i} className="w-0.5 bg-[#B8112D] rounded-full animate-pulse" style={{ height:`${h*10}%`, animationDelay:`${i*55}ms` }} />)}</div>
                    <span className="text-sm font-bold text-[#B8112D] tabular-nums shrink-0">{fmtAudio(recTime)}</span>
                    <button onClick={cancelRec} className="w-7 h-7 rounded-xl bg-white text-gray-500 hover:bg-gray-100 flex items-center justify-center shrink-0"><X size={13} /></button>
                    <button onClick={stopRec} className="w-7 h-7 rounded-xl bg-[#B8112D] text-white flex items-center justify-center shrink-0 shadow-sm"><StopCircle size={13} /></button>
                  </div>
                ) : (
                  <div className="flex items-end gap-1.5">
                    <button onClick={() => fileInputRef.current?.click()} className="w-8 h-8 rounded-xl bg-[#F3F4F6] text-gray-500 hover:bg-[#FFF1F3] hover:text-[#B8112D] flex items-center justify-center shrink-0 transition-colors mb-0.5" title="Attach file"><Paperclip size={14} /></button>
                    <div className="flex-1 flex items-end bg-[#F3F4F6] rounded-2xl px-3 py-2">
                      <textarea ref={inputRef} value={msgText} onChange={onMsgTextChange} onKeyDown={onKey} placeholder={pendingFile ? "Press send to uploadΓÇª" : activeConv.type === "group" ? `Message #${activeConv.name}ΓÇª (@ to mention)` : `Message ${activeConv.name}ΓÇª`} rows={1} disabled={!!pendingFile} className="flex-1 bg-transparent text-sm outline-none resize-none leading-relaxed placeholder:text-gray-400 max-h-24 disabled:opacity-40" />
                    </div>
                    <button onClick={() => void startRec()} disabled={!!pendingFile || sendingMsg} className="w-8 h-8 rounded-xl bg-[#F3F4F6] text-gray-500 hover:bg-[#FFF1F3] hover:text-[#B8112D] flex items-center justify-center shrink-0 transition-colors mb-0.5 disabled:opacity-40" title="Voice message"><Mic size={14} /></button>
                    <button onClick={pendingFile ? () => void sendFile() : () => void sendText()} disabled={(!msgText.trim() && !pendingFile) || sendingMsg || uploading} className="w-8 h-8 rounded-xl bg-[#B8112D] text-white flex items-center justify-center hover:bg-[#a30f27] disabled:bg-gray-200 disabled:text-gray-400 transition-colors shrink-0 mb-0.5 shadow-sm shadow-red-200">
                      {sendingMsg || uploading ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                    </button>
                  </div>
                )}
                {mentionSuggestions.length > 0 && (
                  <div className="absolute bottom-full left-10 mb-1 w-48 bg-white rounded-xl border border-gray-100 shadow-lg py-1 z-10">
                    {mentionSuggestions.map(m => (
                      <button key={m.id} type="button" onClick={() => insertMention(m.name)} className="w-full text-left px-3 py-1.5 text-xs hover:bg-[#F5F6FA] truncate">{m.name} <span className="text-gray-400">{m.role}</span></button>
                    ))}
                  </div>
                )}
              </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-[#F5F6FA]">
              <button onClick={onClose} className="absolute top-3 right-3 sm:flex hidden w-7 h-7 rounded-xl bg-gray-100 text-gray-500 hover:bg-gray-200 items-center justify-center"><X size={13} /></button>
              <div className="w-16 h-16 rounded-3xl bg-white border border-gray-100 shadow-sm flex items-center justify-center mb-3"><MessageSquare size={28} className="text-gray-200" /></div>
              <h3 className="text-base font-bold text-[#0F172A]">Your Messages</h3>
              <p className="text-xs text-gray-400 mt-1 max-w-[220px]">Select a conversation or start a new one.</p>
              <div className="flex flex-wrap gap-2 mt-4 justify-center">
                <button onClick={() => { setShowDmModal(true); void fetchUsers(); }} className="h-8 px-3 rounded-xl bg-white border border-gray-200 text-xs font-semibold text-gray-600 hover:border-[#B8112D] hover:text-[#B8112D] flex items-center gap-1.5 shadow-sm transition-all"><User2 size={12} />New DM</button>
                <button onClick={() => { setShowGroupModal(true); void fetchUsers(); }} className="h-8 px-3 rounded-xl bg-[#B8112D] text-white text-xs font-semibold flex items-center gap-1.5 hover:bg-[#a30f27] shadow-sm shadow-red-200 transition-colors"><Hash size={12} />Create Group</button>
              </div>
              <button onClick={() => setMobileSideOpen(true)} className="sm:hidden mt-3 text-xs text-[#B8112D] font-semibold underline">ΓåÉ Back</button>
            </div>
          )}
        </section>
      </div>

      {/* ΓöÇΓöÇ CONTEXT MENU ΓöÇΓöÇ */}
      {ctxMenu && (
        <>
          <div className="fixed inset-0 top-[64px] z-[60] pointer-events-auto" onClick={() => setCtxMenu(null)} onContextMenu={e => { e.preventDefault(); setCtxMenu(null); }} />
          <div className="fixed z-[61] bg-white rounded-2xl shadow-xl border border-gray-100 py-1.5 min-w-[170px] overflow-hidden pointer-events-auto" style={{ top: ctxMenu.y, left: ctxMenu.x }} onClick={e => e.stopPropagation()}>
            <button onClick={() => handleReply(ctxMenu.msg)} className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-[#0F172A] hover:bg-[#F5F6FA] transition-colors"><Reply size={13} className="text-gray-400" />Reply</button>
            {ctxMenu.msg.type === "text" && <button onClick={() => void copyText(ctxMenu.msg.text)} className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-[#0F172A] hover:bg-[#F5F6FA] transition-colors"><Copy size={13} className="text-gray-400" />Copy text</button>}
            {canEdit(ctxMenu.msg) && (
              <button onClick={() => { setEditingMsg(ctxMenu.msg); setEditText(ctxMenu.msg.text); setCtxMenu(null); }} className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-[#0F172A] hover:bg-[#F5F6FA] transition-colors"><Pencil size={13} className="text-gray-400" />Edit</button>
            )}
            <button onClick={() => void pinMessage(ctxMenu.msg)} className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-[#0F172A] hover:bg-[#F5F6FA] transition-colors"><Pin size={13} className="text-gray-400" />Pin message</button>
            <div className="border-t border-gray-100 my-1 px-1"><ReactionPicker onPick={emoji => void toggleReaction(ctxMenu.msg, emoji)} /></div>
            <div className="border-t border-gray-100 my-1" />
            <button onClick={() => void deleteMsg(ctxMenu.msg.id, false)} className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"><Trash2 size={13} />Delete for me</button>
            {ctxMenu.msg.isOwn && me?.role === "admin" && (
              <button onClick={() => void deleteMsg(ctxMenu.msg.id, true)} className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-600 font-semibold hover:bg-red-50 transition-colors"><Trash2 size={13} />Delete for everyone</button>
            )}
          </div>
        </>
      )}

      {/* ΓöÇΓöÇ GROUP MODAL ΓöÇΓöÇ */}
      {showGroupModal && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-[440px] bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden" style={{ maxHeight: "85vh" }}>
            <div className="px-4 pt-4 pb-3 border-b border-gray-100 shrink-0 flex items-center justify-between">
              <div className="flex items-center gap-2.5"><div className="w-8 h-8 rounded-xl bg-[#B8112D] text-white flex items-center justify-center"><Hash size={14} /></div><div><h2 className="text-sm font-bold text-[#0F172A]">Create Group</h2><p className="text-[10px] text-gray-400">Name and invite members</p></div></div>
              <button onClick={() => { setShowGroupModal(false); setGroupName(""); setSelectedUsers([]); setUserSearch(""); }} className="w-7 h-7 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"><X size={13} /></button>
            </div>
            <div className="px-4 pt-3 pb-2 shrink-0 space-y-2.5 border-b border-gray-100">
              <input type="text" placeholder="Group nameΓÇª" value={groupName} onChange={e => setGroupName(e.target.value)} className="w-full h-9 rounded-xl border-2 border-gray-200 bg-[#FAFAFA] px-3 text-sm outline-none focus:border-[#B8112D] focus:bg-white transition-colors" />
              <div className="relative"><Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input type="text" placeholder="Search usersΓÇª" value={userSearch} onChange={e => setUserSearch(e.target.value)} className="w-full h-8 rounded-xl bg-[#F3F4F6] pl-7 pr-3 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-[#B8112D]/20 transition-all" /></div>
              {selectedUsers.length > 0 && <p className="text-[10px] text-gray-400">{selectedUsers.length} member{selectedUsers.length !== 1 ? "s" : ""} selected</p>}
            </div>
            <div className="flex-1 overflow-y-auto px-2 py-1.5 space-y-0.5">
              {filteredUsers.map(u => {
                const sel = selectedUsers.includes(u.id);
                return (
                  <button key={u.id} onClick={() => setSelectedUsers(p => sel ? p.filter(id => id !== u.id) : [...p, u.id])} className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all ${sel ? "bg-[#FFF1F3]" : "hover:bg-[#F9FAFB]"}`}>
                    <Avatar name={u.name} size="sm" online={u.isOnline} />
                    <div className="flex-1 min-w-0 text-left"><p className="text-xs font-semibold text-[#0F172A] truncate">{u.name}</p><p className="text-[10px] text-gray-400 capitalize">{u.csrCode ?? u.role ?? u.email}</p></div>
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${sel ? "bg-[#B8112D] border-[#B8112D]" : "border-gray-300"}`}>{sel && <Check size={8} className="text-white" />}</div>
                  </button>
                );
              })}
            </div>
            <div className="px-4 py-3 border-t border-gray-100 shrink-0 flex gap-2">
              <button onClick={() => { setShowGroupModal(false); setGroupName(""); setSelectedUsers([]); setUserSearch(""); }} className="flex-1 h-9 rounded-xl bg-[#F5F6FA] text-gray-600 font-semibold text-sm hover:bg-gray-100 transition-colors">Cancel</button>
              <button onClick={() => void createGroup()} disabled={!groupName.trim() || creatingGroup} className={`flex-1 h-9 rounded-xl font-semibold text-sm flex items-center justify-center gap-1.5 transition-all ${groupName.trim() && !creatingGroup ? "bg-[#B8112D] text-white hover:bg-[#a30f27] shadow-sm" : "bg-gray-100 text-gray-400 cursor-not-allowed"}`}>
                {creatingGroup ? <><Loader2 size={13} className="animate-spin" />CreatingΓÇª</> : <><Plus size={13} />Create</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ΓöÇΓöÇ DM MODAL ΓöÇΓöÇ */}
      {showDmModal && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-[400px] bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden" style={{ maxHeight: "80vh" }}>
            <div className="px-4 pt-4 pb-3 border-b border-gray-100 shrink-0 flex items-center justify-between">
              <div className="flex items-center gap-2.5"><div className="w-8 h-8 rounded-xl bg-[#B8112D]/10 text-[#B8112D] flex items-center justify-center"><User2 size={14} /></div><div><h2 className="text-sm font-bold text-[#0F172A]">New Direct Message</h2><p className="text-[10px] text-gray-400">Choose a team member</p></div></div>
              <button onClick={() => { setShowDmModal(false); setDmSearch(""); }} className="w-7 h-7 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"><X size={13} /></button>
            </div>
            <div className="px-3 py-2.5 border-b border-gray-100 shrink-0">
              <div className="relative"><Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input type="text" placeholder="Search usersΓÇª" value={dmSearch} onChange={e => setDmSearch(e.target.value)} autoFocus className="w-full h-8 rounded-xl bg-[#F3F4F6] pl-7 pr-3 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-[#B8112D]/20 transition-all" /></div>
            </div>
            <div className="flex-1 overflow-y-auto px-2 py-1.5 space-y-0.5">
              {filteredUsers.length === 0 ? (
                <div className="py-10 text-center"><User2 size={26} className="text-gray-200 mx-auto mb-2" /><p className="text-sm text-gray-400">{dmSearch ? "No users found" : "No team members"}</p></div>
              ) : filteredUsers.map(u => (
                /* eslint-disable-next-line react-hooks/refs */
                <button key={u.id} onClick={() => void startDm(u)} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-[#F9FAFB] transition-all group">
                  <Avatar name={u.name} size="sm" online={u.isOnline} />
                  <div className="flex-1 min-w-0 text-left"><p className="text-xs font-semibold text-[#0F172A] truncate group-hover:text-[#B8112D] transition-colors">{u.name}</p><p className="text-[10px] text-gray-400">{u.csrCode ?? u.role ?? u.email}</p></div>
                  {u.isOnline && <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
