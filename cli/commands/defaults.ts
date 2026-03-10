import { defineCommand } from "citty";
import { defaultsPath } from "../lib/paths";
import { getDefaults, writeJson, parseCliValue } from "../lib/config";
import { ok } from "../lib/fmt";

export default defineCommand({
  meta: { name: "defaults", description: "Get/set global defaults" },
  args: {
    key: { type: "positional", description: "Key to get/set", required: false },
    value: { type: "positional", description: "New value", required: false },
  },
  run({ args }) {
    const defaults = getDefaults();

    if (!args.key) {
      console.log(JSON.stringify(defaults, null, 2));
      return;
    }

    if (!args.value) {
      const val = defaults[args.key];
      console.log(typeof val === "object" ? JSON.stringify(val, null, 2) : String(val ?? "null"));
      return;
    }

    // Set
    defaults[args.key] = parseCliValue(args.value);
    writeJson(defaultsPath(), defaults);
    ok(`${args.key} → ${args.value}`);
  },
});
