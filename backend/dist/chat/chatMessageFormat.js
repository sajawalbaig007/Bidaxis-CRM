"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EDIT_WINDOW_MS = void 0;
exports.parseReactions = parseReactions;
exports.msgStatus = msgStatus;
exports.formatMessage = formatMessage;
exports.messagePreviewText = messagePreviewText;
exports.EDIT_WINDOW_MS = 10 * 60 * 1000;
function parseReactions(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
        return {};
    return raw;
}
function msgStatus(senderId, userId, createdAt, members) {
    const others = members.filter(m => m.userId !== userId);
    if (senderId === userId) {
        const readBy = others
            .filter(m => m.lastReadAt && m.lastReadAt >= createdAt)
            .map(m => m.user.name);
        const allRead = others.length > 0 && readBy.length === others.length;
        return { status: allRead ? "read" : "delivered", readBy };
    }
    const me = members.find(m => m.userId === userId);
    const read = me?.lastReadAt && me.lastReadAt >= createdAt;
    return { status: read ? "read" : "delivered", readBy: [] };
}
function formatMessage(m, userId, members) {
    const { status, readBy } = msgStatus(m.senderId, userId, m.createdAt, members);
    return {
        id: m.id,
        senderId: m.senderId,
        senderName: m.sender.name,
        text: m.text,
        type: m.type,
        fileUrl: m.fileUrl,
        fileName: m.fileName,
        fileSize: m.fileSize,
        fileMimeType: m.fileMimeType,
        createdAt: m.createdAt,
        editedAt: m.editedAt,
        mentions: m.mentions ?? [],
        reactions: parseReactions(m.reactions),
        readBy,
        isOwn: m.senderId === userId,
        status,
        replyTo: m.replyTo ? {
            id: m.replyTo.id,
            text: m.replyTo.text,
            senderName: m.replyTo.sender.name,
            type: m.replyTo.type,
        } : null,
    };
}
function messagePreviewText(type, text) {
    return type !== "text" ? `Sent a ${type}` : text;
}
