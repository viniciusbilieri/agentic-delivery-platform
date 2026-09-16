import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), admin: vi.fn() }));
vi.mock("@/app/chatgpt-auth", () => ({ getChatGPTUser: mocks.auth }));
vi.mock("@/db", () => ({ getSupabaseAdmin: mocks.admin }));
import { GET, POST } from "./route";
import { GET as projects, POST as createProject } from "../projects/route";
import { GET as events } from "../projects/[projectId]/events/route";
import { GET as runs } from "../projects/[projectId]/runs/route";
import { POST as setMember, DELETE as removeMember } from "../projects/[projectId]/members/route";
const id = "11111111-1111-4111-8111-111111111111";
const requestId = "22222222-2222-4222-8222-222222222222";
const context = { params: Promise.resolve({ projectId: id }) };
const input = { project_id: id, title: " Test ", objective: " Do work ", request_id: requestId };
const request = (value: unknown = input, headers = {}) => new Request("https://example.test/api/deliveries", { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(value) });
function dbFixture(role: string | null = "owner") {
  const rpc = vi.fn().mockResolvedValue({ data: { delivery: { id: 1 }, run: { status: "queued" } }, error: null });
  const tables: Record<string, ReturnType<typeof query>> = {};
  function query(table: string) {
    const result = { data: table === "projects" ? { id, owner_user_id: role === "owner" ? "alice" : "bob" } : table === "project_members" ? role ? { role } : null : [], error: null };
    const chain = { select: vi.fn(), eq: vi.fn(), order: vi.fn(), limit: vi.fn().mockResolvedValue(result), maybeSingle: vi.fn().mockResolvedValue(result) };
    chain.select.mockReturnValue(chain); chain.eq.mockReturnValue(chain); chain.order.mockReturnValue(chain);
    return chain;
  }
  const from = vi.fn((table: string) => tables[table] ??= query(table));
  mocks.admin.mockReturnValue({ schema: vi.fn(() => ({ from, rpc })) });
  return { tables, rpc, from };
}
beforeEach(() => { vi.clearAllMocks(); mocks.auth.mockResolvedValue({ userId: "alice", email: "a@example.test" }); });
describe("authenticated project APIs", () => {
  it("rejects anonymous requests before touching storage", async () => {
    mocks.auth.mockResolvedValue(null);
    for (const response of await Promise.all([GET(new Request(`https://example.test/api/deliveries?project_id=${id}`)), POST(request()), projects(), events(request(), context), runs(request(), context), setMember(request(), context), removeMember(request(), context)])) expect(response.status).toBe(401);
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("does not expose another user's deliveries, events or runs", async () => {
    const db = dbFixture(null);
    for (const response of await Promise.all([GET(new Request(`https://example.test/api/deliveries?project_id=${id}`)), events(request(), context), runs(request(), context), POST(request())])) expect(response.status).toBe(404);
    expect(db.from.mock.calls.map(call => call[0])).not.toContain("deliveries");
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it("allows a viewer to read but not create or grant access", async () => {
    const db = dbFixture("viewer");
    expect((await GET(new Request(`https://example.test/api/deliveries?project_id=${id}`))).status).toBe(200);
    expect(db.tables.deliveries.eq).toHaveBeenCalledWith("project_id", id);
    expect((await POST(request())).status).toBe(403);
    expect((await setMember(request({ user_id: "charlie", role: "admin" }), context)).status).toBe(403);
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it("uses authenticated actor and an atomic RPC for a tester's delivery", async () => {
    const db = dbFixture("tester");
    const response = await POST(request());
    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(db.rpc).toHaveBeenCalledWith("create_project_delivery", { p_actor: "alice", p_project: id, p_title: "Test", p_objective: "Do work", p_request: requestId });
  });
  it("rejects spoofed actor fields, invalid identifiers and invalid JSON", async () => {
    dbFixture();
    expect((await POST(request({ ...input, p_actor: "bob" }))).status).toBe(400);
    expect((await GET(new Request("https://example.test/api/deliveries"))).status).toBe(400);
    expect((await POST(new Request("https://example.test/api/deliveries", { method: "POST", body: "{" }))).status).toBe(400);
    expect((await POST(request({ ...input, objective: "a".repeat(100001) }))).status).toBe(413);
  });
  it("rejects cross-origin mutations", async () => {
    dbFixture();
    expect((await POST(request(input, { origin: "https://evil.test" }))).status).toBe(403);
    expect((await createProject(request({ name: "P" }, { "sec-fetch-site": "cross-site" }))).status).toBe(403);
  });
  it("binds the project list to the current user", async () => {
    const db = dbFixture();
    expect((await projects()).status).toBe(200);
    expect(db.rpc).toHaveBeenCalledWith("list_projects", { p_actor: "alice" });
  });
  it("only the owner can change membership", async () => {
    const db = dbFixture("admin");
    expect((await setMember(request({ user_id: "charlie", role: "member" }), context)).status).toBe(403);
    expect((await removeMember(request({ user_id: "charlie" }), context)).status).toBe(403);
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it("rechecks denied membership in the transaction and does not leak database errors", async () => {
    const db = dbFixture();
    db.rpc.mockResolvedValueOnce({ data: null, error: { code: "42501" } });
    expect((await POST(request())).status).toBe(403);
    db.rpc.mockResolvedValueOnce({ data: null, error: { code: "SECRET DATABASE DETAILS" } });
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("SECRET");
  });
});
