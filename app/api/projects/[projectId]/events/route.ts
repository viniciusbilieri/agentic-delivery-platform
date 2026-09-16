import { actor, api, check, database, json, membership, type ProjectRoute } from "@/lib/server/control-plane";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: ProjectRoute) {
  return api(async () => {
    const user = await actor();
    const { projectId } = await context.params;
    await membership(projectId, user.userId);
    const { data, error } = await database().from("project_events").select("*").eq("project_id", projectId).order("id", { ascending: false }).limit(100);
    check(error);
    return json({ events: data ?? [] });
  });
}
