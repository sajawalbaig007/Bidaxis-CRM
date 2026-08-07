import API from "@/lib/api";

type FetchAdminProjectsParams = {
  csrId?: string;
  from?: string;
  to?: string;
  search?: string;
  /** Exclude projects soft-removed from Technical portal */
  technicalView?: boolean;
};

/** Same project set for Admin Project DB and Technical Active Projects. */
export async function fetchAllAdminProjects<T = Record<string, unknown>>(
  params: FetchAdminProjectsParams = {},
): Promise<{ leads: T[]; total: number }> {
  const query: Record<string, string> = {
    lite: "1",
    page: "1",
    limit: "500",
  };
  if (params.csrId) query.csrId = params.csrId;
  if (params.from) query.from = params.from;
  if (params.to) query.to = params.to;
  if (params.search?.trim()) query.search = params.search.trim();
  if (params.technicalView) query.technicalView = "1";

  const res = await API.get("/admin/projects", { params: query });
  const leads = (res.data.leads ?? []) as T[];
  const total = Number(res.data.total ?? res.data.stats?.total ?? leads.length);
  return { leads, total };
}
