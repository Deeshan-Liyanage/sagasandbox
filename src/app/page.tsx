import Link from "next/link";
import { DEMO_PROJECT_ID } from "@/lib/mock-workspace";

export default function Home() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-[#0f0f12] px-6 py-16 text-[#e5e7eb]">
      <main className="mx-auto flex w-full max-w-lg flex-col items-center gap-8 text-center">
        <p className="text-xs font-medium uppercase tracking-widest text-[#7c3aed]">
          SagaSandbox
        </p>
        <h1 className="text-3xl font-semibold leading-tight">
          Agentic multimodal storytelling canvas
        </h1>
        <p className="text-sm leading-relaxed text-[#9ca3af]">
          Map geography, sequence events on a timeline, and catalog characters in
          a collaborative studio workspace. Preview uses seeded mock data until
          backend APIs are connected.
        </p>
        <Link
          href={`/projects/${DEMO_PROJECT_ID}`}
          className="rounded-full bg-[#7c3aed] px-6 py-3 text-sm font-medium text-white transition hover:bg-[#6d28d9]"
        >
          Open demo workspace
        </Link>
        <p className="font-mono text-[10px] text-[#6b7280]">
          /projects/{DEMO_PROJECT_ID}
        </p>
      </main>
    </div>
  );
}
