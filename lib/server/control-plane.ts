import { z } from "zod";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getSupabaseAdmin } from "@/db";

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export const projectIdSchema = z.string().uuid();
export const projectInput = z.object({ name: z.string().trim().min(1).max(120), description: z.string().trim().max(4000).default("") }).strict();
export const deliveryInput = z.object({ project_id: projectIdSchema, title: z.string().trim().min(1).max(200), objective: z.string().trim().min(1).max(20000), request_id: z.string().uuid() }).strict();
export const memberInput = z.object({ user_id: z.string().trim().min(1).max(256), role: z.enum(["admin", "member", "tester", "viewer"]) }).strict();
export async function actor() {
  const user = await getChatGPTUser();
  if (!user) throw new ApiError(401, "Entre com sua conta para continuar.");
  return user;
}
export function database() { return getSupabaseAdmin().schema("agentic_delivery"); }
export function check(error: { code?: string } | null) {
  if (!error) return;
  if (error.code === "42501") throw new ApiError(403, "Acesso não permitido.");
  if (error.code === "22023") throw new ApiError(400, "Dados inválidos.");
  if (error.code === "23505") throw new ApiError(409, "Conflito com um registro existente.");
  throw new ApiError(503, "Armazenamento indisponível. Verifique a configuração e as migrations.");
}
export async function membership(projectId: string, userId: string, write = false) {
  projectIdSchema.parse(projectId);
  const db = database();
  const { data: project, error } = await db.from("projects").select("*").eq("id", projectId).maybeSingle();
  check(error);
  if (!project) throw new ApiError(404, "Projeto não encontrado.");
  let role = "owner";
  if (project.owner_user_id !== userId) {
    const result = await db.from("project_members").select("role").eq("project_id", projectId).eq("user_id", userId).maybeSingle();
    check(result.error);
    if (!result.data) throw new ApiError(404, "Projeto não encontrado.");
    role = result.data.role;
  }
  if (write && role === "viewer") throw new ApiError(403, "Seu acesso permite apenas leitura.");
  return { project, role };
}
export async function body<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "JSON obrigatório.");
  let size = 0;
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 100_000) { await reader.cancel(); throw new ApiError(413, "Solicitação muito grande."); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return schema.parse(JSON.parse(new TextDecoder().decode(bytes))); }
  catch { throw new ApiError(400, "Dados inválidos. Confira os campos obrigatórios."); }
}
export function mutationOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (request.headers.get("sec-fetch-site") === "cross-site" || (origin && origin !== new URL(request.url).origin)) throw new ApiError(403, "Origem não permitida.");
}
export function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { "Cache-Control": "private, no-store" } });
}
export async function api(action: () => Promise<Response>) {
  try { return await action(); }
  catch (error) {
    if (error instanceof ApiError) return json({ error: error.message }, error.status);
    if (error instanceof z.ZodError) return json({ error: "Identificador inválido." }, 400);
    return json({ error: "Serviço indisponível. Tente novamente." }, 503);
  }
}
export type ProjectRoute = { params: Promise<{ projectId: string }> };
