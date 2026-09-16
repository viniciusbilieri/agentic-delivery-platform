import { actor, api, ApiError, body, check, database, json, memberInput, membership, mutationOrigin, type ProjectRoute } from "@/lib/server/control-plane";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: ProjectRoute) {
  return api(async () => {
    const user = await actor();
    const { projectId } = await context.params;
    const { project, role } = await membership(projectId, user.userId);
    if (role !== "owner") throw new ApiError(403, "Somente o proprietário gerencia acessos.");
    const { data, error } = await database().from("project_members").select("user_id,role").eq("project_id", projectId);
    check(error);
    return json({ members: [{ user_id: project.owner_user_id, role: "owner" }, ...(data ?? [])] });
  });
}
export async function POST(request: Request, context: ProjectRoute) {
  return api(async () => {
    const user = await actor();
    mutationOrigin(request);
    const { projectId } = await context.params;
    const { role } = await membership(projectId, user.userId);
    if (role !== "owner") throw new ApiError(403, "Somente o proprietário gerencia acessos.");
    const input = await body(request, memberInput);
    const { error } = await database().rpc("set_project_member", { p_actor: user.userId, p_project: projectId, p_user: input.user_id, p_role: input.role });
    check(error);
    return json({ ok: true });
  });
}
export async function DELETE(request: Request, context: ProjectRoute) {
  return api(async () => {
    const user = await actor();
    mutationOrigin(request);
    const { projectId } = await context.params;
    const { role } = await membership(projectId, user.userId);
    if (role !== "owner") throw new ApiError(403, "Somente o proprietário gerencia acessos.");
    const input = await body(request, memberInput.pick({ user_id: true }));
    const { error } = await database().rpc("set_project_member", { p_actor: user.userId, p_project: projectId, p_user: input.user_id, p_role: null });
    check(error);
    return json({ ok: true });
  });
}
