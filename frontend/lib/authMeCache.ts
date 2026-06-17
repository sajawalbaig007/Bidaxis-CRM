import API from "./api";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  csrCode?: string | null;
  cnic?: string | null;
  profilePic?: string | null;
  twoFAEnabled?: boolean;
  createdAt?: string;
};

let cached: { user: AuthUser; at: number } | null = null;
let inflight: Promise<AuthUser | null> | null = null;
const TTL_MS = 60_000;

export function invalidateAuthMeCache() {
  cached = null;
}

export async function getAuthMe(force = false): Promise<AuthUser | null> {
  if (!force && cached && Date.now() - cached.at < TTL_MS) {
    return cached.user;
  }
  if (inflight) return inflight;

  inflight = API.get("/auth/me")
    .then(res => {
      const user: AuthUser | null = res.data?.user ?? null;
      if (user) cached = { user, at: Date.now() };
      return user;
    })
    .catch(() => null)
    .finally(() => { inflight = null; });

  return inflight;
}
