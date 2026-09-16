import { actor, api, check, database, json, membership, type ProjectRoute } from "@/lib/server/control-plane";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: ProjectRoute) {
  return api(async () => {
    const user = await actor();
    const { projectId } = await context.params;
    await membership(projectId, user.userId);
    const { data, error } = await database().from("runs").select("*,run_steps(*)").eq("project_id", projectId).order("created_at", { ascending: false }).limit(50);
    check(error);
    return json({ runs: data ?? [] });
  });
}
