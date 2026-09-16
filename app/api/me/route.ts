import { actor, api, json } from "@/lib/server/control-plane";
export const dynamic = "force-dynamic";
export async function GET() { return api(async () => json({ user: await actor() })); }
