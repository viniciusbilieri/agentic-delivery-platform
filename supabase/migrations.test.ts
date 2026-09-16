import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
let db: PGlite;
let project: string;
let other: string;
let delivery: { delivery: { id: number }; run: { id: string } };
const requestId = "22222222-2222-4222-8222-222222222222";
async function scalar<T>(sql: string, params: unknown[] = []) {
  const result = await db.query<{ value: T }>(sql, params);
  return result.rows[0]?.value;
}
async function create(actor = "alice", p = project, key = requestId, title = "Task") {
  return scalar<typeof delivery>("select agentic_delivery.create_project_delivery($1,$2,$3,'Objective',$4) as value", [actor, p, title, key]);
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
  await db.exec(readFileSync(new URL("./migrations/20260916133554_create_deliveries.sql", import.meta.url), "utf8"));
  await db.exec("insert into agentic_delivery.deliveries(code,title,objective) values('legacy','Old delivery','Keep me');");
  await db.exec(readFileSync(new URL("./migrations/20260916220000_project_foundation.sql", import.meta.url), "utf8"));
  await db.exec("set role service_role;");
  project = (await scalar<{ id: string }>("select agentic_delivery.create_project('alice','Private Ipiranga','') as value")).id;
  other = (await scalar<{ id: string }>("select agentic_delivery.create_project('bob','Demo','') as value")).id;
}, 30000);
afterAll(async () => { await db?.close(); });
describe("PostgreSQL foundation migration", () => {
  it("preserves legacy rows without assigning them to a stranger", async () => {
    expect(await scalar("select title as value from agentic_delivery.deliveries where code='legacy' and project_id is null")).toBe("Old delivery");
  });
  it("isolates projects and restricts browser roles from tables and actor-bound functions", async () => {
    const rows = await db.query<{ id: string }>("select id from agentic_delivery.list_projects('bob')");
    expect(rows.rows.map(r => r.id)).toEqual([other]);
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`reset role; set role ${role};`);
      await expect(db.query("select * from agentic_delivery.projects")).rejects.toMatchObject({ code: "42501" });
      await expect(db.query("select agentic_delivery.list_projects('alice')")).rejects.toMatchObject({ code: "42501" });
    }
    await db.exec("reset role; set role service_role;");
  });
  it("creates one delivery, run, step and event across duplicate submissions", async () => {
    delivery = await create();
    const again = await create();
    expect(again).toEqual(delivery);
    expect(await scalar("select count(*)::int as value from agentic_delivery.runs where project_id=$1", [project])).toBe(1);
    expect(await scalar("select count(*)::int as value from agentic_delivery.run_steps where project_id=$1", [project])).toBe(1);
    expect(await scalar("select count(*)::int as value from agentic_delivery.project_events where project_id=$1 and kind='delivery.created'", [project])).toBe(1);
    await expect(create("alice", project, requestId, "Changed")).rejects.toMatchObject({ code: "23505" });
  });
  it("does not grant tester access to another project and enforces read-only/revocation", async () => {
    await expect(create("bob")).rejects.toMatchObject({ code: "42501" });
    await db.query("select agentic_delivery.set_project_member('alice',$1,'henrique','viewer')", [project]);
    await expect(create("henrique")).rejects.toMatchObject({ code: "42501" });
    await expect(db.query("select agentic_delivery.set_project_member('henrique',$1,'intruder','admin')", [project])).rejects.toMatchObject({ code: "42501" });
    await db.query("select agentic_delivery.set_project_member('alice',$1,'henrique','tester')", [project]);
    await create("henrique", project, "33333333-3333-4333-8333-333333333333");
    await expect(create("henrique", other)).rejects.toMatchObject({ code: "42501" });
    await db.query("select agentic_delivery.set_project_member('alice',$1,'henrique',null)", [project]);
    await expect(create("henrique")).rejects.toMatchObject({ code: "42501" });
    await expect(db.query("select agentic_delivery.set_project_member('alice',$1,'alice','viewer')", [project])).rejects.toMatchObject({ code: "22023" });
  });
  it("rolls back the complete delivery if event persistence fails", async () => {
    const key = "44444444-4444-4444-8444-444444444444";
    await db.exec("reset role; revoke insert on agentic_delivery.project_events from service_role; set role service_role;");
    await expect(create("alice", project, key)).rejects.toMatchObject({ code: "42501" });
    expect(await scalar("select count(*)::int as value from agentic_delivery.deliveries where request_id=$1", [key])).toBe(0);
    await db.exec("reset role; grant insert on agentic_delivery.project_events to service_role; set role service_role;");
  });
  it("blocks cross-project run links and mutation of the audit trail", async () => {
    await expect(db.query("insert into agentic_delivery.runs(project_id,delivery_id,created_by) values($1,$2,'alice')", [other, delivery.delivery.id])).rejects.toBeDefined();
    await expect(db.query("insert into agentic_delivery.run_steps(project_id,run_id,position,name) values($1,$2,1,'wrong')", [other, delivery.run.id])).rejects.toMatchObject({ code: "23503" });
    await expect(db.query("delete from agentic_delivery.project_events")).rejects.toMatchObject({ code: "42501" });
  });
  it("enforces quota transition ordering and terminal states in the database", async () => {
    const id = delivery.run.id;
    await expect(db.query("update agentic_delivery.runs set status='completed' where id=$1", [id])).rejects.toMatchObject({ code: "22023" });
    for (const state of ["leased", "running", "waiting_for_quota", "retry_scheduled", "leased", "running", "completed"]) await db.query("update agentic_delivery.runs set status=$1 where id=$2", [state, id]);
    await expect(db.query("update agentic_delivery.runs set status='running' where id=$1", [id])).rejects.toMatchObject({ code: "22023" });
    await expect(db.query("update agentic_delivery.run_steps set status='invented' where run_id=$1", [id])).rejects.toBeDefined();
  });
});
