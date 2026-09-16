import { beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({
  getDb: vi.fn(() => {
    throw new Error("The legacy D1 adapter must not be used.");
  }),
  getSupabaseAdmin: vi.fn(),
}));

vi.mock("../../../db", () => database);

import { GET, POST } from "./route";

describe("deliveries API", () => {
  beforeEach(() => {
    database.getDb.mockClear();
    database.getSupabaseAdmin.mockReset();
  });

  it("lists the 20 most recent deliveries through Supabase", async () => {
    const rows = [
      {
        id: 2,
        code: "DT-0002",
        title: "Second delivery",
        objective: "Validate the Supabase migration",
        status: "discovery",
        created_at: "2026-09-16T13:00:00.000Z",
      },
    ];
    const limit = vi.fn().mockResolvedValue({ data: rows, error: null });
    const order = vi.fn(() => ({ limit }));
    const select = vi.fn(() => ({ order }));
    const from = vi.fn(() => ({ select }));
    const schema = vi.fn(() => ({ from }));
    database.getSupabaseAdmin.mockReturnValue({ schema });

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ deliveries: rows });
    expect(schema).toHaveBeenCalledWith("agentic_delivery");
    expect(from).toHaveBeenCalledWith("deliveries");
    expect(select).toHaveBeenCalledWith("*");
    expect(order).toHaveBeenCalledWith("id", { ascending: false });
    expect(limit).toHaveBeenCalledWith(20);
    expect(database.getDb).not.toHaveBeenCalled();
  });

  it("creates a delivery through Supabase", async () => {
    const created = {
      id: 1,
      code: "DT-0001",
      title: "Ipiranga Engineering Data",
      objective: "Map impacted consumers without production changes",
      status: "discovery",
      created_at: "2026-09-16T13:00:00.000Z",
    };
    const single = vi.fn().mockResolvedValue({ data: created, error: null });
    const returning = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select: returning }));
    const from = vi.fn(() => ({ insert }));
    const schema = vi.fn(() => ({ from }));
    database.getSupabaseAdmin.mockReturnValue({ schema });

    const response = await POST(
      new Request("https://example.test/api/deliveries", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: " Ipiranga Engineering Data ",
          objective: " Map impacted consumers without production changes ",
        }),
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ delivery: created });
    expect(schema).toHaveBeenCalledWith("agentic_delivery");
    expect(from).toHaveBeenCalledWith("deliveries");
    expect(insert).toHaveBeenCalledWith({
      code: "DT-0001",
      title: "Ipiranga Engineering Data",
      objective: "Map impacted consumers without production changes",
    });
    expect(returning).toHaveBeenCalledWith("*");
    expect(single).toHaveBeenCalledOnce();
    expect(database.getDb).not.toHaveBeenCalled();
  });
});
