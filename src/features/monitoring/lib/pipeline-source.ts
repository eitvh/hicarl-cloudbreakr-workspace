export type PipelineSource = "lambda" | "fargate" | "manual";

export function pipelineSource(value: string | null): PipelineSource | null {
  if (value === null || value === "lambda") return "lambda";
  return (value === "fargate" || value === "manual") ? value : null;
}

export function jobStatus(state: string) {
  switch (state) {
    case "completed": return "Completed";
    case "fetching":
    case "embedding": return "In progress";
    case "attention": return "Needs attention";
    case "stale": return "No recent activity";
    case "idle": return "No job";
    default: return "Status unavailable";
  }
}

export function sourceLabel(source: PipelineSource) {
  return source === "manual" ? "Manual" : source === "lambda" ? "Lambda" : "Fargate";
}

const stageNames: Record<string,string> = {ingest:"Post ingestion", "lambda-fetch":"Fetch posts", "lambda-embed":"Generate embeddings"};

export function stageLabel(stage: string) {
  return stageNames[stage] || stage?.replace(/[-_]/g," ") || "Run";
}
