import { getSupabaseAdmin } from "../../../db";

export async function GET() {
  try {
    const { data, error } = await getSupabaseAdmin()
      .schema("agentic_delivery")
      .from("deliveries")
      .select("*")
      .order("id", { ascending: false })
      .limit(20);
    if (error) throw error;
    return Response.json({ deliveries: data });
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
    const { data, error } = await getSupabaseAdmin()
      .schema("agentic_delivery")
      .from("deliveries")
      .insert({ code: "DT-0001", title, objective })
      .select("*")
      .single();
    if (error) throw error;
    return Response.json({ delivery: data }, { status: 201 });
  } catch {
    return Response.json({ error: "The delivery could not be saved." }, { status: 503 });
  }
}
