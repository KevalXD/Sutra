import { SutraApp } from "@/components/sutra/app";
import { parseScenario } from "@/lib/scenario";

export default async function DemoPage({
  searchParams,
}: {
  searchParams: Promise<{ scenario?: string }>;
}) {
  const { scenario } = await searchParams;
  const selected = parseScenario(scenario);
  return <SutraApp key={selected} scenario={selected} />;
}
