import { getChatGPTUser, chatGPTSignInPath } from "./chatgpt-auth";
import { ProjectConsole } from "@/components/project-console";
export const dynamic = "force-dynamic";
export default async function Home() {
  const user = await getChatGPTUser();
  if (!user) return <main className="min-h-screen bg-[#07100d] p-8 text-[#eef5f0]"><div className="panel mx-auto mt-16 max-w-lg space-y-6 p-8"><h1 className="text-3xl font-semibold">TeamClaw</h1><p>Entre para acessar seus projetos e acompanhar as demandas.</p><a className="inline-block rounded-lg bg-[#b7f34a] px-5 py-3 font-semibold text-[#07100d]" href={chatGPTSignInPath("/")} target="_top">Entrar com ChatGPT</a><p><a className="underline" href="/demo">Explorar demonstração</a></p></div></main>;
  return <ProjectConsole user={{ userId: user.userId, displayName: user.displayName }} />;
}
