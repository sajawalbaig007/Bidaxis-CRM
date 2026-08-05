import prisma from "../config/db";

export type ChatAccessProfile = {
  chatEnabled: boolean;
  chatAllowedUserIds: string[];
  chatVisibleToUserIds: string[];
};

export async function getChatAccess(userId: string): Promise<ChatAccessProfile | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { chatEnabled: true, chatAllowedUserIds: true, chatVisibleToUserIds: true },
  });
  if (!user) return null;
  return {
    chatEnabled: user.chatEnabled !== false,
    chatAllowedUserIds: Array.isArray(user.chatAllowedUserIds) ? user.chatAllowedUserIds : [],
    chatVisibleToUserIds: Array.isArray(user.chatVisibleToUserIds) ? user.chatVisibleToUserIds : [],
  };
}

/** True when this user may use chat at all. */
export function isChatEnabled(access: ChatAccessProfile | null | undefined): boolean {
  return !!access && access.chatEnabled !== false;
}

/**
 * Can `me` start/message `target`?
 * - chat must be enabled for me
 * - empty allowlist = unrestricted
 * - otherwise target must be in allowlist
 */
export function canMessageUser(
  access: ChatAccessProfile | null | undefined,
  targetUserId: string,
): boolean {
  if (!isChatEnabled(access)) return false;
  const list = access!.chatAllowedUserIds;
  if (!list.length) return true;
  return list.includes(targetUserId);
}

/** Whether `viewerUserId` is allowed to discover/message this target account. */
export function isVisibleToUser(
  targetAccess: ChatAccessProfile | null | undefined,
  viewerUserId: string,
): boolean {
  if (!isChatEnabled(targetAccess)) return false;
  const list = targetAccess!.chatVisibleToUserIds;
  return !list.length || list.includes(viewerUserId);
}

export async function assertSenderCanChat(userId: string): Promise<
  { ok: true; access: ChatAccessProfile } | { ok: false; status: number; message: string }
> {
  const access = await getChatAccess(userId);
  if (!access) return { ok: false, status: 401, message: "Unauthorized" };
  if (!isChatEnabled(access)) {
    return { ok: false, status: 403, message: "Chat is disabled for your account. Contact admin." };
  }
  return { ok: true, access };
}

export async function assertCanMessageTarget(
  meId: string,
  targetId: string,
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const gate = await assertSenderCanChat(meId);
  if (!gate.ok) return gate;
  if (!canMessageUser(gate.access, targetId)) {
    return { ok: false, status: 403, message: "You are not allowed to message this user." };
  }
  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: {
      chatEnabled: true,
      chatAllowedUserIds: true,
      chatVisibleToUserIds: true,
      isActive: true,
    },
  });
  if (!target?.isActive) {
    return { ok: false, status: 404, message: "User not found." };
  }
  if (target.chatEnabled === false) {
    return { ok: false, status: 403, message: "This user cannot receive messages." };
  }
  if (!isVisibleToUser(target, meId)) {
    return { ok: false, status: 403, message: "This user is hidden from your messages." };
  }
  return { ok: true };
}
