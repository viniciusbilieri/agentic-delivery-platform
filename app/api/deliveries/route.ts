import { actor, api, body, check, database, deliveryInput, json, membership, mutationOrigin, projectIdSchema } from "@/lib/server/control-plane";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return api(async () => {
    const user = await actor();
    const projectId = projectIdSchema.parse(new URL(request.url).searchParams.get("project_id"));
    await membership(projectId, user.userId);
    const { data, error } = await database().from("deliveries").select("*").eq("project_id", projectId).order("id", { ascending: false }).limit(50);
    check(error);
    return json({ deliveries: data ?? [] });
  });
}
export async function POST(request: Request) {
  return api(async () => {
    const user = await actor();
    mutationOrigin(request);
    const input = await body(request, deliveryInput);
    await membership(input.project_id, user.userId, true);
    // The RPC rechecks membership and atomically creates delivery/run/step/event.
    const { data, error } = await database().rpc("create_project_delivery", { p_actor: user.userId, p_project: input.project_id, p_title: input.title, p_objective: input.objective, p_request: input.request_id });
    check(error);
    return json(data, 201);
  });
}
