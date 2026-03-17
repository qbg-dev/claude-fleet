/**
 * Pipeline context generator — produces per-worker awareness fragments.
 *
 * Each worker gets a markdown section describing:
 *   1. Pipeline overview (name, description, spec)
 *   2. Graph flow with position marker
 *   3. Peer roster (other workers in this node)
 *   4. Downstream needs (what the next node expects)
 *   5. Freedom mandate
 *
 * Auto-appended to seeds unless agent opts out (noPipelineContext: true)
 * or seed contains {{> pipeline-context}} partial for custom placement.
 */
import type {
  AgentSpec,
  ProgramGraph,
  ProgramPipelineState,
} from "./types";
import { outgoingEdges, END_SENTINEL } from "./graph";

/**
 * Generate pipeline context for a specific worker within a node.
 */
export function generatePipelineContext(
  agent: AgentSpec,
  nodeName: string,
  allAgentsInNode: AgentSpec[],
  graph: ProgramGraph,
  state: ProgramPipelineState,
): string {
  const lines: string[] = [];

  lines.push("## Pipeline Context");
  lines.push("");

  // 1. Overview
  const desc = graph.description || state.programName;
  lines.push(`You are **${agent.name}** (role: ${agent.role}) in the **${graph.name}** pipeline.`);
  const spec = state.ext?.spec as string;
  if (spec) {
    lines.push(`Goal: "${spec}"`);
  } else if (graph.description) {
    lines.push(`Goal: "${desc}"`);
  }
  lines.push("");

  // 2. Flow diagram
  const flow = buildFlowDiagram(graph, nodeName, state);
  lines.push("### Flow");
  lines.push(flow);
  lines.push("");

  // 3. Peer roster
  if (allAgentsInNode.length > 1) {
    lines.push("### Your Peers");
    lines.push("| Worker | Role | Mail |");
    lines.push("|--------|------|------|");
    for (const peer of allAgentsInNode) {
      if (peer.name === agent.name) continue;
      lines.push(`| ${peer.name} | ${peer.role} | mail_send(to="${peer.name}") |`);
    }
    lines.push("");
  }

  // 4. Downstream needs
  const edges = outgoingEdges(graph, nodeName);
  const forwardEdges = edges.filter(e => !e.maxIterations && e.to !== END_SENTINEL);
  if (forwardEdges.length > 0) {
    lines.push("### What Comes Next");
    for (const edge of forwardEdges) {
      const nextNode = graph.nodes[edge.to];
      const nextDesc = nextNode?.description || edge.to;
      lines.push(`The **${edge.to}** node needs output from this phase${nextDesc !== edge.to ? `: ${nextDesc}` : ""}.`);
    }
    lines.push("");
  }

  // 5. Freedom mandate
  lines.push("### Your Freedom");
  lines.push("You understand the pipeline's intent. You are not following a script blindly.");
  lines.push("If you discover something that changes the plan — communicate it via Fleet Mail.");
  lines.push(`Your role is "${agent.role}" but your mission is the pipeline's goal.`);

  return lines.join("\n");
}

/**
 * Build a flow diagram string showing the worker's position.
 * e.g.: planning (done) --> improve-review (done) --> [review] (you are here) --> verification
 */
function buildFlowDiagram(
  graph: ProgramGraph,
  currentNode: string,
  state: ProgramPipelineState,
): string {
  // Walk forward from entry, following unconditional non-cycle edges
  const chain: string[] = [graph.entry];
  const visited = new Set([graph.entry]);
  let cur = graph.entry;

  const nodeNames = Object.keys(graph.nodes);
  for (let i = 0; i < nodeNames.length; i++) {
    const fwd = graph.edges.find(
      e => e.from === cur && !e.maxIterations && !visited.has(e.to) && e.to !== END_SENTINEL,
    );
    if (!fwd) break;
    chain.push(fwd.to);
    visited.add(fwd.to);
    cur = fwd.to;
  }

  // Format each node with status
  const parts = chain.map(n => {
    const isDone = state.phaseState[n]?.compiled || state.phaseState[n]?.skipped;
    const isCurrent = n === currentNode;

    if (isCurrent) return `[${n}] (you are here)`;
    if (isDone) return `${n} (done)`;
    return n;
  });

  return parts.join(" --> ");
}
