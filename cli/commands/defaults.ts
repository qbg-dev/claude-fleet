import type { Command } from "commander";
import { defaultsPath } from "../lib/paths";
import { getDefaults, writeJsonLocked, parseCliValue } from "../lib/config";
import { ok } from "../lib/fmt";

export function register(parent: Command): void {
  parent
    .command("defaults [key] [value]")
    .description("Get/set global defaults")
    .action((key?: string, value?: string) => {
      const defaults = getDefaults();

      if (!key) {
        console.log(JSON.stringify(defaults, null, 2));
        return;
      }

      if (!value) {
        const val = defaults[key];
        console.log(typeof val === "object" ? JSON.stringify(val, null, 2) : String(val ?? "null"));
        return;
      }

      // Set
      defaults[key] = parseCliValue(value);
      writeJsonLocked(defaultsPath(), defaults);
      ok(`${key} → ${value}`);
    });
}
