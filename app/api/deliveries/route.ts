import { desc } from "drizzle-orm";
import { getDb } from "../../../db";
import { deliveries } from "../../../db/schema";

export async function GET() {
  try {
    const rows = await getDb().select().from(deliveries).orderBy(desc(deliveries.id)).limit(20);
    return Response.json({ deliveries: rows });
  } catch {
    return Response.json({ deliveries: [], error: "Delivery storage is temporarily unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { title?: string; objective?: string };
    const title = payload.title?.trim() ?? "";
    const objective = payload.objective?.trim() ?? "";
    if (!title || !objective) return Response.json({ error: "title and objective are required" }, { status: 400 });
    const [delivery] = await getDb().insert(deliveries).values({ code: "DT-0001", title, objective }).returning();
    return Response.json({ delivery }, { status: 201 });
  } catch {
    return Response.json({ error: "The delivery could not be saved." }, { status: 503 });
  }
}
