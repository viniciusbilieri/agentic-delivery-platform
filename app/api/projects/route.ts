import { actor, api, body, check, database, json, mutationOrigin, projectInput } from "@/lib/server/control-plane";
export const dynamic = "force-dynamic";
export async function GET() {
  return api(async () => {
    const user = await actor();
    const { data, error } = await database().rpc("list_projects", { p_actor: user.userId });
    check(error);
    return json({ projects: data ?? [] });
  });
}
export async function POST(request: Request) {
  return api(async () => {
    const user = await actor();
    mutationOrigin(request);
    const input = await body(request, projectInput);
    const { data, error } = await database().rpc("create_project", { p_actor: user.userId, p_name: input.name, p_description: input.description });
    check(error);
    return json({ project: data }, 201);
  });
}
