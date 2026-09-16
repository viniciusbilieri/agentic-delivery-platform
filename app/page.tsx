"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowRight, Boxes, Check, CheckCircle2, ChevronRight, Circle, Clock3, Code2, Database, FileText, GitBranch, LayoutDashboard, MessageSquare, Network, Pause, Play, Send, ShieldCheck, Sparkles, TerminalSquare, UserRoundCheck, UsersRound, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Status = "waiting" | "active" | "done";

type WebMcpContext = {
  registerTool: (tool: {
    name: string;
    title: string;
    description: string;
    inputSchema: object;
    annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
    execute: (input: unknown) => unknown;
  }, options?: { signal?: AbortSignal }) => void | Promise<void>;
};

const DEFAULT_REQUEST = "Avaliar a mudança do managed location no Unity Catalog do projeto ipiranga-eng-dados, identificar notebooks e consumidores impactados, preparar as alterações de código, plano de testes, rollback e resumo executivo. Não executar nenhuma mudança em produção.";

const capabilities = [
  { name: "Delivery Lead", icon: GitBranch, required: true },
  { name: "Requirements", icon: FileText, required: true },
  { name: "Solution Architect", icon: Network, required: true },
  { name: "Data Architect", icon: Database, keys: ["data", "dados", "catalog", "unity", "notebook"] },
  { name: "Azure Specialist", icon: Boxes, keys: ["azure", "storage", "entra", "cloud"] },
  { name: "Databricks Engineer", icon: TerminalSquare, keys: ["databricks", "unity", "notebook", "catalog"] },
  { name: "Codex Engineer", icon: Code2, keys: ["código", "code", "alterações", "api", "aplicação"] },
  { name: "QA & Reviewer", icon: ShieldCheck, required: true },
  { name: "Executive Delivery", icon: UserRoundCheck, required: true },
];

const phases = [
  { name: "Discovery", tasks: ["Entendimento da demanda", "Requisitos e critérios de aceite"] },
  { name: "Architecture", tasks: ["Análise de impacto", "Plano de solução e rollback"] },
  { name: "Build", tasks: ["Alterações de código", "Documentação técnica"] },
  { name: "Validation", tasks: ["Testes automatizados", "Revisão independente"] },
  { name: "Delivery", tasks: ["Resumo executivo", "Aprovação humana"] },
];

const agentEvents = [
  "Delivery Lead classificou a demanda e definiu os boundaries.",
  "Requirements registrou 6 critérios de aceite.",
  "Data Architect identificou 1 catálogo ativo e 7 notebooks candidatos.",
  "Solution Architect recomenda execução controlada primeiro em DEV.",
  "Codex Engineer preparou o plano de alteração sem executar mudanças.",
  "QA & Reviewer iniciou a validação cruzada das evidências.",
];

function stateFor(taskIndex: number, progress: number): Status {
  if (taskIndex < progress) return "done";
  if (taskIndex === progress) return "active";
  return "waiting";
}

export default function Home() {
  const [request, setRequest] = useState(DEFAULT_REQUEST);
  const [started, setStarted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [decisionMade, setDecisionMade] = useState(false);
  const [chat, setChat] = useState("");
  const [messages, setMessages] = useState<string[]>(["Pronto para receber a demanda. Eu coordenarei o time e trarei apenas as decisões que exigem sua participação."]);

  const selected = useMemo(() => {
    const value = request.toLowerCase();
    return capabilities.filter((capability) => capability.required || capability.keys?.some((key) => value.includes(key)));
  }, [request]);

  useEffect(() => {
    if (!started || paused || decisionOpen || progress >= 10) return;
    const timer = window.setTimeout(() => {
      const next = progress + 1;
      setProgress(next);
      if (next === 4 && !decisionMade) setDecisionOpen(true);
    }, 1400);
    return () => window.clearTimeout(timer);
  }, [started, paused, decisionOpen, progress, decisionMade]);

  function startDelivery() {
    setStarted(true); setPaused(false); setProgress(0); setDecisionMade(false);
    setMessages((current) => [...current, `Delivery DT-0001 iniciada. ${selected.length} capacidades foram selecionadas para esta demanda.`]);
    void fetch("/api/deliveries", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "Ipiranga Engineering Data", objective: request }) }).catch(() => undefined);
  }

  function approveDecision() {
    setDecisionMade(true); setDecisionOpen(false);
    setMessages((current) => [...current, "Decisão DEC-001 aprovada: preparar execução em DEV com validação e rollback antes de qualquer promoção."]);
  }

  function sendMessage() {
    if (!chat.trim()) return;
    const userMessage = chat.trim();
    setMessages((current) => [...current, `Você: ${userMessage}`, userMessage.toLowerCase().includes("por que") ? "Delivery Lead: A recomendação prioriza reversibilidade, evidência e isolamento. A arquitetura detalhada está registrada em ADR-001." : "Delivery Lead: Entendido. Vou registrar como mudança de escopo e avaliar impacto antes de alterar a entrega atual."]);
    setChat("");
  }

  useEffect(() => {
    const modelContext = (document as Document & { modelContext?: WebMcpContext }).modelContext;
    if (!modelContext?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(modelContext.registerTool({
      name: "start_delivery",
      title: "Start delivery",
      description: "Starts the visible Agentic Technology Delivery workflow with a supplied objective.",
      inputSchema: { type: "object", properties: { objective: { type: "string", minLength: 12 } }, required: ["objective"], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        const objective = (input as { objective?: unknown })?.objective;
        if (typeof objective !== "string" || objective.trim().length < 12) throw new Error("A delivery objective with at least 12 characters is required.");
        setRequest(objective.trim());
        setStarted(true); setPaused(false); setProgress(0); setDecisionMade(false);
        return { code: "DT-0001", status: "started", objective: objective.trim() };
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, []);

  const complete = progress >= 10 && decisionMade;

  return (
    <main className="min-h-screen bg-[#07100d] text-[#eef5f0]">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-white/8 bg-[#07100d]/92 px-5 backdrop-blur-xl lg:px-8">
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-xl bg-[#b7f34a] text-[#07100d] shadow-[0_0_28px_rgba(183,243,74,.18)]"><Network className="size-5" /></div>
          <div><div className="flex items-center gap-2"><span className="font-semibold tracking-[-.02em]">ATD Control Plane</span><span className="rounded-full border border-[#b7f34a]/25 bg-[#b7f34a]/8 px-2 py-0.5 text-[11px] font-semibold text-[#b7f34a]">POC v0.1</span></div><p className="text-xs text-[#82958b]">Agentic Technology Delivery</p></div>
        </div>
        <div className="flex items-center gap-3 text-sm text-[#a9b8b0]"><span className="hidden items-center gap-2 sm:flex"><span className="size-2 rounded-full bg-[#58d68d] shadow-[0_0_12px_#58d68d]" />Runtime disponível</span><button className="grid size-9 place-items-center rounded-full border border-white/10 bg-white/5 font-semibold text-white">VI</button></div>
      </header>

      <div className="grid min-h-[calc(100vh-64px)] lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="hidden border-r border-white/8 bg-[#091410] px-4 py-6 lg:flex lg:flex-col">
          <nav className="space-y-1 text-sm"><button className="nav-item nav-active"><LayoutDashboard />Command Center</button><button className="nav-item"><GitBranch />Deliveries <span className="ml-auto rounded-full bg-white/8 px-2 py-0.5 text-xs">1</span></button><button className="nav-item"><UsersRound />Capabilities</button><button className="nav-item"><Activity />Telemetry</button></nav>
          <div className="mt-auto rounded-2xl border border-white/8 bg-white/[.035] p-4"><div className="mb-3 flex items-center gap-2 text-sm font-medium"><ShieldCheck className="size-4 text-[#b7f34a]" />Safety boundary</div><p className="text-xs leading-5 text-[#82958b]">Produção, permissões, secrets e operações destrutivas permanecem bloqueados.</p></div>
        </aside>

        <section className="p-4 sm:p-6 xl:p-8"><div className="mx-auto max-w-[1500px]">
          <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="mb-1 text-xs font-semibold uppercase tracking-[.16em] text-[#b7f34a]">Command center</p><h1 className="text-2xl font-semibold tracking-[-.04em] sm:text-3xl">Digital workforce, sob seu controle.</h1></div><div className="flex items-center gap-2"><span className="rounded-lg border border-white/8 bg-white/[.035] px-3 py-2 text-xs text-[#82958b]">DT-0001 · Ipiranga Engineering Data</span>{started && <Button variant="outline" onClick={() => setPaused(!paused)} className="border-white/10 bg-white/5 text-white hover:bg-white/10"><Pause />{paused ? "Retomar" : "Pausar"}</Button>}</div></div>

          <div className="grid gap-5 xl:grid-cols-[minmax(320px,.82fr)_minmax(560px,1.55fr)_minmax(280px,.78fr)]">
            <section className="panel p-5">
              <div className="mb-4 flex items-center justify-between"><div><p className="eyebrow">New delivery</p><h2 className="section-title">Defina o objetivo</h2></div><div className="grid size-9 place-items-center rounded-xl bg-[#b7f34a]/10 text-[#b7f34a]"><Sparkles className="size-4" /></div></div>
              <Textarea value={request} onChange={(event) => setRequest(event.target.value)} className="min-h-[190px] resize-none border-white/10 bg-black/15 text-[15px] leading-6 text-[#e9f0ec] shadow-none focus-visible:border-[#b7f34a]/50 focus-visible:ring-[#b7f34a]/10" aria-label="Objetivo da entrega" />
              <div className="mt-4"><p className="mb-3 text-xs font-semibold uppercase tracking-[.12em] text-[#71857a]">Time recomendado · {selected.length} capacidades</p><div className="flex flex-wrap gap-2">{selected.map(({ name, icon: Icon }) => <span key={name} className="flex items-center gap-1.5 rounded-lg border border-white/8 bg-white/[.035] px-2.5 py-1.5 text-xs text-[#bdcbc3]"><Icon className="size-3.5 text-[#b7f34a]" />{name}</span>)}</div></div>
              <Button onClick={startDelivery} disabled={!request.trim() || (started && !complete)} className="mt-5 h-11 w-full bg-[#b7f34a] font-semibold text-[#07100d] hover:bg-[#c8ff62]">{started && !complete ? <><Activity className="animate-pulse" />Delivery em execução</> : <><Play className="fill-current" />Start Delivery</>}</Button>
              <p className="mt-3 text-center text-xs text-[#71857a]">O Orchestrator seleciona capacidades. Você aprova decisões críticas.</p>
            </section>

            <section className="panel overflow-hidden">
              <div className="flex items-center justify-between border-b border-white/8 px-5 py-4"><div><p className="eyebrow">Live delivery</p><h2 className="section-title">Execution board</h2></div><div className="flex items-center gap-2 text-xs text-[#91a39a]"><Clock3 className="size-3.5" />{started ? (complete ? "Concluída" : paused ? "Pausada" : "00:04:18") : "Aguardando início"}</div></div>
              <div className="grid min-h-[520px] sm:grid-cols-[1fr_220px]">
                <div className="space-y-6 p-5">{phases.map((phase, phaseIndex) => { const offset = phases.slice(0, phaseIndex).reduce((total, item) => total + item.tasks.length, 0); return <div key={phase.name}><div className="mb-3 flex items-center gap-3"><span className="text-[11px] font-semibold tabular-nums text-[#5e7468]">0{phaseIndex + 1}</span><h3 className="text-xs font-semibold uppercase tracking-[.14em] text-[#a9b8b0]">{phase.name}</h3><span className="h-px flex-1 bg-white/7" /></div><div className="grid gap-2 sm:grid-cols-2">{phase.tasks.map((task, taskIndex) => { const index = offset + taskIndex; const status = started ? stateFor(index, progress) : "waiting"; return <div key={task} className={`task-card ${status}`}><span className="task-icon">{status === "done" ? <Check /> : status === "active" ? <Activity /> : <Circle />}</span><div><p>{task}</p><span>{status === "done" ? "Concluído" : status === "active" ? "Em execução" : "Aguardando dependência"}</span></div></div>; })}</div></div>; })}</div>
                <aside className="border-l border-white/8 bg-black/10 p-4"><p className="mb-4 text-xs font-semibold uppercase tracking-[.13em] text-[#71857a]">Agent activity</p><div className="space-y-4">{selected.slice(0, 6).map(({ name, icon: Icon }, index) => { const status: Status = !started ? "waiting" : index < Math.ceil(progress / 2) ? "done" : index === Math.ceil(progress / 2) ? "active" : "waiting"; return <div key={name} className="flex gap-3"><span className={`agent-avatar ${status}`}><Icon /></span><div className="min-w-0"><p className="truncate text-sm font-medium text-[#dbe6e0]">{name}</p><p className={`text-xs ${status === "active" ? "text-[#b7f34a]" : "text-[#71857a]"}`}>{status === "done" ? "Task completed" : status === "active" ? "Working now" : "Standby"}</p></div></div>; })}</div></aside>
              </div>
            </section>

            <div className="space-y-5">
              <section className="panel p-5"><div className="mb-4 flex items-center justify-between"><div><p className="eyebrow">Human gate</p><h2 className="section-title">Decision queue</h2></div><span className={`size-2.5 rounded-full ${decisionOpen ? "bg-[#ffb454] shadow-[0_0_12px_#ffb454]" : "bg-[#405348]"}`} /></div>{decisionOpen ? <button onClick={() => setDecisionOpen(true)} className="w-full rounded-xl border border-[#ffb454]/25 bg-[#ffb454]/7 p-4 text-left transition hover:bg-[#ffb454]/10"><span className="mb-2 block text-[11px] font-semibold uppercase tracking-[.12em] text-[#ffb454]">DEC-001 · Action required</span><p className="text-sm font-medium leading-5">Onde devemos validar a alteração do managed location?</p><span className="mt-3 flex items-center gap-1 text-xs text-[#c6d2cb]">Abrir decisão <ChevronRight className="size-3" /></span></button> : <div className="rounded-xl border border-dashed border-white/10 px-4 py-6 text-center"><CheckCircle2 className={`mx-auto mb-2 size-5 ${decisionMade ? "text-[#58d68d]" : "text-[#53675c]"}`} /><p className="text-sm text-[#98aaa0]">{decisionMade ? "Todas as decisões resolvidas" : "Nenhuma decisão pendente"}</p></div>}</section>
              <section className="panel overflow-hidden"><div className="border-b border-white/8 px-5 py-4"><p className="eyebrow">Observability</p><h2 className="section-title">Delivery pulse</h2></div><div className="grid grid-cols-2 gap-px bg-white/7">{[["Agents", String(selected.length)], ["Tasks", `${Math.min(progress, 10)}/10`], ["Human wait", decisionOpen ? "01:26" : "00:00"], ["Est. cost", started ? "$0.84" : "$0.00"]].map(([label, value]) => <div key={label} className="bg-[#0b1713] p-4"><p className="text-[11px] uppercase tracking-[.1em] text-[#64786d]">{label}</p><p className="mt-1 text-xl font-semibold tracking-[-.03em]">{value}</p></div>)}</div></section>
              <section className="panel p-4"><div className="mb-3 flex items-center gap-2"><MessageSquare className="size-4 text-[#b7f34a]" /><h2 className="text-sm font-semibold">Chat with Delivery Lead</h2></div><div className="mb-3 max-h-32 space-y-2 overflow-y-auto pr-1 text-xs leading-5 text-[#95a79d]">{messages.slice(-3).map((message, index) => <p key={`${message}-${index}`} className="rounded-lg bg-white/[.035] px-3 py-2">{message}</p>)}</div><div className="flex gap-2"><input value={chat} onChange={(event) => setChat(event.target.value)} onKeyDown={(event) => event.key === "Enter" && sendMessage()} placeholder="Pergunte ou altere o escopo..." className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/15 px-3 text-sm outline-none placeholder:text-[#53675c] focus:border-[#b7f34a]/40" /><Button onClick={sendMessage} size="icon" className="bg-[#b7f34a] text-[#07100d] hover:bg-[#c8ff62]" aria-label="Enviar"><Send /></Button></div></section>
            </div>
          </div>

          <section className="panel mt-5 overflow-hidden"><Tabs defaultValue="events"><div className="flex flex-col gap-3 border-b border-white/8 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><TabsList variant="line" className="bg-transparent p-0"><TabsTrigger value="events" className="px-3">Activity stream</TabsTrigger><TabsTrigger value="technical" className="px-3">Technical delivery</TabsTrigger><TabsTrigger value="executive" className="px-3">Executive delivery</TabsTrigger></TabsList><span className="text-xs text-[#667a6f]">Shared Delivery Context · atualizado em tempo real</span></div>
            <TabsContent value="events" className="m-0 p-5"><div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{agentEvents.slice(0, Math.max(1, Math.min(agentEvents.length, Math.ceil(progress / 2)))).map((event, index) => <div key={event} className="flex gap-3 rounded-xl border border-white/7 bg-white/[.025] p-3"><span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-[#b7f34a]/10 text-[#b7f34a]"><Check className="size-3.5" /></span><div><p className="text-sm leading-5 text-[#c4d0c9]">{event}</p><span className="text-[11px] text-[#60746a]">00:0{index + 1}:{12 + index * 7}</span></div></div>)}</div></TabsContent>
            <TabsContent value="technical" className="m-0 p-5"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{["Delivery.md", "ADR-001.md", "impact-assessment.md", "rollback-plan.md"].map((file) => <button key={file} className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[.025] p-4 text-left hover:border-[#b7f34a]/25"><FileText className="size-5 text-[#b7f34a]" /><div><p className="text-sm font-medium">{file}</p><span className="text-xs text-[#667a6f]">Generated artifact</span></div></button>)}</div></TabsContent>
            <TabsContent value="executive" className="m-0 p-5"><div className="grid gap-5 lg:grid-cols-[1fr_auto]"><div><div className="mb-3 flex items-center gap-2"><span className={`size-2 rounded-full ${complete ? "bg-[#58d68d]" : "bg-[#ffb454]"}`} /><p className="text-sm font-semibold">{complete ? "Ready for approval" : "Delivery in progress"}</p></div><p className="max-w-4xl text-sm leading-6 text-[#9fb0a7]">A análise controlada do projeto Ipiranga Engineering Data avalia a mudança do managed location, mapeia dependências, prepara alterações e documenta riscos sem executar ações em produção. O próximo gate autoriza somente validação em DEV.</p></div><Button variant="outline" disabled={!complete} className="border-white/10 bg-white/5 text-white hover:bg-white/10">View executive summary <ArrowRight /></Button></div></TabsContent>
          </Tabs></section>
        </div></section>
      </div>

      <Dialog open={decisionOpen} onOpenChange={setDecisionOpen}><DialogContent className="border-white/10 bg-[#0b1713] text-[#eef5f0] sm:max-w-xl"><DialogHeader><div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.12em] text-[#ffb454]"><Zap className="size-4" />Human decision required</div><DialogTitle className="text-xl">Autorizar preparação para validação em DEV?</DialogTitle><DialogDescription className="leading-6 text-[#8ea096]">O time concluiu a análise inicial. Nenhuma alteração será aplicada agora; a aprovação libera apenas geração dos artefatos, testes e plano de rollback.</DialogDescription></DialogHeader><div className="space-y-2"><button className="decision-option selected"><span><strong>A. DEV com aprovação por etapa</strong><small>Recomendado · menor risco e evidência completa</small></span><CheckCircle2 /></button><button className="decision-option"><span><strong>B. Somente análise documental</strong><small>Sem preparar scripts ou alterações</small></span><Circle /></button></div><div className="rounded-xl border border-white/8 bg-black/15 p-4 text-sm leading-6 text-[#a7b6ae]"><strong className="text-white">Impacto:</strong> mantém produção isolada, valida permissões e referências em DEV e exige novo approval antes de qualquer execução.</div><DialogFooter><Button variant="ghost" onClick={() => setDecisionOpen(false)} className="text-[#a7b6ae] hover:bg-white/5 hover:text-white">Discutir com o Lead</Button><Button onClick={approveDecision} className="bg-[#b7f34a] text-[#07100d] hover:bg-[#c8ff62]">Approve & continue <ChevronRight /></Button></DialogFooter></DialogContent></Dialog>
    </main>
  );
}
