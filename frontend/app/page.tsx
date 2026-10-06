import { SutraApp } from "@/components/sutra/app";
import { parseScenario } from "@/lib/scenario";

export default async function Page({ searchParams }: { searchParams: Promise<{ scenario?: string }> }) {
  const { scenario } = await searchParams;
  const s = parseScenario(scenario);
  return <SutraApp key={s} scenario={s} />;
}
