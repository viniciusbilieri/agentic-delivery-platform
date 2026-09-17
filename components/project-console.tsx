"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { FolderKanban, Plus, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

type Project = { id: string; name: string; description: string; role: string };
type Delivery = { id: number; title: string; objective: string };
type Run = { id: string; delivery_id: number; status: string; run_steps: { id: string; name: string; status: string }[] };
type ProjectEvent = { id: number; kind: string; created_at: string };
type Member = { user_id: string; role: string };
type Snapshot = { projectId: string; deliveries: Delivery[]; runs: Run[]; events: ProjectEvent[]; members: Member[] };
const eventNames: Record<string, string> = { "project.created": "Projeto criado", "delivery.created": "Demanda registrada", "member.updated": "Acesso atualizado", "member.removed": "Acesso removido" };
const statusNames: Record<string, string> = { queued: "Na fila · aguardando executor", leased: "Reservada", running: "Em execução", waiting_for_quota: "Aguardando limite de uso", waiting_for_input: "Aguardando informação", waiting_for_approval: "Aguardando aprovação", retry_scheduled: "Retomada agendada", completed: "Concluída", failed: "Falhou", cancelled: "Cancelada" };
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...init?.headers }, cache: "no-store" });
  const value = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(value.error || "Não foi possível concluir a operação.");
  return value;
}
export function ProjectConsole({ user }: { user: { userId: string; displayName: string } }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [title, setTitle] = useState("");
  const [objective, setObjective] = useState("");
  const [memberId, setMemberId] = useState("");
  const [memberRole, setMemberRole] = useState("tester");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const inFlight = useRef(false);
  const pendingDelivery = useRef<{ fingerprint: string; id: string } | null>(null);
  const selected = projects.find(project => project.id === selectedId);
  // A late response for another project must never render under this heading.
  const visible = snapshot?.projectId === selectedId ? snapshot : null;
  const loadProjects = useCallback(async () => {
    const value = await request<{ projects: Project[] }>("/api/projects");
    setProjects(value.projects);
    setSelectedId(current => value.projects.some(p => p.id === current) ? current : value.projects[0]?.id ?? "");
  }, []);
  const loadProject = useCallback(async (id: string, role: string) => {
    const [deliveries, runs, events, members] = await Promise.all([
      request<{ deliveries: Delivery[] }>(`/api/deliveries?project_id=${id}`),
      request<{ runs: Run[] }>(`/api/projects/${id}/runs`),
      request<{ events: ProjectEvent[] }>(`/api/projects/${id}/events`),
      role === "owner" ? request<{ members: Member[] }>(`/api/projects/${id}/members`) : Promise.resolve({ members: [] }),
    ]);
    return { projectId: id, ...deliveries, ...runs, ...events, ...members };
  }, []);
  useEffect(() => {
    let active = true;
    request<{ projects: Project[] }>("/api/projects").then(value => {
      if (!active) return;
      setProjects(value.projects);
      setSelectedId(value.projects[0]?.id ?? "");
    }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!selected) return;
    let active = true;
    loadProject(selected.id, selected.role).then(value => { if (active) setSnapshot(value); }).catch(e => { if (active) { setSnapshot(null); setError(e.message); } });
    return () => { active = false; };
  }, [selected, loadProject]);
  async function action(work: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError("");
    try { await work(); } catch (e) { setError(e instanceof Error ? e.message : "Operação indisponível."); }
    finally { inFlight.current = false; setBusy(false); }
  }
  function createProject(event: FormEvent) {
    event.preventDefault();
    void action(async () => {
      const { project } = await request<{ project: Project }>("/api/projects", { method: "POST", body: JSON.stringify({ name, description }) });
      setProjects(current => [project, ...current]); setSelectedId(project.id); setName(""); setDescription("");
    });
  }
  function createDelivery(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    void action(async () => {
      const fingerprint = JSON.stringify([selected.id, title, objective]);
      if (pendingDelivery.current?.fingerprint !== fingerprint) pendingDelivery.current = { fingerprint, id: crypto.randomUUID() };
      await request("/api/deliveries", { method: "POST", body: JSON.stringify({ project_id: selected.id, title, objective, request_id: pendingDelivery.current.id }) });
      pendingDelivery.current = null; setTitle(""); setObjective("");
      setSnapshot(await loadProject(selected.id, selected.role));
    });
  }
  function updateMember(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    void action(async () => {
      await request(`/api/projects/${selected.id}/members`, { method: "POST", body: JSON.stringify({ user_id: memberId, role: memberRole }) });
      setMemberId(""); setSnapshot(await loadProject(selected.id, selected.role));
    });
  }
  const control = "border-white/15 bg-black/20 text-white";
  return <main className="min-h-screen bg-[#07100d] text-[#eef5f0]">
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 p-5 sm:px-8"><div className="flex items-center gap-3"><FolderKanban className="text-[#b7f34a]" /><h1 className="text-xl font-semibold">TeamClaw</h1><span className="text-sm text-[#a9b8b0]">Projetos</span></div><div className="flex flex-wrap gap-4 text-sm"><span>{user.displayName}</span><a href="/demo" className="underline">Demonstração</a><a href="/signout-with-chatgpt?return_to=/" target="_top" className="underline">Sair</a></div></header>
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-8">
      {error && <div role="alert" className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">{error}<Button variant="outline" className="ml-3" disabled={busy} onClick={() => void action(async () => { await loadProjects(); if (selected) setSnapshot(await loadProject(selected.id, selected.role)); })}>Tentar novamente</Button></div>}
      <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="space-y-6"><section className="panel p-5"><h2 className="mb-4 text-lg font-semibold">Seus projetos</h2>{loading ? <p role="status">Carregando…</p> : projects.length === 0 && <p className="text-sm text-[#a9b8b0]">Nenhum projeto disponível. Crie um projeto ou peça acesso ao proprietário.</p>}<nav className="space-y-2">{projects.map(project => <button disabled={busy} key={project.id} onClick={() => { setSelectedId(project.id); setError(""); setTitle(""); setObjective(""); }} aria-current={selectedId === project.id ? "page" : undefined} className={`w-full break-words rounded-lg border p-3 text-left ${selectedId === project.id ? "border-[#b7f34a]/60 bg-[#b7f34a]/10" : "border-white/10"}`}><span className="block font-medium">{project.name}</span><span className="text-sm text-[#a9b8b0]">{project.role}</span></button>)}</nav></section>
          <form onSubmit={createProject} className="panel space-y-3 p-5"><h2 className="text-lg font-semibold">Novo projeto</h2><label className="block text-sm" htmlFor="project-name">Nome</label><Input id="project-name" required maxLength={120} value={name} onChange={e => setName(e.target.value)} className={control} /><label className="block text-sm" htmlFor="project-description">Descrição</label><Textarea id="project-description" maxLength={4000} value={description} onChange={e => setDescription(e.target.value)} className={control} /><Button disabled={busy || !name.trim()} className="bg-[#b7f34a] text-[#07100d] hover:bg-[#c8ff62]"><Plus />Criar projeto</Button></form>
          <details className="panel p-5 text-sm"><summary className="cursor-pointer">Meu identificador de acesso</summary><p className="mt-3 text-[#a9b8b0]">Envie este identificador ao proprietário para receber acesso a um projeto.</p><code className="mt-2 block break-all select-all">{user.userId}</code></details>
        </aside>
        <section className="min-w-0 space-y-6">{selected ? <>
          <div className="flex items-start justify-between gap-4"><div><h2 className="break-words text-2xl font-semibold">{selected.name}</h2><p className="mt-2 whitespace-pre-wrap break-words text-[#a9b8b0]">{selected.description}</p></div><Button aria-label="Atualizar projeto" disabled={busy} variant="outline" onClick={() => void action(async () => setSnapshot(await loadProject(selected.id, selected.role)))}><RefreshCw /></Button></div>
          <p className="rounded-lg border border-white/10 p-4 text-sm text-[#bdcbc3]">As demandas ficam salvas na fila. A conexão com executores locais será habilitada na próxima etapa; nenhuma IA ou comando é executado nesta versão.</p>
          {selected.role !== "viewer" && <form onSubmit={createDelivery} className="panel space-y-3 p-5"><h3 className="text-lg font-semibold">Registrar demanda</h3><label className="block text-sm" htmlFor="delivery-title">Título</label><Input id="delivery-title" required maxLength={200} value={title} onChange={e => setTitle(e.target.value)} className={control} /><label className="block text-sm" htmlFor="delivery-objective">Objetivo e critérios de aceite</label><Textarea id="delivery-objective" required maxLength={20000} value={objective} onChange={e => setObjective(e.target.value)} className={`min-h-28 ${control}`} /><Button disabled={busy || !title.trim() || !objective.trim()} className="bg-[#b7f34a] text-[#07100d] hover:bg-[#c8ff62]">Salvar demanda na fila</Button></form>}
          <section className="panel p-5"><h3 className="mb-4 text-lg font-semibold">Demandas e execuções</h3>{!visible ? <p role="status">Carregando projeto…</p> : visible.deliveries.length === 0 ? <p className="text-[#a9b8b0]">Nenhuma demanda registrada.</p> : <div className="space-y-3">{visible.deliveries.map(delivery => { const run = visible.runs.find(item => item.delivery_id === delivery.id); return <article key={delivery.id} className="rounded-lg border border-white/10 p-4"><h4 className="break-words font-semibold">{delivery.title}</h4><p className="my-2 whitespace-pre-wrap break-words text-sm text-[#bdcbc3]">{delivery.objective}</p><p className="text-sm text-[#b7f34a]">{run ? statusNames[run.status] ?? run.status : "Sem execução associada"}</p>{run?.run_steps.map(step => <p key={step.id} className="mt-2 text-sm text-[#a9b8b0]">{step.name} · {statusNames[step.status] ?? step.status}</p>)}</article>; })}</div>}</section>
          {selected.role === "owner" && <section className="panel space-y-4 p-5"><h3 className="flex items-center gap-2 text-lg font-semibold"><ShieldCheck className="size-5" />Acesso ao projeto</h3><p className="text-sm text-[#a9b8b0]">A pessoa deve entrar neste mesmo site e informar seu identificador. Este acesso vale somente para este projeto.</p><form onSubmit={updateMember} className="flex flex-wrap items-end gap-3"><div className="min-w-0 flex-1"><label className="mb-2 block text-sm" htmlFor="member-id">Identificador</label><Input id="member-id" required maxLength={256} value={memberId} onChange={e => setMemberId(e.target.value)} className={control} /></div><div><label className="mb-2 block text-sm" htmlFor="member-role">Permissão</label><NativeSelect id="member-role" value={memberRole} onChange={e => setMemberRole(e.target.value)} className={control}><NativeSelectOption value="tester">Tester</NativeSelectOption><NativeSelectOption value="viewer">Somente leitura</NativeSelectOption><NativeSelectOption value="member">Membro</NativeSelectOption><NativeSelectOption value="admin">Administrador</NativeSelectOption></NativeSelect></div><Button disabled={busy || !memberId.trim()} type="submit">Salvar acesso</Button></form><p className="text-sm text-[#a9b8b0]">Tester, membro e administrador podem registrar demandas. Nesta etapa, somente o proprietário gerencia acessos.</p><ul className="space-y-2">{visible?.members.map(member => <li key={member.user_id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/5 p-3 text-sm"><span className="min-w-0 break-all">{member.user_id} · {member.role}</span>{member.role !== "owner" && <Button size="sm" variant="outline" disabled={busy} onClick={() => void action(async () => { await request(`/api/projects/${selected.id}/members`, { method: "DELETE", body: JSON.stringify({ user_id: member.user_id }) }); setSnapshot(await loadProject(selected.id, selected.role)); })}>Remover</Button>}</li>)}</ul></section>}
          <section className="panel p-5"><h3 className="mb-4 text-lg font-semibold">Histórico</h3><ul className="space-y-3">{visible?.events.map(event => <li key={event.id} className="flex flex-wrap justify-between gap-2 border-b border-white/10 pb-3 text-sm"><span>{eventNames[event.kind] ?? event.kind}</span><time className="text-[#a9b8b0]" dateTime={event.created_at}>{new Date(event.created_at).toLocaleString("pt-BR")}</time></li>)}</ul></section>
        </> : <section className="panel p-8"><FolderKanban className="mb-4 size-8 text-[#b7f34a]" /><h2 className="text-xl font-semibold">Um espaço para cada projeto</h2><p className="mt-3 text-[#a9b8b0]">Selecione ou crie um projeto para registrar demandas, acompanhar a fila e gerenciar acessos.</p></section>}</section>
      </div>
    </div>
  </main>;
}
