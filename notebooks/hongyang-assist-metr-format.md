# METR Task Standard — Research Notes for HongYang

> Compiled by hongyang-assist, 2026-03-12

---

## 1. Overview: What METR Measures

METR (Model Evaluation & Threat Research) measures AI capability by determining **the length of tasks AI agents can complete** at specified success probabilities (50% and 80%). Their core methodology:

- Record human expert completion time for multi-step tasks
- Fit logistic curves predicting model success probability vs. human task duration
- Convert success curves to "time horizons" — the task duration where predicted success crosses a threshold

**Key finding**: Task-completion time horizon has **doubled approximately every 7 months** for the past 6 years. Current frontier models (Claude 3.7 Sonnet) have a time horizon of ~1 hour but can only *reliably* complete tasks up to a few minutes.

**Projection**: Within a decade, AI agents will independently complete tasks that currently take humans days or weeks.

Source: [Measuring AI Ability to Complete Long Tasks](https://metr.org/blog/2025-03-19-measuring-ai-ability-to-complete-long-tasks/)

---

## 2. The Task Standard (v0.5.0)

### 2.1 Core Concept: TaskFamily

A **TaskFamily** is a Python class that defines a group of related tasks. Each family lives in a single file (`$TASK_FAMILY_NAME.py`) and exposes multiple task instances via `get_tasks()`.

```python
class Task(TypedDict):
    # Define task-specific fields
    word: str
    hash: str

class TaskFamily:
    standard_version = "0.5.0"  # Required

    @staticmethod
    def get_tasks() -> dict[str, Task]:
        """Returns dict mapping task names to Task objects"""

    @staticmethod
    def get_instructions(t: Task) -> str:
        """Returns task instructions for the agent"""

    @staticmethod
    def get_permissions() -> list[str]:
        """Returns permission flags, e.g. ['full_internet']"""

    # --- Optional methods ---

    @staticmethod
    def install() -> None:
        """Install dependencies in task environment"""

    @staticmethod
    def start() -> None:
        """Initialize task environment before agent interaction"""

    @staticmethod
    def score(submission: str, aux_vms, taskSetupData, env) -> float | None:
        """End-scoring: score agent's final submission (0.0-1.0)"""

    @staticmethod
    def intermediate_score(taskSetupData, env) -> "Score":
        """Long-running scoring: called multiple times during execution"""

    @staticmethod
    def aggregate_scores(scoreLog, taskSetupData, env) -> "Score":
        """Aggregate intermediate scores into a final score"""

    @staticmethod
    def get_aux_vm_spec() -> "VMSpec | None":
        """Specify auxiliary VM requirements"""
```

### 2.2 Required vs. Optional

| Component | Required? | Purpose |
|-----------|-----------|---------|
| `standard_version` | **Yes** | Declares schema compatibility (currently "0.5.0") |
| `get_tasks()` | **Yes** | Returns dict[str, Task] of task instances |
| `get_instructions(t)` | **Yes** | Returns task prompt for the agent |
| `get_permissions()` | **Yes** | Returns permission flags |
| `required_environment_variables` | If needed | Env vars the task needs |
| `install()` | Optional | Environment setup (apt packages, etc.) |
| `start()` | Optional | Task initialization (create files, start services) |
| `score()` | Optional | End-scoring (mutually exclusive with intermediate_score) |
| `intermediate_score()` | Optional | Progress scoring during execution |
| `aggregate_scores()` | Optional | Final score from intermediate log |
| `get_aux_vm_spec()` | Optional | Auxiliary VM specification |

**Critical constraint**: A TaskFamily **MUST NOT** implement both `score` and `intermediate_score`, or both `score` and `aggregate_scores`. These are mutually exclusive scoring modes.

### 2.3 Directory Structure

```
task-standard/
├── STANDARD.md              # Full technical specification
├── Dockerfile               # Base task environment
├── template/
│   ├── template.py          # Heavily-commented template
│   └── manifest.yaml        # Resource declaration example
├── python-package/
│   └── metr_task_standard/  # Types & utilities
├── schemas/                 # JSON/YAML validation schemas
├── drivers/                 # Environment generation tools
├── workbench/               # Local development tool
└── examples/
    ├── reverse_hash/
    │   ├── reverse_hash.py
    │   ├── reverse_hash_test.py
    │   └── Dockerfile
    ├── machine_learning_local/
    ├── gaia/
    ├── swe_bench/
    ├── humaneval/
    ├── gpqa_diamond/
    └── pico_ctf/
```

**Naming conventions**:
- Task family files: `lowercase_with_underscores.py`
- Test files: `{family_name}_test.py`
- One Dockerfile per task family
- Task names: string keys in `get_tasks()` dict

Source: [METR/task-standard](https://github.com/METR/task-standard)

---

## 3. Scoring: Two Modes

### 3.1 End Scoring (Simple)

Agent completes the task and submits a string. The `score()` method evaluates it:

```python
@staticmethod
def score(t: Task, submission: str) -> float | None:
    return float(int(submission == t["word"]))  # Binary: 0.0 or 1.0
```

- Returns `float` (typically 0.0-1.0) or `None` if scoring unavailable
- Implementers define custom scoring logic — no built-in rubric system
- Score represents solution quality/correctness

### 3.2 Intermediate Scoring (Long-Running Tasks)

For tasks where progress matters during execution:

1. **During execution**: Call `intermediate_score()` multiple times at any point
2. **After completion**: Call `aggregate_scores(scoreLog)` to compute the final score
3. Agent submission is an empty string in intermediate mode

The spec explicitly states: *"The Task Standard doesn't specify when to call `TaskFamily#intermediate_score`"* — the evaluation harness decides timing.

### 3.3 Scoring Examples from Public Tasks

| Task | Scoring Approach |
|------|-----------------|
| **Reverse Hash** | Binary pass/fail: `submission == t["word"]` |
| **Board Game AI (Cowthello)** | Weighted multi-criteria: 60% win rate vs advanced AI, 30% vs simple AI, 10% vs random |
| **Crossword** | Constraint satisfaction: valid words, >35% filled, ≥2 words >4 letters |
| **Clone Black Box App** | Pass/fail: exact behavior replication across 6 games |
| **Hypothesis Testing** | Efficiency metric: identify correct functions with minimal experiments |
| **Deduplication** | Accuracy measured against benchmarks |

**Key insight for HongYang**: METR's scoring is completely custom per task family. There is no universal rubric format — each `score()` method implements its own logic. Partial credit is possible (return any float 0.0-1.0) but not structurally enforced.

Source: [METR/public-tasks](https://github.com/METR/public-tasks)

---

## 4. Long-Running Tasks: State & Checkpoints

### 4.1 What METR Provides

- **No formal checkpoint API**: There is no save/restore checkpoint mechanism in the standard
- **Container persistence**: Tasks run in isolated Docker containers with dedicated filesystems; the filesystem IS the state
- **Intermediate scoring**: The `intermediate_score()` method lets the harness observe progress without the agent explicitly submitting
- **Token budgets as time proxy**: METR uses token budgets (e.g., $800 ≈ 20 hours of human time) to approximate long-running task durations

### 4.2 Lifecycle for Long-Running Tasks

```
1. Create Docker container (Dockerfile)
2. driver.getTaskSetupData() → permissions, instructions, env vars, aux VM spec
3. Maybe create auxiliary VM (if get_aux_vm_spec() returns non-null)
4. Apply network restrictions (based on get_permissions())
5. TaskFamily.start() — initialize environment
6. Agent runs (potentially for hours):
   - Harness periodically calls intermediate_score()
   - Agent modifies container filesystem
   - Agent can SSH into aux VMs
7. Agent submits (empty string for intermediate mode)
8. aggregate_scores(scoreLog) → final score
```

### 4.3 What This Means for Diagnostic Task Design

- State lives in the filesystem, not a checkpoint API
- For long tasks, use `intermediate_score()` to track progress at harness-defined intervals
- The agent doesn't know when intermediate scoring happens — it's transparent
- If you need checkpoint-like behavior, implement it as filesystem state that `intermediate_score()` reads

---

## 5. Task Families & Difficulty Calibration

### 5.1 Public Task Examples (31 tasks, 10 families)

| Family | Domain | Human Time | Key Feature |
|--------|--------|-----------|-------------|
| **Complex Payments** | Software Engineering | Hours | Two difficulty variants (full vs. payment_logic_only) |
| **Cowthello** | Machine Learning | 5-15 hours | Multi-criteria win rate scoring |
| **Clone Game** | Software Engineering | Hours | Exact behavior replication |
| **Clone Voice** | ML/Security | Hours | Audio quality metrics |
| **Local Research** | Research | Hours | Literature analysis |
| **Hypothesis Testing** | Reasoning | <1 hour | Efficiency-based scoring |
| **Crossword** | Reasoning | <1 hour | Constraint satisfaction |
| **MLAB** | ML Engineering | Days | 9 sequential daily challenges |

### 5.2 Difficulty Calibration Methods

- **Human expert baselines**: Each task has a difficulty estimate based on human completion time
- **Difficulty variants**: Same task family can expose easy/hard versions (e.g., `payment_logic_only` vs. `full`)
- **Task weighting**: In aggregate scoring, tasks are weighted by `1/√n` (n = family size) to prevent over-representation of large families
- **Expertise tags**: Tasks tagged with required domain (software_engineering, machine_learning, etc.)

### 5.3 Training-Restricted Tasks

Some tasks explicitly disallow training/optimization:
- Deduplicate Data
- Improve An LLM Agent
- Reversal Curse replication
- Worm development

---

## 6. Diagnostic Signal & Capability Probes

### 6.1 What "Diagnostic Signal" Means in METR's Framework

METR doesn't formally define "diagnostic signal" as a technical term, but their framework reveals what it means in practice:

- **Signal = information about capability boundaries**: Tasks are designed to reveal WHERE a model starts failing, not just whether it passes or fails
- **Time horizon as signal**: The logistic curve fitting (success probability vs. human task duration) produces a continuous signal of capability level
- **General vs. threat-specific**: METR splits work between:
  - **Red lines**: Hard thresholds where systems become unsafe (threat-specific)
  - **General metrics**: Continuous measures providing signal across capability scales (diagnostic)

### 6.2 Capability Probes vs. Regular Benchmarks

While METR doesn't use the exact term "capability probe," their framework distinguishes:

| Approach | Focus | Signal Type |
|----------|-------|-------------|
| **Regular benchmarks** | Pass/fail on specific tasks | Binary — model can/can't do X |
| **METR general evals** | How task-completion-time-horizon changes | Continuous — measures capability growth rate |
| **Elicitation protocols** | Post-training enhancement + fixable failure analysis | Potential — what model COULD do with better scaffolding |
| **Red-line evaluations** | Threat-specific capability thresholds | Binary threshold — is model dangerous? |

### 6.3 Elicitation as a Core Concept

METR's evaluation methodology includes **elicitation** — the process of post-training enhancement to extract maximum agent performance. This is critical because raw model capability ≠ agent capability. They balance:

- **Safety vs. cost**: Achievable by a small team within a month
- **Fixable failures**: Accounting for issues that better scaffolding would resolve
- **Contamination prevention**: Tasks created from scratch; only ~20 examples published publicly

Source: [METR Autonomy Evaluation Resources](https://evaluations.metr.org/)

---

## 7. Environment & Agent Interaction Model

### 7.1 Docker-Based Primary Machine

- Agent runs as unprivileged `agent` user (not root)
- Root processes can bind to localhost
- Container has dedicated filesystem (this IS the task state)
- Network configurable via permissions (`"full_internet"` or restricted)

### 7.2 Agent Interaction Protocol

The standard **deliberately avoids defining**:
- How agents are implemented
- Communication mechanism with tasks
- Safety/oversight for internet-enabled tasks

In METR's implementation:
- Agent runs in the same container with shell/Python access
- Agent receives instructions only from `get_instructions()`
- Agent indicates completion by submitting a string
- Agent cannot access root-owned files/processes

### 7.3 Auxiliary VMs

- `get_aux_vm_spec()` returns declarative VM specification
- Network-connected to primary machine
- Agent lacks default SSH access (must be explicitly granted)
- Use case: tasks incompatible with containerization (Kubernetes, escape challenges)

### 7.4 manifest.yaml (Resource Declaration)

```yaml
cpu: <number>
memory: <GB>
gpus:
  - <GPU spec>
```

---

## 8. Design Patterns for Diagnostic Tasks (METR-Compatible)

Based on METR's approach, here are patterns for designing diagnostic tasks:

### 8.1 Pattern: Difficulty Spectrum

```python
@staticmethod
def get_tasks() -> dict[str, Task]:
    return {
        "easy": Task(difficulty="easy", ...),
        "medium": Task(difficulty="medium", ...),
        "hard": Task(difficulty="hard", ...),
    }
```

Each variant should map to a known human completion time. The logistic curve fit needs data points across the difficulty spectrum.

### 8.2 Pattern: Multi-Criteria Scoring

```python
@staticmethod
def score(t: Task, submission: str) -> float:
    criteria = {
        "correctness": check_correctness(submission) * 0.5,
        "efficiency": check_efficiency(submission) * 0.3,
        "robustness": check_edge_cases(submission) * 0.2,
    }
    return sum(criteria.values())
```

### 8.3 Pattern: Intermediate Progress Tracking

```python
@staticmethod
def intermediate_score(taskSetupData, env) -> Score:
    # Check filesystem state without agent knowing
    milestones_hit = count_milestones(env.filesystem)
    return Score(milestones_hit / total_milestones)
```

### 8.4 Pattern: Training-Restricted Tasks

For tasks where you want to measure reasoning, not memorization:
- Explicitly state "do not train/optimize" in instructions
- Generate unique instances per run (different seeds, data)
- Score on process quality, not just output

---

## 9. MIRROR Spec-Level Reflection — Prior Art Check

### 9.1 MIRROR Framework Overview

**Paper**: "MIRROR: Multi-agent Intra- and Inter-Reflection for Optimized Reasoning in Tool Learning" (IJCAI 2025)
**Authors**: Zikang Guo, Benfeng Xu, Xiaorui Wang, Zhendong Mao

MIRROR is a multi-agent framework with three specialized agents:
- **Planner Agent**: Decomposes tasks into subtasks; uses intra-reflection to assess decomposition quality
- **Tool Agent**: Selects tools and parameters; uses intra-reflection to evaluate tool choices before execution
- **Answer Agent**: Synthesizes final answer; uses intra-reflection for quality self-assessment

Two types of reflection:
- **Intra-reflection**: Pre-execution self-assessment (each agent evaluates its own planned action before committing)
- **Inter-reflection**: Post-execution trajectory adjustment using Short-Term Memory (STM) and Long-Term Memory (LTM)

### 9.2 Does MIRROR Apply Reflection to Spec/Instruction Parsing?

**No.** MIRROR's reflection is entirely at the **execution level**, not the specification level:

- **Intra-reflection** assesses the quality of planned ACTIONS (decomposition completeness, tool/parameter selection, answer quality) — not the interpretation of the original task specification
- **Inter-reflection** learns from execution failures and adjusts future actions — but never re-interprets the original instructions
- The framework **assumes well-formed task specifications** and focuses on preventing tool-invocation errors

Specifically:
- The Planner's intra-reflection evaluates "decomposition's completeness, efficiency, coherence" — not specification ambiguity
- The Tool Agent's intra-reflection evaluates "tool/parameter selection against subtask requirements" — not whether the subtask was correctly derived from the specification
- No mechanism exists for detecting or resolving specification ambiguity

### 9.3 Ablation Evidence

Removing intra-reflection causes a **7.0% Pass Rate drop** (85.7% → 78.7%), confirming it helps execution quality but says nothing about specification interpretation. The Answer Agent's intra-reflection has the largest individual impact (drop to 79.4%).

### 9.4 Is There ANY Prior Work on Pre-Execution Specification Reflection?

Based on comprehensive search, the answer is: **very little, and nothing directly on spec-level reflection in agent harnesses.**

#### Closest Related Work:

1. **AMBIG-SWE (ICLR 2026)** — "Interactive Agents to Overcome Ambiguity"
   - Evaluates agents on *underspecified* variants of SWE-Bench
   - Tests three capabilities: (a) detecting missing info, (b) formulating clarifying questions, (c) using answers to improve outcomes
   - **Key finding**: Models struggle to distinguish well-specified from underspecified instructions, but when prompted to interact, they leverage clarifications effectively (up to 74% improvement)
   - This is the closest to "spec-level reflection" but it's an *evaluation framework*, not a reflection mechanism
   - Source: [arxiv.org/abs/2502.13069](https://arxiv.org/abs/2502.13069)

2. **Anthropic's Eval Demystification** — Notes that evaluation failure modes include "ambiguous task specs" and "grading bugs" — e.g., Opus 4.5 initially scored 42% on CORE-Bench until spec ambiguity issues were found. This frames spec ambiguity as a measurement problem, not an agent capability.

3. **Analysis → Implementation → Reflection (Scott Logic, 2025)** — A practical pattern where agents do a pre-execution analysis phase to "explore issues and create suitable harnesses," then a reflection phase to assess implementations. Closest to spec-level reasoning but focused on software engineering, not general agent frameworks.

4. **MIRROR-related baselines** (ReAct, Reflexion, DFSDT, Smurfs) — All perform post-execution reflection only. None apply pre-execution reflection to specification interpretation.

### 9.5 The Gap: Spec-Level Reflection in Agent Harnesses

**There is a clear gap in the literature.** No published work applies pre-execution reflection specifically to:
- Parsing task specifications for ambiguity before attempting execution
- Identifying underspecified requirements in agent task descriptions
- Proactively resolving specification ambiguity through self-reflection (vs. interactive clarification)

The closest works either:
- Evaluate agents' ability to detect ambiguity (AMBIG-SWE) without proposing a reflection mechanism
- Apply reflection to execution-level decisions (MIRROR, Reflexion) without touching specification interpretation
- Use interactive clarification (AMBIG-SWE) rather than self-reflection

**This represents a novel research direction**: applying pre-execution reflection specifically to task specification interpretation in agent harnesses, where the agent reasons about WHAT the spec means before reasoning about HOW to accomplish it.

### 9.6 Related Search Terms That Yielded Limited Results

- "specification reflection" + "agent" → Requirements engineering literature (NLP for ambiguity detection in software specs), not agent frameworks
- "ambiguity resolution" + "agent harness" → Almost no results
- "pre-execution reasoning" + "task specification" → AMBIG-SWE only
- "instruction interpretation" + "reflection" + "agent" → MIRROR-adjacent but no spec-level work

---

## 10. Summary for Task Design

### What to Use from METR's Format

1. **TaskFamily class** as the unit of task organization
2. **`get_tasks()` returning dict[str, Task]** for multiple difficulty variants
3. **`intermediate_score()`** for long-running tasks (not `score()`)
4. **Docker containers** as isolated execution environments
5. **Human baselines** for difficulty calibration
6. **Custom scoring logic** per task family (no universal rubric needed)

### What METR Doesn't Provide (Gaps for Our Design)

1. **No checkpoint/resume API** — state is just filesystem
2. **No built-in rubric format** — scoring is fully custom
3. **No specification-level reflection** — tasks assume well-formed instructions
4. **No structured partial credit** — just return a float 0.0-1.0
5. **No diagnostic signal formalism** — "signal" is an informal concept, not a schema field

### Key Sources

- [METR Task Standard (GitHub)](https://github.com/METR/task-standard)
- [METR Public Tasks](https://github.com/METR/public-tasks)
- [Measuring AI Ability to Complete Long Tasks](https://metr.org/blog/2025-03-19-measuring-ai-ability-to-complete-long-tasks/)
- [Portable Evaluation Tasks via METR Task Standard](https://metr.org/blog/2024-02-29-metr-task-standard/)
- [METR Autonomy Evaluation Resources](https://evaluations.metr.org/)
- [Update on General Capability Evaluations](https://metr.org/blog/2024-08-06-update-on-evaluations/)
- [MIRROR (IJCAI 2025)](https://arxiv.org/abs/2505.20670)
- [AMBIG-SWE (ICLR 2026)](https://arxiv.org/abs/2502.13069)
