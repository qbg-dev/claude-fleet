# README Conventions

Rules for writing READMEs that feel like infrastructure, not marketing.
Derived from studying man pages, SQLite, curl, tmux, ripgrep, Terraform, Kubernetes, and what makes AI tool docs feel like bullshit.

A good README has four parts:

```
1. IDENTITY      — What it does (1 sentence) + why it matters (1 sentence).
2. QUICK START   — One command to set up. Example output showing it worked.
3. REFERENCE     — Links to important files, related projects, deeper docs.
4. USAGE         — Man-page-spirit command reference. Dense, scannable, factual.
```

---

## Structure (rules 1–15)

1. **First sentence: what the tool does, under 15 words.** Name the category noun (runtime, framework, CLI). "tool — verb phrase" format. No adjectives.

2. **Second sentence: why it matters.** One sentence on the problem it solves or the motivation. This is the only place for "why" — everywhere else is "what" and "how."

3. **These two sentences are the entire identity section.** No third sentence. No paragraph. If you can't explain it in two sentences, you don't understand it yet.

4. **Quick start: one install command, one run command, expected output.** Three elements, in that order. The reader should see the tool working within 60 seconds of reading the README.

5. **Show example output or behavior, not just the command.** After the run command, show what the terminal prints, what the UI looks like, or what state changed. The reader needs to know "did it work?"

6. **Reference section: links to 4–6 important resources.** Seed template, architecture doc, API reference, plugin directory, related projects. One line each. This is a routing table, not prose.

7. **Usage section: every command on one line with a terse comment.** Scannable in 10 seconds. Format: `command <args>  # what it does`. Group by function, not alphabetically.

8. **Total README: 40–80 lines.** Shorter is better. If it exceeds 80 lines, you're documenting in the wrong file. The README is a lobby, not the building.

9. **No table of contents.** If you need one, the README is too long. Cut content instead.

10. **No Architecture section in README.** Architecture belongs in CLAUDE.md, ARCHITECTURE.md, or a dedicated doc. The README reader wants to use it, not understand its internals.

11. **No duplicate content.** If it exists in CLAUDE.md, `--help`, or a man page, don't copy it into README. Link to it.

12. **Sections in this order: Identity → Quick Start → Reference → Usage.** Never rearrange. The reader's questions come in this order: "what is it?" → "how do I start?" → "where do I learn more?" → "what commands exist?"

13. **Dependencies go inside Quick Start, not as a separate section.** "Requires: bun, tmux, git, claude" as a single line before the install command.

14. **License is a single line at the bottom or omitted entirely.** The LICENSE file exists. Don't make it a section.

15. **End the README at the Usage section.** No Contributing, no Acknowledgments, no Sponsors, no Changelog. Those belong in their own files.

---

## Tone (rules 16–35)

16. **Write for the person who already decided to use your tool.** They arrived via recommendation, search, or dependency. Don't sell. Inform.

17. **Write it like an internal doc for your own team.** Not "welcome to our platform" but "here's how this works."

18. **Imperative voice for descriptions.** "Display verbose output" not "This option causes the tool to display verbose output."

19. **No enthusiasm.** No exclamation points in technical prose. No "We're excited to announce." The README is a reference, not a blog post.

20. **No emoji.** Zero. Emoji signals blog post, not infrastructure.

21. **No corporate verbs.** Never use: leverage, synergize, empower, unlock, supercharge, revolutionize, seamlessly, game-changing, next-generation.

22. **No self-congratulatory language.** No "We're proud to present." No "Awesome" or "Super" in the name.

23. **No speed superlatives without benchmarks.** "Blazing fast" needs a linked benchmark with methodology, or don't say it.

24. **No "easy", "simple", or "lightweight" as standalone claims.** Quantify (binary size, dep count, line count) or drop the adjective.

25. **No "just" or "simply" in instructions.** These words erase complexity and make users feel stupid when things break.

26. **No "production-ready" without naming production users.** If nobody runs it in prod, don't claim it.

27. **No "zero configuration" if a config file exists.** "Sensible defaults" is the honest version.

28. **No "batteries included" without listing which batteries.** Specifics build trust; vague claims erode it.

29. **No future tense for unbuilt features.** If it doesn't exist today, put it in a roadmap file.

30. **Don't explain what your users already know.** If they're evaluating an agent orchestration tool, they know what agents are.

31. **Don't sell the category, sell the implementation.** "Workers run in tmux panes on git worktrees" beats "multi-agent AI orchestration framework."

32. **Name your opinions as facts.** "Workers never push — merger handles main." Unopinionated tools are unusable.

33. **State failure modes.** "Crash-loop protection: 3 restarts/hr max." This proves you've run it. Omitting failures signals you haven't.

34. **The strongest signal of quality is what you leave out.** tmux's 250-word README says more about confidence than a 5,000-word README with badges and GIFs.

35. **Treat the README as an API contract.** Everything stated is a promise. Don't list aspirational capabilities as features.

---

## What to include (rules 36–55)

36. **One "happy path" install command, prominent.** Alternatives go in a collapsible block or INSTALL.md.

37. **Show both input AND output for examples.** Command + what happens. The reader builds a mental model from expected results.

38. **First example must work with zero modifications in under 60 seconds.** No API keys, no databases, no external services.

39. **Show the file system tree if it helps explain the mental model.** Files are real. Architecture diagrams are aspirational.

40. **Troubleshooting: top 3 failures with exact fix commands.** This is the most useful content in any README. Most tools omit it.

41. **Show the data model (config JSON, state file), not the concept model.** Ground the reader in what's on disk.

42. **Sharp edges section: document the hours you lost.** If something is surprising or unintuitive, say so. Saves everyone time.

43. **Security reporting: one sentence, one link.** Never inline the full security policy.

44. **Dependency list: factual, minimal.** Name, minimum version, link. No prose.

45. **Supported platforms: flat list.** "Runs on macOS, Linux, WSL." Not a matrix with emoji checkmarks.

46. **Link to the canonical system description.** If a seed template, architecture doc, or design doc is the real source of truth, point to it in the first 10 lines.

47. **Link to the plugin/extension directory if one exists.** One line is enough.

48. **"For contributors" pointer to the dev reference.** CLAUDE.md, CONTRIBUTING.md, or ARCHITECTURE.md. One line.

49. **Use tables for structured information.** Commands, worker types, config files — these are tables, not prose.

50. **Use callout blocks ([!NOTE], [!WARNING]) for important caveats.** Visually distinct, scannable.

51. **Collapsible `<details>` for advanced content.** Platform-specific install, optional config, verbose examples.

52. **One architectural diagram maximum.** If it needs a paragraph to explain, it's a bad diagram — redesign or cut.

53. **If install requires multiple steps, number them.** Numbered sequences prevent "I did step 1 but nothing happened" confusion.

54. **CLI flags on one line after the command listing.** `Flags: --model, --effort, --json, -p <project>`. Not a separate section.

55. **Config resolution order in one line.** `Resolution: flag > worker config > defaults > hardcoded`. Saves a paragraph of prose.

---

## What to exclude (rules 56–80)

56. **No badges.** Or at most 2–3 (build, version, license). Never more than 5.

57. **No GIFs longer than 15 seconds.** Link to a video instead.

58. **No screenshots of UI.** They age instantly. Link to a demo.

59. **No more than 3 images total.** Each must earn its place with something text can't convey.

60. **No testimonials or quotes.**

61. **No customer logos.**

62. **No competitor comparison tables.** Let users draw their own conclusions.

63. **No FAQ in the README.** If main content doesn't communicate clearly, fix the content.

64. **No changelog in README.** That's CHANGELOG.md.

65. **No version/release announcements.** Tags, releases, changelogs exist.

66. **No sponsor logos above the first code example.**

67. **No full CLI reference.** That's `--help` output. Show top 8–10 commands, link to `--help`.

68. **No full config reference.** It goes stale within one release. Link to the config docs.

69. **No Contributing guidelines.** CONTRIBUTING.md exists for that.

70. **No full license text.** LICENSE file exists.

71. **No "Why use X?" section.** If they're reading the README, they have a reason.

72. **No feature lists longer than 6 items.** If you list 15, nothing feels important.

73. **No architecture tables or package breakdowns.** That's the dev reference, not the user entry point.

74. **No "What are agents/LLMs/containers?" explanations.** Your audience knows.

75. **No opening with problem statements.** "Have you ever struggled with..." — no. State what it does.

76. **No marketing paragraphs between code blocks.** Code → code. Prose → prose. Don't interleave.

77. **No "Developer Experience" as a listed feature.** Good DX is demonstrated by the README itself.

78. **No pre-1.0 "stable" claims.** If semver says 0.x, own it.

79. **No dual-audience README.** Pick users or contributors. Not both.

80. **No content that duplicates another file in the repo.** If CLAUDE.md has it, don't repeat it.

---

## Man-page spirit (rules 81–100)

81. **SYNOPSIS before prose.** Show the invocation pattern before explaining details.

82. **Angle brackets for required args, square brackets for optional.** `fleet create <name> "<mission>"` not `fleet create name mission`.

83. **Ellipsis for repeatable args.** `<file> ...` not "one or more files."

84. **Options grouped by function.** Core operations first, then modifiers, then output control.

85. **Each option: one line, one sentence.** `--json  Output as JSON.` Not a paragraph.

86. **Default behavior stated before variations.** "Outputs human-readable text. Use --json for machine-readable output."

87. **Exit codes documented if meaningful.** Table format: `0 = success, 1 = error, 2 = blocked`.

88. **Environment variables in VAR — Description format.** Not narrated prose.

89. **SEE ALSO: related tools and docs, alphabetically.** Max 5–7 items.

90. **Progressive disclosure.** README → CLAUDE.md → seed template → source code. Each level adds detail.

91. **Describe outcomes, not activation states.** `--force` = "Overwrite without prompting" not "Enables forced mode."

92. **One sentence per option.** If you need two, the option is too complex or you're over-explaining.

93. **No conditional clauses in one-liners.** Move "if output is a terminal" to the description body.

94. **Assume competence.** Don't explain what a terminal is, what git does, or how to open a file.

95. **Cross-reference, don't duplicate.** "See CLAUDE.md for architecture" not a copy of the architecture section.

96. **Version the README with the tool.** It reflects current state. History is in the changelog.

97. **Write the README last.** After the architecture doc, the install guide, the seed template. The README is the map that connects them.

98. **Every sentence must be either a fact or an instruction.** No opinions disguised as features, no aspirations disguised as capabilities.

99. **If you can say it in fewer words, do.** "Walks you through setup interactively" beats a paragraph listing what the setup wizard does.

100. **Read it aloud. If it sounds like a sales pitch, rewrite it. If it sounds like a man page, ship it.**
