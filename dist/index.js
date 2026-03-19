#!/usr/bin/env bun
// @bun
import { createRequire } from "node:module";
var __create = Object.create;
var __getProtoOf = Object.getPrototypeOf;
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __toESM = (mod, isNodeMode, target) => {
  target = mod != null ? __create(__getProtoOf(mod)) : {};
  const to = isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target;
  for (let key of __getOwnPropNames(mod))
    if (!__hasOwnProp.call(to, key))
      __defProp(to, key, {
        get: () => mod[key],
        enumerable: true
      });
  return to;
};
var __moduleCache = /* @__PURE__ */ new WeakMap;
var __toCommonJS = (from) => {
  var entry = __moduleCache.get(from), desc;
  if (entry)
    return entry;
  entry = __defProp({}, "__esModule", { value: true });
  if (from && typeof from === "object" || typeof from === "function")
    __getOwnPropNames(from).map((key) => !__hasOwnProp.call(entry, key) && __defProp(entry, key, {
      get: () => from[key],
      enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
    }));
  __moduleCache.set(from, entry);
  return entry;
};
var __commonJS = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: (newValue) => all[name] = () => newValue
    });
};
var __esm = (fn, res) => () => (fn && (res = fn(fn = 0)), res);
var __require = /* @__PURE__ */ createRequire(import.meta.url);

// node_modules/.bun/commander@14.0.3/node_modules/commander/lib/error.js
var require_error = __commonJS((exports) => {
  class CommanderError extends Error {
    constructor(exitCode, code, message) {
      super(message);
      Error.captureStackTrace(this, this.constructor);
      this.name = this.constructor.name;
      this.code = code;
      this.exitCode = exitCode;
      this.nestedError = undefined;
    }
  }

  class InvalidArgumentError extends CommanderError {
    constructor(message) {
      super(1, "commander.invalidArgument", message);
      Error.captureStackTrace(this, this.constructor);
      this.name = this.constructor.name;
    }
  }
  exports.CommanderError = CommanderError;
  exports.InvalidArgumentError = InvalidArgumentError;
});

// node_modules/.bun/commander@14.0.3/node_modules/commander/lib/argument.js
var require_argument = __commonJS((exports) => {
  var { InvalidArgumentError } = require_error();

  class Argument {
    constructor(name, description) {
      this.description = description || "";
      this.variadic = false;
      this.parseArg = undefined;
      this.defaultValue = undefined;
      this.defaultValueDescription = undefined;
      this.argChoices = undefined;
      switch (name[0]) {
        case "<":
          this.required = true;
          this._name = name.slice(1, -1);
          break;
        case "[":
          this.required = false;
          this._name = name.slice(1, -1);
          break;
        default:
          this.required = true;
          this._name = name;
          break;
      }
      if (this._name.endsWith("...")) {
        this.variadic = true;
        this._name = this._name.slice(0, -3);
      }
    }
    name() {
      return this._name;
    }
    _collectValue(value, previous) {
      if (previous === this.defaultValue || !Array.isArray(previous)) {
        return [value];
      }
      previous.push(value);
      return previous;
    }
    default(value, description) {
      this.defaultValue = value;
      this.defaultValueDescription = description;
      return this;
    }
    argParser(fn) {
      this.parseArg = fn;
      return this;
    }
    choices(values) {
      this.argChoices = values.slice();
      this.parseArg = (arg, previous) => {
        if (!this.argChoices.includes(arg)) {
          throw new InvalidArgumentError(`Allowed choices are ${this.argChoices.join(", ")}.`);
        }
        if (this.variadic) {
          return this._collectValue(arg, previous);
        }
        return arg;
      };
      return this;
    }
    argRequired() {
      this.required = true;
      return this;
    }
    argOptional() {
      this.required = false;
      return this;
    }
  }
  function humanReadableArgName(arg) {
    const nameOutput = arg.name() + (arg.variadic === true ? "..." : "");
    return arg.required ? "<" + nameOutput + ">" : "[" + nameOutput + "]";
  }
  exports.Argument = Argument;
  exports.humanReadableArgName = humanReadableArgName;
});

// node_modules/.bun/commander@14.0.3/node_modules/commander/lib/help.js
var require_help = __commonJS((exports) => {
  var { humanReadableArgName } = require_argument();

  class Help {
    constructor() {
      this.helpWidth = undefined;
      this.minWidthToWrap = 40;
      this.sortSubcommands = false;
      this.sortOptions = false;
      this.showGlobalOptions = false;
    }
    prepareContext(contextOptions) {
      this.helpWidth = this.helpWidth ?? contextOptions.helpWidth ?? 80;
    }
    visibleCommands(cmd) {
      const visibleCommands = cmd.commands.filter((cmd2) => !cmd2._hidden);
      const helpCommand = cmd._getHelpCommand();
      if (helpCommand && !helpCommand._hidden) {
        visibleCommands.push(helpCommand);
      }
      if (this.sortSubcommands) {
        visibleCommands.sort((a, b) => {
          return a.name().localeCompare(b.name());
        });
      }
      return visibleCommands;
    }
    compareOptions(a, b) {
      const getSortKey = (option) => {
        return option.short ? option.short.replace(/^-/, "") : option.long.replace(/^--/, "");
      };
      return getSortKey(a).localeCompare(getSortKey(b));
    }
    visibleOptions(cmd) {
      const visibleOptions = cmd.options.filter((option) => !option.hidden);
      const helpOption = cmd._getHelpOption();
      if (helpOption && !helpOption.hidden) {
        const removeShort = helpOption.short && cmd._findOption(helpOption.short);
        const removeLong = helpOption.long && cmd._findOption(helpOption.long);
        if (!removeShort && !removeLong) {
          visibleOptions.push(helpOption);
        } else if (helpOption.long && !removeLong) {
          visibleOptions.push(cmd.createOption(helpOption.long, helpOption.description));
        } else if (helpOption.short && !removeShort) {
          visibleOptions.push(cmd.createOption(helpOption.short, helpOption.description));
        }
      }
      if (this.sortOptions) {
        visibleOptions.sort(this.compareOptions);
      }
      return visibleOptions;
    }
    visibleGlobalOptions(cmd) {
      if (!this.showGlobalOptions)
        return [];
      const globalOptions = [];
      for (let ancestorCmd = cmd.parent;ancestorCmd; ancestorCmd = ancestorCmd.parent) {
        const visibleOptions = ancestorCmd.options.filter((option) => !option.hidden);
        globalOptions.push(...visibleOptions);
      }
      if (this.sortOptions) {
        globalOptions.sort(this.compareOptions);
      }
      return globalOptions;
    }
    visibleArguments(cmd) {
      if (cmd._argsDescription) {
        cmd.registeredArguments.forEach((argument) => {
          argument.description = argument.description || cmd._argsDescription[argument.name()] || "";
        });
      }
      if (cmd.registeredArguments.find((argument) => argument.description)) {
        return cmd.registeredArguments;
      }
      return [];
    }
    subcommandTerm(cmd) {
      const args = cmd.registeredArguments.map((arg) => humanReadableArgName(arg)).join(" ");
      return cmd._name + (cmd._aliases[0] ? "|" + cmd._aliases[0] : "") + (cmd.options.length ? " [options]" : "") + (args ? " " + args : "");
    }
    optionTerm(option) {
      return option.flags;
    }
    argumentTerm(argument) {
      return argument.name();
    }
    longestSubcommandTermLength(cmd, helper) {
      return helper.visibleCommands(cmd).reduce((max, command) => {
        return Math.max(max, this.displayWidth(helper.styleSubcommandTerm(helper.subcommandTerm(command))));
      }, 0);
    }
    longestOptionTermLength(cmd, helper) {
      return helper.visibleOptions(cmd).reduce((max, option) => {
        return Math.max(max, this.displayWidth(helper.styleOptionTerm(helper.optionTerm(option))));
      }, 0);
    }
    longestGlobalOptionTermLength(cmd, helper) {
      return helper.visibleGlobalOptions(cmd).reduce((max, option) => {
        return Math.max(max, this.displayWidth(helper.styleOptionTerm(helper.optionTerm(option))));
      }, 0);
    }
    longestArgumentTermLength(cmd, helper) {
      return helper.visibleArguments(cmd).reduce((max, argument) => {
        return Math.max(max, this.displayWidth(helper.styleArgumentTerm(helper.argumentTerm(argument))));
      }, 0);
    }
    commandUsage(cmd) {
      let cmdName = cmd._name;
      if (cmd._aliases[0]) {
        cmdName = cmdName + "|" + cmd._aliases[0];
      }
      let ancestorCmdNames = "";
      for (let ancestorCmd = cmd.parent;ancestorCmd; ancestorCmd = ancestorCmd.parent) {
        ancestorCmdNames = ancestorCmd.name() + " " + ancestorCmdNames;
      }
      return ancestorCmdNames + cmdName + " " + cmd.usage();
    }
    commandDescription(cmd) {
      return cmd.description();
    }
    subcommandDescription(cmd) {
      return cmd.summary() || cmd.description();
    }
    optionDescription(option) {
      const extraInfo = [];
      if (option.argChoices) {
        extraInfo.push(`choices: ${option.argChoices.map((choice) => JSON.stringify(choice)).join(", ")}`);
      }
      if (option.defaultValue !== undefined) {
        const showDefault = option.required || option.optional || option.isBoolean() && typeof option.defaultValue === "boolean";
        if (showDefault) {
          extraInfo.push(`default: ${option.defaultValueDescription || JSON.stringify(option.defaultValue)}`);
        }
      }
      if (option.presetArg !== undefined && option.optional) {
        extraInfo.push(`preset: ${JSON.stringify(option.presetArg)}`);
      }
      if (option.envVar !== undefined) {
        extraInfo.push(`env: ${option.envVar}`);
      }
      if (extraInfo.length > 0) {
        const extraDescription = `(${extraInfo.join(", ")})`;
        if (option.description) {
          return `${option.description} ${extraDescription}`;
        }
        return extraDescription;
      }
      return option.description;
    }
    argumentDescription(argument) {
      const extraInfo = [];
      if (argument.argChoices) {
        extraInfo.push(`choices: ${argument.argChoices.map((choice) => JSON.stringify(choice)).join(", ")}`);
      }
      if (argument.defaultValue !== undefined) {
        extraInfo.push(`default: ${argument.defaultValueDescription || JSON.stringify(argument.defaultValue)}`);
      }
      if (extraInfo.length > 0) {
        const extraDescription = `(${extraInfo.join(", ")})`;
        if (argument.description) {
          return `${argument.description} ${extraDescription}`;
        }
        return extraDescription;
      }
      return argument.description;
    }
    formatItemList(heading, items, helper) {
      if (items.length === 0)
        return [];
      return [helper.styleTitle(heading), ...items, ""];
    }
    groupItems(unsortedItems, visibleItems, getGroup) {
      const result = new Map;
      unsortedItems.forEach((item) => {
        const group = getGroup(item);
        if (!result.has(group))
          result.set(group, []);
      });
      visibleItems.forEach((item) => {
        const group = getGroup(item);
        if (!result.has(group)) {
          result.set(group, []);
        }
        result.get(group).push(item);
      });
      return result;
    }
    formatHelp(cmd, helper) {
      const termWidth = helper.padWidth(cmd, helper);
      const helpWidth = helper.helpWidth ?? 80;
      function callFormatItem(term, description) {
        return helper.formatItem(term, termWidth, description, helper);
      }
      let output = [
        `${helper.styleTitle("Usage:")} ${helper.styleUsage(helper.commandUsage(cmd))}`,
        ""
      ];
      const commandDescription = helper.commandDescription(cmd);
      if (commandDescription.length > 0) {
        output = output.concat([
          helper.boxWrap(helper.styleCommandDescription(commandDescription), helpWidth),
          ""
        ]);
      }
      const argumentList = helper.visibleArguments(cmd).map((argument) => {
        return callFormatItem(helper.styleArgumentTerm(helper.argumentTerm(argument)), helper.styleArgumentDescription(helper.argumentDescription(argument)));
      });
      output = output.concat(this.formatItemList("Arguments:", argumentList, helper));
      const optionGroups = this.groupItems(cmd.options, helper.visibleOptions(cmd), (option) => option.helpGroupHeading ?? "Options:");
      optionGroups.forEach((options, group) => {
        const optionList = options.map((option) => {
          return callFormatItem(helper.styleOptionTerm(helper.optionTerm(option)), helper.styleOptionDescription(helper.optionDescription(option)));
        });
        output = output.concat(this.formatItemList(group, optionList, helper));
      });
      if (helper.showGlobalOptions) {
        const globalOptionList = helper.visibleGlobalOptions(cmd).map((option) => {
          return callFormatItem(helper.styleOptionTerm(helper.optionTerm(option)), helper.styleOptionDescription(helper.optionDescription(option)));
        });
        output = output.concat(this.formatItemList("Global Options:", globalOptionList, helper));
      }
      const commandGroups = this.groupItems(cmd.commands, helper.visibleCommands(cmd), (sub) => sub.helpGroup() || "Commands:");
      commandGroups.forEach((commands, group) => {
        const commandList = commands.map((sub) => {
          return callFormatItem(helper.styleSubcommandTerm(helper.subcommandTerm(sub)), helper.styleSubcommandDescription(helper.subcommandDescription(sub)));
        });
        output = output.concat(this.formatItemList(group, commandList, helper));
      });
      return output.join(`
`);
    }
    displayWidth(str) {
      return stripColor(str).length;
    }
    styleTitle(str) {
      return str;
    }
    styleUsage(str) {
      return str.split(" ").map((word) => {
        if (word === "[options]")
          return this.styleOptionText(word);
        if (word === "[command]")
          return this.styleSubcommandText(word);
        if (word[0] === "[" || word[0] === "<")
          return this.styleArgumentText(word);
        return this.styleCommandText(word);
      }).join(" ");
    }
    styleCommandDescription(str) {
      return this.styleDescriptionText(str);
    }
    styleOptionDescription(str) {
      return this.styleDescriptionText(str);
    }
    styleSubcommandDescription(str) {
      return this.styleDescriptionText(str);
    }
    styleArgumentDescription(str) {
      return this.styleDescriptionText(str);
    }
    styleDescriptionText(str) {
      return str;
    }
    styleOptionTerm(str) {
      return this.styleOptionText(str);
    }
    styleSubcommandTerm(str) {
      return str.split(" ").map((word) => {
        if (word === "[options]")
          return this.styleOptionText(word);
        if (word[0] === "[" || word[0] === "<")
          return this.styleArgumentText(word);
        return this.styleSubcommandText(word);
      }).join(" ");
    }
    styleArgumentTerm(str) {
      return this.styleArgumentText(str);
    }
    styleOptionText(str) {
      return str;
    }
    styleArgumentText(str) {
      return str;
    }
    styleSubcommandText(str) {
      return str;
    }
    styleCommandText(str) {
      return str;
    }
    padWidth(cmd, helper) {
      return Math.max(helper.longestOptionTermLength(cmd, helper), helper.longestGlobalOptionTermLength(cmd, helper), helper.longestSubcommandTermLength(cmd, helper), helper.longestArgumentTermLength(cmd, helper));
    }
    preformatted(str) {
      return /\n[^\S\r\n]/.test(str);
    }
    formatItem(term, termWidth, description, helper) {
      const itemIndent = 2;
      const itemIndentStr = " ".repeat(itemIndent);
      if (!description)
        return itemIndentStr + term;
      const paddedTerm = term.padEnd(termWidth + term.length - helper.displayWidth(term));
      const spacerWidth = 2;
      const helpWidth = this.helpWidth ?? 80;
      const remainingWidth = helpWidth - termWidth - spacerWidth - itemIndent;
      let formattedDescription;
      if (remainingWidth < this.minWidthToWrap || helper.preformatted(description)) {
        formattedDescription = description;
      } else {
        const wrappedDescription = helper.boxWrap(description, remainingWidth);
        formattedDescription = wrappedDescription.replace(/\n/g, `
` + " ".repeat(termWidth + spacerWidth));
      }
      return itemIndentStr + paddedTerm + " ".repeat(spacerWidth) + formattedDescription.replace(/\n/g, `
${itemIndentStr}`);
    }
    boxWrap(str, width) {
      if (width < this.minWidthToWrap)
        return str;
      const rawLines = str.split(/\r\n|\n/);
      const chunkPattern = /[\s]*[^\s]+/g;
      const wrappedLines = [];
      rawLines.forEach((line) => {
        const chunks = line.match(chunkPattern);
        if (chunks === null) {
          wrappedLines.push("");
          return;
        }
        let sumChunks = [chunks.shift()];
        let sumWidth = this.displayWidth(sumChunks[0]);
        chunks.forEach((chunk) => {
          const visibleWidth = this.displayWidth(chunk);
          if (sumWidth + visibleWidth <= width) {
            sumChunks.push(chunk);
            sumWidth += visibleWidth;
            return;
          }
          wrappedLines.push(sumChunks.join(""));
          const nextChunk = chunk.trimStart();
          sumChunks = [nextChunk];
          sumWidth = this.displayWidth(nextChunk);
        });
        wrappedLines.push(sumChunks.join(""));
      });
      return wrappedLines.join(`
`);
    }
  }
  function stripColor(str) {
    const sgrPattern = /\x1b\[\d*(;\d*)*m/g;
    return str.replace(sgrPattern, "");
  }
  exports.Help = Help;
  exports.stripColor = stripColor;
});

// node_modules/.bun/commander@14.0.3/node_modules/commander/lib/option.js
var require_option = __commonJS((exports) => {
  var { InvalidArgumentError } = require_error();

  class Option {
    constructor(flags, description) {
      this.flags = flags;
      this.description = description || "";
      this.required = flags.includes("<");
      this.optional = flags.includes("[");
      this.variadic = /\w\.\.\.[>\]]$/.test(flags);
      this.mandatory = false;
      const optionFlags = splitOptionFlags(flags);
      this.short = optionFlags.shortFlag;
      this.long = optionFlags.longFlag;
      this.negate = false;
      if (this.long) {
        this.negate = this.long.startsWith("--no-");
      }
      this.defaultValue = undefined;
      this.defaultValueDescription = undefined;
      this.presetArg = undefined;
      this.envVar = undefined;
      this.parseArg = undefined;
      this.hidden = false;
      this.argChoices = undefined;
      this.conflictsWith = [];
      this.implied = undefined;
      this.helpGroupHeading = undefined;
    }
    default(value, description) {
      this.defaultValue = value;
      this.defaultValueDescription = description;
      return this;
    }
    preset(arg) {
      this.presetArg = arg;
      return this;
    }
    conflicts(names) {
      this.conflictsWith = this.conflictsWith.concat(names);
      return this;
    }
    implies(impliedOptionValues) {
      let newImplied = impliedOptionValues;
      if (typeof impliedOptionValues === "string") {
        newImplied = { [impliedOptionValues]: true };
      }
      this.implied = Object.assign(this.implied || {}, newImplied);
      return this;
    }
    env(name) {
      this.envVar = name;
      return this;
    }
    argParser(fn) {
      this.parseArg = fn;
      return this;
    }
    makeOptionMandatory(mandatory = true) {
      this.mandatory = !!mandatory;
      return this;
    }
    hideHelp(hide = true) {
      this.hidden = !!hide;
      return this;
    }
    _collectValue(value, previous) {
      if (previous === this.defaultValue || !Array.isArray(previous)) {
        return [value];
      }
      previous.push(value);
      return previous;
    }
    choices(values) {
      this.argChoices = values.slice();
      this.parseArg = (arg, previous) => {
        if (!this.argChoices.includes(arg)) {
          throw new InvalidArgumentError(`Allowed choices are ${this.argChoices.join(", ")}.`);
        }
        if (this.variadic) {
          return this._collectValue(arg, previous);
        }
        return arg;
      };
      return this;
    }
    name() {
      if (this.long) {
        return this.long.replace(/^--/, "");
      }
      return this.short.replace(/^-/, "");
    }
    attributeName() {
      if (this.negate) {
        return camelcase(this.name().replace(/^no-/, ""));
      }
      return camelcase(this.name());
    }
    helpGroup(heading) {
      this.helpGroupHeading = heading;
      return this;
    }
    is(arg) {
      return this.short === arg || this.long === arg;
    }
    isBoolean() {
      return !this.required && !this.optional && !this.negate;
    }
  }

  class DualOptions {
    constructor(options) {
      this.positiveOptions = new Map;
      this.negativeOptions = new Map;
      this.dualOptions = new Set;
      options.forEach((option) => {
        if (option.negate) {
          this.negativeOptions.set(option.attributeName(), option);
        } else {
          this.positiveOptions.set(option.attributeName(), option);
        }
      });
      this.negativeOptions.forEach((value, key) => {
        if (this.positiveOptions.has(key)) {
          this.dualOptions.add(key);
        }
      });
    }
    valueFromOption(value, option) {
      const optionKey = option.attributeName();
      if (!this.dualOptions.has(optionKey))
        return true;
      const preset = this.negativeOptions.get(optionKey).presetArg;
      const negativeValue = preset !== undefined ? preset : false;
      return option.negate === (negativeValue === value);
    }
  }
  function camelcase(str) {
    return str.split("-").reduce((str2, word) => {
      return str2 + word[0].toUpperCase() + word.slice(1);
    });
  }
  function splitOptionFlags(flags) {
    let shortFlag;
    let longFlag;
    const shortFlagExp = /^-[^-]$/;
    const longFlagExp = /^--[^-]/;
    const flagParts = flags.split(/[ |,]+/).concat("guard");
    if (shortFlagExp.test(flagParts[0]))
      shortFlag = flagParts.shift();
    if (longFlagExp.test(flagParts[0]))
      longFlag = flagParts.shift();
    if (!shortFlag && shortFlagExp.test(flagParts[0]))
      shortFlag = flagParts.shift();
    if (!shortFlag && longFlagExp.test(flagParts[0])) {
      shortFlag = longFlag;
      longFlag = flagParts.shift();
    }
    if (flagParts[0].startsWith("-")) {
      const unsupportedFlag = flagParts[0];
      const baseError = `option creation failed due to '${unsupportedFlag}' in option flags '${flags}'`;
      if (/^-[^-][^-]/.test(unsupportedFlag))
        throw new Error(`${baseError}
- a short flag is a single dash and a single character
  - either use a single dash and a single character (for a short flag)
  - or use a double dash for a long option (and can have two, like '--ws, --workspace')`);
      if (shortFlagExp.test(unsupportedFlag))
        throw new Error(`${baseError}
- too many short flags`);
      if (longFlagExp.test(unsupportedFlag))
        throw new Error(`${baseError}
- too many long flags`);
      throw new Error(`${baseError}
- unrecognised flag format`);
    }
    if (shortFlag === undefined && longFlag === undefined)
      throw new Error(`option creation failed due to no flags found in '${flags}'.`);
    return { shortFlag, longFlag };
  }
  exports.Option = Option;
  exports.DualOptions = DualOptions;
});

// node_modules/.bun/commander@14.0.3/node_modules/commander/lib/suggestSimilar.js
var require_suggestSimilar = __commonJS((exports) => {
  var maxDistance = 3;
  function editDistance(a, b) {
    if (Math.abs(a.length - b.length) > maxDistance)
      return Math.max(a.length, b.length);
    const d = [];
    for (let i = 0;i <= a.length; i++) {
      d[i] = [i];
    }
    for (let j = 0;j <= b.length; j++) {
      d[0][j] = j;
    }
    for (let j = 1;j <= b.length; j++) {
      for (let i = 1;i <= a.length; i++) {
        let cost = 1;
        if (a[i - 1] === b[j - 1]) {
          cost = 0;
        } else {
          cost = 1;
        }
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
          d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
        }
      }
    }
    return d[a.length][b.length];
  }
  function suggestSimilar(word, candidates) {
    if (!candidates || candidates.length === 0)
      return "";
    candidates = Array.from(new Set(candidates));
    const searchingOptions = word.startsWith("--");
    if (searchingOptions) {
      word = word.slice(2);
      candidates = candidates.map((candidate) => candidate.slice(2));
    }
    let similar = [];
    let bestDistance = maxDistance;
    const minSimilarity = 0.4;
    candidates.forEach((candidate) => {
      if (candidate.length <= 1)
        return;
      const distance = editDistance(word, candidate);
      const length = Math.max(word.length, candidate.length);
      const similarity = (length - distance) / length;
      if (similarity > minSimilarity) {
        if (distance < bestDistance) {
          bestDistance = distance;
          similar = [candidate];
        } else if (distance === bestDistance) {
          similar.push(candidate);
        }
      }
    });
    similar.sort((a, b) => a.localeCompare(b));
    if (searchingOptions) {
      similar = similar.map((candidate) => `--${candidate}`);
    }
    if (similar.length > 1) {
      return `
(Did you mean one of ${similar.join(", ")}?)`;
    }
    if (similar.length === 1) {
      return `
(Did you mean ${similar[0]}?)`;
    }
    return "";
  }
  exports.suggestSimilar = suggestSimilar;
});

// node_modules/.bun/commander@14.0.3/node_modules/commander/lib/command.js
var require_command = __commonJS((exports) => {
  var EventEmitter = __require("node:events").EventEmitter;
  var childProcess = __require("node:child_process");
  var path = __require("node:path");
  var fs = __require("node:fs");
  var process2 = __require("node:process");
  var { Argument, humanReadableArgName } = require_argument();
  var { CommanderError } = require_error();
  var { Help, stripColor } = require_help();
  var { Option, DualOptions } = require_option();
  var { suggestSimilar } = require_suggestSimilar();

  class Command extends EventEmitter {
    constructor(name) {
      super();
      this.commands = [];
      this.options = [];
      this.parent = null;
      this._allowUnknownOption = false;
      this._allowExcessArguments = false;
      this.registeredArguments = [];
      this._args = this.registeredArguments;
      this.args = [];
      this.rawArgs = [];
      this.processedArgs = [];
      this._scriptPath = null;
      this._name = name || "";
      this._optionValues = {};
      this._optionValueSources = {};
      this._storeOptionsAsProperties = false;
      this._actionHandler = null;
      this._executableHandler = false;
      this._executableFile = null;
      this._executableDir = null;
      this._defaultCommandName = null;
      this._exitCallback = null;
      this._aliases = [];
      this._combineFlagAndOptionalValue = true;
      this._description = "";
      this._summary = "";
      this._argsDescription = undefined;
      this._enablePositionalOptions = false;
      this._passThroughOptions = false;
      this._lifeCycleHooks = {};
      this._showHelpAfterError = false;
      this._showSuggestionAfterError = true;
      this._savedState = null;
      this._outputConfiguration = {
        writeOut: (str) => process2.stdout.write(str),
        writeErr: (str) => process2.stderr.write(str),
        outputError: (str, write) => write(str),
        getOutHelpWidth: () => process2.stdout.isTTY ? process2.stdout.columns : undefined,
        getErrHelpWidth: () => process2.stderr.isTTY ? process2.stderr.columns : undefined,
        getOutHasColors: () => useColor() ?? (process2.stdout.isTTY && process2.stdout.hasColors?.()),
        getErrHasColors: () => useColor() ?? (process2.stderr.isTTY && process2.stderr.hasColors?.()),
        stripColor: (str) => stripColor(str)
      };
      this._hidden = false;
      this._helpOption = undefined;
      this._addImplicitHelpCommand = undefined;
      this._helpCommand = undefined;
      this._helpConfiguration = {};
      this._helpGroupHeading = undefined;
      this._defaultCommandGroup = undefined;
      this._defaultOptionGroup = undefined;
    }
    copyInheritedSettings(sourceCommand) {
      this._outputConfiguration = sourceCommand._outputConfiguration;
      this._helpOption = sourceCommand._helpOption;
      this._helpCommand = sourceCommand._helpCommand;
      this._helpConfiguration = sourceCommand._helpConfiguration;
      this._exitCallback = sourceCommand._exitCallback;
      this._storeOptionsAsProperties = sourceCommand._storeOptionsAsProperties;
      this._combineFlagAndOptionalValue = sourceCommand._combineFlagAndOptionalValue;
      this._allowExcessArguments = sourceCommand._allowExcessArguments;
      this._enablePositionalOptions = sourceCommand._enablePositionalOptions;
      this._showHelpAfterError = sourceCommand._showHelpAfterError;
      this._showSuggestionAfterError = sourceCommand._showSuggestionAfterError;
      return this;
    }
    _getCommandAndAncestors() {
      const result = [];
      for (let command = this;command; command = command.parent) {
        result.push(command);
      }
      return result;
    }
    command(nameAndArgs, actionOptsOrExecDesc, execOpts) {
      let desc = actionOptsOrExecDesc;
      let opts = execOpts;
      if (typeof desc === "object" && desc !== null) {
        opts = desc;
        desc = null;
      }
      opts = opts || {};
      const [, name, args] = nameAndArgs.match(/([^ ]+) *(.*)/);
      const cmd = this.createCommand(name);
      if (desc) {
        cmd.description(desc);
        cmd._executableHandler = true;
      }
      if (opts.isDefault)
        this._defaultCommandName = cmd._name;
      cmd._hidden = !!(opts.noHelp || opts.hidden);
      cmd._executableFile = opts.executableFile || null;
      if (args)
        cmd.arguments(args);
      this._registerCommand(cmd);
      cmd.parent = this;
      cmd.copyInheritedSettings(this);
      if (desc)
        return this;
      return cmd;
    }
    createCommand(name) {
      return new Command(name);
    }
    createHelp() {
      return Object.assign(new Help, this.configureHelp());
    }
    configureHelp(configuration) {
      if (configuration === undefined)
        return this._helpConfiguration;
      this._helpConfiguration = configuration;
      return this;
    }
    configureOutput(configuration) {
      if (configuration === undefined)
        return this._outputConfiguration;
      this._outputConfiguration = {
        ...this._outputConfiguration,
        ...configuration
      };
      return this;
    }
    showHelpAfterError(displayHelp = true) {
      if (typeof displayHelp !== "string")
        displayHelp = !!displayHelp;
      this._showHelpAfterError = displayHelp;
      return this;
    }
    showSuggestionAfterError(displaySuggestion = true) {
      this._showSuggestionAfterError = !!displaySuggestion;
      return this;
    }
    addCommand(cmd, opts) {
      if (!cmd._name) {
        throw new Error(`Command passed to .addCommand() must have a name
- specify the name in Command constructor or using .name()`);
      }
      opts = opts || {};
      if (opts.isDefault)
        this._defaultCommandName = cmd._name;
      if (opts.noHelp || opts.hidden)
        cmd._hidden = true;
      this._registerCommand(cmd);
      cmd.parent = this;
      cmd._checkForBrokenPassThrough();
      return this;
    }
    createArgument(name, description) {
      return new Argument(name, description);
    }
    argument(name, description, parseArg, defaultValue) {
      const argument = this.createArgument(name, description);
      if (typeof parseArg === "function") {
        argument.default(defaultValue).argParser(parseArg);
      } else {
        argument.default(parseArg);
      }
      this.addArgument(argument);
      return this;
    }
    arguments(names) {
      names.trim().split(/ +/).forEach((detail) => {
        this.argument(detail);
      });
      return this;
    }
    addArgument(argument) {
      const previousArgument = this.registeredArguments.slice(-1)[0];
      if (previousArgument?.variadic) {
        throw new Error(`only the last argument can be variadic '${previousArgument.name()}'`);
      }
      if (argument.required && argument.defaultValue !== undefined && argument.parseArg === undefined) {
        throw new Error(`a default value for a required argument is never used: '${argument.name()}'`);
      }
      this.registeredArguments.push(argument);
      return this;
    }
    helpCommand(enableOrNameAndArgs, description) {
      if (typeof enableOrNameAndArgs === "boolean") {
        this._addImplicitHelpCommand = enableOrNameAndArgs;
        if (enableOrNameAndArgs && this._defaultCommandGroup) {
          this._initCommandGroup(this._getHelpCommand());
        }
        return this;
      }
      const nameAndArgs = enableOrNameAndArgs ?? "help [command]";
      const [, helpName, helpArgs] = nameAndArgs.match(/([^ ]+) *(.*)/);
      const helpDescription = description ?? "display help for command";
      const helpCommand = this.createCommand(helpName);
      helpCommand.helpOption(false);
      if (helpArgs)
        helpCommand.arguments(helpArgs);
      if (helpDescription)
        helpCommand.description(helpDescription);
      this._addImplicitHelpCommand = true;
      this._helpCommand = helpCommand;
      if (enableOrNameAndArgs || description)
        this._initCommandGroup(helpCommand);
      return this;
    }
    addHelpCommand(helpCommand, deprecatedDescription) {
      if (typeof helpCommand !== "object") {
        this.helpCommand(helpCommand, deprecatedDescription);
        return this;
      }
      this._addImplicitHelpCommand = true;
      this._helpCommand = helpCommand;
      this._initCommandGroup(helpCommand);
      return this;
    }
    _getHelpCommand() {
      const hasImplicitHelpCommand = this._addImplicitHelpCommand ?? (this.commands.length && !this._actionHandler && !this._findCommand("help"));
      if (hasImplicitHelpCommand) {
        if (this._helpCommand === undefined) {
          this.helpCommand(undefined, undefined);
        }
        return this._helpCommand;
      }
      return null;
    }
    hook(event, listener) {
      const allowedValues = ["preSubcommand", "preAction", "postAction"];
      if (!allowedValues.includes(event)) {
        throw new Error(`Unexpected value for event passed to hook : '${event}'.
Expecting one of '${allowedValues.join("', '")}'`);
      }
      if (this._lifeCycleHooks[event]) {
        this._lifeCycleHooks[event].push(listener);
      } else {
        this._lifeCycleHooks[event] = [listener];
      }
      return this;
    }
    exitOverride(fn) {
      if (fn) {
        this._exitCallback = fn;
      } else {
        this._exitCallback = (err) => {
          if (err.code !== "commander.executeSubCommandAsync") {
            throw err;
          } else {}
        };
      }
      return this;
    }
    _exit(exitCode, code, message) {
      if (this._exitCallback) {
        this._exitCallback(new CommanderError(exitCode, code, message));
      }
      process2.exit(exitCode);
    }
    action(fn) {
      const listener = (args) => {
        const expectedArgsCount = this.registeredArguments.length;
        const actionArgs = args.slice(0, expectedArgsCount);
        if (this._storeOptionsAsProperties) {
          actionArgs[expectedArgsCount] = this;
        } else {
          actionArgs[expectedArgsCount] = this.opts();
        }
        actionArgs.push(this);
        return fn.apply(this, actionArgs);
      };
      this._actionHandler = listener;
      return this;
    }
    createOption(flags, description) {
      return new Option(flags, description);
    }
    _callParseArg(target, value, previous, invalidArgumentMessage) {
      try {
        return target.parseArg(value, previous);
      } catch (err) {
        if (err.code === "commander.invalidArgument") {
          const message = `${invalidArgumentMessage} ${err.message}`;
          this.error(message, { exitCode: err.exitCode, code: err.code });
        }
        throw err;
      }
    }
    _registerOption(option) {
      const matchingOption = option.short && this._findOption(option.short) || option.long && this._findOption(option.long);
      if (matchingOption) {
        const matchingFlag = option.long && this._findOption(option.long) ? option.long : option.short;
        throw new Error(`Cannot add option '${option.flags}'${this._name && ` to command '${this._name}'`} due to conflicting flag '${matchingFlag}'
-  already used by option '${matchingOption.flags}'`);
      }
      this._initOptionGroup(option);
      this.options.push(option);
    }
    _registerCommand(command) {
      const knownBy = (cmd) => {
        return [cmd.name()].concat(cmd.aliases());
      };
      const alreadyUsed = knownBy(command).find((name) => this._findCommand(name));
      if (alreadyUsed) {
        const existingCmd = knownBy(this._findCommand(alreadyUsed)).join("|");
        const newCmd = knownBy(command).join("|");
        throw new Error(`cannot add command '${newCmd}' as already have command '${existingCmd}'`);
      }
      this._initCommandGroup(command);
      this.commands.push(command);
    }
    addOption(option) {
      this._registerOption(option);
      const oname = option.name();
      const name = option.attributeName();
      if (option.negate) {
        const positiveLongFlag = option.long.replace(/^--no-/, "--");
        if (!this._findOption(positiveLongFlag)) {
          this.setOptionValueWithSource(name, option.defaultValue === undefined ? true : option.defaultValue, "default");
        }
      } else if (option.defaultValue !== undefined) {
        this.setOptionValueWithSource(name, option.defaultValue, "default");
      }
      const handleOptionValue = (val, invalidValueMessage, valueSource) => {
        if (val == null && option.presetArg !== undefined) {
          val = option.presetArg;
        }
        const oldValue = this.getOptionValue(name);
        if (val !== null && option.parseArg) {
          val = this._callParseArg(option, val, oldValue, invalidValueMessage);
        } else if (val !== null && option.variadic) {
          val = option._collectValue(val, oldValue);
        }
        if (val == null) {
          if (option.negate) {
            val = false;
          } else if (option.isBoolean() || option.optional) {
            val = true;
          } else {
            val = "";
          }
        }
        this.setOptionValueWithSource(name, val, valueSource);
      };
      this.on("option:" + oname, (val) => {
        const invalidValueMessage = `error: option '${option.flags}' argument '${val}' is invalid.`;
        handleOptionValue(val, invalidValueMessage, "cli");
      });
      if (option.envVar) {
        this.on("optionEnv:" + oname, (val) => {
          const invalidValueMessage = `error: option '${option.flags}' value '${val}' from env '${option.envVar}' is invalid.`;
          handleOptionValue(val, invalidValueMessage, "env");
        });
      }
      return this;
    }
    _optionEx(config, flags, description, fn, defaultValue) {
      if (typeof flags === "object" && flags instanceof Option) {
        throw new Error("To add an Option object use addOption() instead of option() or requiredOption()");
      }
      const option = this.createOption(flags, description);
      option.makeOptionMandatory(!!config.mandatory);
      if (typeof fn === "function") {
        option.default(defaultValue).argParser(fn);
      } else if (fn instanceof RegExp) {
        const regex = fn;
        fn = (val, def) => {
          const m = regex.exec(val);
          return m ? m[0] : def;
        };
        option.default(defaultValue).argParser(fn);
      } else {
        option.default(fn);
      }
      return this.addOption(option);
    }
    option(flags, description, parseArg, defaultValue) {
      return this._optionEx({}, flags, description, parseArg, defaultValue);
    }
    requiredOption(flags, description, parseArg, defaultValue) {
      return this._optionEx({ mandatory: true }, flags, description, parseArg, defaultValue);
    }
    combineFlagAndOptionalValue(combine = true) {
      this._combineFlagAndOptionalValue = !!combine;
      return this;
    }
    allowUnknownOption(allowUnknown = true) {
      this._allowUnknownOption = !!allowUnknown;
      return this;
    }
    allowExcessArguments(allowExcess = true) {
      this._allowExcessArguments = !!allowExcess;
      return this;
    }
    enablePositionalOptions(positional = true) {
      this._enablePositionalOptions = !!positional;
      return this;
    }
    passThroughOptions(passThrough = true) {
      this._passThroughOptions = !!passThrough;
      this._checkForBrokenPassThrough();
      return this;
    }
    _checkForBrokenPassThrough() {
      if (this.parent && this._passThroughOptions && !this.parent._enablePositionalOptions) {
        throw new Error(`passThroughOptions cannot be used for '${this._name}' without turning on enablePositionalOptions for parent command(s)`);
      }
    }
    storeOptionsAsProperties(storeAsProperties = true) {
      if (this.options.length) {
        throw new Error("call .storeOptionsAsProperties() before adding options");
      }
      if (Object.keys(this._optionValues).length) {
        throw new Error("call .storeOptionsAsProperties() before setting option values");
      }
      this._storeOptionsAsProperties = !!storeAsProperties;
      return this;
    }
    getOptionValue(key) {
      if (this._storeOptionsAsProperties) {
        return this[key];
      }
      return this._optionValues[key];
    }
    setOptionValue(key, value) {
      return this.setOptionValueWithSource(key, value, undefined);
    }
    setOptionValueWithSource(key, value, source) {
      if (this._storeOptionsAsProperties) {
        this[key] = value;
      } else {
        this._optionValues[key] = value;
      }
      this._optionValueSources[key] = source;
      return this;
    }
    getOptionValueSource(key) {
      return this._optionValueSources[key];
    }
    getOptionValueSourceWithGlobals(key) {
      let source;
      this._getCommandAndAncestors().forEach((cmd) => {
        if (cmd.getOptionValueSource(key) !== undefined) {
          source = cmd.getOptionValueSource(key);
        }
      });
      return source;
    }
    _prepareUserArgs(argv, parseOptions) {
      if (argv !== undefined && !Array.isArray(argv)) {
        throw new Error("first parameter to parse must be array or undefined");
      }
      parseOptions = parseOptions || {};
      if (argv === undefined && parseOptions.from === undefined) {
        if (process2.versions?.electron) {
          parseOptions.from = "electron";
        }
        const execArgv = process2.execArgv ?? [];
        if (execArgv.includes("-e") || execArgv.includes("--eval") || execArgv.includes("-p") || execArgv.includes("--print")) {
          parseOptions.from = "eval";
        }
      }
      if (argv === undefined) {
        argv = process2.argv;
      }
      this.rawArgs = argv.slice();
      let userArgs;
      switch (parseOptions.from) {
        case undefined:
        case "node":
          this._scriptPath = argv[1];
          userArgs = argv.slice(2);
          break;
        case "electron":
          if (process2.defaultApp) {
            this._scriptPath = argv[1];
            userArgs = argv.slice(2);
          } else {
            userArgs = argv.slice(1);
          }
          break;
        case "user":
          userArgs = argv.slice(0);
          break;
        case "eval":
          userArgs = argv.slice(1);
          break;
        default:
          throw new Error(`unexpected parse option { from: '${parseOptions.from}' }`);
      }
      if (!this._name && this._scriptPath)
        this.nameFromFilename(this._scriptPath);
      this._name = this._name || "program";
      return userArgs;
    }
    parse(argv, parseOptions) {
      this._prepareForParse();
      const userArgs = this._prepareUserArgs(argv, parseOptions);
      this._parseCommand([], userArgs);
      return this;
    }
    async parseAsync(argv, parseOptions) {
      this._prepareForParse();
      const userArgs = this._prepareUserArgs(argv, parseOptions);
      await this._parseCommand([], userArgs);
      return this;
    }
    _prepareForParse() {
      if (this._savedState === null) {
        this.saveStateBeforeParse();
      } else {
        this.restoreStateBeforeParse();
      }
    }
    saveStateBeforeParse() {
      this._savedState = {
        _name: this._name,
        _optionValues: { ...this._optionValues },
        _optionValueSources: { ...this._optionValueSources }
      };
    }
    restoreStateBeforeParse() {
      if (this._storeOptionsAsProperties)
        throw new Error(`Can not call parse again when storeOptionsAsProperties is true.
- either make a new Command for each call to parse, or stop storing options as properties`);
      this._name = this._savedState._name;
      this._scriptPath = null;
      this.rawArgs = [];
      this._optionValues = { ...this._savedState._optionValues };
      this._optionValueSources = { ...this._savedState._optionValueSources };
      this.args = [];
      this.processedArgs = [];
    }
    _checkForMissingExecutable(executableFile, executableDir, subcommandName) {
      if (fs.existsSync(executableFile))
        return;
      const executableDirMessage = executableDir ? `searched for local subcommand relative to directory '${executableDir}'` : "no directory for search for local subcommand, use .executableDir() to supply a custom directory";
      const executableMissing = `'${executableFile}' does not exist
 - if '${subcommandName}' is not meant to be an executable command, remove description parameter from '.command()' and use '.description()' instead
 - if the default executable name is not suitable, use the executableFile option to supply a custom name or path
 - ${executableDirMessage}`;
      throw new Error(executableMissing);
    }
    _executeSubCommand(subcommand, args) {
      args = args.slice();
      let launchWithNode = false;
      const sourceExt = [".js", ".ts", ".tsx", ".mjs", ".cjs"];
      function findFile(baseDir, baseName) {
        const localBin = path.resolve(baseDir, baseName);
        if (fs.existsSync(localBin))
          return localBin;
        if (sourceExt.includes(path.extname(baseName)))
          return;
        const foundExt = sourceExt.find((ext) => fs.existsSync(`${localBin}${ext}`));
        if (foundExt)
          return `${localBin}${foundExt}`;
        return;
      }
      this._checkForMissingMandatoryOptions();
      this._checkForConflictingOptions();
      let executableFile = subcommand._executableFile || `${this._name}-${subcommand._name}`;
      let executableDir = this._executableDir || "";
      if (this._scriptPath) {
        let resolvedScriptPath;
        try {
          resolvedScriptPath = fs.realpathSync(this._scriptPath);
        } catch {
          resolvedScriptPath = this._scriptPath;
        }
        executableDir = path.resolve(path.dirname(resolvedScriptPath), executableDir);
      }
      if (executableDir) {
        let localFile = findFile(executableDir, executableFile);
        if (!localFile && !subcommand._executableFile && this._scriptPath) {
          const legacyName = path.basename(this._scriptPath, path.extname(this._scriptPath));
          if (legacyName !== this._name) {
            localFile = findFile(executableDir, `${legacyName}-${subcommand._name}`);
          }
        }
        executableFile = localFile || executableFile;
      }
      launchWithNode = sourceExt.includes(path.extname(executableFile));
      let proc;
      if (process2.platform !== "win32") {
        if (launchWithNode) {
          args.unshift(executableFile);
          args = incrementNodeInspectorPort(process2.execArgv).concat(args);
          proc = childProcess.spawn(process2.argv[0], args, { stdio: "inherit" });
        } else {
          proc = childProcess.spawn(executableFile, args, { stdio: "inherit" });
        }
      } else {
        this._checkForMissingExecutable(executableFile, executableDir, subcommand._name);
        args.unshift(executableFile);
        args = incrementNodeInspectorPort(process2.execArgv).concat(args);
        proc = childProcess.spawn(process2.execPath, args, { stdio: "inherit" });
      }
      if (!proc.killed) {
        const signals = ["SIGUSR1", "SIGUSR2", "SIGTERM", "SIGINT", "SIGHUP"];
        signals.forEach((signal) => {
          process2.on(signal, () => {
            if (proc.killed === false && proc.exitCode === null) {
              proc.kill(signal);
            }
          });
        });
      }
      const exitCallback = this._exitCallback;
      proc.on("close", (code) => {
        code = code ?? 1;
        if (!exitCallback) {
          process2.exit(code);
        } else {
          exitCallback(new CommanderError(code, "commander.executeSubCommandAsync", "(close)"));
        }
      });
      proc.on("error", (err) => {
        if (err.code === "ENOENT") {
          this._checkForMissingExecutable(executableFile, executableDir, subcommand._name);
        } else if (err.code === "EACCES") {
          throw new Error(`'${executableFile}' not executable`);
        }
        if (!exitCallback) {
          process2.exit(1);
        } else {
          const wrappedError = new CommanderError(1, "commander.executeSubCommandAsync", "(error)");
          wrappedError.nestedError = err;
          exitCallback(wrappedError);
        }
      });
      this.runningCommand = proc;
    }
    _dispatchSubcommand(commandName, operands, unknown) {
      const subCommand = this._findCommand(commandName);
      if (!subCommand)
        this.help({ error: true });
      subCommand._prepareForParse();
      let promiseChain;
      promiseChain = this._chainOrCallSubCommandHook(promiseChain, subCommand, "preSubcommand");
      promiseChain = this._chainOrCall(promiseChain, () => {
        if (subCommand._executableHandler) {
          this._executeSubCommand(subCommand, operands.concat(unknown));
        } else {
          return subCommand._parseCommand(operands, unknown);
        }
      });
      return promiseChain;
    }
    _dispatchHelpCommand(subcommandName) {
      if (!subcommandName) {
        this.help();
      }
      const subCommand = this._findCommand(subcommandName);
      if (subCommand && !subCommand._executableHandler) {
        subCommand.help();
      }
      return this._dispatchSubcommand(subcommandName, [], [this._getHelpOption()?.long ?? this._getHelpOption()?.short ?? "--help"]);
    }
    _checkNumberOfArguments() {
      this.registeredArguments.forEach((arg, i) => {
        if (arg.required && this.args[i] == null) {
          this.missingArgument(arg.name());
        }
      });
      if (this.registeredArguments.length > 0 && this.registeredArguments[this.registeredArguments.length - 1].variadic) {
        return;
      }
      if (this.args.length > this.registeredArguments.length) {
        this._excessArguments(this.args);
      }
    }
    _processArguments() {
      const myParseArg = (argument, value, previous) => {
        let parsedValue = value;
        if (value !== null && argument.parseArg) {
          const invalidValueMessage = `error: command-argument value '${value}' is invalid for argument '${argument.name()}'.`;
          parsedValue = this._callParseArg(argument, value, previous, invalidValueMessage);
        }
        return parsedValue;
      };
      this._checkNumberOfArguments();
      const processedArgs = [];
      this.registeredArguments.forEach((declaredArg, index) => {
        let value = declaredArg.defaultValue;
        if (declaredArg.variadic) {
          if (index < this.args.length) {
            value = this.args.slice(index);
            if (declaredArg.parseArg) {
              value = value.reduce((processed, v) => {
                return myParseArg(declaredArg, v, processed);
              }, declaredArg.defaultValue);
            }
          } else if (value === undefined) {
            value = [];
          }
        } else if (index < this.args.length) {
          value = this.args[index];
          if (declaredArg.parseArg) {
            value = myParseArg(declaredArg, value, declaredArg.defaultValue);
          }
        }
        processedArgs[index] = value;
      });
      this.processedArgs = processedArgs;
    }
    _chainOrCall(promise, fn) {
      if (promise?.then && typeof promise.then === "function") {
        return promise.then(() => fn());
      }
      return fn();
    }
    _chainOrCallHooks(promise, event) {
      let result = promise;
      const hooks = [];
      this._getCommandAndAncestors().reverse().filter((cmd) => cmd._lifeCycleHooks[event] !== undefined).forEach((hookedCommand) => {
        hookedCommand._lifeCycleHooks[event].forEach((callback) => {
          hooks.push({ hookedCommand, callback });
        });
      });
      if (event === "postAction") {
        hooks.reverse();
      }
      hooks.forEach((hookDetail) => {
        result = this._chainOrCall(result, () => {
          return hookDetail.callback(hookDetail.hookedCommand, this);
        });
      });
      return result;
    }
    _chainOrCallSubCommandHook(promise, subCommand, event) {
      let result = promise;
      if (this._lifeCycleHooks[event] !== undefined) {
        this._lifeCycleHooks[event].forEach((hook) => {
          result = this._chainOrCall(result, () => {
            return hook(this, subCommand);
          });
        });
      }
      return result;
    }
    _parseCommand(operands, unknown) {
      const parsed = this.parseOptions(unknown);
      this._parseOptionsEnv();
      this._parseOptionsImplied();
      operands = operands.concat(parsed.operands);
      unknown = parsed.unknown;
      this.args = operands.concat(unknown);
      if (operands && this._findCommand(operands[0])) {
        return this._dispatchSubcommand(operands[0], operands.slice(1), unknown);
      }
      if (this._getHelpCommand() && operands[0] === this._getHelpCommand().name()) {
        return this._dispatchHelpCommand(operands[1]);
      }
      if (this._defaultCommandName) {
        this._outputHelpIfRequested(unknown);
        return this._dispatchSubcommand(this._defaultCommandName, operands, unknown);
      }
      if (this.commands.length && this.args.length === 0 && !this._actionHandler && !this._defaultCommandName) {
        this.help({ error: true });
      }
      this._outputHelpIfRequested(parsed.unknown);
      this._checkForMissingMandatoryOptions();
      this._checkForConflictingOptions();
      const checkForUnknownOptions = () => {
        if (parsed.unknown.length > 0) {
          this.unknownOption(parsed.unknown[0]);
        }
      };
      const commandEvent = `command:${this.name()}`;
      if (this._actionHandler) {
        checkForUnknownOptions();
        this._processArguments();
        let promiseChain;
        promiseChain = this._chainOrCallHooks(promiseChain, "preAction");
        promiseChain = this._chainOrCall(promiseChain, () => this._actionHandler(this.processedArgs));
        if (this.parent) {
          promiseChain = this._chainOrCall(promiseChain, () => {
            this.parent.emit(commandEvent, operands, unknown);
          });
        }
        promiseChain = this._chainOrCallHooks(promiseChain, "postAction");
        return promiseChain;
      }
      if (this.parent?.listenerCount(commandEvent)) {
        checkForUnknownOptions();
        this._processArguments();
        this.parent.emit(commandEvent, operands, unknown);
      } else if (operands.length) {
        if (this._findCommand("*")) {
          return this._dispatchSubcommand("*", operands, unknown);
        }
        if (this.listenerCount("command:*")) {
          this.emit("command:*", operands, unknown);
        } else if (this.commands.length) {
          this.unknownCommand();
        } else {
          checkForUnknownOptions();
          this._processArguments();
        }
      } else if (this.commands.length) {
        checkForUnknownOptions();
        this.help({ error: true });
      } else {
        checkForUnknownOptions();
        this._processArguments();
      }
    }
    _findCommand(name) {
      if (!name)
        return;
      return this.commands.find((cmd) => cmd._name === name || cmd._aliases.includes(name));
    }
    _findOption(arg) {
      return this.options.find((option) => option.is(arg));
    }
    _checkForMissingMandatoryOptions() {
      this._getCommandAndAncestors().forEach((cmd) => {
        cmd.options.forEach((anOption) => {
          if (anOption.mandatory && cmd.getOptionValue(anOption.attributeName()) === undefined) {
            cmd.missingMandatoryOptionValue(anOption);
          }
        });
      });
    }
    _checkForConflictingLocalOptions() {
      const definedNonDefaultOptions = this.options.filter((option) => {
        const optionKey = option.attributeName();
        if (this.getOptionValue(optionKey) === undefined) {
          return false;
        }
        return this.getOptionValueSource(optionKey) !== "default";
      });
      const optionsWithConflicting = definedNonDefaultOptions.filter((option) => option.conflictsWith.length > 0);
      optionsWithConflicting.forEach((option) => {
        const conflictingAndDefined = definedNonDefaultOptions.find((defined) => option.conflictsWith.includes(defined.attributeName()));
        if (conflictingAndDefined) {
          this._conflictingOption(option, conflictingAndDefined);
        }
      });
    }
    _checkForConflictingOptions() {
      this._getCommandAndAncestors().forEach((cmd) => {
        cmd._checkForConflictingLocalOptions();
      });
    }
    parseOptions(args) {
      const operands = [];
      const unknown = [];
      let dest = operands;
      function maybeOption(arg) {
        return arg.length > 1 && arg[0] === "-";
      }
      const negativeNumberArg = (arg) => {
        if (!/^-(\d+|\d*\.\d+)(e[+-]?\d+)?$/.test(arg))
          return false;
        return !this._getCommandAndAncestors().some((cmd) => cmd.options.map((opt) => opt.short).some((short) => /^-\d$/.test(short)));
      };
      let activeVariadicOption = null;
      let activeGroup = null;
      let i = 0;
      while (i < args.length || activeGroup) {
        const arg = activeGroup ?? args[i++];
        activeGroup = null;
        if (arg === "--") {
          if (dest === unknown)
            dest.push(arg);
          dest.push(...args.slice(i));
          break;
        }
        if (activeVariadicOption && (!maybeOption(arg) || negativeNumberArg(arg))) {
          this.emit(`option:${activeVariadicOption.name()}`, arg);
          continue;
        }
        activeVariadicOption = null;
        if (maybeOption(arg)) {
          const option = this._findOption(arg);
          if (option) {
            if (option.required) {
              const value = args[i++];
              if (value === undefined)
                this.optionMissingArgument(option);
              this.emit(`option:${option.name()}`, value);
            } else if (option.optional) {
              let value = null;
              if (i < args.length && (!maybeOption(args[i]) || negativeNumberArg(args[i]))) {
                value = args[i++];
              }
              this.emit(`option:${option.name()}`, value);
            } else {
              this.emit(`option:${option.name()}`);
            }
            activeVariadicOption = option.variadic ? option : null;
            continue;
          }
        }
        if (arg.length > 2 && arg[0] === "-" && arg[1] !== "-") {
          const option = this._findOption(`-${arg[1]}`);
          if (option) {
            if (option.required || option.optional && this._combineFlagAndOptionalValue) {
              this.emit(`option:${option.name()}`, arg.slice(2));
            } else {
              this.emit(`option:${option.name()}`);
              activeGroup = `-${arg.slice(2)}`;
            }
            continue;
          }
        }
        if (/^--[^=]+=/.test(arg)) {
          const index = arg.indexOf("=");
          const option = this._findOption(arg.slice(0, index));
          if (option && (option.required || option.optional)) {
            this.emit(`option:${option.name()}`, arg.slice(index + 1));
            continue;
          }
        }
        if (dest === operands && maybeOption(arg) && !(this.commands.length === 0 && negativeNumberArg(arg))) {
          dest = unknown;
        }
        if ((this._enablePositionalOptions || this._passThroughOptions) && operands.length === 0 && unknown.length === 0) {
          if (this._findCommand(arg)) {
            operands.push(arg);
            unknown.push(...args.slice(i));
            break;
          } else if (this._getHelpCommand() && arg === this._getHelpCommand().name()) {
            operands.push(arg, ...args.slice(i));
            break;
          } else if (this._defaultCommandName) {
            unknown.push(arg, ...args.slice(i));
            break;
          }
        }
        if (this._passThroughOptions) {
          dest.push(arg, ...args.slice(i));
          break;
        }
        dest.push(arg);
      }
      return { operands, unknown };
    }
    opts() {
      if (this._storeOptionsAsProperties) {
        const result = {};
        const len = this.options.length;
        for (let i = 0;i < len; i++) {
          const key = this.options[i].attributeName();
          result[key] = key === this._versionOptionName ? this._version : this[key];
        }
        return result;
      }
      return this._optionValues;
    }
    optsWithGlobals() {
      return this._getCommandAndAncestors().reduce((combinedOptions, cmd) => Object.assign(combinedOptions, cmd.opts()), {});
    }
    error(message, errorOptions) {
      this._outputConfiguration.outputError(`${message}
`, this._outputConfiguration.writeErr);
      if (typeof this._showHelpAfterError === "string") {
        this._outputConfiguration.writeErr(`${this._showHelpAfterError}
`);
      } else if (this._showHelpAfterError) {
        this._outputConfiguration.writeErr(`
`);
        this.outputHelp({ error: true });
      }
      const config = errorOptions || {};
      const exitCode = config.exitCode || 1;
      const code = config.code || "commander.error";
      this._exit(exitCode, code, message);
    }
    _parseOptionsEnv() {
      this.options.forEach((option) => {
        if (option.envVar && option.envVar in process2.env) {
          const optionKey = option.attributeName();
          if (this.getOptionValue(optionKey) === undefined || ["default", "config", "env"].includes(this.getOptionValueSource(optionKey))) {
            if (option.required || option.optional) {
              this.emit(`optionEnv:${option.name()}`, process2.env[option.envVar]);
            } else {
              this.emit(`optionEnv:${option.name()}`);
            }
          }
        }
      });
    }
    _parseOptionsImplied() {
      const dualHelper = new DualOptions(this.options);
      const hasCustomOptionValue = (optionKey) => {
        return this.getOptionValue(optionKey) !== undefined && !["default", "implied"].includes(this.getOptionValueSource(optionKey));
      };
      this.options.filter((option) => option.implied !== undefined && hasCustomOptionValue(option.attributeName()) && dualHelper.valueFromOption(this.getOptionValue(option.attributeName()), option)).forEach((option) => {
        Object.keys(option.implied).filter((impliedKey) => !hasCustomOptionValue(impliedKey)).forEach((impliedKey) => {
          this.setOptionValueWithSource(impliedKey, option.implied[impliedKey], "implied");
        });
      });
    }
    missingArgument(name) {
      const message = `error: missing required argument '${name}'`;
      this.error(message, { code: "commander.missingArgument" });
    }
    optionMissingArgument(option) {
      const message = `error: option '${option.flags}' argument missing`;
      this.error(message, { code: "commander.optionMissingArgument" });
    }
    missingMandatoryOptionValue(option) {
      const message = `error: required option '${option.flags}' not specified`;
      this.error(message, { code: "commander.missingMandatoryOptionValue" });
    }
    _conflictingOption(option, conflictingOption) {
      const findBestOptionFromValue = (option2) => {
        const optionKey = option2.attributeName();
        const optionValue = this.getOptionValue(optionKey);
        const negativeOption = this.options.find((target) => target.negate && optionKey === target.attributeName());
        const positiveOption = this.options.find((target) => !target.negate && optionKey === target.attributeName());
        if (negativeOption && (negativeOption.presetArg === undefined && optionValue === false || negativeOption.presetArg !== undefined && optionValue === negativeOption.presetArg)) {
          return negativeOption;
        }
        return positiveOption || option2;
      };
      const getErrorMessage = (option2) => {
        const bestOption = findBestOptionFromValue(option2);
        const optionKey = bestOption.attributeName();
        const source = this.getOptionValueSource(optionKey);
        if (source === "env") {
          return `environment variable '${bestOption.envVar}'`;
        }
        return `option '${bestOption.flags}'`;
      };
      const message = `error: ${getErrorMessage(option)} cannot be used with ${getErrorMessage(conflictingOption)}`;
      this.error(message, { code: "commander.conflictingOption" });
    }
    unknownOption(flag) {
      if (this._allowUnknownOption)
        return;
      let suggestion = "";
      if (flag.startsWith("--") && this._showSuggestionAfterError) {
        let candidateFlags = [];
        let command = this;
        do {
          const moreFlags = command.createHelp().visibleOptions(command).filter((option) => option.long).map((option) => option.long);
          candidateFlags = candidateFlags.concat(moreFlags);
          command = command.parent;
        } while (command && !command._enablePositionalOptions);
        suggestion = suggestSimilar(flag, candidateFlags);
      }
      const message = `error: unknown option '${flag}'${suggestion}`;
      this.error(message, { code: "commander.unknownOption" });
    }
    _excessArguments(receivedArgs) {
      if (this._allowExcessArguments)
        return;
      const expected = this.registeredArguments.length;
      const s = expected === 1 ? "" : "s";
      const forSubcommand = this.parent ? ` for '${this.name()}'` : "";
      const message = `error: too many arguments${forSubcommand}. Expected ${expected} argument${s} but got ${receivedArgs.length}.`;
      this.error(message, { code: "commander.excessArguments" });
    }
    unknownCommand() {
      const unknownName = this.args[0];
      let suggestion = "";
      if (this._showSuggestionAfterError) {
        const candidateNames = [];
        this.createHelp().visibleCommands(this).forEach((command) => {
          candidateNames.push(command.name());
          if (command.alias())
            candidateNames.push(command.alias());
        });
        suggestion = suggestSimilar(unknownName, candidateNames);
      }
      const message = `error: unknown command '${unknownName}'${suggestion}`;
      this.error(message, { code: "commander.unknownCommand" });
    }
    version(str, flags, description) {
      if (str === undefined)
        return this._version;
      this._version = str;
      flags = flags || "-V, --version";
      description = description || "output the version number";
      const versionOption = this.createOption(flags, description);
      this._versionOptionName = versionOption.attributeName();
      this._registerOption(versionOption);
      this.on("option:" + versionOption.name(), () => {
        this._outputConfiguration.writeOut(`${str}
`);
        this._exit(0, "commander.version", str);
      });
      return this;
    }
    description(str, argsDescription) {
      if (str === undefined && argsDescription === undefined)
        return this._description;
      this._description = str;
      if (argsDescription) {
        this._argsDescription = argsDescription;
      }
      return this;
    }
    summary(str) {
      if (str === undefined)
        return this._summary;
      this._summary = str;
      return this;
    }
    alias(alias) {
      if (alias === undefined)
        return this._aliases[0];
      let command = this;
      if (this.commands.length !== 0 && this.commands[this.commands.length - 1]._executableHandler) {
        command = this.commands[this.commands.length - 1];
      }
      if (alias === command._name)
        throw new Error("Command alias can't be the same as its name");
      const matchingCommand = this.parent?._findCommand(alias);
      if (matchingCommand) {
        const existingCmd = [matchingCommand.name()].concat(matchingCommand.aliases()).join("|");
        throw new Error(`cannot add alias '${alias}' to command '${this.name()}' as already have command '${existingCmd}'`);
      }
      command._aliases.push(alias);
      return this;
    }
    aliases(aliases) {
      if (aliases === undefined)
        return this._aliases;
      aliases.forEach((alias) => this.alias(alias));
      return this;
    }
    usage(str) {
      if (str === undefined) {
        if (this._usage)
          return this._usage;
        const args = this.registeredArguments.map((arg) => {
          return humanReadableArgName(arg);
        });
        return [].concat(this.options.length || this._helpOption !== null ? "[options]" : [], this.commands.length ? "[command]" : [], this.registeredArguments.length ? args : []).join(" ");
      }
      this._usage = str;
      return this;
    }
    name(str) {
      if (str === undefined)
        return this._name;
      this._name = str;
      return this;
    }
    helpGroup(heading) {
      if (heading === undefined)
        return this._helpGroupHeading ?? "";
      this._helpGroupHeading = heading;
      return this;
    }
    commandsGroup(heading) {
      if (heading === undefined)
        return this._defaultCommandGroup ?? "";
      this._defaultCommandGroup = heading;
      return this;
    }
    optionsGroup(heading) {
      if (heading === undefined)
        return this._defaultOptionGroup ?? "";
      this._defaultOptionGroup = heading;
      return this;
    }
    _initOptionGroup(option) {
      if (this._defaultOptionGroup && !option.helpGroupHeading)
        option.helpGroup(this._defaultOptionGroup);
    }
    _initCommandGroup(cmd) {
      if (this._defaultCommandGroup && !cmd.helpGroup())
        cmd.helpGroup(this._defaultCommandGroup);
    }
    nameFromFilename(filename) {
      this._name = path.basename(filename, path.extname(filename));
      return this;
    }
    executableDir(path2) {
      if (path2 === undefined)
        return this._executableDir;
      this._executableDir = path2;
      return this;
    }
    helpInformation(contextOptions) {
      const helper = this.createHelp();
      const context = this._getOutputContext(contextOptions);
      helper.prepareContext({
        error: context.error,
        helpWidth: context.helpWidth,
        outputHasColors: context.hasColors
      });
      const text = helper.formatHelp(this, helper);
      if (context.hasColors)
        return text;
      return this._outputConfiguration.stripColor(text);
    }
    _getOutputContext(contextOptions) {
      contextOptions = contextOptions || {};
      const error = !!contextOptions.error;
      let baseWrite;
      let hasColors;
      let helpWidth;
      if (error) {
        baseWrite = (str) => this._outputConfiguration.writeErr(str);
        hasColors = this._outputConfiguration.getErrHasColors();
        helpWidth = this._outputConfiguration.getErrHelpWidth();
      } else {
        baseWrite = (str) => this._outputConfiguration.writeOut(str);
        hasColors = this._outputConfiguration.getOutHasColors();
        helpWidth = this._outputConfiguration.getOutHelpWidth();
      }
      const write = (str) => {
        if (!hasColors)
          str = this._outputConfiguration.stripColor(str);
        return baseWrite(str);
      };
      return { error, write, hasColors, helpWidth };
    }
    outputHelp(contextOptions) {
      let deprecatedCallback;
      if (typeof contextOptions === "function") {
        deprecatedCallback = contextOptions;
        contextOptions = undefined;
      }
      const outputContext = this._getOutputContext(contextOptions);
      const eventContext = {
        error: outputContext.error,
        write: outputContext.write,
        command: this
      };
      this._getCommandAndAncestors().reverse().forEach((command) => command.emit("beforeAllHelp", eventContext));
      this.emit("beforeHelp", eventContext);
      let helpInformation = this.helpInformation({ error: outputContext.error });
      if (deprecatedCallback) {
        helpInformation = deprecatedCallback(helpInformation);
        if (typeof helpInformation !== "string" && !Buffer.isBuffer(helpInformation)) {
          throw new Error("outputHelp callback must return a string or a Buffer");
        }
      }
      outputContext.write(helpInformation);
      if (this._getHelpOption()?.long) {
        this.emit(this._getHelpOption().long);
      }
      this.emit("afterHelp", eventContext);
      this._getCommandAndAncestors().forEach((command) => command.emit("afterAllHelp", eventContext));
    }
    helpOption(flags, description) {
      if (typeof flags === "boolean") {
        if (flags) {
          if (this._helpOption === null)
            this._helpOption = undefined;
          if (this._defaultOptionGroup) {
            this._initOptionGroup(this._getHelpOption());
          }
        } else {
          this._helpOption = null;
        }
        return this;
      }
      this._helpOption = this.createOption(flags ?? "-h, --help", description ?? "display help for command");
      if (flags || description)
        this._initOptionGroup(this._helpOption);
      return this;
    }
    _getHelpOption() {
      if (this._helpOption === undefined) {
        this.helpOption(undefined, undefined);
      }
      return this._helpOption;
    }
    addHelpOption(option) {
      this._helpOption = option;
      this._initOptionGroup(option);
      return this;
    }
    help(contextOptions) {
      this.outputHelp(contextOptions);
      let exitCode = Number(process2.exitCode ?? 0);
      if (exitCode === 0 && contextOptions && typeof contextOptions !== "function" && contextOptions.error) {
        exitCode = 1;
      }
      this._exit(exitCode, "commander.help", "(outputHelp)");
    }
    addHelpText(position, text) {
      const allowedValues = ["beforeAll", "before", "after", "afterAll"];
      if (!allowedValues.includes(position)) {
        throw new Error(`Unexpected value for position to addHelpText.
Expecting one of '${allowedValues.join("', '")}'`);
      }
      const helpEvent = `${position}Help`;
      this.on(helpEvent, (context) => {
        let helpStr;
        if (typeof text === "function") {
          helpStr = text({ error: context.error, command: context.command });
        } else {
          helpStr = text;
        }
        if (helpStr) {
          context.write(`${helpStr}
`);
        }
      });
      return this;
    }
    _outputHelpIfRequested(args) {
      const helpOption = this._getHelpOption();
      const helpRequested = helpOption && args.find((arg) => helpOption.is(arg));
      if (helpRequested) {
        this.outputHelp();
        this._exit(0, "commander.helpDisplayed", "(outputHelp)");
      }
    }
  }
  function incrementNodeInspectorPort(args) {
    return args.map((arg) => {
      if (!arg.startsWith("--inspect")) {
        return arg;
      }
      let debugOption;
      let debugHost = "127.0.0.1";
      let debugPort = "9229";
      let match;
      if ((match = arg.match(/^(--inspect(-brk)?)$/)) !== null) {
        debugOption = match[1];
      } else if ((match = arg.match(/^(--inspect(-brk|-port)?)=([^:]+)$/)) !== null) {
        debugOption = match[1];
        if (/^\d+$/.test(match[3])) {
          debugPort = match[3];
        } else {
          debugHost = match[3];
        }
      } else if ((match = arg.match(/^(--inspect(-brk|-port)?)=([^:]+):(\d+)$/)) !== null) {
        debugOption = match[1];
        debugHost = match[3];
        debugPort = match[4];
      }
      if (debugOption && debugPort !== "0") {
        return `${debugOption}=${debugHost}:${parseInt(debugPort) + 1}`;
      }
      return arg;
    });
  }
  function useColor() {
    if (process2.env.NO_COLOR || process2.env.FORCE_COLOR === "0" || process2.env.FORCE_COLOR === "false")
      return false;
    if (process2.env.FORCE_COLOR || process2.env.CLICOLOR_FORCE !== undefined)
      return true;
    return;
  }
  exports.Command = Command;
  exports.useColor = useColor;
});

// node_modules/.bun/commander@14.0.3/node_modules/commander/index.js
var require_commander = __commonJS((exports) => {
  var { Argument } = require_argument();
  var { Command } = require_command();
  var { CommanderError, InvalidArgumentError } = require_error();
  var { Help } = require_help();
  var { Option } = require_option();
  exports.program = new Command;
  exports.createCommand = (name) => new Command(name);
  exports.createOption = (flags, description) => new Option(flags, description);
  exports.createArgument = (name, description) => new Argument(name, description);
  exports.Command = Command;
  exports.Option = Option;
  exports.Argument = Argument;
  exports.Help = Help;
  exports.CommanderError = CommanderError;
  exports.InvalidArgumentError = InvalidArgumentError;
  exports.InvalidOptionArgumentError = InvalidArgumentError;
});

// node_modules/.bun/commander@14.0.3/node_modules/commander/esm.mjs
var import__, program, createCommand, createArgument, createOption, CommanderError, InvalidArgumentError, InvalidOptionArgumentError, Command, Argument, Option, Help;
var init_esm = __esm(() => {
  import__ = __toESM(require_commander(), 1);
  ({
    program,
    createCommand,
    createArgument,
    createOption,
    CommanderError,
    InvalidArgumentError,
    InvalidOptionArgumentError,
    Command,
    Argument,
    Option,
    Help
  } = import__.default);
});

// node_modules/.bun/chalk@5.6.2/node_modules/chalk/source/vendor/ansi-styles/index.js
function assembleStyles() {
  const codes = new Map;
  for (const [groupName, group] of Object.entries(styles)) {
    for (const [styleName, style] of Object.entries(group)) {
      styles[styleName] = {
        open: `\x1B[${style[0]}m`,
        close: `\x1B[${style[1]}m`
      };
      group[styleName] = styles[styleName];
      codes.set(style[0], style[1]);
    }
    Object.defineProperty(styles, groupName, {
      value: group,
      enumerable: false
    });
  }
  Object.defineProperty(styles, "codes", {
    value: codes,
    enumerable: false
  });
  styles.color.close = "\x1B[39m";
  styles.bgColor.close = "\x1B[49m";
  styles.color.ansi = wrapAnsi16();
  styles.color.ansi256 = wrapAnsi256();
  styles.color.ansi16m = wrapAnsi16m();
  styles.bgColor.ansi = wrapAnsi16(ANSI_BACKGROUND_OFFSET);
  styles.bgColor.ansi256 = wrapAnsi256(ANSI_BACKGROUND_OFFSET);
  styles.bgColor.ansi16m = wrapAnsi16m(ANSI_BACKGROUND_OFFSET);
  Object.defineProperties(styles, {
    rgbToAnsi256: {
      value(red, green, blue) {
        if (red === green && green === blue) {
          if (red < 8) {
            return 16;
          }
          if (red > 248) {
            return 231;
          }
          return Math.round((red - 8) / 247 * 24) + 232;
        }
        return 16 + 36 * Math.round(red / 255 * 5) + 6 * Math.round(green / 255 * 5) + Math.round(blue / 255 * 5);
      },
      enumerable: false
    },
    hexToRgb: {
      value(hex) {
        const matches = /[a-f\d]{6}|[a-f\d]{3}/i.exec(hex.toString(16));
        if (!matches) {
          return [0, 0, 0];
        }
        let [colorString] = matches;
        if (colorString.length === 3) {
          colorString = [...colorString].map((character) => character + character).join("");
        }
        const integer = Number.parseInt(colorString, 16);
        return [
          integer >> 16 & 255,
          integer >> 8 & 255,
          integer & 255
        ];
      },
      enumerable: false
    },
    hexToAnsi256: {
      value: (hex) => styles.rgbToAnsi256(...styles.hexToRgb(hex)),
      enumerable: false
    },
    ansi256ToAnsi: {
      value(code) {
        if (code < 8) {
          return 30 + code;
        }
        if (code < 16) {
          return 90 + (code - 8);
        }
        let red;
        let green;
        let blue;
        if (code >= 232) {
          red = ((code - 232) * 10 + 8) / 255;
          green = red;
          blue = red;
        } else {
          code -= 16;
          const remainder = code % 36;
          red = Math.floor(code / 36) / 5;
          green = Math.floor(remainder / 6) / 5;
          blue = remainder % 6 / 5;
        }
        const value = Math.max(red, green, blue) * 2;
        if (value === 0) {
          return 30;
        }
        let result = 30 + (Math.round(blue) << 2 | Math.round(green) << 1 | Math.round(red));
        if (value === 2) {
          result += 60;
        }
        return result;
      },
      enumerable: false
    },
    rgbToAnsi: {
      value: (red, green, blue) => styles.ansi256ToAnsi(styles.rgbToAnsi256(red, green, blue)),
      enumerable: false
    },
    hexToAnsi: {
      value: (hex) => styles.ansi256ToAnsi(styles.hexToAnsi256(hex)),
      enumerable: false
    }
  });
  return styles;
}
var ANSI_BACKGROUND_OFFSET = 10, wrapAnsi16 = (offset = 0) => (code) => `\x1B[${code + offset}m`, wrapAnsi256 = (offset = 0) => (code) => `\x1B[${38 + offset};5;${code}m`, wrapAnsi16m = (offset = 0) => (red, green, blue) => `\x1B[${38 + offset};2;${red};${green};${blue}m`, styles, modifierNames, foregroundColorNames, backgroundColorNames, colorNames, ansiStyles, ansi_styles_default;
var init_ansi_styles = __esm(() => {
  styles = {
    modifier: {
      reset: [0, 0],
      bold: [1, 22],
      dim: [2, 22],
      italic: [3, 23],
      underline: [4, 24],
      overline: [53, 55],
      inverse: [7, 27],
      hidden: [8, 28],
      strikethrough: [9, 29]
    },
    color: {
      black: [30, 39],
      red: [31, 39],
      green: [32, 39],
      yellow: [33, 39],
      blue: [34, 39],
      magenta: [35, 39],
      cyan: [36, 39],
      white: [37, 39],
      blackBright: [90, 39],
      gray: [90, 39],
      grey: [90, 39],
      redBright: [91, 39],
      greenBright: [92, 39],
      yellowBright: [93, 39],
      blueBright: [94, 39],
      magentaBright: [95, 39],
      cyanBright: [96, 39],
      whiteBright: [97, 39]
    },
    bgColor: {
      bgBlack: [40, 49],
      bgRed: [41, 49],
      bgGreen: [42, 49],
      bgYellow: [43, 49],
      bgBlue: [44, 49],
      bgMagenta: [45, 49],
      bgCyan: [46, 49],
      bgWhite: [47, 49],
      bgBlackBright: [100, 49],
      bgGray: [100, 49],
      bgGrey: [100, 49],
      bgRedBright: [101, 49],
      bgGreenBright: [102, 49],
      bgYellowBright: [103, 49],
      bgBlueBright: [104, 49],
      bgMagentaBright: [105, 49],
      bgCyanBright: [106, 49],
      bgWhiteBright: [107, 49]
    }
  };
  modifierNames = Object.keys(styles.modifier);
  foregroundColorNames = Object.keys(styles.color);
  backgroundColorNames = Object.keys(styles.bgColor);
  colorNames = [...foregroundColorNames, ...backgroundColorNames];
  ansiStyles = assembleStyles();
  ansi_styles_default = ansiStyles;
});

// node_modules/.bun/chalk@5.6.2/node_modules/chalk/source/vendor/supports-color/index.js
import process2 from "node:process";
import os from "node:os";
import tty from "node:tty";
function hasFlag(flag, argv = globalThis.Deno ? globalThis.Deno.args : process2.argv) {
  const prefix = flag.startsWith("-") ? "" : flag.length === 1 ? "-" : "--";
  const position = argv.indexOf(prefix + flag);
  const terminatorPosition = argv.indexOf("--");
  return position !== -1 && (terminatorPosition === -1 || position < terminatorPosition);
}
function envForceColor() {
  if ("FORCE_COLOR" in env) {
    if (env.FORCE_COLOR === "true") {
      return 1;
    }
    if (env.FORCE_COLOR === "false") {
      return 0;
    }
    return env.FORCE_COLOR.length === 0 ? 1 : Math.min(Number.parseInt(env.FORCE_COLOR, 10), 3);
  }
}
function translateLevel(level) {
  if (level === 0) {
    return false;
  }
  return {
    level,
    hasBasic: true,
    has256: level >= 2,
    has16m: level >= 3
  };
}
function _supportsColor(haveStream, { streamIsTTY, sniffFlags = true } = {}) {
  const noFlagForceColor = envForceColor();
  if (noFlagForceColor !== undefined) {
    flagForceColor = noFlagForceColor;
  }
  const forceColor = sniffFlags ? flagForceColor : noFlagForceColor;
  if (forceColor === 0) {
    return 0;
  }
  if (sniffFlags) {
    if (hasFlag("color=16m") || hasFlag("color=full") || hasFlag("color=truecolor")) {
      return 3;
    }
    if (hasFlag("color=256")) {
      return 2;
    }
  }
  if ("TF_BUILD" in env && "AGENT_NAME" in env) {
    return 1;
  }
  if (haveStream && !streamIsTTY && forceColor === undefined) {
    return 0;
  }
  const min = forceColor || 0;
  if (env.TERM === "dumb") {
    return min;
  }
  if (process2.platform === "win32") {
    const osRelease = os.release().split(".");
    if (Number(osRelease[0]) >= 10 && Number(osRelease[2]) >= 10586) {
      return Number(osRelease[2]) >= 14931 ? 3 : 2;
    }
    return 1;
  }
  if ("CI" in env) {
    if (["GITHUB_ACTIONS", "GITEA_ACTIONS", "CIRCLECI"].some((key) => (key in env))) {
      return 3;
    }
    if (["TRAVIS", "APPVEYOR", "GITLAB_CI", "BUILDKITE", "DRONE"].some((sign) => (sign in env)) || env.CI_NAME === "codeship") {
      return 1;
    }
    return min;
  }
  if ("TEAMCITY_VERSION" in env) {
    return /^(9\.(0*[1-9]\d*)\.|\d{2,}\.)/.test(env.TEAMCITY_VERSION) ? 1 : 0;
  }
  if (env.COLORTERM === "truecolor") {
    return 3;
  }
  if (env.TERM === "xterm-kitty") {
    return 3;
  }
  if (env.TERM === "xterm-ghostty") {
    return 3;
  }
  if (env.TERM === "wezterm") {
    return 3;
  }
  if ("TERM_PROGRAM" in env) {
    const version = Number.parseInt((env.TERM_PROGRAM_VERSION || "").split(".")[0], 10);
    switch (env.TERM_PROGRAM) {
      case "iTerm.app": {
        return version >= 3 ? 3 : 2;
      }
      case "Apple_Terminal": {
        return 2;
      }
    }
  }
  if (/-256(color)?$/i.test(env.TERM)) {
    return 2;
  }
  if (/^screen|^xterm|^vt100|^vt220|^rxvt|color|ansi|cygwin|linux/i.test(env.TERM)) {
    return 1;
  }
  if ("COLORTERM" in env) {
    return 1;
  }
  return min;
}
function createSupportsColor(stream, options = {}) {
  const level = _supportsColor(stream, {
    streamIsTTY: stream && stream.isTTY,
    ...options
  });
  return translateLevel(level);
}
var env, flagForceColor, supportsColor, supports_color_default;
var init_supports_color = __esm(() => {
  ({ env } = process2);
  if (hasFlag("no-color") || hasFlag("no-colors") || hasFlag("color=false") || hasFlag("color=never")) {
    flagForceColor = 0;
  } else if (hasFlag("color") || hasFlag("colors") || hasFlag("color=true") || hasFlag("color=always")) {
    flagForceColor = 1;
  }
  supportsColor = {
    stdout: createSupportsColor({ isTTY: tty.isatty(1) }),
    stderr: createSupportsColor({ isTTY: tty.isatty(2) })
  };
  supports_color_default = supportsColor;
});

// node_modules/.bun/chalk@5.6.2/node_modules/chalk/source/utilities.js
function stringReplaceAll(string, substring, replacer) {
  let index = string.indexOf(substring);
  if (index === -1) {
    return string;
  }
  const substringLength = substring.length;
  let endIndex = 0;
  let returnValue = "";
  do {
    returnValue += string.slice(endIndex, index) + substring + replacer;
    endIndex = index + substringLength;
    index = string.indexOf(substring, endIndex);
  } while (index !== -1);
  returnValue += string.slice(endIndex);
  return returnValue;
}
function stringEncaseCRLFWithFirstIndex(string, prefix, postfix, index) {
  let endIndex = 0;
  let returnValue = "";
  do {
    const gotCR = string[index - 1] === "\r";
    returnValue += string.slice(endIndex, gotCR ? index - 1 : index) + prefix + (gotCR ? `\r
` : `
`) + postfix;
    endIndex = index + 1;
    index = string.indexOf(`
`, endIndex);
  } while (index !== -1);
  returnValue += string.slice(endIndex);
  return returnValue;
}

// node_modules/.bun/chalk@5.6.2/node_modules/chalk/source/index.js
function createChalk(options) {
  return chalkFactory(options);
}
var stdoutColor, stderrColor, GENERATOR, STYLER, IS_EMPTY, levelMapping, styles2, applyOptions = (object, options = {}) => {
  if (options.level && !(Number.isInteger(options.level) && options.level >= 0 && options.level <= 3)) {
    throw new Error("The `level` option should be an integer from 0 to 3");
  }
  const colorLevel = stdoutColor ? stdoutColor.level : 0;
  object.level = options.level === undefined ? colorLevel : options.level;
}, chalkFactory = (options) => {
  const chalk = (...strings) => strings.join(" ");
  applyOptions(chalk, options);
  Object.setPrototypeOf(chalk, createChalk.prototype);
  return chalk;
}, getModelAnsi = (model, level, type, ...arguments_) => {
  if (model === "rgb") {
    if (level === "ansi16m") {
      return ansi_styles_default[type].ansi16m(...arguments_);
    }
    if (level === "ansi256") {
      return ansi_styles_default[type].ansi256(ansi_styles_default.rgbToAnsi256(...arguments_));
    }
    return ansi_styles_default[type].ansi(ansi_styles_default.rgbToAnsi(...arguments_));
  }
  if (model === "hex") {
    return getModelAnsi("rgb", level, type, ...ansi_styles_default.hexToRgb(...arguments_));
  }
  return ansi_styles_default[type][model](...arguments_);
}, usedModels, proto, createStyler = (open, close, parent) => {
  let openAll;
  let closeAll;
  if (parent === undefined) {
    openAll = open;
    closeAll = close;
  } else {
    openAll = parent.openAll + open;
    closeAll = close + parent.closeAll;
  }
  return {
    open,
    close,
    openAll,
    closeAll,
    parent
  };
}, createBuilder = (self, _styler, _isEmpty) => {
  const builder = (...arguments_) => applyStyle(builder, arguments_.length === 1 ? "" + arguments_[0] : arguments_.join(" "));
  Object.setPrototypeOf(builder, proto);
  builder[GENERATOR] = self;
  builder[STYLER] = _styler;
  builder[IS_EMPTY] = _isEmpty;
  return builder;
}, applyStyle = (self, string) => {
  if (self.level <= 0 || !string) {
    return self[IS_EMPTY] ? "" : string;
  }
  let styler = self[STYLER];
  if (styler === undefined) {
    return string;
  }
  const { openAll, closeAll } = styler;
  if (string.includes("\x1B")) {
    while (styler !== undefined) {
      string = stringReplaceAll(string, styler.close, styler.open);
      styler = styler.parent;
    }
  }
  const lfIndex = string.indexOf(`
`);
  if (lfIndex !== -1) {
    string = stringEncaseCRLFWithFirstIndex(string, closeAll, openAll, lfIndex);
  }
  return openAll + string + closeAll;
}, chalk, chalkStderr, source_default;
var init_source = __esm(() => {
  init_ansi_styles();
  init_supports_color();
  ({ stdout: stdoutColor, stderr: stderrColor } = supports_color_default);
  GENERATOR = Symbol("GENERATOR");
  STYLER = Symbol("STYLER");
  IS_EMPTY = Symbol("IS_EMPTY");
  levelMapping = [
    "ansi",
    "ansi",
    "ansi256",
    "ansi16m"
  ];
  styles2 = Object.create(null);
  Object.setPrototypeOf(createChalk.prototype, Function.prototype);
  for (const [styleName, style] of Object.entries(ansi_styles_default)) {
    styles2[styleName] = {
      get() {
        const builder = createBuilder(this, createStyler(style.open, style.close, this[STYLER]), this[IS_EMPTY]);
        Object.defineProperty(this, styleName, { value: builder });
        return builder;
      }
    };
  }
  styles2.visible = {
    get() {
      const builder = createBuilder(this, this[STYLER], true);
      Object.defineProperty(this, "visible", { value: builder });
      return builder;
    }
  };
  usedModels = ["rgb", "hex", "ansi256"];
  for (const model of usedModels) {
    styles2[model] = {
      get() {
        const { level } = this;
        return function(...arguments_) {
          const styler = createStyler(getModelAnsi(model, levelMapping[level], "color", ...arguments_), ansi_styles_default.color.close, this[STYLER]);
          return createBuilder(this, styler, this[IS_EMPTY]);
        };
      }
    };
    const bgModel = "bg" + model[0].toUpperCase() + model.slice(1);
    styles2[bgModel] = {
      get() {
        const { level } = this;
        return function(...arguments_) {
          const styler = createStyler(getModelAnsi(model, levelMapping[level], "bgColor", ...arguments_), ansi_styles_default.bgColor.close, this[STYLER]);
          return createBuilder(this, styler, this[IS_EMPTY]);
        };
      }
    };
  }
  proto = Object.defineProperties(() => {}, {
    ...styles2,
    level: {
      enumerable: true,
      get() {
        return this[GENERATOR].level;
      },
      set(level) {
        this[GENERATOR].level = level;
      }
    }
  });
  Object.defineProperties(createChalk.prototype, styles2);
  chalk = createChalk();
  chalkStderr = createChalk({ level: stderrColor ? stderrColor.level : 0 });
  source_default = chalk;
});

// cli/lib/fmt.ts
function setOutputMode(opts) {
  if (opts.human !== undefined)
    _humanMode = opts.human;
}
var _humanMode = null;
var init_fmt = () => {};

// cli/lib/paths.ts
var exports_paths = {};
__export(exports_paths, {
  workerDir: () => workerDir,
  statePath: () => statePath,
  resolveProjectRoot: () => resolveProjectRoot,
  resolveProject: () => resolveProject,
  fleetJsonPath: () => fleetJsonPath,
  exists: () => exists,
  defaultsPath: () => defaultsPath,
  configPath: () => configPath,
  FLEET_MAIL_URL: () => FLEET_MAIL_URL,
  FLEET_MAIL_TOKEN: () => FLEET_MAIL_TOKEN,
  FLEET_DIR: () => FLEET_DIR,
  FLEET_DATA: () => FLEET_DATA,
  DEFAULT_SESSION: () => DEFAULT_SESSION
});
import { join } from "node:path";
import { existsSync, readFileSync } from "node:fs";
function resolveMailConfig() {
  const envUrl = process.env.FLEET_MAIL_URL || null;
  const envToken = process.env.FLEET_MAIL_TOKEN || null;
  let fileUrl = null;
  let fileToken = null;
  const dp = defaultsPath();
  if (existsSync(dp)) {
    try {
      const d = JSON.parse(readFileSync(dp, "utf-8"));
      if (d.fleet_mail_url)
        fileUrl = String(d.fleet_mail_url);
      if (d.fleet_mail_token)
        fileToken = String(d.fleet_mail_token);
    } catch {}
  }
  return {
    url: envUrl || fileUrl,
    token: envToken || fileToken
  };
}
function workerDir(project, name) {
  return join(FLEET_DATA, project, name);
}
function configPath(project, name) {
  return join(workerDir(project, name), "config.json");
}
function statePath(project, name) {
  return join(workerDir(project, name), "state.json");
}
function defaultsPath() {
  return join(FLEET_DATA, "defaults.json");
}
function fleetJsonPath(project) {
  return join(FLEET_DATA, project, "fleet.json");
}
function resolveProjectRoot(cwd) {
  const dir = cwd || process.cwd();
  try {
    const result = Bun.spawnSync(["git", "rev-parse", "--show-toplevel"], {
      cwd: dir,
      stderr: "pipe"
    });
    if (result.exitCode === 0)
      return result.stdout.toString().trim();
  } catch {}
  return dir;
}
function resolveProject(root) {
  const r = root || resolveProjectRoot();
  const base = r.split("/").pop() || "unknown";
  return base.replace(/-w-.*$/, "");
}
function exists(p) {
  return existsSync(p);
}
var HOME, FLEET_DIR, FLEET_DATA, _mailConfig, FLEET_MAIL_URL, FLEET_MAIL_TOKEN, DEFAULT_SESSION = "w";
var init_paths = __esm(() => {
  HOME = process.env.HOME || process.env.USERPROFILE || "/tmp";
  FLEET_DIR = process.env.CLAUDE_FLEET_DIR || join(HOME, ".claude-fleet");
  FLEET_DATA = join(HOME, ".claude", "fleet");
  _mailConfig = resolveMailConfig();
  FLEET_MAIL_URL = _mailConfig.url;
  FLEET_MAIL_TOKEN = _mailConfig.token;
});

// cli/lib/fmt.ts
function isHumanMode() {
  if (_humanMode2 !== null)
    return _humanMode2;
  return !!process.env.HUMAN;
}
function statusColor(status) {
  if (!isHumanMode())
    return status;
  switch (status) {
    case "active":
      return source_default.green(status);
    case "sleeping":
      return source_default.yellow(status);
    case "idle":
      return source_default.dim(status);
    case "dead":
      return source_default.red(status);
    default:
      return source_default.dim(status);
  }
}
function table(headers, rows) {
  const human = isHumanMode();
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => stripAnsi(r[i] || "").length)));
  if (human) {
    console.log(headers.map((h, i) => source_default.bold(h.padEnd(widths[i]))).join("  "));
    console.log(widths.map((w) => "─".repeat(w)).join("  "));
  } else {
    console.log(headers.map((h, i) => h.padEnd(widths[i])).join("  "));
    console.log(widths.map((w) => "-".repeat(w)).join("  "));
  }
  for (const row of rows) {
    const parts = row.map((cell, i) => {
      const raw = human ? cell || "" : stripAnsi(cell || "");
      const stripped = stripAnsi(cell || "");
      const pad = widths[i] - stripped.length;
      return raw + " ".repeat(Math.max(0, pad));
    });
    console.log(parts.join("  "));
  }
}
function stripAnsi(s) {
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}
function hintOnboard(project) {
  const { existsSync: existsSync2 } = __require("node:fs");
  const { join: join2 } = __require("node:path");
  const HOME2 = process.env.HOME || "/tmp";
  const fleetJsonPath2 = join2(HOME2, ".claude/fleet", project, "fleet.json");
  if (!existsSync2(fleetJsonPath2)) {
    console.log("");
    info(`Tip: Run ${source_default.bold("fleet onboard")} first for guided fleet setup and configuration.`);
  }
}
var _humanMode2 = null, ok = (msg) => {
  if (isHumanMode()) {
    console.log(`${source_default.green("✓")} ${msg}`);
  } else {
    console.log(`OK: ${stripAnsi(msg)}`);
  }
}, info = (msg) => {
  if (isHumanMode()) {
    console.log(`${source_default.cyan("→")} ${msg}`);
  } else {
    console.log(`INFO: ${stripAnsi(msg)}`);
  }
}, warn = (msg) => {
  if (isHumanMode()) {
    console.log(`${source_default.yellow("⚠")} ${msg}`);
  } else {
    console.error(`WARN: ${stripAnsi(msg)}`);
  }
}, fail = (msg) => {
  if (isHumanMode()) {
    console.error(`${source_default.red("ERROR:")} ${msg}`);
  } else {
    console.error(`ERROR: ${stripAnsi(msg)}`);
  }
  process.exit(1);
};
var init_fmt2 = __esm(() => {
  init_source();
});

// shared/lock-utils.ts
import { mkdirSync, rmSync } from "fs";
function acquireLock(lockPath, maxWaitMs = 1e4) {
  const start = Date.now();
  while (true) {
    try {
      mkdirSync(lockPath, { recursive: false });
      return true;
    } catch {
      if (Date.now() - start > maxWaitMs) {
        try {
          rmSync(lockPath, { recursive: true, force: true });
        } catch {}
        try {
          mkdirSync(lockPath, { recursive: false });
          return true;
        } catch {}
        return false;
      }
      globalThis.Bun.sleepSync(100);
    }
  }
}
function releaseLock(lockPath) {
  try {
    rmSync(lockPath, { recursive: true, force: true });
  } catch {}
}
var init_lock_utils = () => {};

// shared/io.ts
var exports_io = {};
__export(exports_io, {
  writeJsonLocked: () => writeJsonLocked,
  writeJson: () => writeJson,
  updateJsonLocked: () => updateJsonLocked,
  readJson: () => readJson,
  REGISTRY_LOCK_PATH: () => REGISTRY_LOCK_PATH
});
import { readFileSync as readFileSync2, writeFileSync, mkdirSync as mkdirSync2 } from "node:fs";
import { dirname, join as join2 } from "node:path";
function readJson(path) {
  try {
    return JSON.parse(readFileSync2(path, "utf-8"));
  } catch {
    return null;
  }
}
function writeJson(path, data) {
  mkdirSync2(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + `
`);
}
function writeJsonLocked(path, data) {
  mkdirSync2(dirname(REGISTRY_LOCK_PATH), { recursive: true });
  if (!acquireLock(REGISTRY_LOCK_PATH)) {
    throw new Error("Could not acquire worker-registry lock after 10s — stale lock?");
  }
  try {
    writeJson(path, data);
  } finally {
    releaseLock(REGISTRY_LOCK_PATH);
  }
}
function updateJsonLocked(path, updater) {
  mkdirSync2(dirname(REGISTRY_LOCK_PATH), { recursive: true });
  if (!acquireLock(REGISTRY_LOCK_PATH)) {
    throw new Error("Could not acquire worker-registry lock after 10s — stale lock?");
  }
  try {
    const current = readJson(path);
    const updated = updater(current);
    writeJson(path, updated);
    return updated;
  } finally {
    releaseLock(REGISTRY_LOCK_PATH);
  }
}
var HOME2, FLEET_ROOT, REGISTRY_LOCK_PATH;
var init_io = __esm(() => {
  init_lock_utils();
  HOME2 = process.env.HOME || process.env.USERPROFILE || "/tmp";
  FLEET_ROOT = process.env.CLAUDE_FLEET_DIR || join2(HOME2, ".claude-fleet");
  REGISTRY_LOCK_PATH = join2(FLEET_ROOT, "state", "locks", "worker-registry");
});

// cli/commands/mail-server.ts
import { existsSync as existsSync2, readFileSync as readFileSync3, mkdirSync as mkdirSync3, writeFileSync as writeFileSync2 } from "node:fs";
import { join as join3 } from "node:path";
function findMailServerBinary() {
  const platform = process.platform === "darwin" ? "darwin" : "linux";
  const arch = process.arch === "arm64" ? "arm64" : "x86_64";
  const vendored = join3(FLEET_DIR, `vendor/boring-mail-${platform}-${arch}`);
  if (existsSync2(vendored))
    return vendored;
  const which = Bun.spawnSync(["which", "boring-mail"], { stderr: "pipe" });
  if (which.exitCode === 0)
    return which.stdout.toString().trim();
  const whichLegacy = Bun.spawnSync(["which", "fleet-server"], { stderr: "pipe" });
  if (whichLegacy.exitCode === 0)
    return whichLegacy.stdout.toString().trim();
  for (const p of MAIL_SERVER_PATHS) {
    if (existsSync2(p))
      return p;
  }
  return null;
}
function msDefaultsPath() {
  return join3(FLEET_DATA, "defaults.json");
}
function updateMailConfig(url, token) {
  const dp = msDefaultsPath();
  const defaults = readJson(dp) || {};
  if (url !== undefined)
    defaults.fleet_mail_url = url;
  if (token !== undefined)
    defaults.fleet_mail_token = token;
  writeJson(dp, defaults);
}
function readLocalAdminToken() {
  for (const dir of [BORING_MAIL_DATA, LEGACY_MAIL_DATA]) {
    const p = join3(dir, "admin-token");
    if (existsSync2(p)) {
      const t = readFileSync3(p, "utf-8").trim();
      if (t)
        return t;
    }
  }
  return null;
}
async function startLocalServer(opts) {
  const port = opts?.port || "8025";
  const log = opts?.quiet ? () => {} : info;
  let binary = findMailServerBinary();
  if (!binary) {
    const platform = process.platform === "darwin" ? "darwin" : "linux";
    const arch = process.arch === "arm64" ? "arm64" : "x86_64";
    throw new Error(`boring-mail binary not found.

` + `  Expected: ${FLEET_DIR}/vendor/boring-mail-${platform}-${arch}

` + `  Or connect to a remote server:
` + "    fleet mail-server connect http://your-server:8025");
  }
  log(`Found boring-mail at ${binary}`);
  try {
    const resp = await fetch(`http://127.0.0.1:${port}/health`, {
      signal: AbortSignal.timeout(2000)
    });
    if (resp.ok) {
      if (!opts?.quiet)
        warn(`Server already running on port ${port}`);
      const url2 = `http://127.0.0.1:${port}`;
      const localToken = readLocalAdminToken();
      if (localToken) {
        updateMailConfig(url2, localToken);
        return { url: url2, token: localToken };
      }
      updateMailConfig(url2, null);
      throw new Error(`Server running on port ${port} but no admin token found in ~/.boring-mail/admin-token`);
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("admin token"))
      throw e;
  }
  let adminToken = opts?.token || null;
  const adminTokenPath = join3(BORING_MAIL_DATA, "admin-token");
  if (!adminToken) {
    adminToken = readLocalAdminToken();
    if (adminToken)
      log(`Using existing admin token from ~/.boring-mail/admin-token`);
  }
  if (!adminToken) {
    adminToken = crypto.randomUUID();
    mkdirSync3(BORING_MAIL_DATA, { recursive: true });
    writeFileSync2(adminTokenPath, adminToken + `
`);
    log(`Generated admin token → ~/.boring-mail/admin-token`);
  } else if (!existsSync2(adminTokenPath)) {
    mkdirSync3(BORING_MAIL_DATA, { recursive: true });
    writeFileSync2(adminTokenPath, adminToken + `
`);
  }
  log(`Starting Fleet Mail on port ${port}...`);
  const env2 = {
    ...process.env,
    BORING_MAIL_BIND: `0.0.0.0:${port}`,
    BORING_MAIL_ADMIN_TOKEN: adminToken
  };
  const proc = Bun.spawn([binary, "serve"], {
    env: env2,
    stdout: "pipe",
    stderr: "pipe"
  });
  let ready = false;
  for (let i = 0;i < 20; i++) {
    await Bun.sleep(500);
    try {
      const resp = await fetch(`http://127.0.0.1:${port}/health`, {
        signal: AbortSignal.timeout(1000)
      });
      if (resp.ok) {
        ready = true;
        break;
      }
    } catch {}
  }
  if (!ready) {
    proc.kill();
    throw new Error("Server failed to start within 10s");
  }
  const url = `http://127.0.0.1:${port}`;
  updateMailConfig(url, adminToken);
  proc.unref();
  if (!opts?.quiet) {
    ok(`Fleet Mail running at ${url} (PID: ${proc.pid})`);
    console.log(`
  URL:   ${url}`);
    console.log(`  Token: ${adminToken.slice(0, 8)}...${adminToken.slice(-4)}`);
    console.log(`  PID:   ${proc.pid}`);
    console.log(`
  Stop:  kill ${proc.pid}`);
    console.log(`  The server runs in the background.`);
  }
  return { url, token: adminToken };
}
var MAIL_SERVER_PATHS, BORING_MAIL_DATA, LEGACY_MAIL_DATA;
var init_mail_server = __esm(() => {
  init_paths();
  init_fmt2();
  init_io();
  MAIL_SERVER_PATHS = [
    join3(process.env.HOME || "", ".cargo/bin/boring-mail"),
    join3(process.env.HOME || "", ".cargo/bin/fleet-server")
  ];
  BORING_MAIL_DATA = join3(process.env.HOME || "", ".boring-mail");
  LEGACY_MAIL_DATA = join3(process.env.HOME || "", ".fleet-server");
});

// cli/commands/tui.ts
var exports_tui = {};
__export(exports_tui, {
  register: () => register,
  findTuiBinary: () => findTuiBinary
});
import { existsSync as existsSync3, readFileSync as readFileSync4 } from "node:fs";
import { join as join4 } from "node:path";
function findTuiBinary() {
  const which = Bun.spawnSync(["which", "boring-mail-tui"], { stderr: "pipe" });
  if (which.exitCode === 0)
    return which.stdout.toString().trim();
  for (const p of TUI_BINARY_PATHS) {
    if (existsSync3(p))
      return p;
  }
  return null;
}
function resolveProject2(override) {
  if (override)
    return override;
  if (process.env.FLEET_PROJECT)
    return process.env.FLEET_PROJECT;
  try {
    const result = Bun.spawnSync(["git", "rev-parse", "--show-toplevel"], { stderr: "pipe" });
    if (result.exitCode === 0) {
      const root = result.stdout.toString().trim();
      const name = root.split("/").pop().replace(/-w-.*$/, "");
      if (existsSync3(join4(FLEET_DATA, name)))
        return name;
    }
  } catch {}
  try {
    const entries = __require("node:fs").readdirSync(FLEET_DATA, { withFileTypes: true });
    for (const e of entries) {
      if (e.isDirectory() && !e.name.startsWith("."))
        return e.name;
    }
  } catch {}
  return "unknown";
}
function resolveToken(project, account) {
  if (account) {
    const tokenPath = join4(FLEET_DATA, project, account, "token");
    if (existsSync3(tokenPath))
      return readFileSync4(tokenPath, "utf-8").trim();
  }
  if (process.env.BMS_TOKEN)
    return process.env.BMS_TOKEN;
  const userToken = join4(FLEET_DATA, project, "_user", "token");
  if (existsSync3(userToken))
    return readFileSync4(userToken, "utf-8").trim();
  const accountJson = join4(FLEET_DATA, project, "_user", "account.json");
  if (existsSync3(accountJson)) {
    try {
      const data = JSON.parse(readFileSync4(accountJson, "utf-8"));
      if (data.bms_token)
        return data.bms_token;
    } catch {}
  }
  if (process.env.FLEET_MAIL_TOKEN)
    return process.env.FLEET_MAIL_TOKEN;
  return null;
}
function resolveUrl() {
  if (process.env.BMS_URL)
    return process.env.BMS_URL;
  if (FLEET_MAIL_URL)
    return FLEET_MAIL_URL;
  const dp = join4(FLEET_DATA, "defaults.json");
  if (existsSync3(dp)) {
    try {
      const d = JSON.parse(readFileSync4(dp, "utf-8"));
      if (d.fleet_mail_url)
        return d.fleet_mail_url;
    } catch {}
  }
  return "http://5.161.107.142:8026";
}
function register(parent) {
  const sub = parent.command("tui").description("Launch Fleet Mail TUI client").option("-a, --account <name>", "Account name (reads token from fleet dirs)").option("--control", "Open in control window tmux pane");
  addGlobalOpts(sub).action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals();
    const binary = findTuiBinary();
    if (!binary) {
      fail(`boring-mail-tui not found. Install with:
  cargo install --git https://github.com/qbg-dev/boring-mail-server boring-mail-tui`);
    }
    const project = resolveProject2(globalOpts.project);
    const account = opts.account;
    const token = resolveToken(project, account);
    const url = resolveUrl();
    if (!token) {
      fail(`No token found for project '${project}'. Set BMS_TOKEN or create ~/.claude/fleet/${project}/_user/token`);
    }
    const env2 = {
      ...process.env,
      BMS_URL: url,
      BMS_TOKEN: token
    };
    if (account)
      env2.BMS_ACCOUNT = account;
    if (opts.control) {
      const fleetJson = readJson(join4(FLEET_DATA, project, "fleet.json"));
      const session = fleetJson?.tmux_session || "w";
      const tmuxCmd = `BMS_URL=${url} BMS_TOKEN=${token} ${binary}`;
      const result = Bun.spawnSync(["tmux", "split-window", "-t", `${session}:control`, "-h", tmuxCmd], { stderr: "pipe" });
      if (result.exitCode !== 0) {
        Bun.spawnSync(["tmux", "new-window", "-t", session, "-n", "control"], { stderr: "pipe" });
        const retry = Bun.spawnSync(["tmux", "split-window", "-t", `${session}:control`, "-h", tmuxCmd], { stderr: "pipe" });
        if (retry.exitCode !== 0) {
          fail(`Failed to open TUI in control window (session: ${session})`);
        }
      }
      const layouts = fleetJson?.layouts;
      if (layouts?.control) {
        Bun.spawnSync(["tmux", "select-layout", "-t", `${session}:control`, layouts.control], { stderr: "pipe" });
      }
      ok(`TUI opened in ${session}:control`);
    } else {
      info(`Connecting to ${url}...`);
      const proc = Bun.spawnSync([binary], {
        env: env2,
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit"
      });
      process.exit(proc.exitCode || 0);
    }
  });
}
var HOME3, TUI_BINARY_PATHS;
var init_tui = __esm(() => {
  init_paths();
  init_fmt2();
  init_cli();
  init_io();
  HOME3 = process.env.HOME || "/tmp";
  TUI_BINARY_PATHS = [
    join4(HOME3, ".cargo/bin/boring-mail-tui"),
    join4(HOME3, "Desktop/zPersonalProjects/boring-mail-server/target/release/boring-mail-tui")
  ];
});

// cli/commands/setup.ts
import { existsSync as existsSync4, mkdirSync as mkdirSync4, writeFileSync as writeFileSync3, readFileSync as readFileSync5, appendFileSync, copyFileSync } from "node:fs";
import { join as join5 } from "node:path";
function register2(parent) {
  parent.command("setup").description("Bootstrap fleet infrastructure").option("--extensions", "Build and install all extensions (watchdog, review, etc.)").option("--no-global-hooks", "Skip installing hooks MCP + engine globally (default: install)").action(async (opts) => {
    console.log(`${source_default.bold("fleet setup")} — bootstrapping fleet infrastructure
`);
    let errors = 0;
    const HOME4 = process.env.HOME || "/tmp";
    info("Checking dependencies...");
    const deps = [
      { name: "bun", hint: "curl -fsSL https://bun.sh/install | bash" },
      { name: "tmux", hint: "brew install tmux" },
      { name: "claude", hint: "https://docs.anthropic.com/en/docs/claude-code" }
    ];
    for (const { name, hint } of deps) {
      const result = Bun.spawnSync(["which", name], { stderr: "pipe" });
      if (result.exitCode === 0) {
        ok(`${name} → ${result.stdout.toString().trim()}`);
      } else {
        console.log(`  ${source_default.red("✗")} ${name} not found`);
        console.log(`    Install: ${hint}`);
        errors++;
      }
    }
    if (errors > 0)
      fail("Install missing tools above, then re-run: fleet setup");
    let fleetDir = FLEET_DIR;
    if (!existsSync4(fleetDir)) {
      const scriptDir = import.meta.dir;
      const repoRoot = join5(scriptDir, "../..");
      if (existsSync4(join5(repoRoot, "cli/index.ts")) && existsSync4(join5(repoRoot, "mcp/worker-fleet/index.ts"))) {
        fleetDir = repoRoot;
      } else {
        fail(`Fleet repo not found at ${fleetDir}. Clone it first:
  git clone https://github.com/qbg-dev/claude-fleet.git ~/.claude-fleet`);
      }
    }
    ok(`Fleet repo: ${fleetDir}`);
    info("Setting up symlinks...");
    const realDir = Bun.spawnSync(["realpath", fleetDir], { stderr: "pipe" }).stdout.toString().trim() || fleetDir;
    if (!existsSync4(join5(HOME4, ".claude-fleet"))) {
      Bun.spawnSync(["ln", "-sfn", realDir, join5(HOME4, ".claude-fleet")]);
      ok(`Created ~/.claude-fleet → ${realDir}`);
    } else {
      ok("~/.claude-fleet exists");
    }
    if (!existsSync4(join5(HOME4, ".claude-fleet"))) {
      Bun.spawnSync(["ln", "-sfn", realDir, join5(HOME4, ".claude-fleet")]);
      ok("Created ~/.claude-fleet → (compat)");
    } else {
      ok("~/.claude-fleet exists");
    }
    mkdirSync4(join5(HOME4, ".claude"), { recursive: true });
    Bun.spawnSync(["ln", "-sfn", join5(HOME4, ".claude-fleet"), join5(HOME4, ".claude/ops")]);
    ok("~/.claude/ops → ~/.claude-fleet");
    if (!existsSync4(join5(HOME4, ".tmux-agents"))) {
      Bun.spawnSync(["ln", "-sfn", realDir, join5(HOME4, ".tmux-agents")]);
      ok("Created ~/.tmux-agents → (compat)");
    } else {
      ok("~/.tmux-agents exists");
    }
    mkdirSync4(join5(HOME4, ".local/bin"), { recursive: true });
    Bun.spawnSync(["ln", "-sf", join5(HOME4, ".claude-fleet/bin/fleet"), join5(HOME4, ".local/bin/fleet")]);
    ok("Symlinked ~/.local/bin/fleet");
    if (!process.env.PATH?.includes(`${HOME4}/.local/bin`)) {
      const shell = process.env.SHELL || "";
      let rcFile = null;
      if (shell.endsWith("/zsh"))
        rcFile = join5(HOME4, ".zshrc");
      else if (shell.endsWith("/bash"))
        rcFile = join5(HOME4, ".bashrc");
      if (rcFile) {
        const rcContent = existsSync4(rcFile) ? readFileSync5(rcFile, "utf-8") : "";
        if (rcContent.includes(".local/bin") && rcContent.includes("PATH")) {
          ok(`PATH entry already in ${rcFile} (restart shell to pick up)`);
        } else {
          appendFileSync(rcFile, `
# Added by fleet setup
export PATH="$HOME/.local/bin:$PATH"
`);
          ok(`Added ~/.local/bin to PATH in ${rcFile}`);
          console.log(`    Restart shell or: source ${rcFile}`);
        }
      } else {
        warn(`${HOME4}/.local/bin is not in PATH (${shell || "unknown"} shell — add manually)`);
        console.log(`    Add to your shell rc: export PATH="$HOME/.local/bin:$PATH"`);
      }
    }
    mkdirSync4(FLEET_DATA, { recursive: true });
    ok(`Fleet data dir: ${FLEET_DATA}`);
    const defaultsFile = join5(FLEET_DATA, "defaults.json");
    if (!existsSync4(defaultsFile)) {
      writeFileSync3(defaultsFile, JSON.stringify({
        model: "opus[1m]",
        effort: "high",
        permission_mode: "bypassPermissions",
        sleep_duration: null
      }, null, 2) + `
`);
      ok("Created defaults.json");
    } else {
      ok("defaults.json exists");
    }
    const pkgJson = join5(fleetDir, "package.json");
    if (existsSync4(pkgJson)) {
      info("Installing dependencies...");
      const install = Bun.spawnSync(["bun", "install"], { cwd: fleetDir, stderr: "pipe" });
      if (install.exitCode === 0) {
        ok("Dependencies installed");
      } else {
        warn("bun install failed (non-fatal)");
      }
    }
    info("Fleet Mail...");
    let resolvedMailUrl = FLEET_MAIL_URL;
    if (FLEET_MAIL_URL) {
      let mailOk = false;
      try {
        const resp = await fetch(`${FLEET_MAIL_URL}/health`, { signal: AbortSignal.timeout(3000) });
        if (resp.ok) {
          ok(`Fleet Mail: ${FLEET_MAIL_URL} ${source_default.green("(reachable)")}`);
          mailOk = true;
        } else {
          console.log(`  ${source_default.red("✗")} Fleet Mail: ${FLEET_MAIL_URL} (returned ${resp.status})`);
        }
      } catch {
        console.log(`  ${source_default.red("✗")} Fleet Mail: ${FLEET_MAIL_URL} (unreachable)`);
      }
      if (!mailOk) {
        fail(`Fleet Mail at ${FLEET_MAIL_URL} is unreachable. Is the server running?

  Check status:  fleet mail-server status
  Reconnect:     fleet mail-server connect <url>
  Start local:   fleet mail-server start`);
      }
      if (FLEET_MAIL_TOKEN) {
        ok(`Admin token: ${FLEET_MAIL_TOKEN.slice(0, 8)}...`);
      }
    } else {
      info("No Fleet Mail configured — attempting to auto-start local server...");
      try {
        const result = await startLocalServer({ quiet: true });
        resolvedMailUrl = result.url;
        ok(`Fleet Mail auto-started: ${result.url}`);
        ok(`Admin token: ${result.token.slice(0, 8)}...`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.log(`  ${source_default.red("✗")} Auto-start failed: ${msg}`);
        console.log("");
        console.log(`  Fleet Mail is required for worker coordination.`);
        console.log("");
        console.log(`  ${source_default.cyan("Connect to a remote server:")}`);
        console.log(`    fleet mail-server connect http://your-server:8026`);
        console.log("");
        fail("Set up Fleet Mail via one of the paths above, then re-run: fleet setup");
      }
    }
    const settingsFile = join5(HOME4, ".claude/settings.json");
    const bunPath = Bun.spawnSync(["which", "bun"]).stdout.toString().trim();
    {
      let settings = {};
      if (existsSync4(settingsFile)) {
        try {
          settings = JSON.parse(readFileSync5(settingsFile, "utf-8"));
        } catch {}
      }
      if (!settings.mcpServers)
        settings.mcpServers = {};
      if (settings.mcpServers["worker-fleet"]) {
        delete settings.mcpServers["worker-fleet"];
        info("Removed legacy worker-fleet MCP (now using fleet CLI)");
      }
      if (opts.globalHooks !== false) {
        const claudeHooksDir = process.env.CLAUDE_HOOKS_DIR || join5(HOME4, ".claude-hooks");
        const claudeHooksMcp = join5(claudeHooksDir, "mcp/index.ts");
        const claudeHooksMcpResolved = existsSync4(claudeHooksMcp) ? Bun.spawnSync(["realpath", claudeHooksMcp]).stdout.toString().trim() || claudeHooksMcp : null;
        if (claudeHooksMcpResolved) {
          const hooksDir = join5(HOME4, ".claude/hooks");
          const result = Bun.spawnSync([
            "claude",
            "mcp",
            "add",
            "-s",
            "user",
            "claude-hooks",
            "-e",
            `HOOKS_DIR=${hooksDir}`,
            "-e",
            "HOOKS_IDENTITY=operator",
            "--",
            bunPath,
            "run",
            claudeHooksMcpResolved
          ], { stdout: "pipe", stderr: "pipe" });
          if (result.exitCode === 0) {
            ok("claude-hooks MCP registered globally (user scope, works for all Claude Code instances)");
          } else {
            const stderr = result.stderr.toString().trim();
            warn(`claude-hooks MCP registration failed: ${stderr}`);
            console.log(`    Try manually: claude mcp add -s user claude-hooks -e HOOKS_DIR=${hooksDir} -e HOOKS_IDENTITY=operator -- ${bunPath} run ${claudeHooksMcpResolved}`);
          }
        } else {
          info("claude-hooks not found — skipping (optional, install at ~/.claude-hooks)");
        }
      } else {
        info("Global hooks MCP skipped (--no-global-hooks)");
      }
      const statuslineInstaller = join5(fleetDir, "extensions/statusline/install.sh");
      if (existsSync4(statuslineInstaller)) {
        if (settings.statusLine) {
          info("Existing statusline detected — skipping (onboarding agent will help merge)");
        } else {
          const slInstall = Bun.spawnSync(["bash", statuslineInstaller, "--link"], { stdout: "pipe", stderr: "pipe", env: { ...process.env, HOME: HOME4 } });
          if (slInstall.exitCode === 0) {
            try {
              settings = JSON.parse(readFileSync5(settingsFile, "utf-8"));
            } catch {}
            ok("Statusline: installed via extension (worker identity via worktree)");
          } else {
            warn("Statusline install failed — try: bash extensions/statusline/install.sh");
          }
        }
      }
      writeFileSync3(settingsFile, JSON.stringify(settings, null, 2) + `
`);
      ok("Settings updated");
    }
    const globalHooksDir = join5(HOME4, ".claude/hooks");
    mkdirSync4(globalHooksDir, { recursive: true });
    ok(`Global hooks dir: ${globalHooksDir}`);
    info("Installing hooks...");
    {
      let settings = {};
      if (existsSync4(settingsFile)) {
        try {
          settings = JSON.parse(readFileSync5(settingsFile, "utf-8"));
        } catch {}
      }
      const backupDir = join5(HOME4, ".claude/settings-backups");
      mkdirSync4(backupDir, { recursive: true });
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      writeFileSync3(join5(backupDir, `settings.${ts}.json`), JSON.stringify(settings, null, 2) + `
`);
      const fleetBase = join5(HOME4, ".claude-fleet");
      const isFleetHook = (entry) => entry.hooks?.some((h2) => h2.command?.includes("/.claude-fleet/") || h2.command?.includes("/.claude-hooks/") || h2.command?.includes("/.tmux-agents/") || h2.command?.includes("bun run") && h2.command?.includes("/engine/"));
      const existingHooks = settings.hooks || {};
      const preservedHooks = {};
      for (const [event, entries] of Object.entries(existingHooks)) {
        const kept = entries.filter((e) => !isFleetHook(e));
        if (kept.length > 0)
          preservedHooks[event] = kept;
      }
      const h = (script, timeout) => ({
        hooks: [{ type: "command", command: `bash ${fleetBase}/${script}`, ...timeout ? { timeout } : {} }]
      });
      const hooksDir = join5(HOME4, ".claude/hooks");
      const engine = {
        hooks: [{ type: "command", command: `HOOKS_DIR=${hooksDir} bun run ${fleetBase}/engine/hook-engine.ts` }]
      };
      const logger = h("engine/session-logger.sh");
      const fleetHooks = {
        UserPromptSubmit: [
          h("hooks/publishers/worker-session-register.sh"),
          h("hooks/publishers/prompt-echo-deferred.sh"),
          engine,
          logger
        ],
        PreToolUse: [
          h("hooks/gates/tool-policy-gate.sh"),
          h("hooks/interceptors/pre-tool-context-injector.sh"),
          engine,
          logger
        ],
        PreCompact: [
          h("scripts/pre-compact.sh", 5000),
          engine,
          logger
        ],
        Stop: [
          h("hooks/gates/stop-worker-dispatch.sh"),
          h("hooks/gates/stop-inbox-drain.sh"),
          h("hooks/publishers/stop-echo.sh"),
          engine,
          logger
        ]
      };
      const merged = {};
      const allEvents = new Set([...Object.keys(preservedHooks), ...Object.keys(fleetHooks)]);
      for (const event of allEvents) {
        merged[event] = [
          ...preservedHooks[event] || [],
          ...fleetHooks[event] || []
        ];
      }
      settings.hooks = merged;
      writeFileSync3(settingsFile, JSON.stringify(settings, null, 2) + `
`);
      let hookCount = 0;
      let missingCount = 0;
      for (const entries of Object.values(fleetHooks)) {
        for (const entry of entries) {
          hookCount++;
          const script = entry.hooks[0].command.replace(/^(bash|bun run)\s+/, "");
          if (!existsSync4(script))
            missingCount++;
        }
      }
      if (missingCount > 0) {
        warn(`${hookCount} hooks registered, ${missingCount} scripts missing`);
      } else {
        ok(`${hookCount} hooks installed across ${Object.keys(fleetHooks).length} events`);
      }
      const nonFleetCount = Object.values(preservedHooks).reduce((n, arr) => n + arr.length, 0);
      if (nonFleetCount > 0) {
        ok(`${nonFleetCount} project-specific hooks preserved`);
      }
    }
    info(opts.extensions ? "Installing extensions..." : "Detecting extensions...");
    const rustBinary = join5(fleetDir, "extensions/watchdog-rs/target/release/boring-watchdog");
    const watchdogPlugin = join5(fleetDir, "extensions/watchdog/src/watchdog.ts");
    const cargoToml = join5(fleetDir, "extensions/watchdog-rs/Cargo.toml");
    const watchdogPlist = join5(HOME4, "Library/LaunchAgents/com.tmux-agents.watchdog.plist");
    const legacyPlist = join5(HOME4, "Library/LaunchAgents/com.claude-fleet.harness-watchdog.plist");
    const watchdogInstalled = existsSync4(watchdogPlist) || existsSync4(legacyPlist);
    let hasRustWatchdog = existsSync4(rustBinary);
    const hasTsWatchdog = existsSync4(watchdogPlugin);
    if (opts.extensions && !watchdogInstalled) {
      if (existsSync4(cargoToml)) {
        const hasCargo = Bun.spawnSync(["which", "cargo"], { stderr: "pipe" }).exitCode === 0;
        if (hasCargo) {
          info("Building Rust watchdog...");
          const build = Bun.spawnSync(["cargo", "build", "--release"], { cwd: join5(fleetDir, "extensions/watchdog-rs"), stdout: "inherit", stderr: "inherit" });
          if (build.exitCode === 0) {
            hasRustWatchdog = true;
            ok("Rust watchdog built");
            info("Installing watchdog daemon...");
            const install = Bun.spawnSync([rustBinary, "install"], { stdout: "inherit", stderr: "inherit" });
            if (install.exitCode === 0) {
              ok("Watchdog: Rust — launchd daemon installed");
            } else {
              warn("Watchdog install failed (try manually)");
            }
          } else {
            warn("Rust watchdog build failed — trying TypeScript fallback");
          }
        } else {
          info("cargo not found — using TypeScript watchdog");
        }
      }
      if (!hasRustWatchdog && hasTsWatchdog) {
        info("Installing TypeScript watchdog...");
        const install = Bun.spawnSync(["bash", join5(fleetDir, "extensions/watchdog/install.sh")], { stdout: "inherit", stderr: "inherit", env: { ...process.env, CLAUDE_FLEET_DIR: fleetDir } });
        if (install.exitCode === 0) {
          ok("Watchdog: TypeScript — launchd daemon installed");
        } else {
          warn("TypeScript watchdog install failed");
        }
      }
    } else if (hasRustWatchdog || hasTsWatchdog) {
      const impl = hasRustWatchdog ? "Rust (boring-watchdog)" : "TypeScript";
      if (watchdogInstalled) {
        ok(`Watchdog: ${impl} — launchd daemon active`);
      } else {
        warn(`Watchdog: ${impl} found but not installed as daemon`);
        if (hasRustWatchdog) {
          console.log(`    Install: ${rustBinary} install`);
        } else {
          console.log(`    Install: bash ${join5(fleetDir, "extensions/watchdog/install.sh")}`);
        }
        if (!opts.extensions) {
          console.log(`    Or run: fleet setup --extensions`);
        }
      }
    } else if (existsSync4(cargoToml)) {
      info("Watchdog: Rust source found but not built");
      console.log(`    Build + install: fleet setup --extensions`);
    } else {
      info("Watchdog: not found (optional — supervises long-running workers)");
    }
    if (watchdogInstalled) {
      const plistPath = existsSync4(watchdogPlist) ? watchdogPlist : legacyPlist;
      const unload = Bun.spawnSync(["launchctl", "unload", plistPath], { stderr: "pipe" });
      const load = Bun.spawnSync(["launchctl", "load", plistPath], { stderr: "pipe" });
      if (load.exitCode === 0) {
        ok("Watchdog: restarted (picks up code changes)");
      } else {
        warn("Watchdog: restart failed — may need manual `launchctl unload/load`");
      }
    }
    const reviewInstallScript = join5(fleetDir, "extensions/review/install.sh");
    const deepReviewDir = process.env.DEEP_REVIEW_DIR || join5(HOME4, ".deep-review");
    if (opts.extensions && existsSync4(reviewInstallScript)) {
      info("Installing review extension...");
      const install = Bun.spawnSync(["bash", reviewInstallScript], { stdout: "inherit", stderr: "inherit" });
      if (install.exitCode === 0) {
        ok("Deep review: installed (REVIEW.md, pre-commit hook, scripts)");
      } else {
        warn("Review extension install failed");
      }
    } else if (existsSync4(join5(deepReviewDir, "scripts/deep-review.sh"))) {
      ok(`Deep review: ${deepReviewDir}`);
    } else if (existsSync4(join5(fleetDir, "scripts/deep-review.sh"))) {
      ok("Deep review: bundled (in fleet repo)");
    } else {
      info("Deep review: not found (optional — multi-pass adversarial code review)");
    }
    {
      const { findTuiBinary: findTuiBinary2 } = await Promise.resolve().then(() => (init_tui(), exports_tui));
      const tuiBinary = findTuiBinary2();
      if (tuiBinary) {
        ok(`Fleet Mail TUI: ${tuiBinary}`);
      } else {
        info("Fleet Mail TUI: not found (optional — build or install separately)");
      }
    }
    info("Tmux prefix key...");
    const tmuxConf = join5(HOME4, ".tmux.conf");
    const tmuxConfContent = existsSync4(tmuxConf) ? readFileSync5(tmuxConf, "utf-8") : "";
    const hasCustomPrefix = /set\s+(-g\s+)?prefix\b/.test(tmuxConfContent);
    const hasPrefixY = /set\s+(-g\s+)?prefix2?\s+C-y/i.test(tmuxConfContent);
    if (hasPrefixY) {
      ok("Tmux prefix Y already configured");
    } else if (hasCustomPrefix) {
      info("Custom tmux prefix detected — skipping prefix Y (add manually if desired)");
      console.log(`    Add to ~/.tmux.conf: set -g prefix2 C-y`);
    } else {
      info("Recommend: Ctrl-Y as secondary tmux prefix (convenient for fleet ops)");
      console.log(`    Fleet uses tmux heavily — a second prefix key avoids conflicts with Ctrl-B.`);
      console.log(`    Adding prefix2 C-y to ~/.tmux.conf (your existing prefix is preserved)...`);
      const prefixLine = `
# Added by fleet setup — secondary prefix for fleet operations
set -g prefix2 C-y
bind C-y send-prefix -2
`;
      appendFileSync(tmuxConf, prefixLine);
      ok("Added prefix2 C-y to ~/.tmux.conf");
      console.log(`    Reload: tmux source-file ~/.tmux.conf`);
    }
    info("Tmux config...");
    const fleetTmuxConf = join5(fleetDir, "config/tmux.conf");
    if (existsSync4(fleetTmuxConf)) {
      const hasHighScrollback = /history-limit\s+[3-9]\d{4,}/.test(tmuxConfContent);
      const hasPaneBorders = /pane-border-status/.test(tmuxConfContent);
      if (hasHighScrollback && hasPaneBorders) {
        ok("Tmux config: agent-friendly settings detected");
      } else if (tmuxConfContent.trim()) {
        const additions = [];
        if (!hasHighScrollback) {
          additions.push("set -g history-limit 50000");
        }
        if (!hasPaneBorders) {
          additions.push("set -g pane-border-status bottom");
          additions.push(`set -g pane-border-format " #[fg=cyan]#{session_name}:#{window_index}.#{pane_index}#[default] #[fg=yellow,bold]#(cat /tmp/tmux_pane_status_#{pane_id} 2>/dev/null)#[default] #{pane_title} "`);
        }
        if (!/focus-events/.test(tmuxConfContent)) {
          additions.push("set -g focus-events on");
        }
        if (!/aggressive-resize/.test(tmuxConfContent)) {
          additions.push("set -g aggressive-resize on");
        }
        if (additions.length > 0) {
          appendFileSync(tmuxConf, `
# Fleet agent essentials (added by fleet setup — supplements existing config)
${additions.join(`
`)}
`);
          Bun.spawnSync(["tmux", "source-file", tmuxConf], { stderr: "pipe" });
          ok(`Appended ${additions.length} agent-friendly settings to ~/.tmux.conf`);
        } else {
          ok("Tmux config: all agent essentials present");
        }
        info(`Full fleet tmux reference: ${fleetTmuxConf}`);
      } else {
        copyFileSync(fleetTmuxConf, tmuxConf);
        Bun.spawnSync(["tmux", "source-file", tmuxConf], { stderr: "pipe" });
        ok("Installed fleet tmux.conf (50k scrollback, pane labels, broadcast menu)");
      }
    }
    info("Shell completions...");
    const completionSrc = join5(fleetDir, "completions/_fleet");
    const completionDst = join5(fleetDir, "completions");
    if (existsSync4(completionSrc)) {
      const shell = process.env.SHELL || "";
      if (shell.endsWith("/zsh")) {
        const rcFile = join5(HOME4, ".zshrc");
        const rcContent = existsSync4(rcFile) ? readFileSync5(rcFile, "utf-8") : "";
        if (rcContent.includes("completions/_fleet") || rcContent.includes(`fpath=(${completionDst}`)) {
          ok("Zsh completions already in ~/.zshrc");
        } else {
          appendFileSync(rcFile, `
# Fleet CLI completions (added by fleet setup)
fpath=(${completionDst} $fpath)
autoload -Uz compinit && compinit
`);
          ok("Added fleet completions to ~/.zshrc");
          console.log("    Reload: exec zsh");
        }
      } else {
        info(`Completions available at ${completionSrc} (zsh only — add fpath manually for other shells)`);
      }
    } else {
      warn("Completion file not found — skipping");
    }
    console.log("");
    ok("Fleet setup complete!");
    console.log("");
    console.log(`  ${source_default.bold("fleet onboard")}                — guided setup + fleet design (recommended next step)`);
    console.log("  fleet ls                    — list workers");
    console.log("  fleet doctor                — verify installation");
    console.log("");
    info("Run 'fleet onboard' to design your fleet with the architect agent.");
  });
}
var init_setup = __esm(() => {
  init_source();
  init_paths();
  init_fmt2();
  init_mail_server();
});

// node_modules/.bun/js-yaml@4.1.1/node_modules/js-yaml/lib/common.js
var require_common = __commonJS((exports, module) => {
  function isNothing(subject) {
    return typeof subject === "undefined" || subject === null;
  }
  function isObject(subject) {
    return typeof subject === "object" && subject !== null;
  }
  function toArray(sequence) {
    if (Array.isArray(sequence))
      return sequence;
    else if (isNothing(sequence))
      return [];
    return [sequence];
  }
  function extend(target, source) {
    var index, length, key, sourceKeys;
    if (source) {
      sourceKeys = Object.keys(source);
      for (index = 0, length = sourceKeys.length;index < length; index += 1) {
        key = sourceKeys[index];
        target[key] = source[key];
      }
    }
    return target;
  }
  function repeat(string, count) {
    var result = "", cycle;
    for (cycle = 0;cycle < count; cycle += 1) {
      result += string;
    }
    return result;
  }
  function isNegativeZero(number) {
    return number === 0 && Number.NEGATIVE_INFINITY === 1 / number;
  }
  exports.isNothing = isNothing;
  exports.isObject = isObject;
  exports.toArray = toArray;
  exports.repeat = repeat;
  exports.isNegativeZero = isNegativeZero;
  exports.extend = extend;
});

// node_modules/.bun/js-yaml@4.1.1/node_modules/js-yaml/lib/exception.js
var require_exception = __commonJS((exports, module) => {
  function formatError(exception, compact) {
    var where = "", message = exception.reason || "(unknown reason)";
    if (!exception.mark)
      return message;
    if (exception.mark.name) {
      where += 'in "' + exception.mark.name + '" ';
    }
    where += "(" + (exception.mark.line + 1) + ":" + (exception.mark.column + 1) + ")";
    if (!compact && exception.mark.snippet) {
      where += `

` + exception.mark.snippet;
    }
    return message + " " + where;
  }
  function YAMLException(reason, mark) {
    Error.call(this);
    this.name = "YAMLException";
    this.reason = reason;
    this.mark = mark;
    this.message = formatError(this, false);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    } else {
      this.stack = new Error().stack || "";
    }
  }
  YAMLException.prototype = Object.create(Error.prototype);
  YAMLException.prototype.constructor = YAMLException;
  YAMLException.prototype.toString = function toString(compact) {
    return this.name + ": " + formatError(this, compact);
  };
  module.exports = YAMLException;
});

// node_modules/.bun/js-yaml@4.1.1/node_modules/js-yaml/lib/snippet.js
var require_snippet = __commonJS((exports, module) => {
  var common = require_common();
  function getLine(buffer, lineStart, lineEnd, position, maxLineLength) {
    var head = "";
    var tail = "";
    var maxHalfLength = Math.floor(maxLineLength / 2) - 1;
    if (position - lineStart > maxHalfLength) {
      head = " ... ";
      lineStart = position - maxHalfLength + head.length;
    }
    if (lineEnd - position > maxHalfLength) {
      tail = " ...";
      lineEnd = position + maxHalfLength - tail.length;
    }
    return {
      str: head + buffer.slice(lineStart, lineEnd).replace(/\t/g, "→") + tail,
      pos: position - lineStart + head.length
    };
  }
  function padStart(string, max) {
    return common.repeat(" ", max - string.length) + string;
  }
  function makeSnippet(mark, options) {
    options = Object.create(options || null);
    if (!mark.buffer)
      return null;
    if (!options.maxLength)
      options.maxLength = 79;
    if (typeof options.indent !== "number")
      options.indent = 1;
    if (typeof options.linesBefore !== "number")
      options.linesBefore = 3;
    if (typeof options.linesAfter !== "number")
      options.linesAfter = 2;
    var re = /\r?\n|\r|\0/g;
    var lineStarts = [0];
    var lineEnds = [];
    var match;
    var foundLineNo = -1;
    while (match = re.exec(mark.buffer)) {
      lineEnds.push(match.index);
      lineStarts.push(match.index + match[0].length);
      if (mark.position <= match.index && foundLineNo < 0) {
        foundLineNo = lineStarts.length - 2;
      }
    }
    if (foundLineNo < 0)
      foundLineNo = lineStarts.length - 1;
    var result = "", i, line;
    var lineNoLength = Math.min(mark.line + options.linesAfter, lineEnds.length).toString().length;
    var maxLineLength = options.maxLength - (options.indent + lineNoLength + 3);
    for (i = 1;i <= options.linesBefore; i++) {
      if (foundLineNo - i < 0)
        break;
      line = getLine(mark.buffer, lineStarts[foundLineNo - i], lineEnds[foundLineNo - i], mark.position - (lineStarts[foundLineNo] - lineStarts[foundLineNo - i]), maxLineLength);
      result = common.repeat(" ", options.indent) + padStart((mark.line - i + 1).toString(), lineNoLength) + " | " + line.str + `
` + result;
    }
    line = getLine(mark.buffer, lineStarts[foundLineNo], lineEnds[foundLineNo], mark.position, maxLineLength);
    result += common.repeat(" ", options.indent) + padStart((mark.line + 1).toString(), lineNoLength) + " | " + line.str + `
`;
    result += common.repeat("-", options.indent + lineNoLength + 3 + line.pos) + "^" + `
`;
    for (i = 1;i <= options.linesAfter; i++) {
      if (foundLineNo + i >= lineEnds.length)
        break;
      line = getLine(mark.buffer, lineStarts[foundLineNo + i], lineEnds[foundLineNo + i], mark.position - (lineStarts[foundLineNo] - lineStarts[foundLineNo + i]), maxLineLength);
      result += common.repeat(" ", options.indent) + padStart((mark.line + i + 1).toString(), lineNoLength) + " | " + line.str + `
`;
    }
    return result.replace(/\n$/, "");
  }
  module.exports = makeSnippet;
});

// node_modules/.bun/js-yaml@4.1.1/node_modules/js-yaml/lib/type.js
var require_type = __commonJS((exports, module) => {
  var YAMLException = require_exception();
  var TYPE_CONSTRUCTOR_OPTIONS = [
    "kind",
    "multi",
    "resolve",
    "construct",
    "instanceOf",
    "predicate",
    "represent",
    "representName",
    "defaultStyle",
    "styleAliases"
  ];
  var YAML_NODE_KINDS = [
    "scalar",
    "sequence",
    "mapping"
  ];
  function compileStyleAliases(map) {
    var result = {};
    if (map !== null) {
      Object.keys(map).forEach(function(style) {
        map[style].forEach(function(alias) {
          result[String(alias)] = style;
        });
      });
    }
    return result;
  }
  function Type(tag, options) {
    options = options || {};
    Object.keys(options).forEach(function(name) {
      if (TYPE_CONSTRUCTOR_OPTIONS.indexOf(name) === -1) {
        throw new YAMLException('Unknown option "' + name + '" is met in definition of "' + tag + '" YAML type.');
      }
    });
    this.options = options;
    this.tag = tag;
    this.kind = options["kind"] || null;
    this.resolve = options["resolve"] || function() {
      return true;
    };
    this.construct = options["construct"] || function(data) {
      return data;
    };
    this.instanceOf = options["instanceOf"] || null;
    this.predicate = options["predicate"] || null;
    this.represent = options["represent"] || null;
    this.representName = options["representName"] || null;
    this.defaultStyle = options["defaultStyle"] || null;
    this.multi = options["multi"] || false;
    this.styleAliases = compileStyleAliases(options["styleAliases"] || null);
    if (YAML_NODE_KINDS.indexOf(this.kind) === -1) {
      throw new YAMLException('Unknown kind "' + this.kind + '" is specified for "' + tag + '" YAML type.');
    }
  }
  module.exports = Type;
});

// node_modules/.bun/js-yaml@4.1.1/node_modules/js-yaml/lib/schema.js
var require_schema = __commonJS((exports, module) => {
  var YAMLException = require_exception();
  var Type = require_type();
  function compileList(schema, name) {
    var result = [];
    schema[name].forEach(function(currentType) {
      var newIndex = result.length;
      result.forEach(function(previousType, previousIndex) {
        if (previousType.tag === currentType.tag && previousType.kind === currentType.kind && previousType.multi === currentType.multi) {
          newIndex = previousIndex;
        }
      });
      result[newIndex] = currentType;
    });
    return result;
  }
  function compileMap() {
    var result = {
      scalar: {},
      sequence: {},
      mapping: {},
      fallback: {},
      multi: {
        scalar: [],
        sequence: [],
        mapping: [],
        fallback: []
      }
    }, index, length;
    function collectType(type) {
      if (type.multi) {
        result.multi[type.kind].push(type);
        result.multi["fallback"].push(type);
      } else {
        result[type.kind][type.tag] = result["fallback"][type.tag] = type;
      }
    }
    for (index = 0, length = arguments.length;index < length; index += 1) {
      arguments[index].forEach(collectType);
    }
    return result;
  }
  function Schema(definition) {
    return this.extend(definition);
  }
  Schema.prototype.extend = function extend(definition) {
    var implicit = [];
    var explicit = [];
    if (definition instanceof Type) {
      explicit.push(definition);
    } else if (Array.isArray(definition)) {
      explicit = explicit.concat(definition);
    } else if (definition && (Array.isArray(definition.implicit) || Array.isArray(definition.explicit))) {
      if (definition.implicit)
        implicit = implicit.concat(definition.implicit);
      if (definition.explicit)
        explicit = explicit.concat(definition.explicit);
    } else {
      throw new YAMLException("Schema.extend argument should be a Type, [ Type ], " + "or a schema definition ({ implicit: [...], explicit: [...] })");
    }
    implicit.forEach(function(type) {
      if (!(type instanceof Type)) {
        throw new YAMLException("Specified list of YAML types (or a single Type object) contains a non-Type object.");
      }
      if (type.loadKind && type.loadKind !== "scalar") {
        throw new YAMLException("There is a non-scalar type in the implicit list of a schema. Implicit resolving of such types is not supported.");
      }
      if (type.multi) {
        throw new YAMLException("There is a multi type in the implicit list of a schema. Multi tags can only be listed as explicit.");
      }
    });
    explicit.forEach(function(type) {
      if (!(type instanceof Type)) {
        throw new YAMLException("Specified list of YAML types (or a single Type object) contains a non-Type object.");
      }
    });
    var result = Object.create(Schema.prototype);
    result.implicit = (this.implicit || []).concat(implicit);
    result.explicit = (this.explicit || []).concat(explicit);
    result.compiledImplicit = compileList(result, "implicit");
    result.compiledExplicit = compileList(result, "explicit");
    result.compiledTypeMap = compileMap(result.compiledImplicit, result.compiledExplicit);
    return result;
  };
  module.exports = Schema;
});

// node_modules/.bun/js-yaml@4.1.1/node_modules/js-yaml/lib/type/str.js
var require_str = __commonJS((exports, module) => {
  var Type = require_type();
  module.exports = new Type("tag:yaml.org,2002:str", {
    kind: "scalar",
    construct: function(data) {
      return data !== null ? data : "";
    }
  });
});

// node_modules/.bun/js-yaml@4.1.1/node_modules/js-yaml/lib/type/seq.js
var require_seq = __commonJS((exports, module) => {
  var Type = require_type();
  module.exports = new Type("tag:yaml.org,2002:seq", {
    kind: "sequence",
    construct: function(data) {
      return data !== null ? data : [];
    }
  });
});

// node_modules/.bun/js-yaml@4.1.1/node_modules/js-yaml/lib/type/map.js
var require_map = __commonJS((exports, module) => {
  var Type = require_type();
  module.exports = new Type("tag:yaml.org,2002:map", {
    kind: "mapping",
    construct: function(data) {
      return data !== null ? data : {};
    }
  });
});

// node_modules/.bun/js-yaml@4.1.1/node_modules/js-yaml/lib/schema/failsafe.js
var require_failsafe = __commonJS((exports, module) => {
  var Schema = require_schema();
  module.exports = new Schema({
    explicit: [
      require_str(),
      require_seq(),
      require_map()
    ]
  });
});

// node_modules/.bun/js-yaml@4.1.1/node_modules/js-yaml/lib/type/null.js
var require_null = __commonJS((exports, module) => {
  var Type = require_type();
  function resolveYamlNull(data) {
    if (data === null)
      return true;
    var max = data.length;
    return max === 1 && data === "~" || max === 4 && (data === "null" || data === "Null" || data === "NULL");
  }
  function constructYamlNull() {
    return null;
  }
  function isNull(object) {
    return object === null;
  }
  module.exports = new Type("tag:yaml.org,2002:null", {
    kind: "scalar",
    resolve: resolveYamlNull,
    construct: constructYamlNull,
    predicate: isNull,
    represent: {
      canonical: function() {
        return "~";
      },
      lowercase: function() {
        return "null";
      },
      uppercase: function() {
        return "NULL";
      },
      camelcase: function() {
        return "Null";
      },
      empty: function() {
        return "";
      }
    },
    defaultStyle: "lowercase"
  });
});

// node_modules/.bun/js-yaml@4.1.1/node_modules/js-yaml/lib/type/bool.js
var require_bool = __commonJS((exports, module) => {
  var Type = require_type();
  function resolveYamlBoolean(data) {
    if (data === null)
      return false;
    var max = data.length;
    return max === 4 && (data === "true" || data === "True" || data === "TRUE") || max === 5 && (data === "false" || data === "False" || data === "FALSE");
  }
  function constructYamlBoolean(data) {
    return data === "true" || data === "True" || data === "TRUE";
  }
  function isBoolean(object) {
    return Object.prototype.toString.call(object) === "[object Boolean]";
  }
  module.exports = new Type("tag:yaml.org,2002:bool", {
    kind: "scalar",
    resolve: resolveYamlBoolean,
    construct: constructYamlBoolean,
    predicate: isBoolean,
    represent: {
      lowercase: function(object) {
        return object ? "true" : "false";
      },
      uppercase: function(object) {
        return object ? "TRUE" : "FALSE";
      },
      camelcase: function(object) {
        return object ? "True" : "False";
      }
    },
    defaultStyle: "lowercase"
  });
});

// node_modules/.bun/js-yaml@4.1.1/node_modules/js-yaml/lib/type/int.js
var require_int = __commonJS((exports, module) => {
  var common = require_common();
  var Type = require_type();
  function isHexCode(c) {
    return 48 <= c && c <= 57 || 65 <= c && c <= 70 || 97 <= c && c <= 102;
  }
  function isOctCode(c) {
    return 48 <= c && c <= 55;
  }
  function isDecCode(c) {
    return 48 <= c && c <= 57;
  }
  function resolveYamlInteger(data) {
    if (data === null)
      return false;
    var max = data.length, index = 0, hasDigits = false, ch;
    if (!max)
      return false;
    ch = data[index];
    if (ch === "-" || ch === "+") {
      ch = data[++index];
    }
    if (ch === "0") {
      if (index + 1 === max)
        return true;
      ch = data[++index];
      if (ch === "b") {
        index++;
        for (;index < max; index++) {
          ch = data[index];
          if (ch === "_")
            continue;
          if (ch !== "0" && ch !== "1")
            return false;
          hasDigits = true;
        }
        return hasDigits && ch !== "_";
      }
      if (ch === "x") {
        index++;
        for (;index < max; index++) {
          ch = data[index];
          if (ch === "_")
            continue;
          if (!isHexCode(data.charCodeAt(index)))
            return false;
          hasDigits = true;
        }
        return hasDigits && ch !== "_";
      }
      if (ch === "o") {
        index++;
        for (;index < max; index++) {
          ch = data[index];
          if (ch === "_")
            continue;
          if (!isOctCode(data.charCodeAt(index)))
            return false;
          hasDigits = true;
        }
        return hasDigits && ch !== "_";
      }
    }
    if (ch === "_")
      return false;
    for (;index < max; index++) {
      ch = data[index];
      if (ch === "_")
        continue;
      if (!isDecCode(data.charCodeAt(index))) {
        return false;
      }
      hasDigits = true;
    }
    if (!hasDigits || ch === "_")
      return false;
    return true;
  }
  function constructYamlInteger(data) {
    var value = data, sign = 1, ch;
    if (value.indexOf("_") !== -1) {
      value = value.replace(/_/g, "");
    }
    ch = value[0];
    if (ch === "-" || ch === "+") {
      if (ch === "-")
        sign = -1;
      value = value.slice(1);
      ch = value[0];
    }
    if (value === "0")
      return 0;
    if (ch === "0") {
      if (value[1] === "b")
        return sign * parseInt(value.slice(2), 2);
      if (value[1] === "x")
        return sign * parseInt(value.slice(2), 16);
      if (value[1] === "o")
        return sign * parseInt(value.slice(2), 8);
    }
    return sign * parseInt(value, 10);
  }
  function isInteger(object) {
    return Object.prototype.toString.call(object) === "[object Number]" && (object % 1 === 0 && !common.isNegativeZero(object));
  }
  module.exports = new Type("tag:yaml.org,2002:int", {
    kind: "scalar",
    resolve: resolveYamlInteger,
    construct: constructYamlInteger,
    predicate: isInteger,
    represent: {
      binary: function(obj) {
        return obj >= 0 ? "0b" + obj.toString(2) : "-0b" + obj.toString(2).slice(1);
      },
      octal: function(obj) {
        return obj >= 0 ? "0o" + obj.toString(8) : "-0o" + obj.toString(8).slice(1);
      },
      decimal: function(obj) {
        return obj.toString(10);
      },
      hexadecimal: function(obj) {
        return obj >= 0 ? "0x" + obj.toString(16).toUpperCase() : "-0x" + obj.toString(16).toUpperCase().slice(1);
      }
    },
    defaultStyle: "decimal",
    styleAliases: {
      binary: [2, "bin"],
      octal: [8, "oct"],
      decimal: [10, "dec"],
      hexadecimal: [16, "hex"]
    }
  });
});

// node_modules/.bun/js-yaml@4.1.1/node_modules/js-yaml/lib/type/float.js
var require_float = __commonJS((exports, module) => {
  var common = require_common();
  var Type = require_type();
  var YAML_FLOAT_PATTERN = new RegExp("^(?:[-+]?(?:[0-9][0-9_]*)(?:\\.[0-9_]*)?(?:[eE][-+]?[0-9]+)?" + "|\\.[0-9_]+(?:[eE][-+]?[0-9]+)?" + "|[-+]?\\.(?:inf|Inf|INF)" + "|\\.(?:nan|NaN|NAN))$");
  function resolveYamlFloat(data) {
    if (data === null)
      return false;
    if (!YAML_FLOAT_PATTERN.test(data) || data[data.length - 1] === "_") {
      return false;
    }
    return true;
  }
  function constructYamlFloat(data) {
    var value, sign;
    value = data.replace(/_/g, "").toLowerCase();
    sign = value[0] === "-" ? -1 : 1;
    if ("+-".indexOf(value[0]) >= 0) {
      value = value.slice(1);
    }
    if (value === ".inf") {
      return sign === 1 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
    } else if (value === ".nan") {
      return NaN;
    }
    return sign * parseFloat(value, 10);
  }
  var SCIENTIFIC_WITHOUT_DOT = /^[-+]?[0-9]+e/;
  function representYamlFloat(object, style) {
    var res;
    if (isNaN(object)) {
      switch (style) {
        case "lowercase":
          return ".nan";
        case "uppercase":
          return ".NAN";
        case "camelcase":
          return ".NaN";
      }
    } else if (Number.POSITIVE_INFINITY === object) {
      switch (style) {
        case "lowercase":
          return ".inf";
        case "uppercase":
          return ".INF";
        case "camelcase":
          return ".Inf";
      }
    } else if (Number.NEGATIVE_INFINITY === object) {
      switch (style) {
        case "lowercase":
          return "-.inf";
        case "uppercase":
          return "-.INF";
        case "camelcase":
          return "-.Inf";
      }
    } else if (common.isNegativeZero(object)) {
      return "-0.0";
    }
    res = object.toString(10);
    return SCIENTIFIC_WITHOUT_DOT.test(res) ? res.replace("e", ".e") : res;
  }
  function isFloat(object) {
    return Object.prototype.toString.call(object) === "[object Number]" && (object % 1 !== 0 || common.isNegativeZero(object));
  }
  module.exports = new Type("tag:yaml.org,2002:float", {
    kind: "scalar",
    resolve: resolveYamlFloat,
    construct: constructYamlFloat,
    predicate: isFloat,
    represent: representYamlFloat,
    defaultStyle: "lowercase"
  });
});

// node_modules/.bun/js-yaml@4.1.1/node_modules/js-yaml/lib/schema/json.js
var require_json = __commonJS((exports, module) => {
  module.exports = require_failsafe().extend({
    implicit: [
      require_null(),
      require_bool(),
      require_int(),
      require_float()
    ]
  });
});

// node_modules/.bun/js-yaml@4.1.1/node_modules/js-yaml/lib/type/timestamp.js
var require_timestamp = __commonJS((exports, module) => {
  var Type = require_type();
  var YAML_DATE_REGEXP = new RegExp("^([0-9][0-9][0-9][0-9])" + "-([0-9][0-9])" + "-([0-9][0-9])$");
  var YAML_TIMESTAMP_REGEXP = new RegExp("^([0-9][0-9][0-9][0-9])" + "-([0-9][0-9]?)" + "-([0-9][0-9]?)" + "(?:[Tt]|[ \\t]+)" + "([0-9][0-9]?)" + ":([0-9][0-9])" + ":([0-9][0-9])" + "(?:\\.([0-9]*))?" + "(?:[ \\t]*(Z|([-+])([0-9][0-9]?)" + "(?::([0-9][0-9]))?))?$");
  function resolveYamlTimestamp(data) {
    if (data === null)
      return false;
    if (YAML_DATE_REGEXP.exec(data) !== null)
      return true;
    if (YAML_TIMESTAMP_REGEXP.exec(data) !== null)
      return true;
    return false;
  }
  function constructYamlTimestamp(data) {
    var match, year, month, day, hour, minute, second, fraction = 0, delta = null, tz_hour, tz_minute, date;
    match = YAML_DATE_REGEXP.exec(data);
    if (match === null)
      match = YAML_TIMESTAMP_REGEXP.exec(data);
    if (match === null)
      throw new Error("Date resolve error");
    year = +match[1];
    month = +match[2] - 1;
    day = +match[3];
    if (!match[4]) {
      return new Date(Date.UTC(year, month, day));
    }
    hour = +match[4];
    minute = +match[5];
    second = +match[6];
    if (match[7]) {
      fraction = match[7].slice(0, 3);
      while (fraction.length < 3) {
        fraction += "0";
      }
      fraction = +fraction;
    }
    if (match[9]) {
      tz_hour = +match[10];
      tz_minute = +(match[11] || 0);
      delta = (tz_hour * 60 + tz_minute) * 60000;
      if (match[9] === "-")
        delta = -delta;
    }
    date = new Date(Date.UTC(year, month, day, hour, minute, second, fraction));
    if (delta)
      date.setTime(date.getTime() - delta);
    return date;
  }
  function representYamlTimestamp(object) {
    return object.toISOString();
  }
  module.exports = new Type("tag:yaml.org,2002:timestamp", {
    kind: "scalar",
    resolve: resolveYamlTimestamp,
    construct: constructYamlTimestamp,
    instanceOf: Date,
    represent: representYamlTimestamp
  });
});

// node_modules/.bun/js-yaml@4.1.1/node_modules/js-yaml/lib/type/merge.js
var require_merge = __commonJS((exports, module) => {
  var Type = require_type();
  function resolveYamlMerge(data) {
    return data === "<<" || data === null;
  }
  module.exports = new Type("tag:yaml.org,2002:merge", {
    kind: "scalar",
    resolve: resolveYamlMerge
  });
});

// node_modules/.bun/js-yaml@4.1.1/node_modules/js-yaml/lib/type/binary.js
var require_binary = __commonJS((exports, module) => {
  var Type = require_type();
  var BASE64_MAP = `ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=
\r`;
  function resolveYamlBinary(data) {
    if (data === null)
      return false;
    var code, idx, bitlen = 0, max = data.length, map = BASE64_MAP;
    for (idx = 0;idx < max; idx++) {
      code = map.indexOf(data.charAt(idx));
      if (code > 64)
        continue;
      if (code < 0)
        return false;
      bitlen += 6;
    }
    return bitlen % 8 === 0;
  }
  function constructYamlBinary(data) {
    var idx, tailbits, input = data.replace(/[\r\n=]/g, ""), max = input.length, map = BASE64_MAP, bits = 0, result = [];
    for (idx = 0;idx < max; idx++) {
      if (idx % 4 === 0 && idx) {
        result.push(bits >> 16 & 255);
        result.push(bits >> 8 & 255);
        result.push(bits & 255);
      }
      bits = bits << 6 | map.indexOf(input.charAt(idx));
    }
    tailbits = max % 4 * 6;
    if (tailbits === 0) {
      result.push(bits >> 16 & 255);
      result.push(bits >> 8 & 255);
      result.push(bits & 255);
    } else if (tailbits === 18) {
      result.push(bits >> 10 & 255);
      result.push(bits >> 2 & 255);
    } else if (tailbits === 12) {
      result.push(bits >> 4 & 255);
    }
    return new Uint8Array(result);
  }
  function representYamlBinary(object) {
    var result = "", bits = 0, idx, tail, max = object.length, map = BASE64_MAP;
    for (idx = 0;idx < max; idx++) {
      if (idx % 3 === 0 && idx) {
        result += map[bits >> 18 & 63];
        result += map[bits >> 12 & 63];
        result += map[bits >> 6 & 63];
        result += map[bits & 63];
      }
      bits = (bits << 8) + object[idx];
    }
    tail = max % 3;
    if (tail === 0) {
      result += map[bits >> 18 & 63];
      result += map[bits >> 12 & 63];
      result += map[bits >> 6 & 63];
      result += map[bits & 63];
    } else if (tail === 2) {
      result += map[bits >> 10 & 63];
      result += map[bits >> 4 & 63];
      result += map[bits << 2 & 63];
      result += map[64];
    } else if (tail === 1) {
      result += map[bits >> 2 & 63];
      result += map[bits << 4 & 63];
      result += map[64];
      result += map[64];
    }
    return result;
  }
  function isBinary(obj) {
    return Object.prototype.toString.call(obj) === "[object Uint8Array]";
  }
  module.exports = new Type("tag:yaml.org,2002:binary", {
    kind: "scalar",
    resolve: resolveYamlBinary,
    construct: constructYamlBinary,
    predicate: isBinary,
    represent: representYamlBinary
  });
});

// node_modules/.bun/js-yaml@4.1.1/node_modules/js-yaml/lib/type/omap.js
var require_omap = __commonJS((exports, module) => {
  var Type = require_type();
  var _hasOwnProperty = Object.prototype.hasOwnProperty;
  var _toString = Object.prototype.toString;
  function resolveYamlOmap(data) {
    if (data === null)
      return true;
    var objectKeys = [], index, length, pair, pairKey, pairHasKey, object = data;
    for (index = 0, length = object.length;index < length; index += 1) {
      pair = object[index];
      pairHasKey = false;
      if (_toString.call(pair) !== "[object Object]")
        return false;
      for (pairKey in pair) {
        if (_hasOwnProperty.call(pair, pairKey)) {
          if (!pairHasKey)
            pairHasKey = true;
          else
            return false;
        }
      }
      if (!pairHasKey)
        return false;
      if (objectKeys.indexOf(pairKey) === -1)
        objectKeys.push(pairKey);
      else
        return false;
    }
    return true;
  }
  function constructYamlOmap(data) {
    return data !== null ? data : [];
  }
  module.exports = new Type("tag:yaml.org,2002:omap", {
    kind: "sequence",
    resolve: resolveYamlOmap,
    construct: constructYamlOmap
  });
});

// node_modules/.bun/js-yaml@4.1.1/node_modules/js-yaml/lib/type/pairs.js
var require_pairs = __commonJS((exports, module) => {
  var Type = require_type();
  var _toString = Object.prototype.toString;
  function resolveYamlPairs(data) {
    if (data === null)
      return true;
    var index, length, pair, keys, result, object = data;
    result = new Array(object.length);
    for (index = 0, length = object.length;index < length; index += 1) {
      pair = object[index];
      if (_toString.call(pair) !== "[object Object]")
        return false;
      keys = Object.keys(pair);
      if (keys.length !== 1)
        return false;
      result[index] = [keys[0], pair[keys[0]]];
    }
    return true;
  }
  function constructYamlPairs(data) {
    if (data === null)
      return [];
    var index, length, pair, keys, result, object = data;
    result = new Array(object.length);
    for (index = 0, length = object.length;index < length; index += 1) {
      pair = object[index];
      keys = Object.keys(pair);
      result[index] = [keys[0], pair[keys[0]]];
    }
    return result;
  }
  module.exports = new Type("tag:yaml.org,2002:pairs", {
    kind: "sequence",
    resolve: resolveYamlPairs,
    construct: constructYamlPairs
  });
});

// node_modules/.bun/js-yaml@4.1.1/node_modules/js-yaml/lib/type/set.js
var require_set = __commonJS((exports, module) => {
  var Type = require_type();
  var _hasOwnProperty = Object.prototype.hasOwnProperty;
  function resolveYamlSet(data) {
    if (data === null)
      return true;
    var key, object = data;
    for (key in object) {
      if (_hasOwnProperty.call(object, key)) {
        if (object[key] !== null)
          return false;
      }
    }
    return true;
  }
  function constructYamlSet(data) {
    return data !== null ? data : {};
  }
  module.exports = new Type("tag:yaml.org,2002:set", {
    kind: "mapping",
    resolve: resolveYamlSet,
    construct: constructYamlSet
  });
});

// node_modules/.bun/js-yaml@4.1.1/node_modules/js-yaml/lib/schema/default.js
var require_default = __commonJS((exports, module) => {
  module.exports = require_json().extend({
    implicit: [
      require_timestamp(),
      require_merge()
    ],
    explicit: [
      require_binary(),
      require_omap(),
      require_pairs(),
      require_set()
    ]
  });
});

// node_modules/.bun/js-yaml@4.1.1/node_modules/js-yaml/lib/loader.js
var require_loader = __commonJS((exports, module) => {
  var common = require_common();
  var YAMLException = require_exception();
  var makeSnippet = require_snippet();
  var DEFAULT_SCHEMA = require_default();
  var _hasOwnProperty = Object.prototype.hasOwnProperty;
  var CONTEXT_FLOW_IN = 1;
  var CONTEXT_FLOW_OUT = 2;
  var CONTEXT_BLOCK_IN = 3;
  var CONTEXT_BLOCK_OUT = 4;
  var CHOMPING_CLIP = 1;
  var CHOMPING_STRIP = 2;
  var CHOMPING_KEEP = 3;
  var PATTERN_NON_PRINTABLE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x84\x86-\x9F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/;
  var PATTERN_NON_ASCII_LINE_BREAKS = /[\x85\u2028\u2029]/;
  var PATTERN_FLOW_INDICATORS = /[,\[\]\{\}]/;
  var PATTERN_TAG_HANDLE = /^(?:!|!!|![a-z\-]+!)$/i;
  var PATTERN_TAG_URI = /^(?:!|[^,\[\]\{\}])(?:%[0-9a-f]{2}|[0-9a-z\-#;\/\?:@&=\+\$,_\.!~\*'\(\)\[\]])*$/i;
  function _class(obj) {
    return Object.prototype.toString.call(obj);
  }
  function is_EOL(c) {
    return c === 10 || c === 13;
  }
  function is_WHITE_SPACE(c) {
    return c === 9 || c === 32;
  }
  function is_WS_OR_EOL(c) {
    return c === 9 || c === 32 || c === 10 || c === 13;
  }
  function is_FLOW_INDICATOR(c) {
    return c === 44 || c === 91 || c === 93 || c === 123 || c === 125;
  }
  function fromHexCode(c) {
    var lc;
    if (48 <= c && c <= 57) {
      return c - 48;
    }
    lc = c | 32;
    if (97 <= lc && lc <= 102) {
      return lc - 97 + 10;
    }
    return -1;
  }
  function escapedHexLen(c) {
    if (c === 120) {
      return 2;
    }
    if (c === 117) {
      return 4;
    }
    if (c === 85) {
      return 8;
    }
    return 0;
  }
  function fromDecimalCode(c) {
    if (48 <= c && c <= 57) {
      return c - 48;
    }
    return -1;
  }
  function simpleEscapeSequence(c) {
    return c === 48 ? "\x00" : c === 97 ? "\x07" : c === 98 ? "\b" : c === 116 ? "\t" : c === 9 ? "\t" : c === 110 ? `
` : c === 118 ? "\v" : c === 102 ? "\f" : c === 114 ? "\r" : c === 101 ? "\x1B" : c === 32 ? " " : c === 34 ? '"' : c === 47 ? "/" : c === 92 ? "\\" : c === 78 ? "" : c === 95 ? " " : c === 76 ? "\u2028" : c === 80 ? "\u2029" : "";
  }
  function charFromCodepoint(c) {
    if (c <= 65535) {
      return String.fromCharCode(c);
    }
    return String.fromCharCode((c - 65536 >> 10) + 55296, (c - 65536 & 1023) + 56320);
  }
  function setProperty(object, key, value) {
    if (key === "__proto__") {
      Object.defineProperty(object, key, {
        configurable: true,
        enumerable: true,
        writable: true,
        value
      });
    } else {
      object[key] = value;
    }
  }
  var simpleEscapeCheck = new Array(256);
  var simpleEscapeMap = new Array(256);
  for (i = 0;i < 256; i++) {
    simpleEscapeCheck[i] = simpleEscapeSequence(i) ? 1 : 0;
    simpleEscapeMap[i] = simpleEscapeSequence(i);
  }
  var i;
  function State(input, options) {
    this.input = input;
    this.filename = options["filename"] || null;
    this.schema = options["schema"] || DEFAULT_SCHEMA;
    this.onWarning = options["onWarning"] || null;
    this.legacy = options["legacy"] || false;
    this.json = options["json"] || false;
    this.listener = options["listener"] || null;
    this.implicitTypes = this.schema.compiledImplicit;
    this.typeMap = this.schema.compiledTypeMap;
    this.length = input.length;
    this.position = 0;
    this.line = 0;
    this.lineStart = 0;
    this.lineIndent = 0;
    this.firstTabInLine = -1;
    this.documents = [];
  }
  function generateError(state, message) {
    var mark = {
      name: state.filename,
      buffer: state.input.slice(0, -1),
      position: state.position,
      line: state.line,
      column: state.position - state.lineStart
    };
    mark.snippet = makeSnippet(mark);
    return new YAMLException(message, mark);
  }
  function throwError(state, message) {
    throw generateError(state, message);
  }
  function throwWarning(state, message) {
    if (state.onWarning) {
      state.onWarning.call(null, generateError(state, message));
    }
  }
  var directiveHandlers = {
    YAML: function handleYamlDirective(state, name, args) {
      var match, major, minor;
      if (state.version !== null) {
        throwError(state, "duplication of %YAML directive");
      }
      if (args.length !== 1) {
        throwError(state, "YAML directive accepts exactly one argument");
      }
      match = /^([0-9]+)\.([0-9]+)$/.exec(args[0]);
      if (match === null) {
        throwError(state, "ill-formed argument of the YAML directive");
      }
      major = parseInt(match[1], 10);
      minor = parseInt(match[2], 10);
      if (major !== 1) {
        throwError(state, "unacceptable YAML version of the document");
      }
      state.version = args[0];
      state.checkLineBreaks = minor < 2;
      if (minor !== 1 && minor !== 2) {
        throwWarning(state, "unsupported YAML version of the document");
      }
    },
    TAG: function handleTagDirective(state, name, args) {
      var handle, prefix;
      if (args.length !== 2) {
        throwError(state, "TAG directive accepts exactly two arguments");
      }
      handle = args[0];
      prefix = args[1];
      if (!PATTERN_TAG_HANDLE.test(handle)) {
        throwError(state, "ill-formed tag handle (first argument) of the TAG directive");
      }
      if (_hasOwnProperty.call(state.tagMap, handle)) {
        throwError(state, 'there is a previously declared suffix for "' + handle + '" tag handle');
      }
      if (!PATTERN_TAG_URI.test(prefix)) {
        throwError(state, "ill-formed tag prefix (second argument) of the TAG directive");
      }
      try {
        prefix = decodeURIComponent(prefix);
      } catch (err) {
        throwError(state, "tag prefix is malformed: " + prefix);
      }
      state.tagMap[handle] = prefix;
    }
  };
  function captureSegment(state, start, end, checkJson) {
    var _position, _length, _character, _result;
    if (start < end) {
      _result = state.input.slice(start, end);
      if (checkJson) {
        for (_position = 0, _length = _result.length;_position < _length; _position += 1) {
          _character = _result.charCodeAt(_position);
          if (!(_character === 9 || 32 <= _character && _character <= 1114111)) {
            throwError(state, "expected valid JSON character");
          }
        }
      } else if (PATTERN_NON_PRINTABLE.test(_result)) {
        throwError(state, "the stream contains non-printable characters");
      }
      state.result += _result;
    }
  }
  function mergeMappings(state, destination, source, overridableKeys) {
    var sourceKeys, key, index, quantity;
    if (!common.isObject(source)) {
      throwError(state, "cannot merge mappings; the provided source object is unacceptable");
    }
    sourceKeys = Object.keys(source);
    for (index = 0, quantity = sourceKeys.length;index < quantity; index += 1) {
      key = sourceKeys[index];
      if (!_hasOwnProperty.call(destination, key)) {
        setProperty(destination, key, source[key]);
        overridableKeys[key] = true;
      }
    }
  }
  function storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, startLine, startLineStart, startPos) {
    var index, quantity;
    if (Array.isArray(keyNode)) {
      keyNode = Array.prototype.slice.call(keyNode);
      for (index = 0, quantity = keyNode.length;index < quantity; index += 1) {
        if (Array.isArray(keyNode[index])) {
          throwError(state, "nested arrays are not supported inside keys");
        }
        if (typeof keyNode === "object" && _class(keyNode[index]) === "[object Object]") {
          keyNode[index] = "[object Object]";
        }
      }
    }
    if (typeof keyNode === "object" && _class(keyNode) === "[object Object]") {
      keyNode = "[object Object]";
    }
    keyNode = String(keyNode);
    if (_result === null) {
      _result = {};
    }
    if (keyTag === "tag:yaml.org,2002:merge") {
      if (Array.isArray(valueNode)) {
        for (index = 0, quantity = valueNode.length;index < quantity; index += 1) {
          mergeMappings(state, _result, valueNode[index], overridableKeys);
        }
      } else {
        mergeMappings(state, _result, valueNode, overridableKeys);
      }
    } else {
      if (!state.json && !_hasOwnProperty.call(overridableKeys, keyNode) && _hasOwnProperty.call(_result, keyNode)) {
        state.line = startLine || state.line;
        state.lineStart = startLineStart || state.lineStart;
        state.position = startPos || state.position;
        throwError(state, "duplicated mapping key");
      }
      setProperty(_result, keyNode, valueNode);
      delete overridableKeys[keyNode];
    }
    return _result;
  }
  function readLineBreak(state) {
    var ch;
    ch = state.input.charCodeAt(state.position);
    if (ch === 10) {
      state.position++;
    } else if (ch === 13) {
      state.position++;
      if (state.input.charCodeAt(state.position) === 10) {
        state.position++;
      }
    } else {
      throwError(state, "a line break is expected");
    }
    state.line += 1;
    state.lineStart = state.position;
    state.firstTabInLine = -1;
  }
  function skipSeparationSpace(state, allowComments, checkIndent) {
    var lineBreaks = 0, ch = state.input.charCodeAt(state.position);
    while (ch !== 0) {
      while (is_WHITE_SPACE(ch)) {
        if (ch === 9 && state.firstTabInLine === -1) {
          state.firstTabInLine = state.position;
        }
        ch = state.input.charCodeAt(++state.position);
      }
      if (allowComments && ch === 35) {
        do {
          ch = state.input.charCodeAt(++state.position);
        } while (ch !== 10 && ch !== 13 && ch !== 0);
      }
      if (is_EOL(ch)) {
        readLineBreak(state);
        ch = state.input.charCodeAt(state.position);
        lineBreaks++;
        state.lineIndent = 0;
        while (ch === 32) {
          state.lineIndent++;
          ch = state.input.charCodeAt(++state.position);
        }
      } else {
        break;
      }
    }
    if (checkIndent !== -1 && lineBreaks !== 0 && state.lineIndent < checkIndent) {
      throwWarning(state, "deficient indentation");
    }
    return lineBreaks;
  }
  function testDocumentSeparator(state) {
    var _position = state.position, ch;
    ch = state.input.charCodeAt(_position);
    if ((ch === 45 || ch === 46) && ch === state.input.charCodeAt(_position + 1) && ch === state.input.charCodeAt(_position + 2)) {
      _position += 3;
      ch = state.input.charCodeAt(_position);
      if (ch === 0 || is_WS_OR_EOL(ch)) {
        return true;
      }
    }
    return false;
  }
  function writeFoldedLines(state, count) {
    if (count === 1) {
      state.result += " ";
    } else if (count > 1) {
      state.result += common.repeat(`
`, count - 1);
    }
  }
  function readPlainScalar(state, nodeIndent, withinFlowCollection) {
    var preceding, following, captureStart, captureEnd, hasPendingContent, _line, _lineStart, _lineIndent, _kind = state.kind, _result = state.result, ch;
    ch = state.input.charCodeAt(state.position);
    if (is_WS_OR_EOL(ch) || is_FLOW_INDICATOR(ch) || ch === 35 || ch === 38 || ch === 42 || ch === 33 || ch === 124 || ch === 62 || ch === 39 || ch === 34 || ch === 37 || ch === 64 || ch === 96) {
      return false;
    }
    if (ch === 63 || ch === 45) {
      following = state.input.charCodeAt(state.position + 1);
      if (is_WS_OR_EOL(following) || withinFlowCollection && is_FLOW_INDICATOR(following)) {
        return false;
      }
    }
    state.kind = "scalar";
    state.result = "";
    captureStart = captureEnd = state.position;
    hasPendingContent = false;
    while (ch !== 0) {
      if (ch === 58) {
        following = state.input.charCodeAt(state.position + 1);
        if (is_WS_OR_EOL(following) || withinFlowCollection && is_FLOW_INDICATOR(following)) {
          break;
        }
      } else if (ch === 35) {
        preceding = state.input.charCodeAt(state.position - 1);
        if (is_WS_OR_EOL(preceding)) {
          break;
        }
      } else if (state.position === state.lineStart && testDocumentSeparator(state) || withinFlowCollection && is_FLOW_INDICATOR(ch)) {
        break;
      } else if (is_EOL(ch)) {
        _line = state.line;
        _lineStart = state.lineStart;
        _lineIndent = state.lineIndent;
        skipSeparationSpace(state, false, -1);
        if (state.lineIndent >= nodeIndent) {
          hasPendingContent = true;
          ch = state.input.charCodeAt(state.position);
          continue;
        } else {
          state.position = captureEnd;
          state.line = _line;
          state.lineStart = _lineStart;
          state.lineIndent = _lineIndent;
          break;
        }
      }
      if (hasPendingContent) {
        captureSegment(state, captureStart, captureEnd, false);
        writeFoldedLines(state, state.line - _line);
        captureStart = captureEnd = state.position;
        hasPendingContent = false;
      }
      if (!is_WHITE_SPACE(ch)) {
        captureEnd = state.position + 1;
      }
      ch = state.input.charCodeAt(++state.position);
    }
    captureSegment(state, captureStart, captureEnd, false);
    if (state.result) {
      return true;
    }
    state.kind = _kind;
    state.result = _result;
    return false;
  }
  function readSingleQuotedScalar(state, nodeIndent) {
    var ch, captureStart, captureEnd;
    ch = state.input.charCodeAt(state.position);
    if (ch !== 39) {
      return false;
    }
    state.kind = "scalar";
    state.result = "";
    state.position++;
    captureStart = captureEnd = state.position;
    while ((ch = state.input.charCodeAt(state.position)) !== 0) {
      if (ch === 39) {
        captureSegment(state, captureStart, state.position, true);
        ch = state.input.charCodeAt(++state.position);
        if (ch === 39) {
          captureStart = state.position;
          state.position++;
          captureEnd = state.position;
        } else {
          return true;
        }
      } else if (is_EOL(ch)) {
        captureSegment(state, captureStart, captureEnd, true);
        writeFoldedLines(state, skipSeparationSpace(state, false, nodeIndent));
        captureStart = captureEnd = state.position;
      } else if (state.position === state.lineStart && testDocumentSeparator(state)) {
        throwError(state, "unexpected end of the document within a single quoted scalar");
      } else {
        state.position++;
        captureEnd = state.position;
      }
    }
    throwError(state, "unexpected end of the stream within a single quoted scalar");
  }
  function readDoubleQuotedScalar(state, nodeIndent) {
    var captureStart, captureEnd, hexLength, hexResult, tmp, ch;
    ch = state.input.charCodeAt(state.position);
    if (ch !== 34) {
      return false;
    }
    state.kind = "scalar";
    state.result = "";
    state.position++;
    captureStart = captureEnd = state.position;
    while ((ch = state.input.charCodeAt(state.position)) !== 0) {
      if (ch === 34) {
        captureSegment(state, captureStart, state.position, true);
        state.position++;
        return true;
      } else if (ch === 92) {
        captureSegment(state, captureStart, state.position, true);
        ch = state.input.charCodeAt(++state.position);
        if (is_EOL(ch)) {
          skipSeparationSpace(state, false, nodeIndent);
        } else if (ch < 256 && simpleEscapeCheck[ch]) {
          state.result += simpleEscapeMap[ch];
          state.position++;
        } else if ((tmp = escapedHexLen(ch)) > 0) {
          hexLength = tmp;
          hexResult = 0;
          for (;hexLength > 0; hexLength--) {
            ch = state.input.charCodeAt(++state.position);
            if ((tmp = fromHexCode(ch)) >= 0) {
              hexResult = (hexResult << 4) + tmp;
            } else {
              throwError(state, "expected hexadecimal character");
            }
          }
          state.result += charFromCodepoint(hexResult);
          state.position++;
        } else {
          throwError(state, "unknown escape sequence");
        }
        captureStart = captureEnd = state.position;
      } else if (is_EOL(ch)) {
        captureSegment(state, captureStart, captureEnd, true);
        writeFoldedLines(state, skipSeparationSpace(state, false, nodeIndent));
        captureStart = captureEnd = state.position;
      } else if (state.position === state.lineStart && testDocumentSeparator(state)) {
        throwError(state, "unexpected end of the document within a double quoted scalar");
      } else {
        state.position++;
        captureEnd = state.position;
      }
    }
    throwError(state, "unexpected end of the stream within a double quoted scalar");
  }
  function readFlowCollection(state, nodeIndent) {
    var readNext = true, _line, _lineStart, _pos, _tag = state.tag, _result, _anchor = state.anchor, following, terminator, isPair, isExplicitPair, isMapping, overridableKeys = Object.create(null), keyNode, keyTag, valueNode, ch;
    ch = state.input.charCodeAt(state.position);
    if (ch === 91) {
      terminator = 93;
      isMapping = false;
      _result = [];
    } else if (ch === 123) {
      terminator = 125;
      isMapping = true;
      _result = {};
    } else {
      return false;
    }
    if (state.anchor !== null) {
      state.anchorMap[state.anchor] = _result;
    }
    ch = state.input.charCodeAt(++state.position);
    while (ch !== 0) {
      skipSeparationSpace(state, true, nodeIndent);
      ch = state.input.charCodeAt(state.position);
      if (ch === terminator) {
        state.position++;
        state.tag = _tag;
        state.anchor = _anchor;
        state.kind = isMapping ? "mapping" : "sequence";
        state.result = _result;
        return true;
      } else if (!readNext) {
        throwError(state, "missed comma between flow collection entries");
      } else if (ch === 44) {
        throwError(state, "expected the node content, but found ','");
      }
      keyTag = keyNode = valueNode = null;
      isPair = isExplicitPair = false;
      if (ch === 63) {
        following = state.input.charCodeAt(state.position + 1);
        if (is_WS_OR_EOL(following)) {
          isPair = isExplicitPair = true;
          state.position++;
          skipSeparationSpace(state, true, nodeIndent);
        }
      }
      _line = state.line;
      _lineStart = state.lineStart;
      _pos = state.position;
      composeNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
      keyTag = state.tag;
      keyNode = state.result;
      skipSeparationSpace(state, true, nodeIndent);
      ch = state.input.charCodeAt(state.position);
      if ((isExplicitPair || state.line === _line) && ch === 58) {
        isPair = true;
        ch = state.input.charCodeAt(++state.position);
        skipSeparationSpace(state, true, nodeIndent);
        composeNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
        valueNode = state.result;
      }
      if (isMapping) {
        storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, _line, _lineStart, _pos);
      } else if (isPair) {
        _result.push(storeMappingPair(state, null, overridableKeys, keyTag, keyNode, valueNode, _line, _lineStart, _pos));
      } else {
        _result.push(keyNode);
      }
      skipSeparationSpace(state, true, nodeIndent);
      ch = state.input.charCodeAt(state.position);
      if (ch === 44) {
        readNext = true;
        ch = state.input.charCodeAt(++state.position);
      } else {
        readNext = false;
      }
    }
    throwError(state, "unexpected end of the stream within a flow collection");
  }
  function readBlockScalar(state, nodeIndent) {
    var captureStart, folding, chomping = CHOMPING_CLIP, didReadContent = false, detectedIndent = false, textIndent = nodeIndent, emptyLines = 0, atMoreIndented = false, tmp, ch;
    ch = state.input.charCodeAt(state.position);
    if (ch === 124) {
      folding = false;
    } else if (ch === 62) {
      folding = true;
    } else {
      return false;
    }
    state.kind = "scalar";
    state.result = "";
    while (ch !== 0) {
      ch = state.input.charCodeAt(++state.position);
      if (ch === 43 || ch === 45) {
        if (CHOMPING_CLIP === chomping) {
          chomping = ch === 43 ? CHOMPING_KEEP : CHOMPING_STRIP;
        } else {
          throwError(state, "repeat of a chomping mode identifier");
        }
      } else if ((tmp = fromDecimalCode(ch)) >= 0) {
        if (tmp === 0) {
          throwError(state, "bad explicit indentation width of a block scalar; it cannot be less than one");
        } else if (!detectedIndent) {
          textIndent = nodeIndent + tmp - 1;
          detectedIndent = true;
        } else {
          throwError(state, "repeat of an indentation width identifier");
        }
      } else {
        break;
      }
    }
    if (is_WHITE_SPACE(ch)) {
      do {
        ch = state.input.charCodeAt(++state.position);
      } while (is_WHITE_SPACE(ch));
      if (ch === 35) {
        do {
          ch = state.input.charCodeAt(++state.position);
        } while (!is_EOL(ch) && ch !== 0);
      }
    }
    while (ch !== 0) {
      readLineBreak(state);
      state.lineIndent = 0;
      ch = state.input.charCodeAt(state.position);
      while ((!detectedIndent || state.lineIndent < textIndent) && ch === 32) {
        state.lineIndent++;
        ch = state.input.charCodeAt(++state.position);
      }
      if (!detectedIndent && state.lineIndent > textIndent) {
        textIndent = state.lineIndent;
      }
      if (is_EOL(ch)) {
        emptyLines++;
        continue;
      }
      if (state.lineIndent < textIndent) {
        if (chomping === CHOMPING_KEEP) {
          state.result += common.repeat(`
`, didReadContent ? 1 + emptyLines : emptyLines);
        } else if (chomping === CHOMPING_CLIP) {
          if (didReadContent) {
            state.result += `
`;
          }
        }
        break;
      }
      if (folding) {
        if (is_WHITE_SPACE(ch)) {
          atMoreIndented = true;
          state.result += common.repeat(`
`, didReadContent ? 1 + emptyLines : emptyLines);
        } else if (atMoreIndented) {
          atMoreIndented = false;
          state.result += common.repeat(`
`, emptyLines + 1);
        } else if (emptyLines === 0) {
          if (didReadContent) {
            state.result += " ";
          }
        } else {
          state.result += common.repeat(`
`, emptyLines);
        }
      } else {
        state.result += common.repeat(`
`, didReadContent ? 1 + emptyLines : emptyLines);
      }
      didReadContent = true;
      detectedIndent = true;
      emptyLines = 0;
      captureStart = state.position;
      while (!is_EOL(ch) && ch !== 0) {
        ch = state.input.charCodeAt(++state.position);
      }
      captureSegment(state, captureStart, state.position, false);
    }
    return true;
  }
  function readBlockSequence(state, nodeIndent) {
    var _line, _tag = state.tag, _anchor = state.anchor, _result = [], following, detected = false, ch;
    if (state.firstTabInLine !== -1)
      return false;
    if (state.anchor !== null) {
      state.anchorMap[state.anchor] = _result;
    }
    ch = state.input.charCodeAt(state.position);
    while (ch !== 0) {
      if (state.firstTabInLine !== -1) {
        state.position = state.firstTabInLine;
        throwError(state, "tab characters must not be used in indentation");
      }
      if (ch !== 45) {
        break;
      }
      following = state.input.charCodeAt(state.position + 1);
      if (!is_WS_OR_EOL(following)) {
        break;
      }
      detected = true;
      state.position++;
      if (skipSeparationSpace(state, true, -1)) {
        if (state.lineIndent <= nodeIndent) {
          _result.push(null);
          ch = state.input.charCodeAt(state.position);
          continue;
        }
      }
      _line = state.line;
      composeNode(state, nodeIndent, CONTEXT_BLOCK_IN, false, true);
      _result.push(state.result);
      skipSeparationSpace(state, true, -1);
      ch = state.input.charCodeAt(state.position);
      if ((state.line === _line || state.lineIndent > nodeIndent) && ch !== 0) {
        throwError(state, "bad indentation of a sequence entry");
      } else if (state.lineIndent < nodeIndent) {
        break;
      }
    }
    if (detected) {
      state.tag = _tag;
      state.anchor = _anchor;
      state.kind = "sequence";
      state.result = _result;
      return true;
    }
    return false;
  }
  function readBlockMapping(state, nodeIndent, flowIndent) {
    var following, allowCompact, _line, _keyLine, _keyLineStart, _keyPos, _tag = state.tag, _anchor = state.anchor, _result = {}, overridableKeys = Object.create(null), keyTag = null, keyNode = null, valueNode = null, atExplicitKey = false, detected = false, ch;
    if (state.firstTabInLine !== -1)
      return false;
    if (state.anchor !== null) {
      state.anchorMap[state.anchor] = _result;
    }
    ch = state.input.charCodeAt(state.position);
    while (ch !== 0) {
      if (!atExplicitKey && state.firstTabInLine !== -1) {
        state.position = state.firstTabInLine;
        throwError(state, "tab characters must not be used in indentation");
      }
      following = state.input.charCodeAt(state.position + 1);
      _line = state.line;
      if ((ch === 63 || ch === 58) && is_WS_OR_EOL(following)) {
        if (ch === 63) {
          if (atExplicitKey) {
            storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
            keyTag = keyNode = valueNode = null;
          }
          detected = true;
          atExplicitKey = true;
          allowCompact = true;
        } else if (atExplicitKey) {
          atExplicitKey = false;
          allowCompact = true;
        } else {
          throwError(state, "incomplete explicit mapping pair; a key node is missed; or followed by a non-tabulated empty line");
        }
        state.position += 1;
        ch = following;
      } else {
        _keyLine = state.line;
        _keyLineStart = state.lineStart;
        _keyPos = state.position;
        if (!composeNode(state, flowIndent, CONTEXT_FLOW_OUT, false, true)) {
          break;
        }
        if (state.line === _line) {
          ch = state.input.charCodeAt(state.position);
          while (is_WHITE_SPACE(ch)) {
            ch = state.input.charCodeAt(++state.position);
          }
          if (ch === 58) {
            ch = state.input.charCodeAt(++state.position);
            if (!is_WS_OR_EOL(ch)) {
              throwError(state, "a whitespace character is expected after the key-value separator within a block mapping");
            }
            if (atExplicitKey) {
              storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
              keyTag = keyNode = valueNode = null;
            }
            detected = true;
            atExplicitKey = false;
            allowCompact = false;
            keyTag = state.tag;
            keyNode = state.result;
          } else if (detected) {
            throwError(state, "can not read an implicit mapping pair; a colon is missed");
          } else {
            state.tag = _tag;
            state.anchor = _anchor;
            return true;
          }
        } else if (detected) {
          throwError(state, "can not read a block mapping entry; a multiline key may not be an implicit key");
        } else {
          state.tag = _tag;
          state.anchor = _anchor;
          return true;
        }
      }
      if (state.line === _line || state.lineIndent > nodeIndent) {
        if (atExplicitKey) {
          _keyLine = state.line;
          _keyLineStart = state.lineStart;
          _keyPos = state.position;
        }
        if (composeNode(state, nodeIndent, CONTEXT_BLOCK_OUT, true, allowCompact)) {
          if (atExplicitKey) {
            keyNode = state.result;
          } else {
            valueNode = state.result;
          }
        }
        if (!atExplicitKey) {
          storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, _keyLine, _keyLineStart, _keyPos);
          keyTag = keyNode = valueNode = null;
        }
        skipSeparationSpace(state, true, -1);
        ch = state.input.charCodeAt(state.position);
      }
      if ((state.line === _line || state.lineIndent > nodeIndent) && ch !== 0) {
        throwError(state, "bad indentation of a mapping entry");
      } else if (state.lineIndent < nodeIndent) {
        break;
      }
    }
    if (atExplicitKey) {
      storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
    }
    if (detected) {
      state.tag = _tag;
      state.anchor = _anchor;
      state.kind = "mapping";
      state.result = _result;
    }
    return detected;
  }
  function readTagProperty(state) {
    var _position, isVerbatim = false, isNamed = false, tagHandle, tagName, ch;
    ch = state.input.charCodeAt(state.position);
    if (ch !== 33)
      return false;
    if (state.tag !== null) {
      throwError(state, "duplication of a tag property");
    }
    ch = state.input.charCodeAt(++state.position);
    if (ch === 60) {
      isVerbatim = true;
      ch = state.input.charCodeAt(++state.position);
    } else if (ch === 33) {
      isNamed = true;
      tagHandle = "!!";
      ch = state.input.charCodeAt(++state.position);
    } else {
      tagHandle = "!";
    }
    _position = state.position;
    if (isVerbatim) {
      do {
        ch = state.input.charCodeAt(++state.position);
      } while (ch !== 0 && ch !== 62);
      if (state.position < state.length) {
        tagName = state.input.slice(_position, state.position);
        ch = state.input.charCodeAt(++state.position);
      } else {
        throwError(state, "unexpected end of the stream within a verbatim tag");
      }
    } else {
      while (ch !== 0 && !is_WS_OR_EOL(ch)) {
        if (ch === 33) {
          if (!isNamed) {
            tagHandle = state.input.slice(_position - 1, state.position + 1);
            if (!PATTERN_TAG_HANDLE.test(tagHandle)) {
              throwError(state, "named tag handle cannot contain such characters");
            }
            isNamed = true;
            _position = state.position + 1;
          } else {
            throwError(state, "tag suffix cannot contain exclamation marks");
          }
        }
        ch = state.input.charCodeAt(++state.position);
      }
      tagName = state.input.slice(_position, state.position);
      if (PATTERN_FLOW_INDICATORS.test(tagName)) {
        throwError(state, "tag suffix cannot contain flow indicator characters");
      }
    }
    if (tagName && !PATTERN_TAG_URI.test(tagName)) {
      throwError(state, "tag name cannot contain such characters: " + tagName);
    }
    try {
      tagName = decodeURIComponent(tagName);
    } catch (err) {
      throwError(state, "tag name is malformed: " + tagName);
    }
    if (isVerbatim) {
      state.tag = tagName;
    } else if (_hasOwnProperty.call(state.tagMap, tagHandle)) {
      state.tag = state.tagMap[tagHandle] + tagName;
    } else if (tagHandle === "!") {
      state.tag = "!" + tagName;
    } else if (tagHandle === "!!") {
      state.tag = "tag:yaml.org,2002:" + tagName;
    } else {
      throwError(state, 'undeclared tag handle "' + tagHandle + '"');
    }
    return true;
  }
  function readAnchorProperty(state) {
    var _position, ch;
    ch = state.input.charCodeAt(state.position);
    if (ch !== 38)
      return false;
    if (state.anchor !== null) {
      throwError(state, "duplication of an anchor property");
    }
    ch = state.input.charCodeAt(++state.position);
    _position = state.position;
    while (ch !== 0 && !is_WS_OR_EOL(ch) && !is_FLOW_INDICATOR(ch)) {
      ch = state.input.charCodeAt(++state.position);
    }
    if (state.position === _position) {
      throwError(state, "name of an anchor node must contain at least one character");
    }
    state.anchor = state.input.slice(_position, state.position);
    return true;
  }
  function readAlias(state) {
    var _position, alias, ch;
    ch = state.input.charCodeAt(state.position);
    if (ch !== 42)
      return false;
    ch = state.input.charCodeAt(++state.position);
    _position = state.position;
    while (ch !== 0 && !is_WS_OR_EOL(ch) && !is_FLOW_INDICATOR(ch)) {
      ch = state.input.charCodeAt(++state.position);
    }
    if (state.position === _position) {
      throwError(state, "name of an alias node must contain at least one character");
    }
    alias = state.input.slice(_position, state.position);
    if (!_hasOwnProperty.call(state.anchorMap, alias)) {
      throwError(state, 'unidentified alias "' + alias + '"');
    }
    state.result = state.anchorMap[alias];
    skipSeparationSpace(state, true, -1);
    return true;
  }
  function composeNode(state, parentIndent, nodeContext, allowToSeek, allowCompact) {
    var allowBlockStyles, allowBlockScalars, allowBlockCollections, indentStatus = 1, atNewLine = false, hasContent = false, typeIndex, typeQuantity, typeList, type, flowIndent, blockIndent;
    if (state.listener !== null) {
      state.listener("open", state);
    }
    state.tag = null;
    state.anchor = null;
    state.kind = null;
    state.result = null;
    allowBlockStyles = allowBlockScalars = allowBlockCollections = CONTEXT_BLOCK_OUT === nodeContext || CONTEXT_BLOCK_IN === nodeContext;
    if (allowToSeek) {
      if (skipSeparationSpace(state, true, -1)) {
        atNewLine = true;
        if (state.lineIndent > parentIndent) {
          indentStatus = 1;
        } else if (state.lineIndent === parentIndent) {
          indentStatus = 0;
        } else if (state.lineIndent < parentIndent) {
          indentStatus = -1;
        }
      }
    }
    if (indentStatus === 1) {
      while (readTagProperty(state) || readAnchorProperty(state)) {
        if (skipSeparationSpace(state, true, -1)) {
          atNewLine = true;
          allowBlockCollections = allowBlockStyles;
          if (state.lineIndent > parentIndent) {
            indentStatus = 1;
          } else if (state.lineIndent === parentIndent) {
            indentStatus = 0;
          } else if (state.lineIndent < parentIndent) {
            indentStatus = -1;
          }
        } else {
          allowBlockCollections = false;
        }
      }
    }
    if (allowBlockCollections) {
      allowBlockCollections = atNewLine || allowCompact;
    }
    if (indentStatus === 1 || CONTEXT_BLOCK_OUT === nodeContext) {
      if (CONTEXT_FLOW_IN === nodeContext || CONTEXT_FLOW_OUT === nodeContext) {
        flowIndent = parentIndent;
      } else {
        flowIndent = parentIndent + 1;
      }
      blockIndent = state.position - state.lineStart;
      if (indentStatus === 1) {
        if (allowBlockCollections && (readBlockSequence(state, blockIndent) || readBlockMapping(state, blockIndent, flowIndent)) || readFlowCollection(state, flowIndent)) {
          hasContent = true;
        } else {
          if (allowBlockScalars && readBlockScalar(state, flowIndent) || readSingleQuotedScalar(state, flowIndent) || readDoubleQuotedScalar(state, flowIndent)) {
            hasContent = true;
          } else if (readAlias(state)) {
            hasContent = true;
            if (state.tag !== null || state.anchor !== null) {
              throwError(state, "alias node should not have any properties");
            }
          } else if (readPlainScalar(state, flowIndent, CONTEXT_FLOW_IN === nodeContext)) {
            hasContent = true;
            if (state.tag === null) {
              state.tag = "?";
            }
          }
          if (state.anchor !== null) {
            state.anchorMap[state.anchor] = state.result;
          }
        }
      } else if (indentStatus === 0) {
        hasContent = allowBlockCollections && readBlockSequence(state, blockIndent);
      }
    }
    if (state.tag === null) {
      if (state.anchor !== null) {
        state.anchorMap[state.anchor] = state.result;
      }
    } else if (state.tag === "?") {
      if (state.result !== null && state.kind !== "scalar") {
        throwError(state, 'unacceptable node kind for !<?> tag; it should be "scalar", not "' + state.kind + '"');
      }
      for (typeIndex = 0, typeQuantity = state.implicitTypes.length;typeIndex < typeQuantity; typeIndex += 1) {
        type = state.implicitTypes[typeIndex];
        if (type.resolve(state.result)) {
          state.result = type.construct(state.result);
          state.tag = type.tag;
          if (state.anchor !== null) {
            state.anchorMap[state.anchor] = state.result;
          }
          break;
        }
      }
    } else if (state.tag !== "!") {
      if (_hasOwnProperty.call(state.typeMap[state.kind || "fallback"], state.tag)) {
        type = state.typeMap[state.kind || "fallback"][state.tag];
      } else {
        type = null;
        typeList = state.typeMap.multi[state.kind || "fallback"];
        for (typeIndex = 0, typeQuantity = typeList.length;typeIndex < typeQuantity; typeIndex += 1) {
          if (state.tag.slice(0, typeList[typeIndex].tag.length) === typeList[typeIndex].tag) {
            type = typeList[typeIndex];
            break;
          }
        }
      }
      if (!type) {
        throwError(state, "unknown tag !<" + state.tag + ">");
      }
      if (state.result !== null && type.kind !== state.kind) {
        throwError(state, "unacceptable node kind for !<" + state.tag + '> tag; it should be "' + type.kind + '", not "' + state.kind + '"');
      }
      if (!type.resolve(state.result, state.tag)) {
        throwError(state, "cannot resolve a node with !<" + state.tag + "> explicit tag");
      } else {
        state.result = type.construct(state.result, state.tag);
        if (state.anchor !== null) {
          state.anchorMap[state.anchor] = state.result;
        }
      }
    }
    if (state.listener !== null) {
      state.listener("close", state);
    }
    return state.tag !== null || state.anchor !== null || hasContent;
  }
  function readDocument(state) {
    var documentStart = state.position, _position, directiveName, directiveArgs, hasDirectives = false, ch;
    state.version = null;
    state.checkLineBreaks = state.legacy;
    state.tagMap = Object.create(null);
    state.anchorMap = Object.create(null);
    while ((ch = state.input.charCodeAt(state.position)) !== 0) {
      skipSeparationSpace(state, true, -1);
      ch = state.input.charCodeAt(state.position);
      if (state.lineIndent > 0 || ch !== 37) {
        break;
      }
      hasDirectives = true;
      ch = state.input.charCodeAt(++state.position);
      _position = state.position;
      while (ch !== 0 && !is_WS_OR_EOL(ch)) {
        ch = state.input.charCodeAt(++state.position);
      }
      directiveName = state.input.slice(_position, state.position);
      directiveArgs = [];
      if (directiveName.length < 1) {
        throwError(state, "directive name must not be less than one character in length");
      }
      while (ch !== 0) {
        while (is_WHITE_SPACE(ch)) {
          ch = state.input.charCodeAt(++state.position);
        }
        if (ch === 35) {
          do {
            ch = state.input.charCodeAt(++state.position);
          } while (ch !== 0 && !is_EOL(ch));
          break;
        }
        if (is_EOL(ch))
          break;
        _position = state.position;
        while (ch !== 0 && !is_WS_OR_EOL(ch)) {
          ch = state.input.charCodeAt(++state.position);
        }
        directiveArgs.push(state.input.slice(_position, state.position));
      }
      if (ch !== 0)
        readLineBreak(state);
      if (_hasOwnProperty.call(directiveHandlers, directiveName)) {
        directiveHandlers[directiveName](state, directiveName, directiveArgs);
      } else {
        throwWarning(state, 'unknown document directive "' + directiveName + '"');
      }
    }
    skipSeparationSpace(state, true, -1);
    if (state.lineIndent === 0 && state.input.charCodeAt(state.position) === 45 && state.input.charCodeAt(state.position + 1) === 45 && state.input.charCodeAt(state.position + 2) === 45) {
      state.position += 3;
      skipSeparationSpace(state, true, -1);
    } else if (hasDirectives) {
      throwError(state, "directives end mark is expected");
    }
    composeNode(state, state.lineIndent - 1, CONTEXT_BLOCK_OUT, false, true);
    skipSeparationSpace(state, true, -1);
    if (state.checkLineBreaks && PATTERN_NON_ASCII_LINE_BREAKS.test(state.input.slice(documentStart, state.position))) {
      throwWarning(state, "non-ASCII line breaks are interpreted as content");
    }
    state.documents.push(state.result);
    if (state.position === state.lineStart && testDocumentSeparator(state)) {
      if (state.input.charCodeAt(state.position) === 46) {
        state.position += 3;
        skipSeparationSpace(state, true, -1);
      }
      return;
    }
    if (state.position < state.length - 1) {
      throwError(state, "end of the stream or a document separator is expected");
    } else {
      return;
    }
  }
  function loadDocuments(input, options) {
    input = String(input);
    options = options || {};
    if (input.length !== 0) {
      if (input.charCodeAt(input.length - 1) !== 10 && input.charCodeAt(input.length - 1) !== 13) {
        input += `
`;
      }
      if (input.charCodeAt(0) === 65279) {
        input = input.slice(1);
      }
    }
    var state = new State(input, options);
    var nullpos = input.indexOf("\x00");
    if (nullpos !== -1) {
      state.position = nullpos;
      throwError(state, "null byte is not allowed in input");
    }
    state.input += "\x00";
    while (state.input.charCodeAt(state.position) === 32) {
      state.lineIndent += 1;
      state.position += 1;
    }
    while (state.position < state.length - 1) {
      readDocument(state);
    }
    return state.documents;
  }
  function loadAll(input, iterator, options) {
    if (iterator !== null && typeof iterator === "object" && typeof options === "undefined") {
      options = iterator;
      iterator = null;
    }
    var documents = loadDocuments(input, options);
    if (typeof iterator !== "function") {
      return documents;
    }
    for (var index = 0, length = documents.length;index < length; index += 1) {
      iterator(documents[index]);
    }
  }
  function load(input, options) {
    var documents = loadDocuments(input, options);
    if (documents.length === 0) {
      return;
    } else if (documents.length === 1) {
      return documents[0];
    }
    throw new YAMLException("expected a single document in the stream, but found more");
  }
  exports.loadAll = loadAll;
  exports.load = load;
});

// node_modules/.bun/js-yaml@4.1.1/node_modules/js-yaml/lib/dumper.js
var require_dumper = __commonJS((exports, module) => {
  var common = require_common();
  var YAMLException = require_exception();
  var DEFAULT_SCHEMA = require_default();
  var _toString = Object.prototype.toString;
  var _hasOwnProperty = Object.prototype.hasOwnProperty;
  var CHAR_BOM = 65279;
  var CHAR_TAB = 9;
  var CHAR_LINE_FEED = 10;
  var CHAR_CARRIAGE_RETURN = 13;
  var CHAR_SPACE = 32;
  var CHAR_EXCLAMATION = 33;
  var CHAR_DOUBLE_QUOTE = 34;
  var CHAR_SHARP = 35;
  var CHAR_PERCENT = 37;
  var CHAR_AMPERSAND = 38;
  var CHAR_SINGLE_QUOTE = 39;
  var CHAR_ASTERISK = 42;
  var CHAR_COMMA = 44;
  var CHAR_MINUS = 45;
  var CHAR_COLON = 58;
  var CHAR_EQUALS = 61;
  var CHAR_GREATER_THAN = 62;
  var CHAR_QUESTION = 63;
  var CHAR_COMMERCIAL_AT = 64;
  var CHAR_LEFT_SQUARE_BRACKET = 91;
  var CHAR_RIGHT_SQUARE_BRACKET = 93;
  var CHAR_GRAVE_ACCENT = 96;
  var CHAR_LEFT_CURLY_BRACKET = 123;
  var CHAR_VERTICAL_LINE = 124;
  var CHAR_RIGHT_CURLY_BRACKET = 125;
  var ESCAPE_SEQUENCES = {};
  ESCAPE_SEQUENCES[0] = "\\0";
  ESCAPE_SEQUENCES[7] = "\\a";
  ESCAPE_SEQUENCES[8] = "\\b";
  ESCAPE_SEQUENCES[9] = "\\t";
  ESCAPE_SEQUENCES[10] = "\\n";
  ESCAPE_SEQUENCES[11] = "\\v";
  ESCAPE_SEQUENCES[12] = "\\f";
  ESCAPE_SEQUENCES[13] = "\\r";
  ESCAPE_SEQUENCES[27] = "\\e";
  ESCAPE_SEQUENCES[34] = "\\\"";
  ESCAPE_SEQUENCES[92] = "\\\\";
  ESCAPE_SEQUENCES[133] = "\\N";
  ESCAPE_SEQUENCES[160] = "\\_";
  ESCAPE_SEQUENCES[8232] = "\\L";
  ESCAPE_SEQUENCES[8233] = "\\P";
  var DEPRECATED_BOOLEANS_SYNTAX = [
    "y",
    "Y",
    "yes",
    "Yes",
    "YES",
    "on",
    "On",
    "ON",
    "n",
    "N",
    "no",
    "No",
    "NO",
    "off",
    "Off",
    "OFF"
  ];
  var DEPRECATED_BASE60_SYNTAX = /^[-+]?[0-9_]+(?::[0-9_]+)+(?:\.[0-9_]*)?$/;
  function compileStyleMap(schema, map) {
    var result, keys, index, length, tag, style, type;
    if (map === null)
      return {};
    result = {};
    keys = Object.keys(map);
    for (index = 0, length = keys.length;index < length; index += 1) {
      tag = keys[index];
      style = String(map[tag]);
      if (tag.slice(0, 2) === "!!") {
        tag = "tag:yaml.org,2002:" + tag.slice(2);
      }
      type = schema.compiledTypeMap["fallback"][tag];
      if (type && _hasOwnProperty.call(type.styleAliases, style)) {
        style = type.styleAliases[style];
      }
      result[tag] = style;
    }
    return result;
  }
  function encodeHex(character) {
    var string, handle, length;
    string = character.toString(16).toUpperCase();
    if (character <= 255) {
      handle = "x";
      length = 2;
    } else if (character <= 65535) {
      handle = "u";
      length = 4;
    } else if (character <= 4294967295) {
      handle = "U";
      length = 8;
    } else {
      throw new YAMLException("code point within a string may not be greater than 0xFFFFFFFF");
    }
    return "\\" + handle + common.repeat("0", length - string.length) + string;
  }
  var QUOTING_TYPE_SINGLE = 1;
  var QUOTING_TYPE_DOUBLE = 2;
  function State(options) {
    this.schema = options["schema"] || DEFAULT_SCHEMA;
    this.indent = Math.max(1, options["indent"] || 2);
    this.noArrayIndent = options["noArrayIndent"] || false;
    this.skipInvalid = options["skipInvalid"] || false;
    this.flowLevel = common.isNothing(options["flowLevel"]) ? -1 : options["flowLevel"];
    this.styleMap = compileStyleMap(this.schema, options["styles"] || null);
    this.sortKeys = options["sortKeys"] || false;
    this.lineWidth = options["lineWidth"] || 80;
    this.noRefs = options["noRefs"] || false;
    this.noCompatMode = options["noCompatMode"] || false;
    this.condenseFlow = options["condenseFlow"] || false;
    this.quotingType = options["quotingType"] === '"' ? QUOTING_TYPE_DOUBLE : QUOTING_TYPE_SINGLE;
    this.forceQuotes = options["forceQuotes"] || false;
    this.replacer = typeof options["replacer"] === "function" ? options["replacer"] : null;
    this.implicitTypes = this.schema.compiledImplicit;
    this.explicitTypes = this.schema.compiledExplicit;
    this.tag = null;
    this.result = "";
    this.duplicates = [];
    this.usedDuplicates = null;
  }
  function indentString(string, spaces) {
    var ind = common.repeat(" ", spaces), position = 0, next = -1, result = "", line, length = string.length;
    while (position < length) {
      next = string.indexOf(`
`, position);
      if (next === -1) {
        line = string.slice(position);
        position = length;
      } else {
        line = string.slice(position, next + 1);
        position = next + 1;
      }
      if (line.length && line !== `
`)
        result += ind;
      result += line;
    }
    return result;
  }
  function generateNextLine(state, level) {
    return `
` + common.repeat(" ", state.indent * level);
  }
  function testImplicitResolving(state, str) {
    var index, length, type;
    for (index = 0, length = state.implicitTypes.length;index < length; index += 1) {
      type = state.implicitTypes[index];
      if (type.resolve(str)) {
        return true;
      }
    }
    return false;
  }
  function isWhitespace(c) {
    return c === CHAR_SPACE || c === CHAR_TAB;
  }
  function isPrintable(c) {
    return 32 <= c && c <= 126 || 161 <= c && c <= 55295 && c !== 8232 && c !== 8233 || 57344 <= c && c <= 65533 && c !== CHAR_BOM || 65536 <= c && c <= 1114111;
  }
  function isNsCharOrWhitespace(c) {
    return isPrintable(c) && c !== CHAR_BOM && c !== CHAR_CARRIAGE_RETURN && c !== CHAR_LINE_FEED;
  }
  function isPlainSafe(c, prev, inblock) {
    var cIsNsCharOrWhitespace = isNsCharOrWhitespace(c);
    var cIsNsChar = cIsNsCharOrWhitespace && !isWhitespace(c);
    return (inblock ? cIsNsCharOrWhitespace : cIsNsCharOrWhitespace && c !== CHAR_COMMA && c !== CHAR_LEFT_SQUARE_BRACKET && c !== CHAR_RIGHT_SQUARE_BRACKET && c !== CHAR_LEFT_CURLY_BRACKET && c !== CHAR_RIGHT_CURLY_BRACKET) && c !== CHAR_SHARP && !(prev === CHAR_COLON && !cIsNsChar) || isNsCharOrWhitespace(prev) && !isWhitespace(prev) && c === CHAR_SHARP || prev === CHAR_COLON && cIsNsChar;
  }
  function isPlainSafeFirst(c) {
    return isPrintable(c) && c !== CHAR_BOM && !isWhitespace(c) && c !== CHAR_MINUS && c !== CHAR_QUESTION && c !== CHAR_COLON && c !== CHAR_COMMA && c !== CHAR_LEFT_SQUARE_BRACKET && c !== CHAR_RIGHT_SQUARE_BRACKET && c !== CHAR_LEFT_CURLY_BRACKET && c !== CHAR_RIGHT_CURLY_BRACKET && c !== CHAR_SHARP && c !== CHAR_AMPERSAND && c !== CHAR_ASTERISK && c !== CHAR_EXCLAMATION && c !== CHAR_VERTICAL_LINE && c !== CHAR_EQUALS && c !== CHAR_GREATER_THAN && c !== CHAR_SINGLE_QUOTE && c !== CHAR_DOUBLE_QUOTE && c !== CHAR_PERCENT && c !== CHAR_COMMERCIAL_AT && c !== CHAR_GRAVE_ACCENT;
  }
  function isPlainSafeLast(c) {
    return !isWhitespace(c) && c !== CHAR_COLON;
  }
  function codePointAt(string, pos) {
    var first = string.charCodeAt(pos), second;
    if (first >= 55296 && first <= 56319 && pos + 1 < string.length) {
      second = string.charCodeAt(pos + 1);
      if (second >= 56320 && second <= 57343) {
        return (first - 55296) * 1024 + second - 56320 + 65536;
      }
    }
    return first;
  }
  function needIndentIndicator(string) {
    var leadingSpaceRe = /^\n* /;
    return leadingSpaceRe.test(string);
  }
  var STYLE_PLAIN = 1;
  var STYLE_SINGLE = 2;
  var STYLE_LITERAL = 3;
  var STYLE_FOLDED = 4;
  var STYLE_DOUBLE = 5;
  function chooseScalarStyle(string, singleLineOnly, indentPerLevel, lineWidth, testAmbiguousType, quotingType, forceQuotes, inblock) {
    var i;
    var char = 0;
    var prevChar = null;
    var hasLineBreak = false;
    var hasFoldableLine = false;
    var shouldTrackWidth = lineWidth !== -1;
    var previousLineBreak = -1;
    var plain = isPlainSafeFirst(codePointAt(string, 0)) && isPlainSafeLast(codePointAt(string, string.length - 1));
    if (singleLineOnly || forceQuotes) {
      for (i = 0;i < string.length; char >= 65536 ? i += 2 : i++) {
        char = codePointAt(string, i);
        if (!isPrintable(char)) {
          return STYLE_DOUBLE;
        }
        plain = plain && isPlainSafe(char, prevChar, inblock);
        prevChar = char;
      }
    } else {
      for (i = 0;i < string.length; char >= 65536 ? i += 2 : i++) {
        char = codePointAt(string, i);
        if (char === CHAR_LINE_FEED) {
          hasLineBreak = true;
          if (shouldTrackWidth) {
            hasFoldableLine = hasFoldableLine || i - previousLineBreak - 1 > lineWidth && string[previousLineBreak + 1] !== " ";
            previousLineBreak = i;
          }
        } else if (!isPrintable(char)) {
          return STYLE_DOUBLE;
        }
        plain = plain && isPlainSafe(char, prevChar, inblock);
        prevChar = char;
      }
      hasFoldableLine = hasFoldableLine || shouldTrackWidth && (i - previousLineBreak - 1 > lineWidth && string[previousLineBreak + 1] !== " ");
    }
    if (!hasLineBreak && !hasFoldableLine) {
      if (plain && !forceQuotes && !testAmbiguousType(string)) {
        return STYLE_PLAIN;
      }
      return quotingType === QUOTING_TYPE_DOUBLE ? STYLE_DOUBLE : STYLE_SINGLE;
    }
    if (indentPerLevel > 9 && needIndentIndicator(string)) {
      return STYLE_DOUBLE;
    }
    if (!forceQuotes) {
      return hasFoldableLine ? STYLE_FOLDED : STYLE_LITERAL;
    }
    return quotingType === QUOTING_TYPE_DOUBLE ? STYLE_DOUBLE : STYLE_SINGLE;
  }
  function writeScalar(state, string, level, iskey, inblock) {
    state.dump = function() {
      if (string.length === 0) {
        return state.quotingType === QUOTING_TYPE_DOUBLE ? '""' : "''";
      }
      if (!state.noCompatMode) {
        if (DEPRECATED_BOOLEANS_SYNTAX.indexOf(string) !== -1 || DEPRECATED_BASE60_SYNTAX.test(string)) {
          return state.quotingType === QUOTING_TYPE_DOUBLE ? '"' + string + '"' : "'" + string + "'";
        }
      }
      var indent = state.indent * Math.max(1, level);
      var lineWidth = state.lineWidth === -1 ? -1 : Math.max(Math.min(state.lineWidth, 40), state.lineWidth - indent);
      var singleLineOnly = iskey || state.flowLevel > -1 && level >= state.flowLevel;
      function testAmbiguity(string2) {
        return testImplicitResolving(state, string2);
      }
      switch (chooseScalarStyle(string, singleLineOnly, state.indent, lineWidth, testAmbiguity, state.quotingType, state.forceQuotes && !iskey, inblock)) {
        case STYLE_PLAIN:
          return string;
        case STYLE_SINGLE:
          return "'" + string.replace(/'/g, "''") + "'";
        case STYLE_LITERAL:
          return "|" + blockHeader(string, state.indent) + dropEndingNewline(indentString(string, indent));
        case STYLE_FOLDED:
          return ">" + blockHeader(string, state.indent) + dropEndingNewline(indentString(foldString(string, lineWidth), indent));
        case STYLE_DOUBLE:
          return '"' + escapeString(string, lineWidth) + '"';
        default:
          throw new YAMLException("impossible error: invalid scalar style");
      }
    }();
  }
  function blockHeader(string, indentPerLevel) {
    var indentIndicator = needIndentIndicator(string) ? String(indentPerLevel) : "";
    var clip = string[string.length - 1] === `
`;
    var keep = clip && (string[string.length - 2] === `
` || string === `
`);
    var chomp = keep ? "+" : clip ? "" : "-";
    return indentIndicator + chomp + `
`;
  }
  function dropEndingNewline(string) {
    return string[string.length - 1] === `
` ? string.slice(0, -1) : string;
  }
  function foldString(string, width) {
    var lineRe = /(\n+)([^\n]*)/g;
    var result = function() {
      var nextLF = string.indexOf(`
`);
      nextLF = nextLF !== -1 ? nextLF : string.length;
      lineRe.lastIndex = nextLF;
      return foldLine(string.slice(0, nextLF), width);
    }();
    var prevMoreIndented = string[0] === `
` || string[0] === " ";
    var moreIndented;
    var match;
    while (match = lineRe.exec(string)) {
      var prefix = match[1], line = match[2];
      moreIndented = line[0] === " ";
      result += prefix + (!prevMoreIndented && !moreIndented && line !== "" ? `
` : "") + foldLine(line, width);
      prevMoreIndented = moreIndented;
    }
    return result;
  }
  function foldLine(line, width) {
    if (line === "" || line[0] === " ")
      return line;
    var breakRe = / [^ ]/g;
    var match;
    var start = 0, end, curr = 0, next = 0;
    var result = "";
    while (match = breakRe.exec(line)) {
      next = match.index;
      if (next - start > width) {
        end = curr > start ? curr : next;
        result += `
` + line.slice(start, end);
        start = end + 1;
      }
      curr = next;
    }
    result += `
`;
    if (line.length - start > width && curr > start) {
      result += line.slice(start, curr) + `
` + line.slice(curr + 1);
    } else {
      result += line.slice(start);
    }
    return result.slice(1);
  }
  function escapeString(string) {
    var result = "";
    var char = 0;
    var escapeSeq;
    for (var i = 0;i < string.length; char >= 65536 ? i += 2 : i++) {
      char = codePointAt(string, i);
      escapeSeq = ESCAPE_SEQUENCES[char];
      if (!escapeSeq && isPrintable(char)) {
        result += string[i];
        if (char >= 65536)
          result += string[i + 1];
      } else {
        result += escapeSeq || encodeHex(char);
      }
    }
    return result;
  }
  function writeFlowSequence(state, level, object) {
    var _result = "", _tag = state.tag, index, length, value;
    for (index = 0, length = object.length;index < length; index += 1) {
      value = object[index];
      if (state.replacer) {
        value = state.replacer.call(object, String(index), value);
      }
      if (writeNode(state, level, value, false, false) || typeof value === "undefined" && writeNode(state, level, null, false, false)) {
        if (_result !== "")
          _result += "," + (!state.condenseFlow ? " " : "");
        _result += state.dump;
      }
    }
    state.tag = _tag;
    state.dump = "[" + _result + "]";
  }
  function writeBlockSequence(state, level, object, compact) {
    var _result = "", _tag = state.tag, index, length, value;
    for (index = 0, length = object.length;index < length; index += 1) {
      value = object[index];
      if (state.replacer) {
        value = state.replacer.call(object, String(index), value);
      }
      if (writeNode(state, level + 1, value, true, true, false, true) || typeof value === "undefined" && writeNode(state, level + 1, null, true, true, false, true)) {
        if (!compact || _result !== "") {
          _result += generateNextLine(state, level);
        }
        if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
          _result += "-";
        } else {
          _result += "- ";
        }
        _result += state.dump;
      }
    }
    state.tag = _tag;
    state.dump = _result || "[]";
  }
  function writeFlowMapping(state, level, object) {
    var _result = "", _tag = state.tag, objectKeyList = Object.keys(object), index, length, objectKey, objectValue, pairBuffer;
    for (index = 0, length = objectKeyList.length;index < length; index += 1) {
      pairBuffer = "";
      if (_result !== "")
        pairBuffer += ", ";
      if (state.condenseFlow)
        pairBuffer += '"';
      objectKey = objectKeyList[index];
      objectValue = object[objectKey];
      if (state.replacer) {
        objectValue = state.replacer.call(object, objectKey, objectValue);
      }
      if (!writeNode(state, level, objectKey, false, false)) {
        continue;
      }
      if (state.dump.length > 1024)
        pairBuffer += "? ";
      pairBuffer += state.dump + (state.condenseFlow ? '"' : "") + ":" + (state.condenseFlow ? "" : " ");
      if (!writeNode(state, level, objectValue, false, false)) {
        continue;
      }
      pairBuffer += state.dump;
      _result += pairBuffer;
    }
    state.tag = _tag;
    state.dump = "{" + _result + "}";
  }
  function writeBlockMapping(state, level, object, compact) {
    var _result = "", _tag = state.tag, objectKeyList = Object.keys(object), index, length, objectKey, objectValue, explicitPair, pairBuffer;
    if (state.sortKeys === true) {
      objectKeyList.sort();
    } else if (typeof state.sortKeys === "function") {
      objectKeyList.sort(state.sortKeys);
    } else if (state.sortKeys) {
      throw new YAMLException("sortKeys must be a boolean or a function");
    }
    for (index = 0, length = objectKeyList.length;index < length; index += 1) {
      pairBuffer = "";
      if (!compact || _result !== "") {
        pairBuffer += generateNextLine(state, level);
      }
      objectKey = objectKeyList[index];
      objectValue = object[objectKey];
      if (state.replacer) {
        objectValue = state.replacer.call(object, objectKey, objectValue);
      }
      if (!writeNode(state, level + 1, objectKey, true, true, true)) {
        continue;
      }
      explicitPair = state.tag !== null && state.tag !== "?" || state.dump && state.dump.length > 1024;
      if (explicitPair) {
        if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
          pairBuffer += "?";
        } else {
          pairBuffer += "? ";
        }
      }
      pairBuffer += state.dump;
      if (explicitPair) {
        pairBuffer += generateNextLine(state, level);
      }
      if (!writeNode(state, level + 1, objectValue, true, explicitPair)) {
        continue;
      }
      if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
        pairBuffer += ":";
      } else {
        pairBuffer += ": ";
      }
      pairBuffer += state.dump;
      _result += pairBuffer;
    }
    state.tag = _tag;
    state.dump = _result || "{}";
  }
  function detectType(state, object, explicit) {
    var _result, typeList, index, length, type, style;
    typeList = explicit ? state.explicitTypes : state.implicitTypes;
    for (index = 0, length = typeList.length;index < length; index += 1) {
      type = typeList[index];
      if ((type.instanceOf || type.predicate) && (!type.instanceOf || typeof object === "object" && object instanceof type.instanceOf) && (!type.predicate || type.predicate(object))) {
        if (explicit) {
          if (type.multi && type.representName) {
            state.tag = type.representName(object);
          } else {
            state.tag = type.tag;
          }
        } else {
          state.tag = "?";
        }
        if (type.represent) {
          style = state.styleMap[type.tag] || type.defaultStyle;
          if (_toString.call(type.represent) === "[object Function]") {
            _result = type.represent(object, style);
          } else if (_hasOwnProperty.call(type.represent, style)) {
            _result = type.represent[style](object, style);
          } else {
            throw new YAMLException("!<" + type.tag + '> tag resolver accepts not "' + style + '" style');
          }
          state.dump = _result;
        }
        return true;
      }
    }
    return false;
  }
  function writeNode(state, level, object, block, compact, iskey, isblockseq) {
    state.tag = null;
    state.dump = object;
    if (!detectType(state, object, false)) {
      detectType(state, object, true);
    }
    var type = _toString.call(state.dump);
    var inblock = block;
    var tagStr;
    if (block) {
      block = state.flowLevel < 0 || state.flowLevel > level;
    }
    var objectOrArray = type === "[object Object]" || type === "[object Array]", duplicateIndex, duplicate;
    if (objectOrArray) {
      duplicateIndex = state.duplicates.indexOf(object);
      duplicate = duplicateIndex !== -1;
    }
    if (state.tag !== null && state.tag !== "?" || duplicate || state.indent !== 2 && level > 0) {
      compact = false;
    }
    if (duplicate && state.usedDuplicates[duplicateIndex]) {
      state.dump = "*ref_" + duplicateIndex;
    } else {
      if (objectOrArray && duplicate && !state.usedDuplicates[duplicateIndex]) {
        state.usedDuplicates[duplicateIndex] = true;
      }
      if (type === "[object Object]") {
        if (block && Object.keys(state.dump).length !== 0) {
          writeBlockMapping(state, level, state.dump, compact);
          if (duplicate) {
            state.dump = "&ref_" + duplicateIndex + state.dump;
          }
        } else {
          writeFlowMapping(state, level, state.dump);
          if (duplicate) {
            state.dump = "&ref_" + duplicateIndex + " " + state.dump;
          }
        }
      } else if (type === "[object Array]") {
        if (block && state.dump.length !== 0) {
          if (state.noArrayIndent && !isblockseq && level > 0) {
            writeBlockSequence(state, level - 1, state.dump, compact);
          } else {
            writeBlockSequence(state, level, state.dump, compact);
          }
          if (duplicate) {
            state.dump = "&ref_" + duplicateIndex + state.dump;
          }
        } else {
          writeFlowSequence(state, level, state.dump);
          if (duplicate) {
            state.dump = "&ref_" + duplicateIndex + " " + state.dump;
          }
        }
      } else if (type === "[object String]") {
        if (state.tag !== "?") {
          writeScalar(state, state.dump, level, iskey, inblock);
        }
      } else if (type === "[object Undefined]") {
        return false;
      } else {
        if (state.skipInvalid)
          return false;
        throw new YAMLException("unacceptable kind of an object to dump " + type);
      }
      if (state.tag !== null && state.tag !== "?") {
        tagStr = encodeURI(state.tag[0] === "!" ? state.tag.slice(1) : state.tag).replace(/!/g, "%21");
        if (state.tag[0] === "!") {
          tagStr = "!" + tagStr;
        } else if (tagStr.slice(0, 18) === "tag:yaml.org,2002:") {
          tagStr = "!!" + tagStr.slice(18);
        } else {
          tagStr = "!<" + tagStr + ">";
        }
        state.dump = tagStr + " " + state.dump;
      }
    }
    return true;
  }
  function getDuplicateReferences(object, state) {
    var objects = [], duplicatesIndexes = [], index, length;
    inspectNode(object, objects, duplicatesIndexes);
    for (index = 0, length = duplicatesIndexes.length;index < length; index += 1) {
      state.duplicates.push(objects[duplicatesIndexes[index]]);
    }
    state.usedDuplicates = new Array(length);
  }
  function inspectNode(object, objects, duplicatesIndexes) {
    var objectKeyList, index, length;
    if (object !== null && typeof object === "object") {
      index = objects.indexOf(object);
      if (index !== -1) {
        if (duplicatesIndexes.indexOf(index) === -1) {
          duplicatesIndexes.push(index);
        }
      } else {
        objects.push(object);
        if (Array.isArray(object)) {
          for (index = 0, length = object.length;index < length; index += 1) {
            inspectNode(object[index], objects, duplicatesIndexes);
          }
        } else {
          objectKeyList = Object.keys(object);
          for (index = 0, length = objectKeyList.length;index < length; index += 1) {
            inspectNode(object[objectKeyList[index]], objects, duplicatesIndexes);
          }
        }
      }
    }
  }
  function dump(input, options) {
    options = options || {};
    var state = new State(options);
    if (!state.noRefs)
      getDuplicateReferences(input, state);
    var value = input;
    if (state.replacer) {
      value = state.replacer.call({ "": value }, "", value);
    }
    if (writeNode(state, 0, value, true, true))
      return state.dump + `
`;
    return "";
  }
  exports.dump = dump;
});

// node_modules/.bun/js-yaml@4.1.1/node_modules/js-yaml/index.js
var require_js_yaml = __commonJS((exports, module) => {
  var loader = require_loader();
  var dumper = require_dumper();
  function renamed(from, to) {
    return function() {
      throw new Error("Function yaml." + from + " is removed in js-yaml 4. " + "Use yaml." + to + " instead, which is now safe by default.");
    };
  }
  exports.Type = require_type();
  exports.Schema = require_schema();
  exports.FAILSAFE_SCHEMA = require_failsafe();
  exports.JSON_SCHEMA = require_json();
  exports.CORE_SCHEMA = require_json();
  exports.DEFAULT_SCHEMA = require_default();
  exports.load = loader.load;
  exports.loadAll = loader.loadAll;
  exports.dump = dumper.dump;
  exports.YAMLException = require_exception();
  exports.types = {
    binary: require_binary(),
    float: require_float(),
    map: require_map(),
    null: require_null(),
    pairs: require_pairs(),
    set: require_set(),
    timestamp: require_timestamp(),
    bool: require_bool(),
    int: require_int(),
    merge: require_merge(),
    omap: require_omap(),
    seq: require_seq(),
    str: require_str()
  };
  exports.safeLoad = renamed("safeLoad", "load");
  exports.safeLoadAll = renamed("safeLoadAll", "loadAll");
  exports.safeDump = renamed("safeDump", "dump");
});

// shared/types.ts
function loadAgentSpec(path) {
  const { readFileSync: readFileSync6 } = __require("node:fs");
  const content = readFileSync6(path, "utf-8");
  let spec;
  if (path.endsWith(".json")) {
    spec = JSON.parse(content);
  } else {
    const yaml = require_js_yaml();
    spec = yaml.load(content);
  }
  if (!spec || typeof spec !== "object") {
    throw new Error(`Invalid agent spec file: ${path}`);
  }
  if (!spec.name) {
    throw new Error(`Agent spec missing required 'name' field: ${path}`);
  }
  return spec;
}
var SYSTEM_HOOKS, HARDCODED_DEFAULTS;
var init_types = __esm(() => {
  SYSTEM_HOOKS = [
    { id: "sys-1", owner: "system", event: "PreToolUse", tool: "Bash", condition: { command_pattern: "rm\\s+-rf\\s+[/~.]" }, action: "block", message: "Catastrophic rm -rf blocked" },
    { id: "sys-2", owner: "system", event: "PreToolUse", tool: "Bash", condition: { command_pattern: "git\\s+reset\\s+--hard" }, action: "block", message: "git reset --hard blocked" },
    { id: "sys-3", owner: "system", event: "PreToolUse", tool: "Bash", condition: { command_pattern: "git\\s+clean\\s+-[fd]" }, action: "block", message: "git clean blocked" },
    { id: "sys-4", owner: "system", event: "PreToolUse", tool: "Bash", condition: { command_pattern: "git\\s+push.*--force" }, action: "block", message: "Force push blocked" },
    { id: "sys-5", owner: "system", event: "PreToolUse", tool: "Bash", condition: { command_pattern: "git\\s+checkout\\s+main\\b" }, action: "block", message: "Workers stay on their branch" },
    { id: "sys-6", owner: "system", event: "PreToolUse", tool: "Bash", condition: { command_pattern: "git\\s+merge\\b" }, action: "block", message: "Workers don't merge — use Fleet Mail" },
    { id: "sys-7", owner: "system", event: "PreToolUse", tool: "Edit", condition: { file_glob: "**/fleet/**/config.json" }, action: "block", message: "Use update_worker_config tool" },
    { id: "sys-8", owner: "system", event: "PreToolUse", tool: "Write", condition: { file_glob: "**/fleet/**/config.json" }, action: "block", message: "Use update_worker_config tool" },
    { id: "sys-9", owner: "system", event: "PreToolUse", tool: "Edit", condition: { file_glob: "**/fleet/**/state.json" }, action: "block", message: "Use update_state tool" },
    { id: "sys-10", owner: "system", event: "PreToolUse", tool: "Write", condition: { file_glob: "**/fleet/**/state.json" }, action: "block", message: "Use update_state tool" },
    { id: "sys-11", owner: "system", event: "PreToolUse", tool: "Edit", condition: { file_glob: "**/fleet/**/token" }, action: "block", message: "Token is auto-provisioned" },
    { id: "sys-12", owner: "system", event: "PreToolUse", tool: "Write", condition: { file_glob: "**/fleet/**/token" }, action: "block", message: "Token is auto-provisioned" }
  ];
  HARDCODED_DEFAULTS = {
    model: "opus[1m]",
    runtime: "claude",
    effort: "high",
    permission_mode: "bypassPermissions",
    sleep_duration: null
  };
});

// cli/lib/config.ts
var exports_config = {};
__export(exports_config, {
  writeJsonLocked: () => writeJsonLocked,
  writeJson: () => writeJson,
  updateJsonLocked: () => updateJsonLocked,
  setConfigValue: () => setConfigValue,
  resolveValue: () => resolveValue,
  readJson: () => readJson,
  parseCliValue: () => parseCliValue,
  getSystemHooks: () => getSystemHooks,
  getState: () => getState,
  getFleetConfig: () => getFleetConfig,
  getDefaults: () => getDefaults,
  getConfig: () => getConfig,
  generateLaunchSh: () => generateLaunchSh,
  SYSTEM_HOOKS: () => SYSTEM_HOOKS,
  HARDCODED_DEFAULTS: () => HARDCODED_DEFAULTS
});
import { writeFileSync as writeFileSync4 } from "node:fs";
function getDefaults() {
  const dp = defaultsPath();
  const fromFile = exists(dp) ? readJson(dp) : null;
  return { ...HARDCODED_DEFAULTS, ...fromFile };
}
function getConfig(project, name) {
  const cp = configPath(project, name);
  return readJson(cp);
}
function getState(project, name) {
  const sp = `${workerDir(project, name)}/state.json`;
  return readJson(sp);
}
function getFleetConfig(project) {
  return readJson(fleetJsonPath(project));
}
function resolveValue(project, name, key) {
  const config = getConfig(project, name);
  const defaults = getDefaults();
  const configKey = key === "effort" ? "reasoning_effort" : key;
  if (config) {
    const val = config[configKey];
    if (val !== undefined && val !== null)
      return val;
  }
  return defaults[key] ?? null;
}
function setConfigValue(project, name, key, value) {
  const cp = configPath(project, name);
  const config = readJson(cp);
  if (!config)
    throw new Error(`Config not found: ${cp}`);
  const configKey = key === "effort" ? "reasoning_effort" : key;
  config[configKey] = value;
  writeJsonLocked(cp, config);
  generateLaunchSh(project, name);
}
function generateLaunchSh(project, name) {
  const config = getConfig(project, name);
  if (!config)
    throw new Error(`Config not found for ${name}`);
  const dir = workerDir(project, name);
  const permFlag = config.permission_mode === "bypassPermissions" ? "--dangerously-skip-permissions" : `--permission-mode "${config.permission_mode}"`;
  const script = `#!/bin/bash
# Auto-generated by fleet — restart command for ${name}
# Regenerated on config changes. Do not edit manually.
cd "${config.worktree}"
CLAUDE_CODE_SKIP_PROJECT_LOCK=1 \\
WORKER_NAME="${name}" \\
exec claude \\
  --model "${config.model}" \\
  --effort "${config.reasoning_effort}" \\
  ${permFlag} \\
  --add-dir "${dir}"
`;
  const launchPath = `${dir}/launch.sh`;
  writeFileSync4(launchPath, script);
  Bun.spawnSync(["chmod", "+x", launchPath]);
}
function parseCliValue(raw) {
  if (raw === "null")
    return null;
  if (raw === "true")
    return true;
  if (raw === "false")
    return false;
  if (!isNaN(Number(raw)) && raw.trim() !== "")
    return Number(raw);
  return raw;
}
function getSystemHooks() {
  return [...SYSTEM_HOOKS];
}
var init_config = __esm(() => {
  init_paths();
  init_types();
  init_types();
  init_io();
  init_io();
  init_types();
});

// cli/lib/tmux.ts
function run(args) {
  const result = Bun.spawnSync(["tmux", ...args], { stderr: "pipe" });
  return {
    ok: result.exitCode === 0,
    stdout: result.stdout.toString().trim(),
    stderr: result.stderr.toString().trim()
  };
}
function sessionExists(session) {
  return run(["has-session", "-t", session]).ok;
}
function createSession(session, window, cwd) {
  run(["new-session", "-d", "-s", session, "-n", window, "-c", cwd]);
  const { stdout } = run(["list-panes", "-t", session, "-F", "#{pane_id}"]);
  return stdout.split(`
`)[0];
}
function listPaneIds() {
  const { ok: ok2, stdout } = run(["list-panes", "-a", "-F", "#{pane_id}"]);
  if (!ok2)
    return new Set;
  return new Set(stdout.split(`
`).filter(Boolean));
}
function getPaneTarget(paneId) {
  const { stdout } = run([
    "list-panes",
    "-a",
    "-F",
    "#{pane_id} #{session_name}:#{window_index}.#{pane_index}"
  ]);
  for (const line of stdout.split(`
`)) {
    const [id, target] = line.split(" ");
    if (id === paneId)
      return target || "";
  }
  return "";
}
function windowExists(session, window) {
  const { ok: ok2, stdout } = run(["list-windows", "-t", session, "-F", "#{window_name}"]);
  if (!ok2)
    return false;
  return stdout.split(`
`).includes(window);
}
function splitIntoWindow(session, window, cwd) {
  const { stdout } = run([
    "split-window",
    "-t",
    `${session}:${window}`,
    "-c",
    cwd,
    "-d",
    "-P",
    "-F",
    "#{pane_id}"
  ]);
  run(["select-layout", "-t", `${session}:${window}`, "tiled"]);
  return stdout;
}
function createWindow(session, window, cwd, index) {
  if (index === undefined) {
    const { stdout: windowList } = run(["list-windows", "-t", session, "-F", "#{window_index}"]);
    const usedIndices = new Set(windowList.split(`
`).filter(Boolean).map(Number));
    const { stdout: baseStr } = run(["show-options", "-gv", "base-index"]);
    let freeIndex = parseInt(baseStr, 10) || 1;
    while (usedIndices.has(freeIndex))
      freeIndex++;
    index = freeIndex;
  }
  const target = `${session}:${index}`;
  const { stdout } = run([
    "new-window",
    "-t",
    target,
    "-n",
    window,
    "-c",
    cwd,
    "-d",
    "-P",
    "-F",
    "#{pane_id}"
  ]);
  return stdout;
}
function setPaneTitle(paneId, title) {
  run(["select-pane", "-T", title, "-t", paneId]);
}
function killPane(paneId) {
  run(["kill-pane", "-t", paneId]);
}
function getPanePid(paneId) {
  const { ok: ok2, stdout } = run(["list-panes", "-a", "-F", "#{pane_id} #{pane_pid}"]);
  if (!ok2)
    return null;
  for (const line of stdout.split(`
`)) {
    const [id, pidStr] = line.split(" ");
    if (id === paneId && pidStr)
      return parseInt(pidStr, 10) || null;
  }
  return null;
}
async function killPaneWithProcess(paneId, timeoutMs = 1e4) {
  const pid = getPanePid(paneId);
  if (pid) {
    try {
      process.kill(-pid, "SIGTERM");
    } catch {
      try {
        process.kill(pid, "SIGTERM");
      } catch {}
    }
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        process.kill(pid, 0);
      } catch {
        break;
      }
      await Bun.sleep(500);
    }
    try {
      process.kill(pid, "SIGKILL");
    } catch {}
  }
  killPane(paneId);
}
function sendKeys(paneId, text) {
  run(["send-keys", "-t", paneId, text]);
}
function sendEnter(paneId) {
  run(["send-keys", "-t", paneId, "-H", "0d"]);
}
function capturePane(paneId, lines = 100) {
  const { ok: ok2, stdout } = run(["capture-pane", "-t", paneId, "-p", "-S", `-${lines}`]);
  return ok2 ? stdout : "";
}
async function waitForPrompt(paneId, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const output = capturePane(paneId, 5);
    if (/[❯>]\s*$/m.test(output))
      return true;
    await Bun.sleep(2000);
  }
  return false;
}
function pasteBuffer(paneId, content) {
  const { writeFileSync: writeFileSync5, unlinkSync } = __require("node:fs");
  const MAX_CHUNK = 8 * 1024;
  if (content.length > MAX_CHUNK) {
    const tmpFile2 = `/tmp/fleet-paste-${process.pid}.txt`;
    writeFileSync5(tmpFile2, content);
    try {
      const bufName = `fleet-${process.pid}`;
      run(["delete-buffer", "-b", bufName]);
      const load = run(["load-buffer", "-b", bufName, tmpFile2]);
      if (!load.ok)
        return false;
      run(["paste-buffer", "-b", bufName, "-t", paneId]);
      Bun.sleepSync(500);
      run(["delete-buffer", "-b", bufName]);
      return true;
    } finally {
      try {
        unlinkSync(tmpFile2);
      } catch {}
    }
  }
  const tmpFile = `/tmp/fleet-paste-${process.pid}.txt`;
  writeFileSync5(tmpFile, content);
  try {
    const bufName = `fleet-${process.pid}`;
    run(["delete-buffer", "-b", bufName]);
    const load = run(["load-buffer", "-b", bufName, tmpFile]);
    if (!load.ok)
      return false;
    run(["paste-buffer", "-b", bufName, "-t", paneId, "-d"]);
    return true;
  } finally {
    try {
      unlinkSync(tmpFile);
    } catch {}
  }
}
function windowHasClaudeProcess(session, window) {
  const { ok: ok2, stdout } = run([
    "list-panes",
    "-t",
    `${session}:${window}`,
    "-F",
    "#{pane_id}\t#{pane_current_command}"
  ]);
  if (!ok2)
    return null;
  for (const line of stdout.split(`
`)) {
    const [paneId, cmd] = line.split("\t");
    if (paneId && cmd && (/^\d+\.\d+/.test(cmd) || cmd.includes("claude"))) {
      return paneId;
    }
  }
  return null;
}
async function gracefulStop(paneId, timeoutMs = 30000) {
  sendKeys(paneId, "/exit");
  sendEnter(paneId);
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (!listPaneIds().has(paneId))
      return true;
    const output = capturePane(paneId, 3);
    const lastLine = output.split(`
`).filter(Boolean).pop() || "";
    if (/^\$\s|^➜|^%\s/.test(lastLine))
      return true;
    await Bun.sleep(2000);
  }
  run(["kill-pane", "-t", paneId]);
  return false;
}

// cli/lib/launch.ts
import { readFileSync as readFileSync6, writeFileSync as writeFileSync5, existsSync as existsSync5, copyFileSync as copyFileSync2, mkdirSync as mkdirSync5 } from "node:fs";
import { join as join6 } from "node:path";
async function launchInTmux(name, project, session, window, windowIndex, options) {
  const dir = workerDir(project, name);
  const config = getConfig(project, name);
  if (!config)
    fail(`No config.json for '${name}'`);
  const worktree = config.worktree;
  if (!worktree)
    fail(`No worktree configured for ${name}`);
  if (!existsSync5(worktree))
    fail(`Worktree not found: ${worktree}`);
  const runtime = options?.runtime || "claude";
  info(`Launching in tmux (session: ${session}, window: ${window}, runtime: ${runtime})`);
  const projectRoot = resolveProjectRootFromWorktree(worktree);
  if (projectRoot && projectRoot !== worktree) {
    const mcpSrc = join6(projectRoot, ".mcp.json");
    const mcpDst = join6(worktree, ".mcp.json");
    if (existsSync5(mcpSrc)) {
      try {
        const { unlinkSync, symlinkSync } = __require("node:fs");
        try {
          unlinkSync(mcpDst);
        } catch {}
        symlinkSync(mcpSrc, mcpDst);
      } catch {}
    }
  }
  installWorktreeGitHooks(worktree, projectRoot);
  let paneId;
  let createdSession = false;
  let adopted = false;
  if (!sessionExists(session)) {
    paneId = createSession(session, window, worktree);
    createdSession = true;
  } else if (windowExists(session, window)) {
    const existingPane = windowHasClaudeProcess(session, window);
    if (existingPane) {
      info(`Claude already running in ${window} (${existingPane}), adopting`);
      paneId = existingPane;
      adopted = true;
    } else {
      paneId = splitIntoWindow(session, window, worktree);
    }
  } else {
    paneId = createWindow(session, window, worktree, windowIndex);
  }
  setPaneTitle(paneId, name);
  if (!adopted) {
    try {
      const { readJson: readJsonImport } = await Promise.resolve().then(() => (init_io(), exports_io));
      const fleetJsonPath2 = join6(FLEET_DATA, project, "fleet.json");
      const fleetJson = readJsonImport(fleetJsonPath2);
      if (fleetJson?.layouts?.[window]) {
        Bun.spawnSync(["tmux", "select-layout", "-t", `${session}:${window}`, fleetJson.layouts[window]], { stderr: "pipe" });
      }
    } catch {}
    if (createdSession) {
      sendKeys(paneId, `cd "${worktree}"`);
      sendEnter(paneId);
    }
    const { model, reasoning_effort: effort, permission_mode: perm } = config;
    let cmd;
    if (runtime === "codex") {
      cmd = `WORKER_NAME="${name}" WORKER_RUNTIME=codex codex -m "${model}"`;
      if (perm === "bypassPermissions") {
        cmd += " --dangerously-bypass-approvals-and-sandbox";
      } else {
        cmd += " -s workspace-write -a on-request";
      }
      cmd += ` -c model_reasoning_effort=${effort}`;
      cmd += " --no-alt-screen";
      cmd += ` --add-dir "${dir}"`;
    } else {
      cmd = `CLAUDE_CODE_SKIP_PROJECT_LOCK=1 WORKER_NAME="${name}" claude --model "${model}" --effort "${effort}"`;
      if (perm === "bypassPermissions") {
        cmd += " --dangerously-skip-permissions";
      } else {
        cmd += ` --permission-mode "${perm}"`;
      }
      cmd += ` --add-dir "${dir}"`;
    }
    sendKeys(paneId, cmd);
    sendEnter(paneId);
    info("Waiting for TUI...");
    const ready = await waitForPrompt(paneId);
    if (!ready)
      warn("TUI timeout after 60s, proceeding anyway");
    await Bun.sleep(2000);
    let seedContent;
    try {
      const result = Bun.spawnSync([Bun.which("bun") || "bun", "-e", `
          const { generateSeedContent } = await import('${FLEET_DIR}/mcp/worker-fleet/index.ts');
          process.stdout.write(generateSeedContent());
        `], {
        env: { ...process.env, WORKER_NAME: name, PROJECT_ROOT: worktree },
        stderr: "pipe"
      });
      seedContent = result.exitCode === 0 ? result.stdout.toString() : `You are worker ${name}. Read mission.md, then start your next cycle.`;
    } catch {
      seedContent = `You are worker ${name}. Read mission.md, then start your next cycle.`;
    }
    const pasted = pasteBuffer(paneId, seedContent);
    if (!pasted) {
      warn("Failed to load seed buffer — worker launched without seed");
    } else {
      const settleMs = Math.min(8000, 2000 + Math.floor(seedContent.length / 4096) * 1000);
      await Bun.sleep(settleMs);
      sendEnter(paneId);
      await Bun.sleep(3000);
      const output = capturePane(paneId, 10);
      if (/command not found|bad pattern|zsh:|bash:/.test(output) && !/❯.*command not found/.test(output)) {
        warn("Detected garbled seed (shell errors) — seed may have leaked into shell");
      }
      if (/❯/.test(output))
        sendEnter(paneId);
    }
  }
  const paneTarget = getPaneTarget(paneId);
  const now = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const oldState = getState(project, name);
  const oldSessionId = oldState?.session_id || "";
  let pastSessions = oldState?.past_sessions || [];
  if (oldSessionId) {
    pastSessions = [oldSessionId, ...pastSessions].slice(0, 10);
  }
  writeJsonLocked(join6(dir, "state.json"), {
    status: "active",
    pane_id: paneId,
    pane_target: paneTarget,
    tmux_session: session,
    session_id: "",
    past_sessions: pastSessions,
    last_relaunch: { at: now, reason: adopted ? "adopted" : "fleet-start" },
    relaunch_count: (oldState?.relaunch_count || 0) + (adopted ? 0 : 1),
    cycles_completed: oldState?.cycles_completed || 0,
    last_cycle_at: oldState?.last_cycle_at || null,
    custom: oldState?.custom || {}
  });
  updateRegistry(name, project, paneId, paneTarget, session);
  ok(`Worker '${name}' ${adopted ? "adopted" : "launched in"} pane ${paneId} (session: ${session}, window: ${window})`);
  return paneId;
}
function installWorktreeGitHooks(worktree, projectRoot) {
  try {
    const result = Bun.spawnSync(["git", "-C", worktree, "rev-parse", "--absolute-git-dir"], { stderr: "pipe" });
    const gitDir = result.exitCode === 0 ? result.stdout.toString().trim() : null;
    if (!gitDir)
      return;
    const hooksDir = join6(gitDir, "hooks");
    mkdirSync5(hooksDir, { recursive: true });
    const hookNames = ["commit-msg", "post-commit"];
    for (const hookName of hookNames) {
      let src = projectRoot ? join6(projectRoot, `.claude/scripts/worker-${hookName}-hook.sh`) : "";
      if (!src || !existsSync5(src)) {
        src = join6(FLEET_DIR, `scripts/worker-${hookName}-hook.sh`);
      }
      if (existsSync5(src)) {
        const dst = join6(hooksDir, hookName);
        if (!existsSync5(dst)) {
          copyFileSync2(src, dst);
          Bun.spawnSync(["chmod", "+x", dst]);
        }
      }
    }
  } catch {}
}
function resolveProjectRootFromWorktree(worktree) {
  const match = worktree.match(/^(.+?)(?:-w-[^/]+)?$/);
  if (match && existsSync5(match[1]))
    return match[1];
  try {
    const result = Bun.spawnSync(["git", "-C", worktree, "rev-parse", "--show-toplevel"], { stderr: "pipe" });
    return result.exitCode === 0 ? result.stdout.toString().trim() : null;
  } catch {
    return null;
  }
}
function updateRegistry(name, project, paneId, paneTarget, session) {
  const registryPath = join6(FLEET_DATA, project, "registry.json");
  if (!existsSync5(registryPath))
    return;
  const config = getConfig(project, name);
  if (!config)
    return;
  try {
    const registry = JSON.parse(readFileSync6(registryPath, "utf-8"));
    registry[name] = {
      ...registry[name] || {},
      pane_id: paneId,
      pane_target: paneTarget,
      tmux_session: session,
      branch: config.branch,
      worktree: config.worktree,
      window: config.window,
      model: config.model,
      permission_mode: config.permission_mode,
      status: "active"
    };
    writeFileSync5(registryPath, JSON.stringify(registry, null, 2) + `
`);
  } catch {}
}
var init_launch = __esm(() => {
  init_paths();
  init_config();
  init_fmt2();
});

// cli/lib/worktree.ts
import { mkdirSync as mkdirSync6, existsSync as existsSync6 } from "node:fs";
import { join as join7, dirname as dirname2 } from "node:path";
function syncWorktree(opts) {
  const { name, project, projectRoot, worktreeDir } = opts;
  const fleetWorkerDir = join7(FLEET_DATA, project, name);
  const synced = [];
  if (projectRoot === worktreeDir)
    return synced;
  const missionSrc = join7(fleetWorkerDir, "mission.md");
  const missionDst = join7(worktreeDir, ".claude/workers", name, "mission.md");
  if (existsSync6(missionSrc) && !existsSync6(missionDst)) {
    mkdirSync6(dirname2(missionDst), { recursive: true });
    try {
      Bun.spawnSync(["ln", "-sf", missionSrc, missionDst]);
      synced.push(missionDst);
    } catch {}
  }
  const mcpSrc = join7(projectRoot, ".mcp.json");
  const mcpDst = join7(worktreeDir, ".mcp.json");
  if (existsSync6(mcpSrc) && !existsSync6(mcpDst)) {
    try {
      Bun.spawnSync(["ln", "-sf", mcpSrc, mcpDst]);
      synced.push(mcpDst);
    } catch {}
  }
  for (const f of [".env", "data/users.json"]) {
    const src = join7(projectRoot, f);
    const dst = join7(worktreeDir, f);
    if (existsSync6(src) && !existsSync6(dst)) {
      mkdirSync6(dirname2(dst), { recursive: true });
      try {
        Bun.spawnSync(["ln", "-sf", src, dst]);
        synced.push(dst);
      } catch {}
    }
  }
  const scriptDir = join7(worktreeDir, ".claude/scripts", name);
  if (!existsSync6(scriptDir)) {
    mkdirSync6(scriptDir, { recursive: true });
  }
  const permsDir = join7(worktreeDir, ".claude/workers", name);
  const permsDst = join7(permsDir, "permissions.json");
  if (!existsSync6(permsDst)) {
    mkdirSync6(permsDir, { recursive: true });
    const fleetPerms = join7(fleetWorkerDir, "permissions.json");
    if (existsSync6(fleetPerms)) {
      try {
        Bun.spawnSync(["ln", "-sf", fleetPerms, permsDst]);
        synced.push(permsDst);
      } catch {}
    }
  }
  return synced;
}
var init_worktree = __esm(() => {
  init_paths();
});

// cli/commands/create.ts
import { mkdirSync as mkdirSync7, writeFileSync as writeFileSync6, existsSync as existsSync7, readFileSync as readFileSync7, copyFileSync as copyFileSync3 } from "node:fs";
import { join as join8, dirname as dirname3, basename } from "node:path";
async function runCreate(name, mission, opts, globalOpts) {
  if (!NAME_RE.test(name))
    fail(`Name must be kebab-case: ${name}`);
  const projectForHint = globalOpts.project || resolveProject();
  hintOnboard(projectForHint);
  if (mission.startsWith("@")) {
    const missionPath = mission.slice(1);
    if (!existsSync7(missionPath))
      fail(`Mission file not found: ${missionPath}`);
    mission = readFileSync7(missionPath, "utf-8").trim();
    if (!mission)
      fail(`Mission file is empty: ${missionPath}`);
  }
  const projectRoot = resolveProjectRoot();
  const project = globalOpts.project || resolveProject(projectRoot);
  const dir = workerDir(project, name);
  if (existsSync7(dir))
    fail(`Worker '${name}' already exists in project '${project}'`);
  const defaults = getDefaults();
  const model = opts.model || String(defaults.model || "opus[1m]");
  const runtime = opts.runtime || String(defaults.runtime || "claude");
  const effort = opts.effort || String(defaults.effort || "high");
  const perm = opts.permissionMode || String(defaults.permission_mode || "bypassPermissions");
  let sleepDuration = null;
  if (opts.type) {
    const typeFile = join8(FLEET_DIR, "templates/flat-worker/types", opts.type, "defaults.json");
    if (existsSync7(typeFile)) {
      try {
        const tmpl = JSON.parse(readFileSync7(typeFile, "utf-8"));
        if ("sleep_duration" in tmpl)
          sleepDuration = tmpl.sleep_duration;
      } catch {}
    } else {
      warn(`Unknown type: ${opts.type} (using defaults)`);
    }
  }
  const window = opts.window || name;
  const projectBasename = basename(projectRoot).replace(/-w-.*$/, "");
  const worktreeDir = join8(dirname3(projectRoot), `${projectBasename}-w-${name}`);
  const branch = `worker/${name}`;
  const fleetConfig = getFleetConfig(project);
  const tmuxSession = fleetConfig?.tmux_session || DEFAULT_SESSION;
  info(`Creating worker '${name}' in project '${project}'`);
  mkdirSync7(dir, { recursive: true });
  const allHooks = [...getSystemHooks()];
  if (opts.type && fleetConfig?.hooks_by_type?.[opts.type]) {
    const typeHooks = fleetConfig.hooks_by_type[opts.type];
    for (let i = 0;i < typeHooks.length; i++) {
      allHooks.push({
        ...typeHooks[i],
        id: `type-${i + 1}`,
        owner: "creator"
      });
    }
  }
  const config = {
    model,
    reasoning_effort: effort,
    permission_mode: perm,
    sleep_duration: sleepDuration ?? null,
    window,
    worktree: worktreeDir,
    branch,
    mcp: {},
    hooks: allHooks,
    meta: {
      created_at: new Date().toISOString(),
      created_by: "fleet-cli",
      forked_from: null,
      project
    }
  };
  writeJsonLocked(join8(dir, "config.json"), config);
  writeJsonLocked(join8(dir, "state.json"), { status: "idle" });
  writeFileSync6(join8(dir, "mission.md"), mission + `
`);
  const missionsDir = join8(FLEET_DATA, project, "missions");
  mkdirSync7(missionsDir, { recursive: true });
  try {
    const target = `../${name}/mission.md`;
    const link = join8(missionsDir, `${name}.md`);
    if (existsSync7(link))
      Bun.spawnSync(["rm", "-f", link]);
    Bun.spawnSync(["ln", "-sf", target, link]);
  } catch {}
  ok("Config written");
  if (!existsSync7(worktreeDir)) {
    info(`Creating worktree at ${worktreeDir} (branch: ${branch})`);
    let result = Bun.spawnSync(["git", "-C", projectRoot, "worktree", "add", worktreeDir, branch], { stderr: "pipe" });
    if (result.exitCode !== 0) {
      result = Bun.spawnSync(["git", "-C", projectRoot, "worktree", "add", worktreeDir, "-b", branch], { stderr: "pipe" });
    }
    if (result.exitCode !== 0)
      fail("Failed to create worktree");
    ok("Worktree created");
  } else {
    info(`Worktree already exists: ${worktreeDir}`);
  }
  const mcpSrc = join8(projectRoot, ".mcp.json");
  const bunPath = process.execPath || join8(process.env.HOME || "", ".bun/bin/bun");
  let mcpConfig = { mcpServers: {} };
  if (existsSync7(mcpSrc)) {
    try {
      mcpConfig = JSON.parse(readFileSync7(mcpSrc, "utf-8"));
      if (!mcpConfig.mcpServers)
        mcpConfig.mcpServers = {};
    } catch {
      mcpConfig = { mcpServers: {} };
    }
  }
  let needsUpdate = false;
  if (mcpConfig.mcpServers["worker-fleet"]) {
    delete mcpConfig.mcpServers["worker-fleet"];
    needsUpdate = true;
  }
  const claudeHooksDir = process.env.CLAUDE_HOOKS_DIR || join8(process.env.HOME || "", ".claude-hooks");
  const claudeHooksMcp = join8(claudeHooksDir, "mcp/index.ts");
  if (existsSync7(claudeHooksMcp)) {
    const hooksDir = join8(FLEET_DATA, project, name, "hooks");
    const permsPath = join8(projectRoot, ".claude/workers", name, "permissions.json");
    const existingHooks = mcpConfig.mcpServers["claude-hooks"];
    const hooksEntry = {
      command: bunPath,
      args: ["run", claudeHooksMcp],
      env: {
        HOOKS_DIR: hooksDir,
        HOOKS_IDENTITY: name,
        HOOKS_PERMISSIONS: permsPath
      }
    };
    if (!existingHooks || JSON.stringify(existingHooks) !== JSON.stringify(hooksEntry)) {
      mcpConfig.mcpServers["claude-hooks"] = hooksEntry;
      needsUpdate = true;
    }
  }
  if (needsUpdate) {
    writeFileSync6(mcpSrc, JSON.stringify(mcpConfig, null, 2) + `
`);
    info("Updated MCP servers in .mcp.json");
  }
  if (projectRoot !== worktreeDir) {
    Bun.spawnSync(["rm", "-f", join8(worktreeDir, ".mcp.json")]);
    Bun.spawnSync(["ln", "-sf", mcpSrc, join8(worktreeDir, ".mcp.json")]);
  }
  syncWorktree({ name, project, projectRoot, worktreeDir });
  try {
    const gitDirResult = Bun.spawnSync(["git", "-C", worktreeDir, "rev-parse", "--absolute-git-dir"], { stderr: "pipe" });
    if (gitDirResult.exitCode === 0) {
      const gitDir = gitDirResult.stdout.toString().trim();
      const hooksDir = join8(gitDir, "hooks");
      mkdirSync7(hooksDir, { recursive: true });
      for (const hookName of ["post-commit", "commit-msg"]) {
        let hookSrc = join8(projectRoot, `.claude/scripts/worker-${hookName}-hook.sh`);
        if (!existsSync7(hookSrc))
          hookSrc = join8(FLEET_DIR, `scripts/worker-${hookName}-hook.sh`);
        if (existsSync7(hookSrc)) {
          copyFileSync3(hookSrc, join8(hooksDir, hookName));
          Bun.spawnSync(["chmod", "+x", join8(hooksDir, hookName)]);
        }
      }
    }
  } catch {}
  ok("Worktree configured");
  let mailToken = "";
  if (FLEET_MAIL_URL) {
    if (FLEET_MAIL_URL.includes("localhost") || FLEET_MAIL_URL.includes("127.0.0.1")) {
      try {
        await fetch(`${FLEET_MAIL_URL}/health`, { signal: AbortSignal.timeout(1000) });
      } catch {
        const bmPath = join8(process.env.HOME || "", ".cargo/bin/boring-mail");
        if (existsSync7(bmPath)) {
          info("Starting local boring-mail...");
          Bun.spawn([bmPath, "serve"], { stdio: ["ignore", "ignore", "ignore"] });
          for (let i = 0;i < 6; i++) {
            await new Promise((r) => setTimeout(r, 500));
            try {
              await fetch(`${FLEET_MAIL_URL}/health`, { signal: AbortSignal.timeout(500) });
              break;
            } catch {}
          }
        }
      }
    }
    const accountName = `${name}@${project}`;
    const mailHeaders = { "Content-Type": "application/json" };
    if (FLEET_MAIL_TOKEN)
      mailHeaders["Authorization"] = `Bearer ${FLEET_MAIL_TOKEN}`;
    try {
      const resp = await fetch(`${FLEET_MAIL_URL}/api/accounts`, {
        method: "POST",
        headers: mailHeaders,
        body: JSON.stringify({ name: accountName })
      });
      if (resp.ok) {
        const data = await resp.json();
        mailToken = data.bearerToken || data.token || "";
      } else if (resp.status === 409 && FLEET_MAIL_TOKEN) {
        const resetResp = await fetch(`${FLEET_MAIL_URL}/api/admin/accounts/${encodeURIComponent(accountName)}/reset-token`, { method: "POST", headers: { Authorization: `Bearer ${FLEET_MAIL_TOKEN}` } });
        if (resetResp.ok) {
          const data = await resetResp.json();
          mailToken = data.bearerToken || data.token || "";
        }
      }
    } catch {}
    if (mailToken) {
      writeFileSync6(join8(dir, "token"), mailToken);
      ok("Fleet Mail provisioned");
    } else {
      warn("Fleet Mail provisioning failed — mail_send/mail_inbox won't work until fixed");
      writeFileSync6(join8(dir, "token"), "");
    }
  } else {
    info("Fleet Mail not configured — run: fleet mail-server connect <url>");
    writeFileSync6(join8(dir, "token"), "");
  }
  generateLaunchSh(project, name);
  ok("launch.sh generated");
  if (opts.noLaunch) {
    ok(`Worker '${name}' created (--no-launch: skipping tmux launch)`);
    console.log(`
  Directory: ${dir}
  Worktree:  ${worktreeDir}
  Branch:    ${branch}
`);
    console.log(`  To launch: fleet start ${name}`);
    return;
  }
  const windowIndex = opts.windowIndex ? parseInt(opts.windowIndex, 10) : undefined;
  await launchInTmux(name, project, tmuxSession, window, windowIndex);
}
function register3(parent) {
  const sub = parent.command("create <name> <mission>").description("Create and launch a worker").option("--model <model>", "Override model").option("--effort <effort>", "Override effort").option("--permission-mode <mode>", "Override permission mode").option("--window <name>", "tmux window group").option("--window-index <index>", "Explicit window position").option("--type <type>", "Worker archetype template").option("--no-launch", "Create only, don't launch");
  addGlobalOpts(sub).action(async (name, mission, opts, cmd) => {
    await runCreate(name, mission, {
      model: opts.model,
      effort: opts.effort,
      permissionMode: opts.permissionMode,
      window: opts.window,
      windowIndex: opts.windowIndex,
      type: opts.type,
      noLaunch: opts.launch === false
    }, cmd.optsWithGlobals());
  });
}
var NAME_RE;
var init_create = __esm(() => {
  init_paths();
  init_config();
  init_fmt2();
  init_launch();
  init_worktree();
  init_cli();
  NAME_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
});

// cli/commands/start.ts
import { readFileSync as readFileSync8, readdirSync, copyFileSync as copyFileSync4, existsSync as existsSync8 } from "node:fs";
import { join as join9 } from "node:path";
async function startOne(name, project, opts) {
  const dir = workerDir(project, name);
  const configPath2 = join9(dir, "config.json");
  if (!existsSync8(dir)) {
    warn(`Worker '${name}' not found`);
    return false;
  }
  if (!existsSync8(configPath2)) {
    warn(`No config.json for '${name}'`);
    return false;
  }
  if (!opts.force) {
    const state = getState(project, name);
    if (state?.pane_id && listPaneIds().has(state.pane_id)) {
      info(`Worker '${name}' already running in pane ${state.pane_id} (use --force to restart)`);
      return true;
    }
  }
  const overrides = {};
  if (opts.model)
    overrides.model = opts.model;
  if (opts.effort)
    overrides.reasoning_effort = opts.effort;
  if (opts.permissionMode)
    overrides.permission_mode = opts.permissionMode;
  if (opts.window)
    overrides.window = opts.window;
  const hasOverrides = Object.keys(overrides).length > 0;
  const backupPath = `${configPath2}.start-bak`;
  if (hasOverrides) {
    if (opts.save) {
      info("Saving overrides to config");
      const config2 = JSON.parse(readFileSync8(configPath2, "utf-8"));
      Object.assign(config2, overrides);
      writeJsonLocked(configPath2, config2);
      generateLaunchSh(project, name);
      ok("Config updated + launch.sh regenerated");
    } else {
      copyFileSync4(configPath2, backupPath);
      const config2 = JSON.parse(readFileSync8(configPath2, "utf-8"));
      Object.assign(config2, overrides);
      writeJsonLocked(configPath2, config2);
    }
  }
  const config = getConfig(project, name);
  const window = config?.window || name;
  const fleetConfig = getFleetConfig(project);
  const session = fleetConfig?.tmux_session || DEFAULT_SESSION;
  const windowIndex = opts.windowIndex ? parseInt(opts.windowIndex, 10) : undefined;
  if (config?.worktree) {
    const projectRoot = config.worktree.replace(/-w-[^/]+$/, "");
    syncWorktree({ name, project, projectRoot, worktreeDir: config.worktree });
  }
  try {
    await launchInTmux(name, project, session, window, windowIndex);
    return true;
  } catch (e) {
    warn(`Failed to start ${name}: ${e}`);
    return false;
  } finally {
    if (hasOverrides && !opts.save && existsSync8(backupPath)) {
      copyFileSync4(backupPath, configPath2);
      Bun.spawnSync(["rm", "-f", backupPath]);
      generateLaunchSh(project, name);
    }
  }
}
function listWorkerNames(project) {
  const projectDir = join9(FLEET_DATA, project);
  try {
    return readdirSync(projectDir, { withFileTypes: true }).filter((d) => d.isDirectory() && !["missions", "_user", "_config"].includes(d.name)).map((d) => d.name);
  } catch {
    return [];
  }
}
async function startAllWorkers(project, concurrency, opts) {
  const panes = listPaneIds();
  const workers = listWorkerNames(project);
  const needLaunch = [];
  const alreadyRunning = [];
  for (const name of workers) {
    const state = getState(project, name);
    if (state?.pane_id && panes.has(state.pane_id)) {
      alreadyRunning.push(name);
    } else {
      needLaunch.push(name);
    }
  }
  if (alreadyRunning.length > 0) {
    info(`Already running (${alreadyRunning.length}): ${alreadyRunning.join(", ")}`);
  }
  if (needLaunch.length === 0) {
    ok("All workers already running");
    return;
  }
  info(`Launching ${needLaunch.length} workers (max ${concurrency} concurrent, ${Math.ceil(needLaunch.length / concurrency)} batches)`);
  let launched = 0;
  let failed = 0;
  for (let i = 0;i < needLaunch.length; i += concurrency) {
    const batch = needLaunch.slice(i, i + concurrency);
    const batchNum = Math.floor(i / concurrency) + 1;
    info(`Batch ${batchNum}: ${batch.join(", ")}`);
    for (const name of batch) {
      const success = await startOne(name, project, opts);
      if (success)
        launched++;
      else
        failed++;
      if (batch.indexOf(name) < batch.length - 1) {
        await Bun.sleep(2000);
      }
    }
    if (i + concurrency < needLaunch.length) {
      info("Waiting 5s before next batch...");
      await Bun.sleep(5000);
    }
  }
  ok(`Done: ${launched} launched, ${failed} failed, ${alreadyRunning.length} already running`);
}
function register4(parent) {
  const sub = parent.command("start [name]").alias("restart").description("Start or restart a worker (use --all for all workers)").option("-a, --all", "Start all workers that aren't running").option("-c, --concurrency <n>", "Max concurrent launches for --all (default: 4)", "4").option("--model <model>", "Override model").option("--effort <effort>", "Override effort").option("--permission-mode <mode>", "Override permission mode").option("--window <name>", "tmux window group").option("--window-index <index>", "Explicit window position").option("--save", "Persist flag overrides to config").option("-f, --force", "Force restart even if worker is already running");
  addGlobalOpts(sub).action(async (name, opts, cmd) => {
    const project = cmd.optsWithGlobals().project || resolveProject();
    hintOnboard(project);
    if (opts.all) {
      const concurrency = Math.max(1, Math.min(8, parseInt(opts.concurrency || "4", 10)));
      await startAllWorkers(project, concurrency, opts);
      return;
    }
    if (!name)
      fail("Usage: fleet start <name> or fleet start --all");
    await startOne(name, project, opts);
  });
}
var init_start = __esm(() => {
  init_paths();
  init_config();
  init_fmt2();
  init_launch();
  init_worktree();
  init_cli();
});

// cli/commands/stop.ts
import { readdirSync as readdirSync2, existsSync as existsSync9 } from "node:fs";
import { join as join10 } from "node:path";
async function stopWorker(name, project) {
  const dir = workerDir(project, name);
  const statePath2 = join10(dir, "state.json");
  if (!existsSync9(statePath2)) {
    warn(`State not found for '${name}'`);
    return;
  }
  const state = getState(project, name);
  const paneId = state?.pane_id;
  if (!paneId) {
    warn(`'${name}' has no pane — marking standby`);
    writeJsonLocked(statePath2, { ...state, status: "standby", pane_id: null, pane_target: null });
    return;
  }
  if (!listPaneIds().has(paneId)) {
    warn(`'${name}' pane ${paneId} is already gone — marking standby`);
    writeJsonLocked(statePath2, { ...state, status: "standby", pane_id: null, pane_target: null });
    return;
  }
  info(`Stopping '${name}' (pane ${paneId})`);
  await gracefulStop(paneId);
  writeJsonLocked(statePath2, { ...state, status: "standby", pane_id: null, pane_target: null });
  ok(`Worker '${name}' stopped (standby — watchdog will not respawn)`);
}
function register5(parent) {
  const sub = parent.command("stop [name]").description("Graceful stop (use --all for all workers)").option("-a, --all", "Stop all workers");
  addGlobalOpts(sub).action(async (name, opts, cmd) => {
    const project = cmd.optsWithGlobals().project || resolveProject();
    if (opts.all) {
      const projectDir = join10(FLEET_DATA, project);
      if (!existsSync9(projectDir))
        fail(`Project not found: ${project}`);
      let stopped = 0;
      const workers = readdirSync2(projectDir, { withFileTypes: true }).filter((d) => d.isDirectory() && !["missions", "_user", "_config"].includes(d.name)).map((d) => d.name);
      for (const w of workers) {
        const state = getState(project, w);
        if (!state || state.status !== "active" && state.status !== "sleeping")
          continue;
        await stopWorker(w, project);
        stopped++;
      }
      if (stopped === 0)
        info("No active workers to stop");
      return;
    }
    if (!name)
      fail("Usage: fleet stop <name> [--all]");
    await stopWorker(name, project);
  });
}
var init_stop = __esm(() => {
  init_paths();
  init_config();
  init_fmt2();
  init_cli();
});

// cli/commands/ls.ts
import { readdirSync as readdirSync3 } from "node:fs";
function register6(parent) {
  const sub = parent.command("list").alias("ls").description("List all workers");
  addGlobalOpts(sub).action((_opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals();
    const filterProject = globalOpts.project;
    const json = globalOpts.json;
    const panes = listPaneIds();
    const results = [];
    let projects;
    try {
      projects = readdirSync3(FLEET_DATA, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
    } catch {
      projects = [];
    }
    for (const project of projects) {
      if (filterProject && project !== filterProject)
        continue;
      let workers;
      try {
        workers = readdirSync3(`${FLEET_DATA}/${project}`, { withFileTypes: true }).filter((d) => d.isDirectory() && !["missions", "_user", "_config"].includes(d.name)).map((d) => d.name);
      } catch {
        continue;
      }
      for (const name of workers) {
        const config = getConfig(project, name);
        const state = getState(project, name);
        if (!config || !state)
          continue;
        let status = state.status || "unknown";
        if (status === "active" && state.pane_id && !panes.has(state.pane_id)) {
          status = "dead";
        }
        results.push({
          name,
          project,
          status,
          model: config.model || "-",
          pane: state.pane_id || "-",
          window: config.window || "-",
          branch: config.branch || "-"
        });
      }
    }
    if (json) {
      console.log(JSON.stringify(results, null, 2));
      return;
    }
    if (results.length === 0) {
      console.log("No workers found." + (filterProject ? ` (project: ${filterProject})` : ""));
      console.log(`  Run ${source_default.cyan("fleet create <name> <mission>")} to create one.`);
      return;
    }
    const uniqueProjects = new Set(results.map((r) => r.project));
    if (uniqueProjects.size > 1) {
      table(["NAME", "PROJECT", "STATUS", "MODEL", "PANE", "WINDOW", "BRANCH"], results.map((r) => [
        r.name,
        r.project,
        statusColor(r.status),
        r.model,
        r.pane,
        r.window,
        r.branch
      ]));
    } else {
      table(["NAME", "STATUS", "MODEL", "PANE", "WINDOW", "BRANCH"], results.map((r) => [
        r.name,
        statusColor(r.status),
        r.model,
        r.pane,
        r.window,
        r.branch
      ]));
    }
  });
}
var init_ls = __esm(() => {
  init_paths();
  init_config();
  init_source();
  init_fmt2();
  init_cli();
});

// cli/commands/status.ts
var exports_status = {};
__export(exports_status, {
  runStatus: () => runStatus,
  register: () => register7
});
import { readdirSync as readdirSync4, existsSync as existsSync10, readFileSync as readFileSync9 } from "node:fs";
import { join as join11 } from "node:path";
async function runStatus(globalOpts) {
  const HOME4 = process.env.HOME || "/tmp";
  const panes = listPaneIds();
  const json = globalOpts.json;
  let projects = [];
  try {
    projects = readdirSync4(FLEET_DATA, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  } catch {}
  const counts = { active: 0, sleeping: 0, idle: 0, dead: 0 };
  let totalWorkers = 0;
  for (const project of projects) {
    let workers;
    try {
      workers = readdirSync4(join11(FLEET_DATA, project), { withFileTypes: true }).filter((d) => d.isDirectory() && !["missions", "_user", "_config"].includes(d.name)).map((d) => d.name);
    } catch {
      continue;
    }
    for (const name of workers) {
      const config = getConfig(project, name);
      const state = getState(project, name);
      if (!config || !state)
        continue;
      totalWorkers++;
      let status = state.status || "unknown";
      if (status === "active" && state.pane_id && !panes.has(state.pane_id)) {
        status = "dead";
      }
      if (status in counts)
        counts[status]++;
    }
  }
  const tmuxSessions = [];
  const tmuxResult = Bun.spawnSync(["tmux", "list-sessions", "-F", "#{session_name}"], { stderr: "pipe" });
  if (tmuxResult.exitCode === 0) {
    tmuxSessions.push(...tmuxResult.stdout.toString().trim().split(`
`).filter(Boolean));
  }
  const settingsFile = join11(HOME4, ".claude/settings.json");
  let mcpRegistered = false;
  if (existsSync10(settingsFile)) {
    try {
      const s = JSON.parse(readFileSync9(settingsFile, "utf-8"));
      mcpRegistered = !!s?.mcpServers?.["worker-fleet"];
    } catch {}
  }
  let mailStatus = "not configured";
  if (FLEET_MAIL_URL) {
    try {
      const resp = await fetch(`${FLEET_MAIL_URL}/health`, { signal: AbortSignal.timeout(3000) });
      mailStatus = resp.ok ? "reachable" : `error (${resp.status})`;
    } catch {
      mailStatus = "unreachable";
    }
  }
  if (json) {
    console.log(JSON.stringify({
      projects: projects.length,
      workers: totalWorkers,
      counts,
      tmux_sessions: tmuxSessions,
      mcp_registered: mcpRegistered,
      fleet_mail: mailStatus
    }, null, 2));
    return;
  }
  console.log(source_default.bold("Fleet Status"));
  console.log("");
  console.log(`  ${source_default.cyan("Projects:")}  ${projects.length > 0 ? projects.join(", ") : source_default.dim("none")}`);
  const parts = [];
  if (counts.active > 0)
    parts.push(source_default.green(`${counts.active} active`));
  if (counts.sleeping > 0)
    parts.push(source_default.yellow(`${counts.sleeping} sleeping`));
  if (counts.idle > 0)
    parts.push(source_default.dim(`${counts.idle} idle`));
  if (counts.dead > 0)
    parts.push(source_default.red(`${counts.dead} dead`));
  console.log(`  ${source_default.cyan("Workers:")}   ${totalWorkers} total (${parts.join(", ") || "none"})`);
  console.log(`  ${source_default.cyan("tmux:")}      ${tmuxSessions.length > 0 ? tmuxSessions.join(", ") : source_default.red("no sessions")}`);
  console.log(`  ${source_default.cyan("MCP:")}       ${mcpRegistered ? source_default.green("registered") : source_default.red("not registered")}`);
  if (FLEET_MAIL_URL) {
    const mailColor = mailStatus === "reachable" ? source_default.green : source_default.red;
    console.log(`  ${source_default.cyan("Mail:")}      ${mailColor(mailStatus)} ${source_default.dim(`(${FLEET_MAIL_URL})`)}`);
  } else {
    console.log(`  ${source_default.cyan("Mail:")}      ${source_default.dim("not configured")} — fleet mail-server connect <url>`);
  }
}
function register7(parent) {
  const sub = parent.command("status").description("Fleet overview — sessions, workers, mail, MCP");
  addGlobalOpts(sub).action(async (_opts, cmd) => {
    await runStatus(cmd.optsWithGlobals());
  });
}
var init_status = __esm(() => {
  init_source();
  init_paths();
  init_config();
  init_cli();
});

// cli/commands/attach.ts
function register8(parent) {
  const cmd = parent.command("attach <name>").description("Focus a worker's tmux pane");
  addGlobalOpts(cmd).action((name, _opts, cmd2) => {
    const project = cmd2.optsWithGlobals().project || resolveProject();
    const state = getState(project, name);
    if (!state)
      fail(`Worker '${name}' not found in project '${project}'`);
    const paneId = state.pane_id;
    if (!paneId)
      fail(`Worker '${name}' has no active pane (status: ${state.status})`);
    if (!listPaneIds().has(paneId))
      fail(`Pane ${paneId} no longer exists. Try: fleet start ${name}`);
    const result = Bun.spawnSync(["tmux", "select-pane", "-t", paneId]);
    if (result.exitCode !== 0) {
      Bun.spawnSync(["tmux", "switch-client", "-t", paneId]);
    }
  });
}
var init_attach = __esm(() => {
  init_paths();
  init_config();
  init_fmt2();
  init_cli();
});

// cli/commands/config.ts
function register9(parent) {
  const sub = parent.command("config <name> [key] [value]").alias("cfg").description("Get/set worker config").option("--full", "Show full config including hooks");
  addGlobalOpts(sub).action((name, key, value, opts, cmd) => {
    const project = cmd.optsWithGlobals().project || resolveProject();
    const config = getConfig(project, name);
    if (!config)
      fail(`Config not found for '${name}' in '${project}'`);
    if (!key) {
      if (opts.full) {
        console.log(JSON.stringify(config, null, 2));
      } else {
        const { hooks, mcp, ...summary } = config;
        const hookCount = Array.isArray(hooks) ? hooks.length : 0;
        console.log(JSON.stringify({ ...summary, hooks: `[${hookCount} hooks — use --full to show]` }, null, 2));
      }
      return;
    }
    if (!value) {
      const val = resolveValue(project, name, key);
      console.log(typeof val === "object" ? JSON.stringify(val, null, 2) : String(val));
      return;
    }
    setConfigValue(project, name, key, parseCliValue(value));
    ok(`${key} → ${value} (launch.sh regenerated)`);
  });
}
var init_config2 = __esm(() => {
  init_paths();
  init_config();
  init_fmt2();
  init_cli();
});

// cli/commands/defaults.ts
function register10(parent) {
  parent.command("defaults [key] [value]").description("Get/set global defaults").action((key, value) => {
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
    defaults[key] = parseCliValue(value);
    writeJsonLocked(defaultsPath(), defaults);
    ok(`${key} → ${value}`);
  });
}
var init_defaults = __esm(() => {
  init_paths();
  init_config();
  init_fmt2();
});

// cli/commands/log.ts
function register11(parent) {
  const sub = parent.command("log <name>").alias("logs").description("Tail worker's tmux pane output").option("-n <lines>", "Number of lines", "100");
  addGlobalOpts(sub).action((name, opts, cmd) => {
    const project = cmd.optsWithGlobals().project || resolveProject();
    const state = getState(project, name);
    if (!state)
      return fail(`State not found for '${name}'`);
    const paneId = state.pane_id;
    if (!paneId)
      return fail(`'${name}' has no active pane`);
    if (!listPaneIds().has(paneId))
      return fail(`Pane ${paneId} no longer exists`);
    const lines = parseInt(opts.n, 10) || 100;
    console.log(capturePane(paneId, lines));
  });
}
var init_log = __esm(() => {
  init_paths();
  init_config();
  init_fmt2();
  init_cli();
});

// shared/identity.ts
import { execSync } from "child_process";
import { basename as basename2, join as join12 } from "path";
import { readFileSync as readFileSync10, readdirSync as readdirSync5 } from "fs";
function isValidSessionId(id) {
  return UUID_RE.test(id);
}
function resolveSessionId(opts) {
  if (opts?.sessionId) {
    return isValidSessionId(opts.sessionId) ? opts.sessionId : null;
  }
  const pane = opts?.tmuxPane || process.env.TMUX_PANE;
  if (pane) {
    const byPanePath = join12(PANE_MAP_DIR, "by-pane", pane);
    try {
      const sid = readFileSync10(byPanePath, "utf-8").trim();
      if (sid && isValidSessionId(sid))
        return sid;
    } catch {}
  }
  if (process.env.CLAUDE_SESSION_ID && isValidSessionId(process.env.CLAUDE_SESSION_ID)) {
    return process.env.CLAUDE_SESSION_ID;
  }
  return null;
}
function resolveDirSlug(cwd) {
  const dir = cwd || process.cwd();
  let base;
  try {
    const toplevel = execSync("git rev-parse --show-toplevel", {
      cwd: dir,
      encoding: "utf-8",
      timeout: 5000
    }).trim();
    base = basename2(toplevel);
  } catch {
    base = basename2(dir);
  }
  return base.replace(/-w-.*$/, "");
}
function buildMailName(customName, dirSlug, sessionId) {
  const name = customName || "session";
  return `${name}-${dirSlug}-${sessionId}`;
}
function sanitizeName(name) {
  let s = name;
  s = s.replace(/\0/g, "");
  s = s.replace(/[\x00-\x1f\x7f]/g, "");
  s = s.replace(/\.\./g, "");
  s = s.replace(/[/\\]/g, "");
  s = s.replace(/^[.\s]+|[.\s]+$/g, "");
  s = s.slice(0, 128);
  return s || "session";
}
function detectLegacyWorkerName() {
  if (process.env.WORKER_NAME)
    return process.env.WORKER_NAME;
  try {
    const branch = execSync("git rev-parse --abbrev-ref HEAD", {
      cwd: process.cwd(),
      encoding: "utf-8",
      timeout: 5000
    }).trim();
    if (branch.startsWith("worker/"))
      return branch.slice("worker/".length);
    const dirName = basename2(process.cwd());
    const match = dirName.match(/-w-(.+)$/);
    if (match)
      return match[1];
  } catch {}
  return null;
}
function loadSessionIdentity(sessionId) {
  if (!isValidSessionId(sessionId))
    return null;
  const idPath = join12(SESSIONS_DIR, sessionId, "identity.json");
  try {
    return JSON.parse(readFileSync10(idPath, "utf-8"));
  } catch {
    return null;
  }
}
function listSessionIdentities() {
  try {
    const dirs = readdirSync5(SESSIONS_DIR);
    return dirs.map((d) => loadSessionIdentity(d)).filter((id) => id !== null);
  } catch {
    return [];
  }
}
function resolveIdentity(opts) {
  const sessionId = resolveSessionId(opts);
  if (sessionId) {
    const identity = loadSessionIdentity(sessionId);
    if (identity)
      return { type: "session", identity };
  }
  const legacyName = detectLegacyWorkerName();
  if (legacyName)
    return { type: "legacy", workerName: legacyName };
  return null;
}
function sessionsDir() {
  return SESSIONS_DIR;
}
function sessionDir(sessionId) {
  if (!isValidSessionId(sessionId)) {
    throw new Error(`Invalid session ID: ${sessionId}`);
  }
  return join12(SESSIONS_DIR, sessionId);
}
var HOME4, PANE_MAP_DIR, SESSIONS_DIR, UUID_RE;
var init_identity = __esm(() => {
  HOME4 = process.env.HOME || process.env.USERPROFILE || "/tmp";
  PANE_MAP_DIR = join12(HOME4, ".claude/pane-map");
  SESSIONS_DIR = join12(HOME4, ".claude/fleet/.sessions");
  UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
});

// cli/lib/mail-client.ts
import { readFileSync as readFileSync11, writeFileSync as writeFileSync7, mkdirSync as mkdirSync8 } from "node:fs";
import { join as join13 } from "node:path";
async function getToken(opts) {
  if (_cachedToken)
    return _cachedToken;
  const identity = resolveIdentity(opts);
  if (identity?.type === "session") {
    const tokenPath = join13(sessionDir(identity.identity.sessionId), "token");
    try {
      const token = readFileSync11(tokenPath, "utf-8").trim();
      if (token) {
        _cachedToken = token;
        return token;
      }
    } catch {}
  }
  if (identity?.type === "legacy") {
    const project = resolveDirSlug();
    const tokenPath = join13(FLEET_DATA, project, identity.workerName, "token");
    try {
      const token = readFileSync11(tokenPath, "utf-8").trim();
      if (token) {
        _cachedToken = token;
        return token;
      }
    } catch {}
  }
  const sessionId = resolveSessionId(opts);
  const dirSlug = resolveDirSlug();
  const mailName = sessionId ? buildMailName(null, dirSlug, sessionId) : `operator-${dirSlug}`;
  return await autoProvision(mailName, sessionId);
}
async function autoProvision(mailName, sessionId) {
  if (!FLEET_MAIL_URL)
    throw new Error("Fleet Mail not configured — run: fleet mail-server connect <url>");
  const resp = await fetch(`${FLEET_MAIL_URL}/api/accounts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: mailName, bio: `Fleet session: ${mailName}` })
  });
  if (!resp.ok) {
    if (resp.status === 409) {
      throw new Error(`Fleet Mail account '${mailName}' already exists but token not found locally. Run: fleet register`);
    }
    const errText = await resp.text().catch(() => "");
    throw new Error(`Fleet Mail register failed (${resp.status}): ${errText}`);
  }
  const data = await resp.json();
  const token = data.bearerToken;
  if (sessionId) {
    const dir = sessionDir(sessionId);
    mkdirSync8(dir, { recursive: true });
    writeFileSync7(join13(dir, "token"), token);
  }
  _cachedToken = token;
  return token;
}
async function mailRequest(method, path, body) {
  if (!FLEET_MAIL_URL)
    throw new Error("Fleet Mail not configured — run: fleet mail-server connect <url>");
  const token = await getToken();
  const url = `${FLEET_MAIL_URL}${path}`;
  for (let attempt = 0;attempt <= 3; attempt++) {
    try {
      const opts = {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...body ? { "Content-Type": "application/json" } : {}
        },
        ...body ? { body: JSON.stringify(body) } : {},
        signal: AbortSignal.timeout(15000)
      };
      const resp = await fetch(url, opts);
      const text = await resp.text();
      if (!resp.ok) {
        const err = new Error(`Fleet Mail ${method} ${path} (${resp.status}): ${text.slice(0, 500)}`);
        err.status = resp.status;
        throw err;
      }
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    } catch (err) {
      const isTransient = err.status && err.status >= 500 || err.code === "ECONNREFUSED" || err.name === "TimeoutError" || err.message?.includes("timeout");
      if (!isTransient || attempt === 3)
        throw err;
      await new Promise((r) => setTimeout(r, 2000 * Math.pow(2, attempt)));
    }
  }
  throw new Error("unreachable");
}
async function resolveRecipient(name) {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(name))
    return name;
  if (name.startsWith("list:"))
    return name;
  const now = Date.now();
  if (!_directoryCache || now - _dirCacheTime > 60000) {
    try {
      const data = await mailRequest("GET", "/api/directory");
      _directoryCache = {};
      for (const acct of data.directory || []) {
        _directoryCache[acct.name] = acct.id;
      }
      _dirCacheTime = now;
    } catch {}
  }
  if (_directoryCache?.[name])
    return name;
  if (_directoryCache) {
    const matches = Object.keys(_directoryCache).filter((k) => k.includes(name));
    if (matches.length === 1)
      return matches[0];
    if (matches.length > 1) {
      throw new Error(`Ambiguous recipient '${name}' — matches: ${matches.join(", ")}`);
    }
  }
  const project = resolveDirSlug().toLowerCase();
  const nsName = `${name}@${project}`;
  if (_directoryCache?.[nsName])
    return nsName;
  throw new Error(`Recipient '${name}' not found in Fleet Mail directory`);
}
function cleanDisplayName(mailName) {
  return mailName.replace(/@[^@]+$/, "");
}
var _cachedToken = null, _directoryCache = null, _dirCacheTime = 0;
var init_mail_client = __esm(() => {
  init_paths();
  init_identity();
});

// cli/commands/mail.ts
import { readFileSync as readFileSync12, existsSync as existsSync11, readdirSync as readdirSync6, writeFileSync as writeFileSync8, mkdirSync as mkdirSync9, rmSync as rmSync2 } from "node:fs";
import { join as join14 } from "node:path";
import { spawnSync } from "node:child_process";
function tmuxPushNotify(recipientMailName, subject, body) {
  try {
    const atIdx = recipientMailName.indexOf("@");
    const project = atIdx >= 0 ? recipientMailName.slice(atIdx + 1) : resolveProject();
    const workerName = atIdx >= 0 ? recipientMailName.slice(0, atIdx) : recipientMailName;
    let fleetDir = join14(FLEET_DATA, project);
    let targetWorker = null;
    if (existsSync11(fleetDir)) {
      const workerNames = readdirSync6(fleetDir, { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith(".") && !d.name.startsWith("_")).map((d) => d.name);
      for (const name of workerNames) {
        if (workerName === name || recipientMailName.includes(name)) {
          targetWorker = name;
          break;
        }
      }
    }
    if (!targetWorker) {
      const projectDirs = readdirSync6(FLEET_DATA, { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith("."));
      for (const pd of projectDirs) {
        const candidateDir = join14(FLEET_DATA, pd.name);
        try {
          const workers = readdirSync6(candidateDir, { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith(".") && !d.name.startsWith("_")).map((d) => d.name);
          for (const name of workers) {
            if (recipientMailName.includes(name)) {
              targetWorker = name;
              fleetDir = candidateDir;
              break;
            }
          }
        } catch {}
        if (targetWorker)
          break;
      }
    }
    if (!targetWorker)
      return;
    const statePath2 = join14(fleetDir, targetWorker, "state.json");
    if (!existsSync11(statePath2))
      return;
    const state = JSON.parse(readFileSync12(statePath2, "utf-8"));
    const paneId = state.pane_id || null;
    if (!paneId)
      return;
    const alive = spawnSync("tmux", ["display-message", "-t", paneId, "-p", "#{pane_id}"], {
      encoding: "utf-8",
      timeout: 3000
    });
    if (alive.status !== 0 || alive.stdout.trim() !== paneId)
      return;
    const identity = resolveIdentity();
    const senderLabel = identity?.type === "legacy" ? identity.workerName : identity?.type === "session" ? identity.identity.customName || "cli" : "cli";
    const preview = `[mail from ${senderLabel}] ${subject}`;
    const displayText = preview.length > 80 ? preview.slice(0, 77) + "..." : preview;
    spawnSync("tmux", ["display-message", "-t", paneId, "-d", "5000", `\uD83D\uDCEC ${displayText}`], { timeout: 3000 });
    const capture = spawnSync("tmux", ["capture-pane", "-t", paneId, "-p"], { encoding: "utf-8", timeout: 3000 });
    const lastLine = (capture.stdout || "").trim().split(`
`).filter((l) => l.trim()).pop() || "";
    const BUSY = ["(running)"];
    const IDLE = ["bypass permissions", "plan mode on", "ctrl-g to edit", "Context left"];
    const isIdle = !BUSY.some((p) => lastLine.includes(p)) && IDLE.some((p) => lastLine.includes(p));
    if (isIdle) {
      const pasteText = `[mail from ${senderLabel}] ${subject}: ${body}`;
      const bufName = `cli-push-${Date.now()}`;
      const tmpDir = join14(process.env.HOME || "/tmp", ".claude-fleet/tmp");
      if (!existsSync11(tmpDir))
        mkdirSync9(tmpDir, { recursive: true });
      const tmpFile = join14(tmpDir, `${bufName}.txt`);
      try {
        writeFileSync8(tmpFile, pasteText);
        spawnSync("tmux", ["load-buffer", "-b", bufName, tmpFile], { timeout: 5000 });
        spawnSync("tmux", ["paste-buffer", "-b", bufName, "-t", paneId, "-d"], { timeout: 5000 });
        Bun.sleepSync(500);
        spawnSync("tmux", ["send-keys", "-t", paneId, "-H", "0d"], { timeout: 5000 });
      } finally {
        try {
          rmSync2(tmpFile);
        } catch {}
        try {
          spawnSync("tmux", ["delete-buffer", "-b", bufName], { timeout: 2000 });
        } catch {}
      }
    }
  } catch {}
}
function register12(parent) {
  const mail = parent.command("mail").description("Fleet Mail communication");
  const send = mail.command("send <to> <subject> [body]").description("Send a message via Fleet Mail");
  addGlobalOpts(send).action(async (to, subject, body) => {
    if (!FLEET_MAIL_URL)
      fail("Fleet Mail not configured — run: fleet mail-server connect <url>");
    let messageBody = body || "";
    if (!messageBody && !process.stdin.isTTY) {
      messageBody = await readStdin();
    }
    if (!messageBody)
      messageBody = "(no body)";
    const recipient = await resolveRecipient(to);
    const data = await mailRequest("POST", "/api/messages/send", {
      to: [recipient],
      subject,
      body: messageBody
    });
    tmuxPushNotify(recipient, subject, messageBody);
    ok(`Sent to ${cleanDisplayName(recipient)}: "${subject}" (id: ${data.id})`);
  });
  const inbox = mail.command("inbox").description("Read your Fleet Mail inbox").option("-l, --label <label>", "Filter by label", "UNREAD").option("-n, --max <count>", "Max messages", "20");
  addGlobalOpts(inbox).action(async (opts) => {
    if (!FLEET_MAIL_URL)
      fail("Fleet Mail not configured — run: fleet mail-server connect <url>");
    const data = await mailRequest("GET", `/api/messages?label=${encodeURIComponent(opts.label)}&maxResults=${encodeURIComponent(opts.max)}`);
    if (!data.messages?.length) {
      info(`No messages with label '${opts.label}'`);
      return;
    }
    for (const msg of data.messages) {
      const from = typeof msg.from === "string" ? msg.from : msg.from?.name || "unknown";
      console.log(JSON.stringify({
        id: msg.id,
        from: cleanDisplayName(from),
        subject: msg.subject,
        date: msg.date,
        ...msg.snippet ? { snippet: msg.snippet } : {}
      }, null, 2));
    }
  });
  const read = mail.command("read <id>").description("Read a message by ID (auto-marks as read)");
  addGlobalOpts(read).action(async (id) => {
    if (!FLEET_MAIL_URL)
      fail("Fleet Mail not configured — run: fleet mail-server connect <url>");
    const msg = await mailRequest("GET", `/api/messages/${encodeURIComponent(id)}`);
    const from = typeof msg.from === "string" ? msg.from : msg.from?.name || "unknown";
    console.log(JSON.stringify({
      id: msg.id,
      from: cleanDisplayName(from),
      to: Array.isArray(msg.to) ? msg.to.map((t) => cleanDisplayName(typeof t === "string" ? t : t?.name || "unknown")) : msg.to,
      subject: msg.subject,
      date: msg.date,
      labels: msg.labels,
      thread_id: msg.thread_id,
      body: msg.body
    }, null, 2));
  });
  mail.command("help").description("Fleet Mail API reference").action(() => {
    console.log(`Fleet Mail CLI Reference
========================

Send:    fleet mail send <to> "<subject>" "<body>"
         fleet mail send <to> "<subject>" < body.txt
Inbox:   fleet mail inbox [--label UNREAD|INBOX|TASK]
Read:    fleet mail read <id>

Recipient resolution:
  - Full mail name: merger-zPersonalProjects-abc123...
  - Substring match: merger (matches first account containing "merger")
  - Legacy: worker@project format still works

Labels:
  UNREAD, INBOX, SENT, TASK, P1, P2, PENDING, IN_PROGRESS, COMPLETED, BLOCKED

curl examples:
  Search:     curl -H "Authorization: Bearer $TOKEN" "$FLEET_MAIL_URL/api/search?q=from:merger+subject:done"
  Thread:     curl -H "Authorization: Bearer $TOKEN" "$FLEET_MAIL_URL/api/threads/<thread_id>"
  Labels:     curl -H "Authorization: Bearer $TOKEN" -X POST "$FLEET_MAIL_URL/api/messages/<id>/modify" -d '{"addLabelIds":["TASK"]}'
  Directory:  curl -H "Authorization: Bearer $TOKEN" "$FLEET_MAIL_URL/api/directory"
`);
  });
  mail.argument("[name]", "Worker name (legacy — reads worker inbox)").option("-l, --label <label>", "Filter by label", "UNREAD").action(async (name, opts, cmd) => {
    if (!name)
      return;
    if (["send", "inbox", "read", "help"].includes(name))
      return;
    const project = cmd.optsWithGlobals().project || resolveProject();
    const safeName = sanitizeName(name);
    const tokenPath = join14(workerDir(project, safeName), "token");
    if (!existsSync11(tokenPath))
      fail(`No token for '${name}'`);
    const token = readFileSync12(tokenPath, "utf-8").trim();
    if (!token)
      fail(`Empty token for '${name}'`);
    if (!FLEET_MAIL_URL)
      fail("Fleet Mail not configured — run: fleet mail-server connect <url>");
    try {
      const resp = await fetch(`${FLEET_MAIL_URL}/api/messages?label=${encodeURIComponent(opts.label)}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!resp.ok)
        fail(`Fleet Mail error: ${resp.status}`);
      const data = await resp.json();
      if (!data.messages?.length) {
        console.log(`No messages with label '${opts.label}'`);
        return;
      }
      for (const msg of data.messages) {
        console.log(JSON.stringify(msg, null, 2));
      }
    } catch {
      fail("Fleet Mail unreachable");
    }
  });
}
async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf-8").trim();
}
var init_mail = __esm(() => {
  init_paths();
  init_fmt2();
  init_cli();
  init_mail_client();
  init_identity();
});

// cli/commands/mail-server.ts
import { existsSync as existsSync12, readFileSync as readFileSync13, mkdirSync as mkdirSync10, writeFileSync as writeFileSync9 } from "node:fs";
import { join as join15 } from "node:path";
function findMailServerBinary2() {
  const platform = process.platform === "darwin" ? "darwin" : "linux";
  const arch = process.arch === "arm64" ? "arm64" : "x86_64";
  const vendored = join15(FLEET_DIR, `vendor/boring-mail-${platform}-${arch}`);
  if (existsSync12(vendored))
    return vendored;
  const which = Bun.spawnSync(["which", "boring-mail"], { stderr: "pipe" });
  if (which.exitCode === 0)
    return which.stdout.toString().trim();
  const whichLegacy = Bun.spawnSync(["which", "fleet-server"], { stderr: "pipe" });
  if (whichLegacy.exitCode === 0)
    return whichLegacy.stdout.toString().trim();
  for (const p of MAIL_SERVER_PATHS2) {
    if (existsSync12(p))
      return p;
  }
  return null;
}
function msDefaultsPath2() {
  return join15(FLEET_DATA, "defaults.json");
}
function updateMailConfig2(url, token) {
  const dp = msDefaultsPath2();
  const defaults = readJson(dp) || {};
  if (url !== undefined)
    defaults.fleet_mail_url = url;
  if (token !== undefined)
    defaults.fleet_mail_token = token;
  writeJson(dp, defaults);
}
async function connectAction(args) {
  const url = args.url;
  if (!url)
    return fail("URL is required: fleet mail-server connect <url> [--token <token>]");
  const normalizedUrl = url.replace(/\/+$/, "");
  info(`Connecting to Fleet Mail at ${normalizedUrl}...`);
  try {
    const resp = await fetch(`${normalizedUrl}/health`, {
      signal: AbortSignal.timeout(5000)
    });
    if (!resp.ok)
      fail(`Server returned ${resp.status}`);
    ok("Server is reachable");
  } catch (e) {
    fail(`Cannot reach ${normalizedUrl} — is the server running?`);
  }
  const adminToken = args.token || null;
  if (adminToken) {
    ok("Admin token saved (used for account management)");
  } else {
    info("No admin token provided (worker accounts use per-worker tokens)");
    info("Provide with: fleet mail-server connect <url> --token <token>");
  }
  updateMailConfig2(normalizedUrl, adminToken);
  ok(`Fleet Mail configured: ${normalizedUrl}`);
  if (adminToken) {
    console.log(`
  URL:   ${normalizedUrl}`);
    console.log(`  Token: ${adminToken.slice(0, 8)}...${adminToken.slice(-4)}`);
  } else {
    console.log(`
  URL:   ${normalizedUrl}`);
    console.log(`  Token: ${source_default.dim("not set")}`);
  }
  console.log(`
  Workers will auto-provision mail accounts on ${source_default.cyan("fleet create")}.`);
}
async function disconnectAction() {
  updateMailConfig2(null, null);
  ok("Fleet Mail disconnected — workers will not have mail.");
}
async function statusAction() {
  console.log(source_default.bold(`Fleet Mail Status
`));
  const url = FLEET_MAIL_URL;
  const token = FLEET_MAIL_TOKEN;
  if (url) {
    console.log(`  ${source_default.cyan("URL:")}    ${url}`);
  } else {
    console.log(`  ${source_default.cyan("URL:")}    ${source_default.dim("not configured")}`);
    console.log(`
  Run ${source_default.cyan("fleet mail-server connect <url>")} to configure.`);
    return;
  }
  if (token) {
    console.log(`  ${source_default.cyan("Token:")}  ${token.slice(0, 8)}...${token.slice(-4)}`);
  } else {
    console.log(`  ${source_default.cyan("Token:")}  ${source_default.dim("not set")}`);
  }
  if (process.env.FLEET_MAIL_URL) {
    console.log(`  ${source_default.cyan("Source:")} ${source_default.dim("$FLEET_MAIL_URL env var")}`);
  } else {
    console.log(`  ${source_default.cyan("Source:")} ${source_default.dim("defaults.json")}`);
  }
  try {
    const resp = await fetch(`${url}/health`, { signal: AbortSignal.timeout(3000) });
    if (resp.ok) {
      console.log(`  ${source_default.cyan("Health:")} ${source_default.green("reachable")}`);
    } else {
      console.log(`  ${source_default.cyan("Health:")} ${source_default.red(`error (${resp.status})`)}`);
    }
  } catch {
    console.log(`  ${source_default.cyan("Health:")} ${source_default.red("unreachable")}`);
  }
}
function readLocalAdminToken2() {
  for (const dir of [BORING_MAIL_DATA2, LEGACY_MAIL_DATA2]) {
    const p = join15(dir, "admin-token");
    if (existsSync12(p)) {
      const t = readFileSync13(p, "utf-8").trim();
      if (t)
        return t;
    }
  }
  return null;
}
async function startLocalServer2(opts) {
  const port = opts?.port || "8025";
  const log = opts?.quiet ? () => {} : info;
  let binary = findMailServerBinary2();
  if (!binary) {
    const platform = process.platform === "darwin" ? "darwin" : "linux";
    const arch = process.arch === "arm64" ? "arm64" : "x86_64";
    throw new Error(`boring-mail binary not found.

` + `  Expected: ${FLEET_DIR}/vendor/boring-mail-${platform}-${arch}

` + `  Or connect to a remote server:
` + "    fleet mail-server connect http://your-server:8025");
  }
  log(`Found boring-mail at ${binary}`);
  try {
    const resp = await fetch(`http://127.0.0.1:${port}/health`, {
      signal: AbortSignal.timeout(2000)
    });
    if (resp.ok) {
      if (!opts?.quiet)
        warn(`Server already running on port ${port}`);
      const url2 = `http://127.0.0.1:${port}`;
      const localToken = readLocalAdminToken2();
      if (localToken) {
        updateMailConfig2(url2, localToken);
        return { url: url2, token: localToken };
      }
      updateMailConfig2(url2, null);
      throw new Error(`Server running on port ${port} but no admin token found in ~/.boring-mail/admin-token`);
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("admin token"))
      throw e;
  }
  let adminToken = opts?.token || null;
  const adminTokenPath = join15(BORING_MAIL_DATA2, "admin-token");
  if (!adminToken) {
    adminToken = readLocalAdminToken2();
    if (adminToken)
      log(`Using existing admin token from ~/.boring-mail/admin-token`);
  }
  if (!adminToken) {
    adminToken = crypto.randomUUID();
    mkdirSync10(BORING_MAIL_DATA2, { recursive: true });
    writeFileSync9(adminTokenPath, adminToken + `
`);
    log(`Generated admin token → ~/.boring-mail/admin-token`);
  } else if (!existsSync12(adminTokenPath)) {
    mkdirSync10(BORING_MAIL_DATA2, { recursive: true });
    writeFileSync9(adminTokenPath, adminToken + `
`);
  }
  log(`Starting Fleet Mail on port ${port}...`);
  const env2 = {
    ...process.env,
    BORING_MAIL_BIND: `0.0.0.0:${port}`,
    BORING_MAIL_ADMIN_TOKEN: adminToken
  };
  const proc = Bun.spawn([binary, "serve"], {
    env: env2,
    stdout: "pipe",
    stderr: "pipe"
  });
  let ready = false;
  for (let i = 0;i < 20; i++) {
    await Bun.sleep(500);
    try {
      const resp = await fetch(`http://127.0.0.1:${port}/health`, {
        signal: AbortSignal.timeout(1000)
      });
      if (resp.ok) {
        ready = true;
        break;
      }
    } catch {}
  }
  if (!ready) {
    proc.kill();
    throw new Error("Server failed to start within 10s");
  }
  const url = `http://127.0.0.1:${port}`;
  updateMailConfig2(url, adminToken);
  proc.unref();
  if (!opts?.quiet) {
    ok(`Fleet Mail running at ${url} (PID: ${proc.pid})`);
    console.log(`
  URL:   ${url}`);
    console.log(`  Token: ${adminToken.slice(0, 8)}...${adminToken.slice(-4)}`);
    console.log(`  PID:   ${proc.pid}`);
    console.log(`
  Stop:  kill ${proc.pid}`);
    console.log(`  The server runs in the background.`);
  }
  return { url, token: adminToken };
}
async function startAction(args) {
  try {
    await startLocalServer2({ port: args.port, token: args.token });
  } catch (e) {
    fail(e instanceof Error ? e.message : String(e));
  }
}
function register13(parent) {
  parent.command("mail-server [action] [url]").description("Fleet Mail server management").option("-t, --token <token>", "Admin token").option("--port <port>", "Port for local server", "8025").action(async (action, url, opts) => {
    const act = action || "status";
    switch (act) {
      case "connect":
        return connectAction({ url, token: opts.token });
      case "disconnect":
        return disconnectAction();
      case "status":
        return statusAction();
      case "start":
        return startAction({ port: opts.port, token: opts.token });
      default:
        fail(`Unknown action: ${act}

Usage:
  fleet mail-server connect <url> [--token <token>]
  fleet mail-server disconnect
  fleet mail-server status
  fleet mail-server start [--port 8025]`);
    }
  });
}
var MAIL_SERVER_PATHS2, BORING_MAIL_DATA2, LEGACY_MAIL_DATA2;
var init_mail_server2 = __esm(() => {
  init_source();
  init_paths();
  init_fmt2();
  init_io();
  MAIL_SERVER_PATHS2 = [
    join15(process.env.HOME || "", ".cargo/bin/boring-mail"),
    join15(process.env.HOME || "", ".cargo/bin/fleet-server")
  ];
  BORING_MAIL_DATA2 = join15(process.env.HOME || "", ".boring-mail");
  LEGACY_MAIL_DATA2 = join15(process.env.HOME || "", ".fleet-server");
});

// cli/commands/create.ts
var exports_create = {};
__export(exports_create, {
  runCreate: () => runCreate2,
  register: () => register14
});
import { mkdirSync as mkdirSync11, writeFileSync as writeFileSync10, existsSync as existsSync13, readFileSync as readFileSync14, copyFileSync as copyFileSync5 } from "node:fs";
import { join as join16, dirname as dirname4, basename as basename3 } from "node:path";
async function runCreate2(name, mission, opts, globalOpts) {
  if (!NAME_RE2.test(name))
    fail(`Name must be kebab-case: ${name}`);
  const projectForHint = globalOpts.project || resolveProject();
  hintOnboard(projectForHint);
  if (mission.startsWith("@")) {
    const missionPath = mission.slice(1);
    if (!existsSync13(missionPath))
      fail(`Mission file not found: ${missionPath}`);
    mission = readFileSync14(missionPath, "utf-8").trim();
    if (!mission)
      fail(`Mission file is empty: ${missionPath}`);
  }
  const projectRoot = resolveProjectRoot();
  const project = globalOpts.project || resolveProject(projectRoot);
  const dir = workerDir(project, name);
  if (existsSync13(dir))
    fail(`Worker '${name}' already exists in project '${project}'`);
  const defaults = getDefaults();
  const model = opts.model || String(defaults.model || "opus[1m]");
  const runtime = opts.runtime || String(defaults.runtime || "claude");
  const effort = opts.effort || String(defaults.effort || "high");
  const perm = opts.permissionMode || String(defaults.permission_mode || "bypassPermissions");
  let sleepDuration = null;
  if (opts.type) {
    const typeFile = join16(FLEET_DIR, "templates/flat-worker/types", opts.type, "defaults.json");
    if (existsSync13(typeFile)) {
      try {
        const tmpl = JSON.parse(readFileSync14(typeFile, "utf-8"));
        if ("sleep_duration" in tmpl)
          sleepDuration = tmpl.sleep_duration;
      } catch {}
    } else {
      warn(`Unknown type: ${opts.type} (using defaults)`);
    }
  }
  const window = opts.window || name;
  const projectBasename = basename3(projectRoot).replace(/-w-.*$/, "");
  const worktreeDir = join16(dirname4(projectRoot), `${projectBasename}-w-${name}`);
  const branch = `worker/${name}`;
  const fleetConfig = getFleetConfig(project);
  const tmuxSession = fleetConfig?.tmux_session || DEFAULT_SESSION;
  info(`Creating worker '${name}' in project '${project}'`);
  mkdirSync11(dir, { recursive: true });
  const allHooks = [...getSystemHooks()];
  if (opts.type && fleetConfig?.hooks_by_type?.[opts.type]) {
    const typeHooks = fleetConfig.hooks_by_type[opts.type];
    for (let i = 0;i < typeHooks.length; i++) {
      allHooks.push({
        ...typeHooks[i],
        id: `type-${i + 1}`,
        owner: "creator"
      });
    }
  }
  const config = {
    model,
    reasoning_effort: effort,
    permission_mode: perm,
    sleep_duration: sleepDuration ?? null,
    window,
    worktree: worktreeDir,
    branch,
    mcp: {},
    hooks: allHooks,
    meta: {
      created_at: new Date().toISOString(),
      created_by: "fleet-cli",
      forked_from: null,
      project
    }
  };
  writeJsonLocked(join16(dir, "config.json"), config);
  writeJsonLocked(join16(dir, "state.json"), { status: "idle" });
  writeFileSync10(join16(dir, "mission.md"), mission + `
`);
  const missionsDir = join16(FLEET_DATA, project, "missions");
  mkdirSync11(missionsDir, { recursive: true });
  try {
    const target = `../${name}/mission.md`;
    const link = join16(missionsDir, `${name}.md`);
    if (existsSync13(link))
      Bun.spawnSync(["rm", "-f", link]);
    Bun.spawnSync(["ln", "-sf", target, link]);
  } catch {}
  ok("Config written");
  if (!existsSync13(worktreeDir)) {
    info(`Creating worktree at ${worktreeDir} (branch: ${branch})`);
    let result = Bun.spawnSync(["git", "-C", projectRoot, "worktree", "add", worktreeDir, branch], { stderr: "pipe" });
    if (result.exitCode !== 0) {
      result = Bun.spawnSync(["git", "-C", projectRoot, "worktree", "add", worktreeDir, "-b", branch], { stderr: "pipe" });
    }
    if (result.exitCode !== 0)
      fail("Failed to create worktree");
    ok("Worktree created");
  } else {
    info(`Worktree already exists: ${worktreeDir}`);
  }
  const mcpSrc = join16(projectRoot, ".mcp.json");
  const bunPath = process.execPath || join16(process.env.HOME || "", ".bun/bin/bun");
  let mcpConfig = { mcpServers: {} };
  if (existsSync13(mcpSrc)) {
    try {
      mcpConfig = JSON.parse(readFileSync14(mcpSrc, "utf-8"));
      if (!mcpConfig.mcpServers)
        mcpConfig.mcpServers = {};
    } catch {
      mcpConfig = { mcpServers: {} };
    }
  }
  let needsUpdate = false;
  if (mcpConfig.mcpServers["worker-fleet"]) {
    delete mcpConfig.mcpServers["worker-fleet"];
    needsUpdate = true;
  }
  const claudeHooksDir = process.env.CLAUDE_HOOKS_DIR || join16(process.env.HOME || "", ".claude-hooks");
  const claudeHooksMcp = join16(claudeHooksDir, "mcp/index.ts");
  if (existsSync13(claudeHooksMcp)) {
    const hooksDir = join16(FLEET_DATA, project, name, "hooks");
    const permsPath = join16(projectRoot, ".claude/workers", name, "permissions.json");
    const existingHooks = mcpConfig.mcpServers["claude-hooks"];
    const hooksEntry = {
      command: bunPath,
      args: ["run", claudeHooksMcp],
      env: {
        HOOKS_DIR: hooksDir,
        HOOKS_IDENTITY: name,
        HOOKS_PERMISSIONS: permsPath
      }
    };
    if (!existingHooks || JSON.stringify(existingHooks) !== JSON.stringify(hooksEntry)) {
      mcpConfig.mcpServers["claude-hooks"] = hooksEntry;
      needsUpdate = true;
    }
  }
  if (needsUpdate) {
    writeFileSync10(mcpSrc, JSON.stringify(mcpConfig, null, 2) + `
`);
    info("Updated MCP servers in .mcp.json");
  }
  if (projectRoot !== worktreeDir) {
    Bun.spawnSync(["rm", "-f", join16(worktreeDir, ".mcp.json")]);
    Bun.spawnSync(["ln", "-sf", mcpSrc, join16(worktreeDir, ".mcp.json")]);
  }
  syncWorktree({ name, project, projectRoot, worktreeDir });
  try {
    const gitDirResult = Bun.spawnSync(["git", "-C", worktreeDir, "rev-parse", "--absolute-git-dir"], { stderr: "pipe" });
    if (gitDirResult.exitCode === 0) {
      const gitDir = gitDirResult.stdout.toString().trim();
      const hooksDir = join16(gitDir, "hooks");
      mkdirSync11(hooksDir, { recursive: true });
      for (const hookName of ["post-commit", "commit-msg"]) {
        let hookSrc = join16(projectRoot, `.claude/scripts/worker-${hookName}-hook.sh`);
        if (!existsSync13(hookSrc))
          hookSrc = join16(FLEET_DIR, `scripts/worker-${hookName}-hook.sh`);
        if (existsSync13(hookSrc)) {
          copyFileSync5(hookSrc, join16(hooksDir, hookName));
          Bun.spawnSync(["chmod", "+x", join16(hooksDir, hookName)]);
        }
      }
    }
  } catch {}
  ok("Worktree configured");
  let mailToken = "";
  if (FLEET_MAIL_URL) {
    if (FLEET_MAIL_URL.includes("localhost") || FLEET_MAIL_URL.includes("127.0.0.1")) {
      try {
        await fetch(`${FLEET_MAIL_URL}/health`, { signal: AbortSignal.timeout(1000) });
      } catch {
        const bmPath = join16(process.env.HOME || "", ".cargo/bin/boring-mail");
        if (existsSync13(bmPath)) {
          info("Starting local boring-mail...");
          Bun.spawn([bmPath, "serve"], { stdio: ["ignore", "ignore", "ignore"] });
          for (let i = 0;i < 6; i++) {
            await new Promise((r) => setTimeout(r, 500));
            try {
              await fetch(`${FLEET_MAIL_URL}/health`, { signal: AbortSignal.timeout(500) });
              break;
            } catch {}
          }
        }
      }
    }
    const accountName = `${name}@${project}`;
    const mailHeaders = { "Content-Type": "application/json" };
    if (FLEET_MAIL_TOKEN)
      mailHeaders["Authorization"] = `Bearer ${FLEET_MAIL_TOKEN}`;
    try {
      const resp = await fetch(`${FLEET_MAIL_URL}/api/accounts`, {
        method: "POST",
        headers: mailHeaders,
        body: JSON.stringify({ name: accountName })
      });
      if (resp.ok) {
        const data = await resp.json();
        mailToken = data.bearerToken || data.token || "";
      } else if (resp.status === 409 && FLEET_MAIL_TOKEN) {
        const resetResp = await fetch(`${FLEET_MAIL_URL}/api/admin/accounts/${encodeURIComponent(accountName)}/reset-token`, { method: "POST", headers: { Authorization: `Bearer ${FLEET_MAIL_TOKEN}` } });
        if (resetResp.ok) {
          const data = await resetResp.json();
          mailToken = data.bearerToken || data.token || "";
        }
      }
    } catch {}
    if (mailToken) {
      writeFileSync10(join16(dir, "token"), mailToken);
      ok("Fleet Mail provisioned");
    } else {
      warn("Fleet Mail provisioning failed — mail_send/mail_inbox won't work until fixed");
      writeFileSync10(join16(dir, "token"), "");
    }
  } else {
    info("Fleet Mail not configured — run: fleet mail-server connect <url>");
    writeFileSync10(join16(dir, "token"), "");
  }
  generateLaunchSh(project, name);
  ok("launch.sh generated");
  if (opts.noLaunch) {
    ok(`Worker '${name}' created (--no-launch: skipping tmux launch)`);
    console.log(`
  Directory: ${dir}
  Worktree:  ${worktreeDir}
  Branch:    ${branch}
`);
    console.log(`  To launch: fleet start ${name}`);
    return;
  }
  const windowIndex = opts.windowIndex ? parseInt(opts.windowIndex, 10) : undefined;
  await launchInTmux(name, project, tmuxSession, window, windowIndex);
}
function register14(parent) {
  const sub = parent.command("create <name> <mission>").description("Create and launch a worker").option("--model <model>", "Override model").option("--effort <effort>", "Override effort").option("--permission-mode <mode>", "Override permission mode").option("--window <name>", "tmux window group").option("--window-index <index>", "Explicit window position").option("--type <type>", "Worker archetype template").option("--no-launch", "Create only, don't launch");
  addGlobalOpts(sub).action(async (name, mission, opts, cmd) => {
    await runCreate2(name, mission, {
      model: opts.model,
      effort: opts.effort,
      permissionMode: opts.permissionMode,
      window: opts.window,
      windowIndex: opts.windowIndex,
      type: opts.type,
      noLaunch: opts.launch === false
    }, cmd.optsWithGlobals());
  });
}
var NAME_RE2;
var init_create2 = __esm(() => {
  init_paths();
  init_config();
  init_fmt2();
  init_launch();
  init_worktree();
  init_cli();
  NAME_RE2 = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
});

// cli/commands/fork.ts
import { existsSync as existsSync14, mkdirSync as mkdirSync12, copyFileSync as copyFileSync6, readFileSync as readFileSync15 } from "node:fs";
import { join as join17 } from "node:path";
function register15(parent) {
  const sub = parent.command("fork <parent> <child> [mission]").description("Fork from existing session (inherits parent mission if omitted)").option("--model <model>", "Override model");
  addGlobalOpts(sub).action(async (parentName, childName, mission, opts, cmd) => {
    const project = cmd.optsWithGlobals().project || resolveProject();
    const parentDir = workerDir(project, parentName);
    const parentState = getState(project, parentName);
    const parentConfig = getConfig(project, parentName);
    if (!existsSync14(parentDir))
      return fail(`Parent '${parentName}' not found`);
    if (!parentState)
      return fail(`Parent '${parentName}' has no state`);
    if (!parentState.pane_id)
      return fail(`Parent '${parentName}' has no active pane`);
    if (!parentState.session_id)
      return fail(`Parent '${parentName}' has no session_id`);
    if (!parentConfig)
      return fail(`Parent '${parentName}' has no config`);
    const NAME_RE3 = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
    if (!NAME_RE3.test(childName))
      fail(`Name must be kebab-case: ${childName}`);
    const childDir = workerDir(project, childName);
    if (existsSync14(childDir))
      fail(`Worker '${childName}' already exists`);
    const parentMissionPath = join17(parentDir, "mission.md");
    const parentMission = existsSync14(parentMissionPath) ? readFileSync15(parentMissionPath, "utf-8").trim() : "";
    if (mission) {
      mission = parentMission ? [
        `# Forked from ${parentName}`,
        ``,
        `You were forked from worker \`${parentName}\`. Your job is to synthesize their original mission with your new directive into a coherent plan.`,
        ``,
        `## Original mission (from ${parentName})`,
        parentMission,
        ``,
        `## New directive`,
        mission,
        ``,
        `## Instructions`,
        `- Synthesize the original mission and new directive into a single coherent understanding of what you need to do.`,
        `- If the directive is clear and unambiguous, proceed immediately.`,
        `- If it's unclear, conflicts with the original mission, or could be interpreted multiple ways, ask the user to clarify before starting work.`,
        `- Once you've synthesized your mission, rewrite this file (mission.md) with your finalized mission so it's clean and self-contained for future reference.`
      ].join(`
`) : mission;
    } else {
      mission = parentMission || `Forked from ${parentName}`;
    }
    info(`Forking '${childName}' from '${parentName}'`);
    const { runCreate: runCreate3 } = await Promise.resolve().then(() => (init_create2(), exports_create));
    await runCreate3(childName, mission, {
      model: opts.model,
      noLaunch: true
    }, cmd.optsWithGlobals());
    const childConfigPath = join17(childDir, "config.json");
    const childConfig = getConfig(project, childName);
    if (childConfig) {
      childConfig.meta.forked_from = parentName;
      writeJsonLocked(childConfigPath, childConfig);
    }
    const HOME5 = process.env.HOME || "/tmp";
    const parentWorktree = parentConfig.worktree;
    const childWorktree = childConfig?.worktree || "";
    const parentProjSlug = parentWorktree.replace(/\//g, "-");
    const childProjSlug = childWorktree.replace(/\//g, "-");
    const parentProjDir = join17(HOME5, ".claude/projects", parentProjSlug);
    const childProjDir = join17(HOME5, ".claude/projects", childProjSlug);
    const sessionId = parentState.session_id;
    const sessionFile = join17(parentProjDir, `${sessionId}.jsonl`);
    if (existsSync14(sessionFile)) {
      mkdirSync12(childProjDir, { recursive: true });
      try {
        copyFileSync6(sessionFile, join17(childProjDir, `${sessionId}.jsonl`));
        const sessionDir2 = join17(parentProjDir, sessionId);
        if (existsSync14(sessionDir2)) {
          Bun.spawnSync(["cp", "-r", sessionDir2, join17(childProjDir, sessionId)]);
        }
        ok("Session data copied");
      } catch {
        warn("Failed to copy session data (non-fatal)");
      }
    }
    const fleetConfig = getFleetConfig(project);
    const session = fleetConfig?.tmux_session || DEFAULT_SESSION;
    const window = childConfig?.window || childName;
    const worktree = childConfig?.worktree || "";
    if (!worktree || !existsSync14(worktree))
      fail("Child worktree not found");
    let paneId;
    if (!sessionExists(session)) {
      paneId = createSession(session, window, worktree);
    } else if (windowExists(session, window)) {
      paneId = splitIntoWindow(session, window, worktree);
    } else {
      paneId = createWindow(session, window, worktree);
    }
    setPaneTitle(paneId, childName);
    const model = childConfig?.model || "opus[1m]";
    const effort = childConfig?.reasoning_effort || "high";
    const perm = childConfig?.permission_mode || "bypassPermissions";
    let launchCmd = `cd "${worktree}" && CLAUDE_CODE_SKIP_PROJECT_LOCK=1 WORKER_NAME="${childName}" claude`;
    launchCmd += ` --model "${model}" --effort "${effort}"`;
    if (perm === "bypassPermissions") {
      launchCmd += " --dangerously-skip-permissions";
    } else {
      launchCmd += ` --permission-mode "${perm}"`;
    }
    launchCmd += ` --add-dir "${childDir}"`;
    launchCmd += ` --resume "${sessionId}" --fork-session`;
    sendKeys(paneId, launchCmd);
    sendEnter(paneId);
    const paneTarget = getPaneTarget(paneId);
    writeJsonLocked(join17(childDir, "state.json"), {
      status: "active",
      pane_id: paneId,
      pane_target: paneTarget,
      tmux_session: session,
      session_id: "",
      past_sessions: [],
      last_relaunch: { at: new Date().toISOString(), reason: "fork" },
      relaunch_count: 0,
      cycles_completed: 0,
      last_cycle_at: null,
      custom: {}
    });
    ok(`Forked '${childName}' from '${parentName}' (pane ${paneId})`);
  });
}
var init_fork = __esm(() => {
  init_paths();
  init_config();
  init_fmt2();
  init_cli();
});

// cli/commands/mcp.ts
import { existsSync as existsSync15, readFileSync as readFileSync16, writeFileSync as writeFileSync11 } from "node:fs";
import { join as join18, dirname as dirname5 } from "node:path";
function register16(parent) {
  parent.command("mcp [action]").description("Manage MCP server registration").option("-q, --quiet", "Suppress output").action((action, opts) => {
    const act = action || "status";
    switch (act) {
      case "register": {
        const bunPath = Bun.spawnSync(["which", "bun"]).stdout.toString().trim();
        if (!bunPath)
          fail("bun not found. Install: curl -fsSL https://bun.sh/install | bash");
        if (!existsSync15(MCP_SCRIPT))
          fail(`MCP server not found: ${MCP_SCRIPT}`);
        let settings = {};
        if (existsSync15(SETTINGS_FILE)) {
          try {
            settings = JSON.parse(readFileSync16(SETTINGS_FILE, "utf-8"));
          } catch {}
        }
        if (!settings.mcpServers)
          settings.mcpServers = {};
        settings.mcpServers["worker-fleet"] = {
          command: bunPath,
          args: ["run", MCP_SCRIPT],
          env: { FLEET_MAIL_URL }
        };
        writeFileSync11(SETTINGS_FILE, JSON.stringify(settings, null, 2) + `
`);
        if (!opts.quiet) {
          ok("MCP server registered in settings.json");
          console.log(`  command: ${bunPath} run ${MCP_SCRIPT}`);
          console.log("  Restart Claude to pick up the change.");
        }
        break;
      }
      case "unregister": {
        if (existsSync15(SETTINGS_FILE)) {
          let settings = {};
          try {
            settings = JSON.parse(readFileSync16(SETTINGS_FILE, "utf-8"));
          } catch {}
          delete settings.mcpServers?.["worker-fleet"];
          writeFileSync11(SETTINGS_FILE, JSON.stringify(settings, null, 2) + `
`);
          ok("MCP server unregistered");
        }
        break;
      }
      case "status": {
        if (existsSync15(SETTINGS_FILE)) {
          try {
            const settings = JSON.parse(readFileSync16(SETTINGS_FILE, "utf-8"));
            const mcp = settings?.mcpServers?.["worker-fleet"];
            if (mcp) {
              console.log(source_default.green("registered"));
              console.log(JSON.stringify(mcp, null, 2));
              return;
            }
          } catch {}
        }
        console.log(source_default.red("not registered"));
        console.log("  Run: fleet mcp register");
        break;
      }
      case "build": {
        info("Building MCP server...");
        if (!existsSync15(MCP_SCRIPT))
          fail(`MCP server not found: ${MCP_SCRIPT}`);
        const result = Bun.spawnSync(["bun", "build", "index.ts", "--outfile", "index.js", "--target", "bun"], { cwd: dirname5(MCP_SCRIPT), stderr: "pipe" });
        if (result.exitCode !== 0)
          fail("Build failed");
        ok("Built index.js");
        break;
      }
      default:
        fail(`Unknown action '${act}'. Usage: fleet mcp [register|unregister|status|build]`);
    }
  });
}
var HOME5, SETTINGS_FILE, MCP_SCRIPT;
var init_mcp = __esm(() => {
  init_source();
  init_paths();
  init_fmt2();
  HOME5 = process.env.HOME || "/tmp";
  SETTINGS_FILE = join18(HOME5, ".claude/settings.json");
  MCP_SCRIPT = join18(FLEET_DIR, "mcp/worker-fleet/index.ts");
});

// engine/program/hooks-bridge.ts
import { join as join19 } from "node:path";
import { existsSync as existsSync16 } from "node:fs";
function resolveHooksDir() {
  return process.env.CLAUDE_HOOKS_DIR || join19(HOME6, ".claude-hooks");
}
async function getHooksIO() {
  const hooksDir = resolveHooksDir();
  const ioPath = join19(hooksDir, "shared/hooks-io.ts");
  if (!existsSync16(ioPath)) {
    throw new Error(`claude-hooks not installed at ${hooksDir}. Run: bash ~/.claude-hooks/scripts/install.sh`);
  }
  return await import(ioPath);
}
var HOME6;
var init_hooks_bridge = __esm(() => {
  HOME6 = process.env.HOME || "/tmp";
});

// engine/program/hook-generator.ts
var exports_hook_generator = {};
__export(exports_hook_generator, {
  installToolRestrictionHooks: () => installToolRestrictionHooks,
  installPipelineHooks: () => installPipelineHooks
});
import { join as join20 } from "node:path";
async function installPipelineHooks(hooksDir, hooks, registeredBy) {
  const { addHookToFile, writeScriptFile } = await getHooksIO();
  for (const hook of hooks) {
    const id = `ph-${++_phCounter}`;
    const desc = hook.description || `Pipeline ${hook.event} hook`;
    const dynHook = {
      id,
      event: hook.event,
      description: desc,
      blocking: hook.blocking ?? hook.event === "Stop",
      completed: false,
      added_at: new Date().toISOString(),
      registered_by: registeredBy,
      ownership: "creator",
      status: "active",
      lifetime: "persistent"
    };
    if (hook.check)
      dynHook.check = hook.check;
    if (hook.command) {
      const filename = writeScriptFile(hooksDir, id, desc, hook.command);
      dynHook.script_path = filename;
    }
    if (hook.type === "launch" && hook.workers) {
      const launchScript = generateLaunchHookScript(hook.workers);
      const filename = writeScriptFile(hooksDir, id, desc, launchScript);
      dynHook.script_path = filename;
    }
    if (hook.type === "message" && hook.to) {
      const messageScript = generateMessageHookScript(hook.to, hook.subject || "", hook.body || "");
      const filename = writeScriptFile(hooksDir, id, desc, messageScript);
      dynHook.script_path = filename;
    }
    if (hook.prompt) {
      dynHook.content = hook.prompt;
    }
    if (hook.matcher) {
      dynHook.condition = { tool: hook.matcher };
    }
    addHookToFile(hooksDir, dynHook);
  }
}
function generateLaunchHookScript(workers) {
  if (typeof workers === "string") {
    return `#!/usr/bin/env bash
set -euo pipefail
FLEET_DIR="\${CLAUDE_FLEET_DIR:-${FLEET_DIR_DEFAULT}}"
SESSION_DIR="\${SESSION_DIR:-.}"
nohup bun "$FLEET_DIR/engine/program/bridge.ts" "$SESSION_DIR" --node "${workers}" \\
  >> "$SESSION_DIR/bridge-launch.log" 2>&1 &
exit 0
`;
  }
  const creates = workers.map((w) => `fleet create "${w.name}" "${w.role}" --model "${w.model || "sonnet[1m]"}" &`).join(`
`);
  return `#!/usr/bin/env bash
set -euo pipefail
${creates}
wait
exit 0
`;
}
async function installToolRestrictionHooks(hooksDir, allowedTools, deniedTools) {
  if (!allowedTools?.length && !deniedTools?.length)
    return;
  const { addHookToFile, writeScriptFile } = await getHooksIO();
  if (deniedTools && deniedTools.length > 0) {
    const id = `ph-${++_phCounter}`;
    const matcher = deniedTools.join("|");
    const script = `#!/usr/bin/env bash
# Block denied tools: ${deniedTools.join(", ")}
echo "Tool $TOOL_NAME is blocked by pipeline configuration" >&2
exit 1
`;
    const filename = writeScriptFile(hooksDir, id, `Block denied tools`, script);
    addHookToFile(hooksDir, {
      id,
      event: "PreToolUse",
      description: `Pipeline: block tools (${deniedTools.join(", ")})`,
      blocking: true,
      completed: false,
      added_at: new Date().toISOString(),
      registered_by: "program-api",
      ownership: "creator",
      status: "active",
      lifetime: "persistent",
      script_path: filename,
      condition: { tool: matcher }
    });
  }
  if (allowedTools && allowedTools.length > 0) {
    const id = `ph-${++_phCounter}`;
    const allowed = allowedTools.join("|");
    const script = `#!/usr/bin/env bash
# Only allow: ${allowedTools.join(", ")}
# TOOL_NAME is set by the hook runner
if echo "$TOOL_NAME" | grep -qE "^(${allowed})$"; then
  exit 0
fi
echo "Tool $TOOL_NAME is not in the allowlist" >&2
exit 1
`;
    const filename = writeScriptFile(hooksDir, id, `Allow only listed tools`, script);
    addHookToFile(hooksDir, {
      id,
      event: "PreToolUse",
      description: `Pipeline: allowlist (${allowedTools.join(", ")})`,
      blocking: true,
      completed: false,
      added_at: new Date().toISOString(),
      registered_by: "program-api",
      ownership: "creator",
      status: "active",
      lifetime: "persistent",
      script_path: filename
    });
  }
}
function generateMessageHookScript(to, subject, body) {
  return `#!/usr/bin/env bash
set -euo pipefail
if [ -z "\${FLEET_MAIL_URL:-}" ] || [ -z "\${FLEET_MAIL_TOKEN:-}" ]; then
  echo "WARN: Fleet Mail not configured, skipping message to ${to}" >&2
  exit 0
fi
curl -s -X POST "\${FLEET_MAIL_URL}/api/messages" \\
  -H "Authorization: Bearer \${FLEET_MAIL_TOKEN}" \\
  -H "Content-Type: application/json" \\
  -d "$(cat <<'EOFMSG'
{"to":"${to}","subject":"${subject}","body":"${body}"}
EOFMSG
)" > /dev/null 2>&1 || true
exit 0
`;
}
var FLEET_DIR_DEFAULT, _phCounter = 0;
var init_hook_generator = __esm(() => {
  init_hooks_bridge();
  FLEET_DIR_DEFAULT = join20(process.env.HOME || "/tmp", ".claude-fleet");
});

// engine/program/sdk-launcher.ts
var exports_sdk_launcher = {};
__export(exports_sdk_launcher, {
  generateStandaloneSdkLauncher: () => generateStandaloneSdkLauncher,
  generateSdkLauncher: () => generateSdkLauncher
});
import { writeFileSync as writeFileSync12, readFileSync as readFileSync17, mkdirSync as mkdirSync13 } from "node:fs";
import { join as join21 } from "node:path";
function generateSdkLauncher(worker, state, specOverrides) {
  const launcherPath = join21(state.sessionDir, `sdk-${worker.name}.ts`);
  const resultsDir = join21(state.sessionDir, "results", worker.name);
  mkdirSync13(resultsDir, { recursive: true });
  const seedContent = readFileSync17(worker.seedPath, "utf-8");
  const opts = {
    model: worker.model,
    permissionMode: "bypassPermissions",
    allowDangerouslySkipPermissions: true,
    effort: "high",
    cwd: state.workDir
  };
  if (specOverrides?.allowed_tools?.length) {
    opts.allowedTools = specOverrides.allowed_tools;
  }
  if (specOverrides?.disallowed_tools?.length) {
    opts.disallowedTools = specOverrides.disallowed_tools;
  }
  if (specOverrides?.add_dir?.length) {
    opts.additionalDirectories = specOverrides.add_dir;
  }
  if (specOverrides?.max_turns) {
    opts.maxTurns = specOverrides.max_turns;
  }
  if (specOverrides?.max_budget_usd) {
    opts.maxBudgetUsd = specOverrides.max_budget_usd;
  }
  if (specOverrides?.persist_session === false) {
    opts.persistSession = false;
  }
  if (specOverrides?.json_schema) {
    opts.outputFormat = { type: "json_schema", schema: JSON.parse(specOverrides.json_schema) };
  }
  if (specOverrides?.system_prompt) {
    opts.systemPrompt = specOverrides.system_prompt;
  } else if (specOverrides?.append_system_prompt) {
    opts.systemPrompt = {
      type: "preset",
      preset: "claude_code",
      append: specOverrides.append_system_prompt
    };
  }
  if (specOverrides?.mcp_servers) {
    opts.mcpServers = specOverrides.mcp_servers;
  }
  if (specOverrides?.agents) {
    opts.agents = specOverrides.agents;
  }
  const envLines = [];
  if (specOverrides?.env) {
    for (const [k, v] of Object.entries(specOverrides.env)) {
      envLines.push(`process.env.${k} = ${JSON.stringify(v)};`);
    }
  }
  const script = `#!/usr/bin/env bun
/**
 * SDK Launcher for ${worker.name}
 * Generated by fleet pipeline engine
 * Runtime: sdk (Claude Agent SDK)
 */
import { query } from "@anthropic-ai/claude-agent-sdk";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

// Environment
process.env.WORKER_NAME = ${JSON.stringify(worker.name)};
process.env.PROJECT_ROOT = ${JSON.stringify(state.workDir)};
process.env.RESULTS_DIR = ${JSON.stringify(resultsDir)};
${envLines.join(`
`)}

const RESULTS_DIR = ${JSON.stringify(resultsDir)};
mkdirSync(RESULTS_DIR, { recursive: true });

const prompt = ${JSON.stringify(seedContent)};
const options = ${JSON.stringify(opts, null, 2)};

async function main() {
  let sessionId: string | undefined;
  let resultText = "";
  let resultJson: unknown = undefined;

  console.log("[sdk] Starting ${worker.name} (model: ${worker.model})");

  try {
    for await (const message of query({ prompt, options })) {
      // Track session ID
      if (message.type === "system" && message.subtype === "init") {
        sessionId = (message as any).session_id;
        console.log("[sdk] Session:", sessionId?.slice(0, 8));
      }

      // Log assistant messages
      if (message.type === "assistant") {
        const content = (message as any).message?.content;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === "text" && block.text) {
              process.stdout.write(block.text);
            }
          }
        }
      }

      // Capture result
      if ("result" in message) {
        resultText = (message as any).result || "";
      }

      // Capture JSON result
      if (message.type === "result" && (message as any).json) {
        resultJson = (message as any).json;
      }
    }
  } catch (err: any) {
    console.error("[sdk] Error:", err.message);
    writeFileSync(join(RESULTS_DIR, "error.txt"), err.message);
    process.exit(1);
  }

  // Write results
  if (resultText) {
    writeFileSync(join(RESULTS_DIR, "result.txt"), resultText);
  }
  if (resultJson !== undefined) {
    writeFileSync(join(RESULTS_DIR, "result.json"), JSON.stringify(resultJson, null, 2));
  }
  if (sessionId) {
    writeFileSync(join(RESULTS_DIR, "session-id.txt"), sessionId);
  }

  console.log("\\n[sdk] ${worker.name} complete");
}

main().catch((err) => {
  console.error("[sdk] Fatal:", err);
  process.exit(1);
});
`;
  writeFileSync12(launcherPath, script, { mode: 493 });
  return launcherPath;
}
function generateStandaloneSdkLauncher(spec, sessionDir2, workDir) {
  const name = spec.name;
  const launcherPath = join21(sessionDir2, `sdk-${name}.ts`);
  const resultsDir = join21(sessionDir2, "results", name);
  mkdirSync13(resultsDir, { recursive: true });
  const prompt = spec.prompt || `You are ${name}. ${spec.role || "Complete your task."}`;
  const model = spec.model || "opus[1m]";
  const opts = {
    model,
    permissionMode: spec.permission_mode || "bypassPermissions",
    allowDangerouslySkipPermissions: (spec.permission_mode || "bypassPermissions") === "bypassPermissions",
    effort: spec.effort || "high",
    cwd: workDir
  };
  if (spec.allowed_tools?.length)
    opts.allowedTools = spec.allowed_tools;
  if (spec.disallowed_tools?.length)
    opts.disallowedTools = spec.disallowed_tools;
  if (spec.add_dir?.length)
    opts.additionalDirectories = spec.add_dir;
  if (spec.max_turns)
    opts.maxTurns = spec.max_turns;
  if (spec.max_budget_usd)
    opts.maxBudgetUsd = spec.max_budget_usd;
  if (spec.persist_session === false)
    opts.persistSession = false;
  if (spec.system_prompt)
    opts.systemPrompt = spec.system_prompt;
  else if (spec.append_system_prompt) {
    opts.systemPrompt = { type: "preset", preset: "claude_code", append: spec.append_system_prompt };
  }
  if (spec.mcp_servers)
    opts.mcpServers = spec.mcp_servers;
  if (spec.agents)
    opts.agents = spec.agents;
  if (spec.json_schema) {
    try {
      opts.outputFormat = { type: "json_schema", schema: JSON.parse(spec.json_schema) };
    } catch {}
  }
  const envLines = [];
  if (spec.env) {
    for (const [k, v] of Object.entries(spec.env)) {
      envLines.push(`process.env.${k} = ${JSON.stringify(v)};`);
    }
  }
  const script = `#!/usr/bin/env bun
/**
 * SDK Launcher for ${name}
 * Generated by fleet run --spec (runtime: sdk)
 */
import { query } from "@anthropic-ai/claude-agent-sdk";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

process.env.WORKER_NAME = ${JSON.stringify(name)};
process.env.PROJECT_ROOT = ${JSON.stringify(workDir)};
process.env.RESULTS_DIR = ${JSON.stringify(resultsDir)};
${envLines.join(`
`)}

const RESULTS_DIR = ${JSON.stringify(resultsDir)};
mkdirSync(RESULTS_DIR, { recursive: true });

async function main() {
  let sessionId: string | undefined;
  let resultText = "";

  console.log("[sdk] Starting ${name} (model: ${model})");

  for await (const message of query({
    prompt: ${JSON.stringify(prompt)},
    options: ${JSON.stringify(opts, null, 2)},
  })) {
    if (message.type === "system" && message.subtype === "init") {
      sessionId = (message as any).session_id;
      console.log("[sdk] Session:", sessionId?.slice(0, 8));
    }
    if (message.type === "assistant") {
      const content = (message as any).message?.content;
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === "text" && block.text) process.stdout.write(block.text);
        }
      }
    }
    if ("result" in message) resultText = (message as any).result || "";
  }

  if (resultText) writeFileSync(join(RESULTS_DIR, "result.txt"), resultText);
  if (sessionId) writeFileSync(join(RESULTS_DIR, "session-id.txt"), sessionId);
  console.log("\\n[sdk] ${name} complete");
}

main().catch((err) => { console.error("[sdk] Fatal:", err); process.exit(1); });
`;
  writeFileSync12(launcherPath, script, { mode: 493 });
  return launcherPath;
}
var init_sdk_launcher = () => {};

// cli/commands/run.ts
import { readdirSync as readdirSync7, mkdirSync as mkdirSync14, writeFileSync as writeFileSync13, existsSync as existsSync17, readFileSync as readFileSync18, copyFileSync as copyFileSync7 } from "node:fs";
import { join as join22, dirname as dirname6, resolve } from "node:path";
function nextRunName(project) {
  const projectDir = `${FLEET_DATA}/${project}`;
  let existing = [];
  try {
    existing = readdirSync7(projectDir, { withFileTypes: true }).filter((d) => d.isDirectory() && d.name.startsWith("run-")).map((d) => d.name);
  } catch {}
  let n = 1;
  while (existing.includes(`run-${n}`))
    n++;
  return `run-${n}`;
}
function parseHookFlag(raw, blocking) {
  const parts = raw.split(":");
  if (parts.length < 2)
    throw new Error(`Invalid --hook format: ${raw} (expected EVENT:COMMAND)`);
  const event = parts[0];
  if (parts.length === 2) {
    return { event, command: parts[1], blocking };
  }
  return { event, matcher: parts[1], command: parts.slice(2).join(":"), blocking };
}
function parseToolFlag(raw) {
  const parts = raw.split(":");
  if (parts.length < 2)
    throw new Error(`Invalid --tool format: ${raw}`);
  const name = parts[0];
  const description = parts[1];
  let handler = "";
  let mode = "command";
  const inputSchema = {};
  for (let i = 2;i < parts.length; i++) {
    const [k, v] = parts[i].split("=", 2);
    if (k === "handler") {
      handler = v;
      mode = "inline";
    } else if (k === "cmd") {
      handler = v;
      mode = "command";
    } else {
      const paramType = v || "string";
      inputSchema[k] = { type: paramType, required: true };
    }
  }
  return { name, description, mode, handler: handler || `echo ${name}`, inputSchema };
}
function resolveFileRef(value, specDir) {
  if (value.startsWith("@")) {
    const filePath = resolve(specDir, value.slice(1));
    if (!existsSync17(filePath))
      throw new Error(`Referenced file not found: ${filePath}`);
    return readFileSync18(filePath, "utf-8");
  }
  return value;
}
function launchInTmuxPane(wrapperPath, workerName, workerDir2, workDir, tmuxSession, windowName) {
  try {
    const tmuxResult = Bun.spawnSync(["tmux", "has-session", "-t", tmuxSession], { stderr: "pipe" });
    if (tmuxResult.exitCode !== 0) {
      Bun.spawnSync(["tmux", "new-session", "-d", "-s", tmuxSession, "-n", windowName, "-c", workDir], { stderr: "pipe" });
      Bun.sleepSync(300);
      const paneResult = Bun.spawnSync(["tmux", "list-panes", "-t", `${tmuxSession}:${windowName}`, "-F", "#{pane_id}"], { stderr: "pipe" });
      const paneId = paneResult.stdout.toString().trim().split(`
`)[0];
      if (paneId) {
        Bun.spawnSync(["tmux", "send-keys", "-t", paneId, `bash '${wrapperPath}'`, "Enter"]);
        ok(`Launched ${workerName} → ${paneId} (${tmuxSession}:${windowName})`);
      }
    } else {
      const winCheck = Bun.spawnSync(["tmux", "list-windows", "-t", tmuxSession, "-F", "#{window_name}"], { stderr: "pipe" });
      const windows = winCheck.stdout.toString().trim().split(`
`);
      let paneId;
      if (windows.includes(windowName)) {
        const result = Bun.spawnSync(["tmux", "split-window", "-t", `${tmuxSession}:${windowName}`, "-d", "-P", "-F", "#{pane_id}", "-c", workDir], { stderr: "pipe" });
        paneId = result.stdout.toString().trim();
        Bun.spawnSync(["tmux", "select-layout", "-t", `${tmuxSession}:${windowName}`, "tiled"], { stderr: "pipe" });
      } else {
        const result = Bun.spawnSync(["tmux", "new-window", "-t", tmuxSession, "-n", windowName, "-d", "-P", "-F", "#{pane_id}", "-c", workDir], { stderr: "pipe" });
        paneId = result.stdout.toString().trim();
      }
      if (paneId) {
        Bun.spawnSync(["tmux", "send-keys", "-t", paneId, `bash '${wrapperPath}'`, "Enter"]);
        try {
          const state = JSON.parse(readFileSync18(join22(workerDir2, "state.json"), "utf-8"));
          state.pane_id = paneId;
          state.pane_target = `${tmuxSession}:${windowName}`;
          state.tmux_session = tmuxSession;
          writeFileSync13(join22(workerDir2, "state.json"), JSON.stringify(state, null, 2));
        } catch {}
        ok(`Launched ${workerName} → ${paneId} (${tmuxSession}:${windowName})`);
      }
    }
  } catch (e) {
    fail(`Failed to launch: ${e.message}`);
  }
}
async function runWithSpec(spec, opts, globalOpts) {
  const projectRoot = resolveProjectRoot();
  const project = globalOpts.project || resolveProject(projectRoot);
  const workerName = spec.name;
  const fleetDir = process.env.CLAUDE_FLEET_DIR || join22(process.env.HOME || "/tmp", ".claude-fleet");
  info(`Running agent: ${workerName}`);
  const sessionHash = Date.now().toString(36).slice(-8);
  const sessionDir2 = join22(process.env.HOME || "/tmp", ".claude/state", workerName, `session-${sessionHash}`);
  mkdirSync14(sessionDir2, { recursive: true });
  let prompt = spec.prompt || "";
  if (opts.specDir && prompt.startsWith("@")) {
    prompt = resolveFileRef(prompt, opts.specDir);
  }
  if (!prompt) {
    prompt = `You are ${workerName}. ${spec.role || "Complete your task."}`;
  }
  const seedPath = join22(sessionDir2, `${workerName}-seed.md`);
  writeFileSync13(seedPath, prompt);
  if (opts.specDir) {
    const specFiles = readdirSync7(opts.specDir).filter((f) => f.endsWith(".agent.yaml") || f.endsWith(".agent.json") || f.endsWith(".agent.yml"));
    for (const f of specFiles) {
      if (f.includes(workerName) || specFiles.length === 1) {
        copyFileSync7(join22(opts.specDir, f), join22(sessionDir2, "agent-spec.yaml"));
        break;
      }
    }
  }
  const workerDir2 = join22(FLEET_DATA, project, workerName);
  mkdirSync14(workerDir2, { recursive: true });
  mkdirSync14(join22(workerDir2, "hooks"), { recursive: true });
  const model = spec.model || "opus[1m]";
  const runtime = spec.runtime || "claude";
  const effort = spec.effort || "high";
  const perm = spec.permission_mode || "bypassPermissions";
  const isPerpetual = typeof spec.sleep_duration === "number" && spec.sleep_duration > 0;
  const config = {
    model,
    runtime,
    reasoning_effort: effort,
    permission_mode: perm,
    sleep_duration: isPerpetual ? spec.sleep_duration : null,
    window: null,
    worktree: spec.dir || projectRoot,
    branch: spec.branch || "HEAD",
    mcp: {},
    hooks: [],
    ephemeral: spec.ephemeral ?? !isPerpetual,
    meta: {
      created_at: new Date().toISOString(),
      created_by: "fleet-run",
      forked_from: null,
      project
    }
  };
  writeFileSync13(join22(workerDir2, "config.json"), JSON.stringify(config, null, 2));
  writeFileSync13(join22(workerDir2, "state.json"), JSON.stringify({
    status: "active",
    pane_id: null,
    pane_target: null,
    tmux_session: null,
    session_id: sessionHash,
    past_sessions: [],
    last_relaunch: null,
    relaunch_count: 0,
    cycles_completed: 0,
    last_cycle_at: null,
    custom: { role: spec.role || workerName, program: "fleet-run", session_dir: sessionDir2 }
  }, null, 2));
  writeFileSync13(join22(workerDir2, "token"), "");
  let missionContent = spec.mission || `# ${workerName}
${spec.role || "fleet run agent"} (${isPerpetual ? "perpetual" : "ephemeral"})`;
  if (missionContent.startsWith("@")) {
    missionContent = readFileSync18(missionContent.slice(1), "utf-8").trim();
  }
  writeFileSync13(join22(workerDir2, "mission.md"), missionContent + `
`);
  const { FLEET_MAIL_URL: FLEET_MAIL_URL2, FLEET_MAIL_TOKEN: FLEET_MAIL_TOKEN2 } = await Promise.resolve().then(() => (init_paths(), exports_paths));
  if (FLEET_MAIL_URL2) {
    try {
      const accountName = `${workerName}@${project}`;
      const mailHeaders = { "Content-Type": "application/json" };
      if (FLEET_MAIL_TOKEN2)
        mailHeaders["Authorization"] = `Bearer ${FLEET_MAIL_TOKEN2}`;
      const resp = await fetch(`${FLEET_MAIL_URL2}/api/accounts`, {
        method: "POST",
        headers: mailHeaders,
        body: JSON.stringify({ name: accountName }),
        signal: AbortSignal.timeout(5000)
      });
      if (resp.ok) {
        const data = await resp.json();
        const token = data.bearerToken || data.token || "";
        if (token)
          writeFileSync13(join22(workerDir2, "token"), token);
      } else if (resp.status === 409 && FLEET_MAIL_TOKEN2) {
        const resetResp = await fetch(`${FLEET_MAIL_URL2}/api/admin/accounts/${encodeURIComponent(accountName)}/reset-token`, { method: "POST", headers: { Authorization: `Bearer ${FLEET_MAIL_TOKEN2}` }, signal: AbortSignal.timeout(5000) });
        if (resetResp.ok) {
          const data = await resetResp.json();
          const token = data.bearerToken || data.token || "";
          if (token)
            writeFileSync13(join22(workerDir2, "token"), token);
        }
      }
    } catch {}
  }
  if (spec.tools?.length) {
    writeFileSync13(join22(workerDir2, "event-tools.json"), JSON.stringify({
      programPath: null,
      tools: spec.tools,
      sessionDir: sessionDir2,
      projectRoot
    }, null, 2));
  }
  if (spec.hooks?.length) {
    const { installPipelineHooks: installPipelineHooks2 } = await Promise.resolve().then(() => (init_hook_generator(), exports_hook_generator));
    const pipelineHooks = spec.hooks.map((h) => ({
      event: h.event,
      type: h.type || "command",
      command: h.command,
      prompt: h.content,
      matcher: h.matcher,
      blocking: h.blocking,
      check: h.check,
      description: h.description,
      to: h.to,
      subject: h.subject,
      body: h.body,
      workers: h.workers?.map((w) => ({
        name: w.name,
        role: w.role || w.name,
        model: w.model,
        runtime: w.runtime,
        seed: { inline: w.prompt || `You are ${w.name}.` }
      }))
    }));
    await installPipelineHooks2(join22(workerDir2, "hooks"), pipelineHooks, "fleet-run");
  }
  const wrapperPath = join22(sessionDir2, `run-${workerName}.sh`);
  const workDir = spec.dir || projectRoot;
  const resultsDir = join22(sessionDir2, "results", workerName);
  mkdirSync14(resultsDir, { recursive: true });
  let mailEnv = `export WORKER_NAME="${workerName}"`;
  try {
    const token = readFileSync18(join22(workerDir2, "token"), "utf-8").trim();
    if (token) {
      const { FLEET_MAIL_URL: mailUrl } = await Promise.resolve().then(() => (init_paths(), exports_paths));
      mailEnv += `
export FLEET_MAIL_URL="${mailUrl || ""}"`;
      mailEnv += `
export FLEET_MAIL_TOKEN="${token}"`;
    }
  } catch {}
  let execLine;
  if (runtime === "sdk") {
    const { generateStandaloneSdkLauncher: generateStandaloneSdkLauncher2 } = await Promise.resolve().then(() => (init_sdk_launcher(), exports_sdk_launcher));
    const sdkPath = generateStandaloneSdkLauncher2(spec, sessionDir2, workDir);
    execLine = `exec bun run "${sdkPath}"`;
  } else if (runtime === "codex") {
    execLine = `exec codex exec --full-auto --skip-git-repo-check -c model='"${model}"' "$(cat '${seedPath}')"`;
  } else if (runtime === "custom" && spec.custom_launcher) {
    execLine = `exec ${spec.custom_launcher}`;
  } else {
    let cmd = `exec claude --model "${model}" --dangerously-skip-permissions`;
    if (spec.effort)
      cmd += ` --effort "${spec.effort}"`;
    if (spec.system_prompt) {
      const syspromptPath = join22(sessionDir2, "system-prompt.md");
      writeFileSync13(syspromptPath, spec.system_prompt);
      cmd += ` --system-prompt "${syspromptPath}"`;
    }
    if (spec.append_system_prompt) {
      const appendPath = join22(sessionDir2, "append-system-prompt.md");
      writeFileSync13(appendPath, spec.append_system_prompt);
      cmd += ` --append-system-prompt "${appendPath}"`;
    }
    if (spec.allowed_tools?.length) {
      cmd += ` --allowedTools "${spec.allowed_tools.join(",")}"`;
    }
    if (spec.disallowed_tools?.length) {
      cmd += ` --disallowedTools "${spec.disallowed_tools.join(",")}"`;
    }
    if (spec.add_dir?.length) {
      for (const d of spec.add_dir)
        cmd += ` --add-dir "${d}"`;
    }
    if (spec.json_schema) {
      cmd += ` --output-format json --json '${spec.json_schema}'`;
    }
    cmd += ` "$(cat '${seedPath}')"`;
    execLine = cmd;
  }
  let envExport = "";
  if (spec.env) {
    for (const [k, v] of Object.entries(spec.env)) {
      envExport += `export ${k}="${v}"
`;
    }
  }
  const script = `#!/usr/bin/env bash
cd "${workDir}"
${mailEnv}
export PROJECT_ROOT="${workDir}"
export HOOKS_DIR="${join22(workerDir2, "hooks")}"
export CLAUDE_FLEET_DIR="${fleetDir}"
export RESULTS_DIR="${resultsDir}"
${envExport}${execLine}
`;
  writeFileSync13(wrapperPath, script, { mode: 493 });
  const { getFleetConfig: getFleetConfig2 } = await Promise.resolve().then(() => (init_config(), exports_config));
  const fleetConfig = getFleetConfig2(project);
  const tmuxSession = opts.session || fleetConfig?.tmux_session || "w";
  const windowName = opts.window || workerName;
  launchInTmuxPane(wrapperPath, workerName, workerDir2, workDir, tmuxSession, windowName);
  console.log(`  Session dir: ${sessionDir2}`);
  console.log(`  Worker dir:  ${workerDir2}`);
}
function register17(parent) {
  const sub = parent.command("run [name]").description("Launch an agent from spec file, flags, or interactive mode").option("--spec <file>", "AgentSpec YAML/JSON file").option("--prompt <text>", "Initial prompt (inline or @file)").option("--model <model>", "Override model").option("--runtime <runtime>", "Runtime: claude, codex, custom").option("--effort <effort>", "Reasoning effort: low, medium, high, max").option("--permission <mode>", "Permission mode").option("--name <name>", "Worker name (overrides spec or auto-generated)").option("--hook <spec...>", "Hook: EVENT:COMMAND or EVENT:MATCHER:COMMAND").option("--hook-gate <spec...>", "Blocking hook: EVENT:COMMAND").option("--tool <spec...>", "Event tool: name:desc:handler=fn|cmd=script:param=type").option("--env <pairs...>", "Environment: KEY=VALUE").option("--allowed-tools <tools>", "Comma-separated tool whitelist").option("--disallowed-tools <tools>", "Comma-separated tool denylist").option("--system-prompt <text>", "Custom system prompt (inline or @file)").option("--append-system-prompt <text>", "Append to system prompt").option("--add-dir <dirs...>", "Additional directories").option("--on-stop <command>", "Shorthand for --hook Stop:COMMAND").option("--worktree", "Create git worktree").option("--window <name>", "tmux window name").option("--session <name>", "tmux session name").option("--dir <path>", "Working directory").option("--perpetual", "Run as perpetual worker").option("--max-budget <usd>", "Cost cap in USD").option("--type <type>", "Worker archetype template").option("--report-to <name>", "Manager worker name").option("--json-schema <schema>", "JSON output schema").option("--mission <text>", "Mission statement (inline or @file)");
  addGlobalOpts(sub).action(async (name, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals();
    const project = globalOpts.project || resolveProject();
    if (opts.spec) {
      const specPath = resolve(opts.spec);
      if (!existsSync17(specPath))
        fail(`Spec file not found: ${specPath}`);
      const spec = loadAgentSpec(specPath);
      if (opts.name || name)
        spec.name = opts.name || name || spec.name;
      if (opts.model)
        spec.model = opts.model;
      if (opts.runtime)
        spec.runtime = opts.runtime;
      if (opts.effort)
        spec.effort = opts.effort;
      if (opts.permission)
        spec.permission_mode = opts.permission;
      if (opts.prompt)
        spec.prompt = opts.prompt;
      if (opts.systemPrompt)
        spec.system_prompt = opts.systemPrompt;
      if (opts.appendSystemPrompt)
        spec.append_system_prompt = opts.appendSystemPrompt;
      if (opts.dir)
        spec.dir = opts.dir;
      if (opts.allowedTools)
        spec.allowed_tools = opts.allowedTools.split(",");
      if (opts.disallowedTools)
        spec.disallowed_tools = opts.disallowedTools.split(",");
      if (opts.addDir)
        spec.add_dir = [...spec.add_dir || [], ...opts.addDir];
      if (opts.jsonSchema)
        spec.json_schema = opts.jsonSchema;
      if (opts.mission)
        spec.mission = opts.mission;
      if (opts.hook || opts.hookGate || opts.onStop) {
        spec.hooks = spec.hooks || [];
        for (const h of opts.hook || []) {
          const parsed = parseHookFlag(h, false);
          spec.hooks.push({ event: parsed.event, type: "command", command: parsed.command, matcher: parsed.matcher, blocking: false });
        }
        for (const h of opts.hookGate || []) {
          const parsed = parseHookFlag(h, true);
          spec.hooks.push({ event: parsed.event, type: "command", command: parsed.command, matcher: parsed.matcher, blocking: true });
        }
        if (opts.onStop) {
          spec.hooks.push({ event: "Stop", type: "command", command: opts.onStop });
        }
      }
      if (opts.tool) {
        spec.tools = spec.tools || [];
        for (const t of opts.tool)
          spec.tools.push(parseToolFlag(t));
      }
      if (opts.env) {
        spec.env = spec.env || {};
        for (const e of opts.env) {
          const [k, ...v] = e.split("=");
          spec.env[k] = v.join("=");
        }
      }
      await runWithSpec(spec, {
        window: opts.window,
        session: opts.session,
        specDir: dirname6(specPath)
      }, globalOpts);
      return;
    }
    if (opts.prompt) {
      const workerName2 = opts.name || name || nextRunName(project);
      const spec = {
        name: workerName2,
        role: "fleet run agent",
        model: opts.model,
        runtime: opts.runtime,
        effort: opts.effort,
        permission_mode: opts.permission,
        prompt: opts.prompt,
        system_prompt: opts.systemPrompt,
        append_system_prompt: opts.appendSystemPrompt,
        dir: opts.dir,
        allowed_tools: opts.allowedTools?.split(","),
        disallowed_tools: opts.disallowedTools?.split(","),
        add_dir: opts.addDir,
        sleep_duration: opts.perpetual ? 30 : null,
        type: opts.type,
        report_to: opts.reportTo,
        json_schema: opts.jsonSchema,
        mission: opts.mission,
        hooks: [],
        tools: [],
        env: {}
      };
      for (const h of opts.hook || []) {
        const parsed = parseHookFlag(h, false);
        spec.hooks.push({ event: parsed.event, type: "command", command: parsed.command, matcher: parsed.matcher });
      }
      for (const h of opts.hookGate || []) {
        const parsed = parseHookFlag(h, true);
        spec.hooks.push({ event: parsed.event, type: "command", command: parsed.command, matcher: parsed.matcher, blocking: true });
      }
      if (opts.onStop) {
        spec.hooks.push({ event: "Stop", type: "command", command: opts.onStop });
      }
      for (const t of opts.tool || [])
        spec.tools.push(parseToolFlag(t));
      for (const e of opts.env || []) {
        const [k, ...v] = e.split("=");
        spec.env[k] = v.join("=");
      }
      await runWithSpec(spec, {
        window: opts.window,
        session: opts.session
      }, globalOpts);
      return;
    }
    const workerName = name || nextRunName(project);
    await runCreate2(workerName, "Interactive session", {
      model: opts.model,
      effort: opts.effort,
      permissionMode: opts.permission,
      window: opts.window || workerName,
      type: opts.type,
      noLaunch: false
    }, globalOpts);
  });
}
var init_run = __esm(() => {
  init_paths();
  init_cli();
  init_create2();
  init_fmt2();
  init_types();
});

// cli/commands/nuke.ts
import { existsSync as existsSync18, readFileSync as readFileSync19, writeFileSync as writeFileSync14, mkdirSync as mkdirSync15, rmSync as rmSync3, lstatSync } from "node:fs";
import { join as join23, dirname as dirname7, basename as basename4 } from "node:path";
async function nukeWorker(name, project, opts) {
  const dir = workerDir(project, name);
  if (!existsSync18(dir))
    fail(`Worker '${name}' not found in project '${project}'`);
  if (!isHumanMode() && !opts.yes) {
    fail("Destructive operation requires --yes in non-interactive mode");
  }
  console.log(source_default.bold.red(`fleet nuke ${name}`) + ` — removing worker from project '${project}'
`);
  const removed = [];
  const state = getState(project, name);
  const paneId = state?.pane_id;
  if (paneId && listPaneIds().has(paneId)) {
    if (!opts.yes) {
      const yes = await confirm(source_default.yellow(`Kill tmux pane ${paneId} and destroy worker '${name}'?`));
      if (!yes) {
        info("Aborted.");
        return;
      }
      console.log("");
    }
    killPane(paneId);
    ok(`Killed tmux pane ${paneId}`);
    removed.push(`tmux pane ${paneId}`);
  } else {
    if (!opts.yes) {
      const yes = await confirm(source_default.yellow(`Destroy worker '${name}'? (no active pane)`));
      if (!yes) {
        info("Aborted.");
        return;
      }
      console.log("");
    }
    if (paneId)
      info(`Pane ${paneId} already gone`);
  }
  const config = getConfig(project, name);
  const worktreeDir = config?.worktree;
  if (worktreeDir && existsSync18(worktreeDir)) {
    const dotGitPath = join23(worktreeDir, ".git");
    const isMainRepo = existsSync18(dotGitPath) && lstatSync(dotGitPath).isDirectory();
    if (isMainRepo) {
      warn(`${worktreeDir} is a main git repo (not a worktree) — refusing to delete`);
      warn(`Fix this worker's config.worktree to point to an actual worktree, or delete manually`);
    } else {
      const projectRoot = resolveProjectRoot(worktreeDir);
      const parentRoot = dirname7(worktreeDir);
      const projectBasename = basename4(worktreeDir).replace(/-w-.*$/, "");
      const mainRoot = join23(parentRoot, projectBasename);
      const gitRoot = existsSync18(join23(mainRoot, ".git")) ? mainRoot : projectRoot;
      const result = Bun.spawnSync(["git", "-C", gitRoot, "worktree", "remove", worktreeDir, "--force"], { stderr: "pipe" });
      if (result.exitCode === 0) {
        ok(`Removed worktree ${worktreeDir}`);
        removed.push(`worktree ${worktreeDir}`);
      } else {
        const dotGit = join23(worktreeDir, ".git");
        const isWorktree = existsSync18(dotGit) && lstatSync(dotGit).isFile();
        if (isWorktree) {
          warn(`git worktree remove failed — removing worktree directory directly`);
          rmSync3(worktreeDir, { recursive: true, force: true });
          ok(`Removed worktree directory ${worktreeDir}`);
          removed.push(`worktree dir ${worktreeDir}`);
        } else {
          warn(`git worktree remove failed and ${worktreeDir} doesn't look like a worktree — skipping deletion`);
          warn(`Delete manually if intended: rm -rf ${worktreeDir}`);
        }
      }
      const branch = config?.branch || `worker/${name}`;
      Bun.spawnSync(["git", "-C", gitRoot, "branch", "-D", branch], { stderr: "pipe" });
    }
  } else if (worktreeDir) {
    info(`Worktree ${worktreeDir} already gone`);
  }
  if (existsSync18(dir)) {
    rmSync3(dir, { recursive: true, force: true });
    ok(`Removed fleet data ${dir}`);
    removed.push(`fleet data ${dir}`);
  }
  const missionLink = join23(FLEET_DATA, project, "missions", `${name}.md`);
  if (existsSync18(missionLink)) {
    rmSync3(missionLink, { force: true });
    ok(`Removed mission symlink ${missionLink}`);
    removed.push(`mission symlink`);
  }
  const mailUrl = FLEET_MAIL_URL;
  const mailToken = FLEET_MAIL_TOKEN;
  if (mailUrl && mailToken) {
    const accountName = `${name}@${project}`;
    try {
      const resp = await fetch(`${mailUrl}/api/admin/accounts/${encodeURIComponent(accountName)}`, { method: "DELETE", headers: { Authorization: `Bearer ${mailToken}` }, signal: AbortSignal.timeout(5000) });
      if (resp.ok) {
        ok(`Deleted Fleet Mail account ${accountName}`);
        removed.push(`mail account ${accountName}`);
      }
    } catch {}
  }
  console.log("");
  if (removed.length > 0) {
    ok(source_default.bold(`Worker '${name}' nuked (${removed.length} artifacts removed)`));
  } else {
    info(`Worker '${name}' — nothing to clean up`);
  }
}
function getArtifacts() {
  return [
    {
      label: "boring-mail processes",
      path: "",
      kind: "process",
      processPattern: "boring-mail"
    },
    {
      label: "fleet-server processes (legacy)",
      path: "",
      kind: "process",
      processPattern: "fleet-server"
    },
    {
      label: "Watchdog launchd agent",
      path: join23(HOME7, "Library/LaunchAgents/com.claude-fleet.harness-watchdog.plist"),
      kind: "launchd",
      launchdLabel: "com.claude-fleet.harness-watchdog"
    },
    {
      label: "Fleet relay launchd agent",
      path: join23(HOME7, "Library/LaunchAgents/com.claude-fleet.fleet-relay.plist"),
      kind: "launchd",
      launchdLabel: "com.claude-fleet.fleet-relay"
    },
    {
      label: "~/.claude-fleet (fleet CLI — preserving)",
      path: join23(HOME7, ".claude-fleet"),
      kind: "symlink",
      cliCritical: true
    },
    {
      label: "~/.local/bin/fleet (fleet binary — preserving)",
      path: join23(HOME7, ".local/bin/fleet"),
      kind: "symlink",
      cliCritical: true
    },
    {
      label: "~/.claude/ops",
      path: join23(HOME7, ".claude/ops"),
      kind: "symlink"
    },
    {
      label: "~/.tmux-agents",
      path: join23(HOME7, ".tmux-agents"),
      kind: "symlink"
    },
    {
      label: "~/.claude/fleet/ (worker configs & state)",
      path: FLEET_DATA,
      kind: "dir",
      flag: "keep-data"
    },
    {
      label: "~/.claude-hooks/ (hooks clone)",
      path: join23(HOME7, ".claude-hooks"),
      kind: "dir"
    },
    {
      label: "~/.deep-review/ (deep review clone)",
      path: join23(HOME7, ".deep-review"),
      kind: "dir",
      guard: () => {
        const envDir = process.env.DEEP_REVIEW_DIR;
        if (envDir) {
          try {
            const realEnv = Bun.spawnSync(["realpath", envDir], { stderr: "pipe" }).stdout.toString().trim();
            const realDefault = Bun.spawnSync(["realpath", join23(HOME7, ".deep-review")], { stderr: "pipe" }).stdout.toString().trim();
            if (realEnv && realDefault && realEnv !== realDefault) {
              return false;
            }
          } catch {}
        }
        return true;
      }
    },
    {
      label: "~/.boring-mail/ (local mail server data)",
      path: join23(HOME7, ".boring-mail"),
      kind: "dir",
      flag: "keep-mail"
    },
    {
      label: "~/.fleet-server/ (legacy mail data)",
      path: join23(HOME7, ".fleet-server"),
      kind: "dir",
      flag: "keep-mail"
    }
  ];
}
function artifactExists(a) {
  if (a.kind === "process")
    return findProcesses(a.processPattern).length > 0;
  if (a.kind === "launchd")
    return existsSync18(a.path);
  if (a.kind === "symlink") {
    try {
      lstatSync(a.path);
      return true;
    } catch {
      return false;
    }
  }
  return existsSync18(a.path);
}
function findProcesses(pattern) {
  const result = Bun.spawnSync(["pgrep", "-f", pattern], { stderr: "pipe" });
  if (result.exitCode !== 0)
    return [];
  return result.stdout.toString().trim().split(`
`).filter((l) => l.trim()).map((l) => parseInt(l.trim(), 10)).filter((pid) => !isNaN(pid) && pid !== process.pid);
}
function settingsHasFleetEntries() {
  const settingsFile = join23(HOME7, ".claude/settings.json");
  if (!existsSync18(settingsFile))
    return { hasMcp: false, hasHooks: false };
  try {
    const settings = JSON.parse(readFileSync19(settingsFile, "utf-8"));
    const hasMcp = !!settings.mcpServers?.["worker-fleet"];
    let hasHooks = false;
    const fleetPatterns = ["/.claude-fleet/", "/.claude-fleet/", "/.claude-hooks/", "/.tmux-agents/"];
    for (const key of Object.keys(settings.hooks || {})) {
      const hookArray = settings.hooks[key];
      if (!Array.isArray(hookArray))
        continue;
      for (const entry of hookArray) {
        const cmds = (entry.hooks || []).map((h) => h.command || "");
        if (entry.command)
          cmds.push(entry.command);
        if (cmds.some((cmd) => fleetPatterns.some((p) => cmd.includes(p)))) {
          hasHooks = true;
          break;
        }
      }
      if (hasHooks)
        break;
    }
    return { hasMcp, hasHooks };
  } catch {
    return { hasMcp: false, hasHooks: false };
  }
}
function backupSettings() {
  const settingsFile = join23(HOME7, ".claude/settings.json");
  if (!existsSync18(settingsFile))
    return null;
  const backupDir = join23(HOME7, ".claude/settings-backups");
  mkdirSync15(backupDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = join23(backupDir, `settings.${timestamp}.json`);
  writeFileSync14(backupPath, readFileSync19(settingsFile));
  return backupPath;
}
function cleanSettings(dryRun) {
  const settingsFile = join23(HOME7, ".claude/settings.json");
  if (!existsSync18(settingsFile))
    return;
  let settings;
  try {
    settings = JSON.parse(readFileSync19(settingsFile, "utf-8"));
  } catch {
    warn("Could not parse settings.json — skipping");
    return;
  }
  let modified = false;
  const fleetPatterns = [
    "/.claude-fleet/",
    "/.claude-fleet/",
    "/.claude-hooks/",
    "/.tmux-agents/"
  ];
  if (settings.mcpServers?.["worker-fleet"]) {
    if (dryRun) {
      info(`Would remove mcpServers["worker-fleet"] from settings.json`);
    } else {
      delete settings.mcpServers["worker-fleet"];
      modified = true;
      ok(`Removed mcpServers["worker-fleet"]`);
    }
  }
  if (settings.hooks && typeof settings.hooks === "object") {
    for (const key of Object.keys(settings.hooks)) {
      const hookArray = settings.hooks[key];
      if (!Array.isArray(hookArray))
        continue;
      const before = hookArray.length;
      const filtered = hookArray.filter((entry) => {
        const cmds = (entry.hooks || []).map((h) => h.command || "");
        if (entry.command)
          cmds.push(entry.command);
        return !cmds.some((cmd) => fleetPatterns.some((p) => cmd.includes(p)));
      });
      const removed = before - filtered.length;
      if (removed > 0) {
        if (dryRun) {
          info(`Would remove ${removed} fleet hook(s) from hooks.${key}`);
        } else {
          settings.hooks[key] = filtered;
          if (filtered.length === 0)
            delete settings.hooks[key];
          modified = true;
          ok(`Removed ${removed} fleet hook(s) from hooks.${key}`);
        }
      }
    }
    if (!dryRun && settings.hooks && Object.keys(settings.hooks).length === 0) {
      delete settings.hooks;
    }
  }
  if (modified && !dryRun) {
    writeFileSync14(settingsFile, JSON.stringify(settings, null, 2) + `
`);
    ok("Updated settings.json");
  }
}
function removeArtifact(a, dryRun) {
  if (a.kind === "process") {
    const pids = findProcesses(a.processPattern);
    if (pids.length === 0)
      return;
    if (dryRun) {
      info(`Would kill ${a.label} (PIDs: ${pids.join(", ")})`);
      return;
    }
    for (const pid of pids) {
      try {
        process.kill(pid, "SIGTERM");
      } catch {}
    }
    ok(`Killed ${a.label} (PIDs: ${pids.join(", ")})`);
    return;
  }
  if (a.kind === "launchd") {
    if (!existsSync18(a.path))
      return;
    if (dryRun) {
      info(`Would unload & remove ${a.label}`);
      return;
    }
    Bun.spawnSync(["launchctl", "unload", a.path], { stderr: "pipe" });
    rmSync3(a.path, { force: true });
    ok(`Unloaded & removed ${a.label}`);
    return;
  }
  if (a.kind === "symlink") {
    try {
      lstatSync(a.path);
    } catch {
      return;
    }
    if (dryRun) {
      info(`Would remove symlink ${a.label}`);
      return;
    }
    rmSync3(a.path, { force: true });
    ok(`Removed symlink ${a.label}`);
    return;
  }
  if (a.kind === "dir" || a.kind === "file") {
    if (!existsSync18(a.path))
      return;
    if (dryRun) {
      info(`Would remove ${a.label}`);
      return;
    }
    rmSync3(a.path, { recursive: true, force: true });
    ok(`Removed ${a.label}`);
    return;
  }
}
async function confirm(message) {
  process.stdout.write(`${message} [y/N] `);
  for await (const line of console) {
    const answer = line.trim().toLowerCase();
    return answer === "y" || answer === "yes";
  }
  return false;
}
async function nukeAll(opts) {
  const dryRun = opts.dryRun ?? false;
  const skipConfirm = opts.yes ?? false;
  const purge = opts.purge ?? false;
  const keepFlags = new Set;
  if (opts.keepData)
    keepFlags.add("keep-data");
  if (opts.keepMail)
    keepFlags.add("keep-mail");
  const label = purge ? "fleet nuke --all --purge" : "fleet nuke --all";
  console.log(source_default.bold.red(dryRun ? `${label} (dry run)` : label) + ` — remove all fleet artifacts
`);
  const artifacts = getArtifacts();
  const settingsInfo = settingsHasFleetEntries();
  const toRemove = [];
  const skippedByFlag = [];
  const skippedByGuard = [];
  const skippedCli = [];
  for (const a of artifacts) {
    if (a.cliCritical && !purge) {
      if (artifactExists(a))
        skippedCli.push(a);
      continue;
    }
    if (a.flag && keepFlags.has(a.flag)) {
      if (artifactExists(a))
        skippedByFlag.push(a);
      continue;
    }
    if (a.guard && !a.guard()) {
      if (artifactExists(a))
        skippedByGuard.push(a);
      continue;
    }
    if (artifactExists(a)) {
      toRemove.push(a);
    }
  }
  const hasSettingsWork = settingsInfo.hasMcp || settingsInfo.hasHooks;
  if (toRemove.length === 0 && !hasSettingsWork) {
    info("Nothing to remove — fleet is not installed (or already nuked).");
    if (skippedCli.length > 0) {
      console.log("");
      info("Preserved (CLI installation):");
      for (const a of skippedCli)
        console.log(`  ${source_default.dim("-")} ${a.label}`);
      console.log(`
  To remove the CLI too: ${source_default.cyan("fleet nuke --all --purge")}`);
    }
    if (skippedByFlag.length > 0) {
      console.log("");
      info("Preserved by flags:");
      for (const a of skippedByFlag)
        console.log(`  ${source_default.dim("-")} ${a.label}`);
    }
    return;
  }
  console.log(source_default.bold("Will remove:"));
  for (const a of toRemove) {
    const kindTag = source_default.dim(`[${a.kind}]`);
    if (a.kind === "process") {
      const pids = findProcesses(a.processPattern);
      console.log(`  ${source_default.red("-")} ${a.label} (PIDs: ${pids.join(", ")}) ${kindTag}`);
    } else {
      console.log(`  ${source_default.red("-")} ${a.label} ${kindTag}`);
    }
  }
  if (hasSettingsWork) {
    if (settingsInfo.hasMcp)
      console.log(`  ${source_default.red("-")} mcpServers["worker-fleet"] in settings.json`);
    if (settingsInfo.hasHooks)
      console.log(`  ${source_default.red("-")} Fleet hook entries in settings.json`);
  }
  if (skippedCli.length > 0) {
    console.log("");
    console.log(source_default.bold("Preserved (CLI installation):"));
    for (const a of skippedCli) {
      console.log(`  ${source_default.dim("-")} ${a.label}`);
    }
  }
  if (skippedByFlag.length > 0) {
    console.log("");
    console.log(source_default.bold("Preserved (by flag):"));
    for (const a of skippedByFlag) {
      console.log(`  ${source_default.dim("-")} ${a.label}`);
    }
  }
  if (skippedByGuard.length > 0) {
    console.log("");
    console.log(source_default.bold("Skipped (external reference):"));
    for (const a of skippedByGuard) {
      console.log(`  ${source_default.dim("-")} ${a.label} ${source_default.dim("(DEEP_REVIEW_DIR points elsewhere)")}`);
    }
  }
  console.log("");
  if (!dryRun && !skipConfirm && !isHumanMode()) {
    fail("Destructive operation requires --yes in non-interactive mode");
  }
  if (!dryRun && !skipConfirm) {
    const yes = await confirm(source_default.yellow("This is destructive. Proceed?"));
    if (!yes) {
      info("Aborted.");
      return;
    }
    console.log("");
  }
  if (hasSettingsWork) {
    if (dryRun) {
      info("Would back up settings.json before modification");
    } else {
      const backup = backupSettings();
      if (backup)
        ok(`Backed up settings.json → ${backup}`);
    }
  }
  const order = ["process", "launchd", "symlink", "dir", "file"];
  for (const kind of order) {
    for (const a of toRemove.filter((x) => x.kind === kind)) {
      removeArtifact(a, dryRun);
    }
    if (kind === "symlink" && hasSettingsWork) {
      cleanSettings(dryRun);
    }
  }
  console.log("");
  if (dryRun) {
    info("Dry run complete — no changes made.");
    console.log(`
  Run ${source_default.cyan(purge ? "fleet nuke --all --purge" : "fleet nuke --all")} (without --dry-run) to execute.`);
  } else {
    ok(source_default.bold("Fleet artifacts removed."));
    if (!purge && skippedCli.length > 0) {
      console.log(`
  CLI preserved — you can still run ${source_default.cyan("fleet setup")} to re-install.`);
      console.log(`  To remove everything including the CLI: ${source_default.cyan("fleet nuke --all --purge")}`);
    } else if (purge) {
      console.log(`
  CLI removed. To re-install from the repo:`);
      console.log(`    ${source_default.cyan("cd <boring-repo> && bash install.sh")}`);
    } else {
      console.log(`
  Re-install: ${source_default.cyan("fleet setup")}`);
    }
  }
}
function register18(parent) {
  const sub = parent.command("nuke [name]").description("Destroy a worker or all fleet artifacts (--all)").option("-a, --all", "Remove ALL fleet-installed artifacts (clean slate)").option("--purge", "Also remove CLI symlinks (~/.claude-fleet, ~/.local/bin/fleet)").option("--dry-run", "Show what would be removed without doing it").option("-y, --yes", "Skip confirmation prompt").option("--keep-data", "Preserve ~/.claude/fleet/ (--all only)").option("--keep-mail", "Preserve Fleet Mail data (--all only)");
  addGlobalOpts(sub).action(async (name, opts, cmd) => {
    if (opts.all) {
      await nukeAll(opts);
      return;
    }
    if (!name) {
      fail("Usage: fleet nuke <name>  or  fleet nuke --all");
    }
    const project = cmd.optsWithGlobals().project || resolveProject();
    await nukeWorker(name, project, { yes: opts.yes });
  });
}
var HOME7;
var init_nuke = __esm(() => {
  init_source();
  init_paths();
  init_config();
  init_fmt2();
  init_cli();
  HOME7 = process.env.HOME || "/tmp";
});

// cli/lib/health.ts
var exports_health = {};
__export(exports_health, {
  runHealthChecks: () => runHealthChecks
});
import { existsSync as existsSync19, readFileSync as readFileSync20, readdirSync as readdirSync9 } from "node:fs";
import { join as join24 } from "node:path";
function readJson2(path) {
  try {
    return JSON.parse(readFileSync20(path, "utf-8"));
  } catch {
    return null;
  }
}
function tmux(...args) {
  const result = Bun.spawnSync(["tmux", ...args], { stderr: "pipe" });
  return { ok: result.exitCode === 0, stdout: result.stdout.toString().trim() };
}
function listAlivePanes() {
  const { ok: ok2, stdout } = tmux("list-panes", "-a", "-F", "#{pane_id}");
  if (!ok2)
    return new Set;
  return new Set(stdout.split(`
`).filter(Boolean));
}
function listPaneWindows() {
  const { ok: ok2, stdout } = tmux("list-panes", "-a", "-F", "#{pane_id}\t#{window_name}");
  if (!ok2)
    return new Map;
  const m = new Map;
  for (const line of stdout.split(`
`)) {
    const [id, win] = line.split("\t");
    if (id)
      m.set(id, win || "");
  }
  return m;
}
function loadAllWorkers(project) {
  const projectDir = join24(FLEET_DATA, project);
  const workers = [];
  try {
    for (const d of readdirSync9(projectDir, { withFileTypes: true })) {
      if (!d.isDirectory() || d.name.startsWith(".") || d.name.startsWith("_") || d.name === "missions")
        continue;
      const configPath2 = join24(projectDir, d.name, "config.json");
      const statePath2 = join24(projectDir, d.name, "state.json");
      const config = readJson2(configPath2);
      if (!config)
        continue;
      const state = readJson2(statePath2) || {};
      workers.push({ name: d.name, config, state });
    }
  } catch {}
  return workers;
}
function runHealthChecks(project) {
  const workers = loadAllWorkers(project);
  if (workers.length === 0) {
    return {
      results: [{ name: "Fleet Health", status: "skip", message: "No workers found" }],
      fixes: []
    };
  }
  const alivePanes = listAlivePanes();
  const paneWindows = listPaneWindows();
  const results = [];
  const fixes = [];
  {
    const deadPanes = [];
    for (const w of workers) {
      const paneId = w.state.pane_id;
      if (paneId && paneId.startsWith("%") && w.state.status === "active" && !alivePanes.has(paneId)) {
        deadPanes.push(w.name);
      }
    }
    if (deadPanes.length > 0) {
      results.push({
        name: "Pane liveness",
        status: "fail",
        message: `${deadPanes.length} active worker(s) with dead panes: ${deadPanes.join(", ")}`,
        autoFixable: true
      });
      for (const name of deadPanes) {
        fixes.push({
          check: "Pane liveness",
          action: `Clear stale pane_id for ${name}`,
          fn: () => {
            const sp = join24(FLEET_DATA, project, name, "state.json");
            const s = readJson2(sp);
            if (s) {
              s.pane_id = "";
              s.status = "idle";
              __require("fs").writeFileSync(sp, JSON.stringify(s, null, 2) + `
`);
            }
          }
        });
      }
    } else {
      results.push({ name: "Pane liveness", status: "pass", message: "All active workers have live panes" });
    }
  }
  {
    const invalid = [];
    for (const w of workers) {
      const pid = w.state.pane_id;
      if (pid && !pid.startsWith("%") && pid !== "") {
        invalid.push(`${w.name} (${pid})`);
      }
    }
    if (invalid.length > 0) {
      results.push({
        name: "Invalid pane_ids",
        status: "fail",
        message: `Non-%NNN values: ${invalid.join(", ")}`,
        autoFixable: true
      });
      for (const w of workers) {
        const pid = w.state.pane_id;
        if (pid && !pid.startsWith("%") && pid !== "") {
          fixes.push({
            check: "Invalid pane_ids",
            action: `Clear invalid pane_id '${pid}' for ${w.name}`,
            fn: () => {
              const sp = join24(FLEET_DATA, project, w.name, "state.json");
              const s = readJson2(sp);
              if (s) {
                s.pane_id = "";
                __require("fs").writeFileSync(sp, JSON.stringify(s, null, 2) + `
`);
              }
            }
          });
        }
      }
    } else {
      results.push({ name: "Invalid pane_ids", status: "pass", message: "All pane_ids valid" });
    }
  }
  {
    const paneCounts = new Map;
    for (const w of workers) {
      const pid = w.state.pane_id;
      if (pid && pid.startsWith("%")) {
        const list = paneCounts.get(pid) || [];
        list.push(w.name);
        paneCounts.set(pid, list);
      }
    }
    const dupes = [...paneCounts.entries()].filter(([, names]) => names.length > 1);
    if (dupes.length > 0) {
      const desc = dupes.map(([pid, names]) => `${pid}: ${names.join(", ")}`).join("; ");
      results.push({ name: "Duplicate panes", status: "fail", message: desc });
    } else {
      results.push({ name: "Duplicate panes", status: "pass", message: "No duplicates" });
    }
  }
  {
    const misplaced = [];
    for (const w of workers) {
      const pid = w.state.pane_id;
      const targetWin = w.config.window;
      if (pid && pid.startsWith("%") && targetWin && alivePanes.has(pid)) {
        const actualWin = paneWindows.get(pid);
        if (actualWin && actualWin !== targetWin) {
          misplaced.push(`${w.name} (in ${actualWin}, want ${targetWin})`);
        }
      }
    }
    if (misplaced.length > 0) {
      results.push({
        name: "Window placement",
        status: "warn",
        message: `${misplaced.length} misplaced: ${misplaced.join(", ")}`,
        fix: "Watchdog will auto-correct on next pass"
      });
    } else {
      results.push({ name: "Window placement", status: "pass", message: "All panes in correct windows" });
    }
  }
  {
    const stale = [];
    const now = Date.now();
    for (const w of workers) {
      if (w.state.status === "sleeping" && w.state.custom?.sleep_until) {
        const wakeMs = new Date(w.state.custom.sleep_until).getTime();
        if (!isNaN(wakeMs) && wakeMs < now) {
          stale.push(w.name);
        }
      }
    }
    if (stale.length > 0) {
      results.push({
        name: "Stale sleep_until",
        status: "warn",
        message: `${stale.length} sleeping past timer: ${stale.join(", ")}`,
        fix: `Run: fleet start <name>`
      });
    } else {
      results.push({ name: "Stale sleep_until", status: "pass", message: "No stale timers" });
    }
  }
  {
    const missing = [];
    for (const w of workers) {
      const wt = w.config.worktree;
      if (wt && !existsSync19(wt)) {
        missing.push(`${w.name} (${wt})`);
      }
    }
    if (missing.length > 0) {
      results.push({ name: "Missing worktrees", status: "fail", message: missing.join(", ") });
    } else {
      results.push({ name: "Missing worktrees", status: "pass", message: "All worktrees exist" });
    }
  }
  {
    const noToken = [];
    for (const w of workers) {
      const tokenPath = join24(FLEET_DATA, project, w.name, "token");
      if (!existsSync19(tokenPath)) {
        noToken.push(w.name);
      } else {
        try {
          const token = readFileSync20(tokenPath, "utf-8").trim();
          if (!token)
            noToken.push(w.name);
        } catch {
          noToken.push(w.name);
        }
      }
    }
    if (noToken.length > 0) {
      results.push({
        name: "Fleet Mail tokens",
        status: "warn",
        message: `${noToken.length} missing: ${noToken.join(", ")}`,
        fix: "Run: fleet setup"
      });
    } else {
      results.push({ name: "Fleet Mail tokens", status: "pass", message: `All ${workers.length} workers have tokens` });
    }
  }
  {
    const registryPath = join24(FLEET_DATA, project, "registry.json");
    if (existsSync19(registryPath)) {
      results.push({
        name: "Registry drift",
        status: "warn",
        message: "Legacy registry.json still exists (per-worker dirs are source of truth)",
        autoFixable: true
      });
      fixes.push({
        check: "Registry drift",
        action: "Delete stale registry.json",
        fn: () => {
          try {
            __require("fs").unlinkSync(registryPath);
          } catch {}
        }
      });
    } else {
      results.push({ name: "Registry drift", status: "pass", message: "No legacy registry.json" });
    }
  }
  {
    const HOME8 = process.env.HOME || "/tmp";
    const crashDir = join24(HOME8, ".tmux-agents/state/watchdog-crashes");
    const crashLooped = [];
    try {
      for (const f of readdirSync9(crashDir)) {
        if (f.endsWith(".crash-loop")) {
          crashLooped.push(f.replace(".crash-loop", ""));
        }
      }
    } catch {}
    if (crashLooped.length > 0) {
      results.push({
        name: "Crash loops",
        status: "fail",
        message: `${crashLooped.length} stuck: ${crashLooped.join(", ")}`,
        autoFixable: true
      });
      for (const name of crashLooped) {
        fixes.push({
          check: "Crash loops",
          action: `Remove crash-loop flag for ${name}`,
          fn: () => {
            try {
              __require("fs").unlinkSync(join24(crashDir, `${name}.crash-loop`));
            } catch {}
          }
        });
      }
    } else {
      results.push({ name: "Crash loops", status: "pass", message: "No crash-looped workers" });
    }
  }
  {
    const HOME8 = process.env.HOME || "/tmp";
    const runtimeDir = join24(HOME8, ".tmux-agents/state/watchdog-runtime");
    const staleWorkers = [];
    const now = Math.floor(Date.now() / 1000);
    for (const w of workers) {
      if (w.state.status !== "active")
        continue;
      const lf = join24(runtimeDir, w.name, "liveness");
      if (!existsSync19(lf))
        continue;
      try {
        const ts = parseInt(readFileSync20(lf, "utf-8").trim(), 10);
        if (!isNaN(ts) && now - ts > 1200) {
          staleWorkers.push(`${w.name} (${Math.floor((now - ts) / 60)}min)`);
        }
      } catch {}
    }
    if (staleWorkers.length > 0) {
      results.push({
        name: "Liveness staleness",
        status: "warn",
        message: `${staleWorkers.length} active with stale heartbeat: ${staleWorkers.join(", ")}`
      });
    } else {
      results.push({ name: "Liveness staleness", status: "pass", message: "All heartbeats recent" });
    }
  }
  {
    const noMission = [];
    for (const w of workers) {
      const mPath = join24(FLEET_DATA, project, w.name, "mission.md");
      if (!existsSync19(mPath))
        noMission.push(w.name);
    }
    if (noMission.length > 0) {
      results.push({
        name: "Missing missions",
        status: "warn",
        message: `${noMission.length} without mission.md: ${noMission.join(", ")}`
      });
    } else {
      results.push({ name: "Missing missions", status: "pass", message: "All workers have missions" });
    }
  }
  {
    const HOME8 = process.env.HOME || "/tmp";
    const plistPath = join24(HOME8, "Library/LaunchAgents/com.tmux-agents.watchdog.plist");
    if (existsSync19(plistPath)) {
      const check = Bun.spawnSync(["launchctl", "list", "com.tmux-agents.watchdog"], { stderr: "pipe" });
      if (check.exitCode === 0) {
        results.push({ name: "Watchdog process", status: "pass", message: "Running" });
      } else {
        results.push({
          name: "Watchdog process",
          status: "warn",
          message: "Plist exists but agent not loaded",
          fix: `Run: launchctl load ${plistPath}`
        });
      }
    } else {
      results.push({
        name: "Watchdog process",
        status: "skip",
        message: "Not installed",
        fix: "Run: bun run extensions/watchdog/src/install.ts"
      });
    }
  }
  return { results, fixes };
}
var init_health = __esm(() => {
  init_paths();
});

// cli/commands/doctor.ts
import { existsSync as existsSync20, readFileSync as readFileSync21, readdirSync as readdirSync10, statSync, accessSync, constants } from "node:fs";
import { join as join25 } from "node:path";
function getVersion(bin) {
  const flags = bin === "tmux" ? ["-V"] : ["--version"];
  try {
    const result = Bun.spawnSync([bin, ...flags], { stderr: "pipe" });
    if (result.exitCode === 0) {
      const out = result.stdout.toString().trim();
      const match = out.match(/(\d[\d.]+\w*)/);
      return match ? match[1] : out;
    }
  } catch {}
  return null;
}
function isExecutable(path) {
  try {
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}
function isDirectory(path) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}
function parseJson(path) {
  try {
    return JSON.parse(readFileSync21(path, "utf-8"));
  } catch {
    return null;
  }
}
function checkPrerequisites() {
  const bins = [
    { name: "bun", hint: "curl -fsSL https://bun.sh/install | bash" },
    { name: "tmux", hint: "brew install tmux" },
    { name: "claude", hint: "https://docs.anthropic.com/en/docs/claude-code" }
  ];
  const found = [];
  const missing = [];
  for (const { name, hint } of bins) {
    const version = getVersion(name);
    if (version) {
      found.push(`${name} ${version}`);
    } else {
      missing.push(`${name} (${hint})`);
    }
  }
  if (missing.length > 0) {
    return {
      name: "Prerequisites",
      status: "fail",
      message: `Missing: ${missing.map((m) => m.split(" (")[0]).join(", ")}`,
      fix: `Install: ${missing.join("; ")}`
    };
  }
  return {
    name: "Prerequisites",
    status: "pass",
    message: found.join(", ")
  };
}
function checkSymlinks() {
  const symlinks = [
    { path: join25(HOME8, ".claude-fleet"), label: "~/.claude-fleet", checkDir: true },
    { path: join25(HOME8, ".claude-fleet"), label: "~/.claude-fleet" },
    { path: join25(HOME8, ".claude/ops"), label: "~/.claude/ops" },
    { path: join25(HOME8, ".tmux-agents"), label: "~/.tmux-agents" },
    { path: join25(HOME8, ".local/bin/fleet"), label: "~/.local/bin/fleet", checkExec: true }
  ];
  let valid = 0;
  const broken = [];
  for (const { path, label, checkDir, checkExec } of symlinks) {
    if (!existsSync20(path)) {
      broken.push(label);
      continue;
    }
    if (checkDir && !isDirectory(path)) {
      broken.push(`${label} (not a directory)`);
      continue;
    }
    if (checkExec && !isExecutable(path)) {
      broken.push(`${label} (not executable)`);
      continue;
    }
    valid++;
  }
  if (broken.length > 0) {
    return {
      name: "Symlinks",
      status: "fail",
      message: `${valid}/${symlinks.length} valid — missing: ${broken.join(", ")}`,
      fix: "Run: fleet setup"
    };
  }
  return {
    name: "Symlinks",
    status: "pass",
    message: `${valid}/${symlinks.length} valid`
  };
}
function checkDataDirectory() {
  if (!existsSync20(FLEET_DATA)) {
    return {
      name: "Data directory",
      status: "fail",
      message: "~/.claude/fleet/ does not exist",
      fix: "Run: fleet setup"
    };
  }
  const defaultsFile = join25(FLEET_DATA, "defaults.json");
  if (!existsSync20(defaultsFile)) {
    return {
      name: "Data directory",
      status: "fail",
      message: "~/.claude/fleet/ exists but defaults.json is missing",
      fix: "Run: fleet setup"
    };
  }
  const defaults = parseJson(defaultsFile);
  if (defaults === null) {
    return {
      name: "Data directory",
      status: "fail",
      message: "defaults.json exists but is not valid JSON",
      fix: "Fix or recreate: fleet setup"
    };
  }
  let projectCount = 0;
  let workerCount = 0;
  try {
    const entries = readdirSync10(FLEET_DATA, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory())
        continue;
      projectCount++;
      try {
        const workers = readdirSync10(join25(FLEET_DATA, entry.name), { withFileTypes: true }).filter((d) => d.isDirectory() && !["missions", "_user", "_config"].includes(d.name));
        workerCount += workers.length;
      } catch {}
    }
  } catch {}
  return {
    name: "Data directory",
    status: "pass",
    message: `~/.claude/fleet/ (${projectCount} project${projectCount !== 1 ? "s" : ""}, ${workerCount} worker${workerCount !== 1 ? "s" : ""})`
  };
}
function checkBunDeps() {
  const nodeModules = join25(FLEET_DIR, "node_modules");
  if (!existsSync20(nodeModules)) {
    return {
      name: "Bun dependencies",
      status: "fail",
      message: "node_modules/ not found in fleet dir",
      fix: `Run: cd ${FLEET_DIR} && bun install`
    };
  }
  const mcpSdk = join25(FLEET_DIR, "mcp/worker-fleet/node_modules/@modelcontextprotocol/sdk");
  const mcpSdkRoot = join25(FLEET_DIR, "node_modules/@modelcontextprotocol/sdk");
  if (!existsSync20(mcpSdk) && !existsSync20(mcpSdkRoot)) {
    return {
      name: "Bun dependencies",
      status: "fail",
      message: "@modelcontextprotocol/sdk not resolved",
      fix: `Run: cd ${FLEET_DIR} && bun install`
    };
  }
  return {
    name: "Bun dependencies",
    status: "pass",
    message: "installed"
  };
}
function checkMcpServer() {
  const settingsFile = join25(HOME8, ".claude/settings.json");
  if (!existsSync20(settingsFile)) {
    return {
      name: "MCP server",
      status: "fail",
      message: "~/.claude/settings.json not found",
      fix: "Run: fleet mcp register"
    };
  }
  const settings = parseJson(settingsFile);
  if (!settings) {
    return {
      name: "MCP server",
      status: "fail",
      message: "settings.json is not valid JSON",
      fix: "Fix settings.json manually or run: fleet setup"
    };
  }
  const mcpEntry = settings?.mcpServers?.["worker-fleet"];
  if (!mcpEntry) {
    return {
      name: "MCP server",
      status: "fail",
      message: "worker-fleet not registered in mcpServers",
      fix: "Run: fleet mcp register"
    };
  }
  const cmd = mcpEntry.command;
  if (cmd) {
    const cmdResult = Bun.spawnSync(["which", cmd], { stderr: "pipe" });
    if (cmdResult.exitCode !== 0) {
      return {
        name: "MCP server",
        status: "fail",
        message: `registered but command not found: ${cmd}`,
        fix: "Run: fleet mcp register"
      };
    }
  }
  const args = mcpEntry.args || [];
  const scriptArg = args.find((a) => a.endsWith(".ts") || a.endsWith(".js"));
  if (scriptArg && !existsSync20(scriptArg)) {
    return {
      name: "MCP server",
      status: "fail",
      message: `registered but script not found: ${scriptArg}`,
      fix: "Run: fleet mcp register"
    };
  }
  return {
    name: "MCP server",
    status: "pass",
    message: "registered and startable"
  };
}
function checkHooks() {
  const settingsFile = join25(HOME8, ".claude/settings.json");
  const settings = parseJson(settingsFile);
  if (!settings?.hooks) {
    return {
      name: "Hooks",
      status: "fail",
      message: "no hooks configured in settings.json",
      fix: "Run: fleet setup"
    };
  }
  let totalHooks = 0;
  let validHooks = 0;
  const brokenScripts = [];
  const fleetPathPattern = /\.claude-fleet|\.claude-fleet|\.tmux-agents/;
  for (const [_event, hookGroups] of Object.entries(settings.hooks)) {
    if (!Array.isArray(hookGroups))
      continue;
    for (const group of hookGroups) {
      const hooks = group.hooks || [];
      for (const hook of hooks) {
        if (hook.type !== "command")
          continue;
        const cmd = hook.command || "";
        if (!fleetPathPattern.test(cmd))
          continue;
        totalHooks++;
        const parts = cmd.split(/\s+/);
        const scriptPath = parts.length > 1 ? parts[1] : parts[0];
        if (existsSync20(scriptPath)) {
          validHooks++;
        } else {
          brokenScripts.push(scriptPath.replace(HOME8, "~"));
        }
      }
    }
  }
  if (totalHooks === 0) {
    return {
      name: "Hooks",
      status: "fail",
      message: "no fleet hooks found in settings.json",
      fix: "Run: fleet setup"
    };
  }
  if (brokenScripts.length > 0) {
    return {
      name: "Hooks",
      status: "fail",
      message: `${validHooks}/${totalHooks} hooks valid — broken: ${brokenScripts.slice(0, 3).join(", ")}${brokenScripts.length > 3 ? ` (+${brokenScripts.length - 3} more)` : ""}`,
      fix: "Run: fleet setup"
    };
  }
  return {
    name: "Hooks",
    status: "pass",
    message: `${totalHooks} hooks installed, all scripts valid`
  };
}
async function checkFleetMail() {
  if (!FLEET_MAIL_URL) {
    return {
      name: "Fleet Mail",
      status: "fail",
      message: "not configured",
      fix: "Run: fleet mail-server connect <url>"
    };
  }
  try {
    const resp = await fetch(`${FLEET_MAIL_URL}/health`, {
      signal: AbortSignal.timeout(3000)
    });
    if (!resp.ok) {
      return {
        name: "Fleet Mail",
        status: "fail",
        message: `${FLEET_MAIL_URL} returned ${resp.status}`,
        fix: "Check that the Fleet Mail server is running"
      };
    }
  } catch {
    return {
      name: "Fleet Mail",
      status: "fail",
      message: `${FLEET_MAIL_URL} unreachable`,
      fix: "Start the Fleet Mail server or run: fleet mail-server connect <url>"
    };
  }
  if (!FLEET_MAIL_TOKEN) {
    return {
      name: "Fleet Mail",
      status: "pass",
      message: `${FLEET_MAIL_URL} reachable (no admin token configured)`
    };
  }
  return {
    name: "Fleet Mail",
    status: "pass",
    message: `${FLEET_MAIL_URL} reachable`
  };
}
function checkDeepReview() {
  const deepReviewDir = process.env.DEEP_REVIEW_DIR || join25(HOME8, ".deep-review");
  const bundledDir = FLEET_DIR;
  const drContextPaths = [
    join25(bundledDir, "tools/dr-context/target/release/dr-context"),
    join25(bundledDir, "tools/dr-context/dr-context")
  ];
  const drContextFound = drContextPaths.some((p) => existsSync20(p));
  const deepReviewPaths = [
    join25(deepReviewDir, "scripts/deep-review.sh"),
    join25(bundledDir, "scripts/deep-review.sh")
  ];
  const deepReviewFound = deepReviewPaths.some((p) => existsSync20(p));
  if (!drContextFound && !deepReviewFound) {
    return {
      name: "Deep Review",
      status: "skip",
      message: "not installed (optional — fleet setup --full to install)",
      optional: true
    };
  }
  const parts = [];
  if (drContextFound)
    parts.push("dr-context binary");
  if (deepReviewFound)
    parts.push("deep-review.sh");
  if (!drContextFound || !deepReviewFound) {
    const missing = !drContextFound ? "dr-context binary" : "deep-review.sh";
    return {
      name: "Deep Review",
      status: "skip",
      message: `partial — missing ${missing}`,
      optional: true
    };
  }
  return {
    name: "Deep Review",
    status: "pass",
    message: parts.join(", "),
    optional: true
  };
}
function checkWatchdog() {
  const rustBinary = join25(FLEET_DIR, "extensions/watchdog-rs/target/release/boring-watchdog");
  const tsScript = join25(FLEET_DIR, "extensions/watchdog/src/watchdog.ts");
  const hasRust = existsSync20(rustBinary);
  const hasTs = existsSync20(tsScript);
  if (!hasRust && !hasTs) {
    return {
      name: "Watchdog",
      status: "skip",
      message: "not installed (optional — fleet setup --full to install)",
      optional: true
    };
  }
  const impl = hasRust ? "Rust" : "TypeScript";
  const plistPath = join25(HOME8, "Library/LaunchAgents/com.tmux-agents.watchdog.plist");
  const legacyPlist = join25(HOME8, "Library/LaunchAgents/com.claude-fleet.harness-watchdog.plist");
  if (!existsSync20(plistPath) && !existsSync20(legacyPlist)) {
    const fix = hasRust ? `Run: ${rustBinary} install` : `Run: bash ${join25(FLEET_DIR, "extensions/watchdog/install.sh")}`;
    return {
      name: "Watchdog",
      status: "skip",
      message: `${impl} binary found but launchd agent not loaded`,
      optional: true,
      fix
    };
  }
  const result = Bun.spawnSync(["launchctl", "list", "com.tmux-agents.watchdog"], { stderr: "pipe" });
  if (result.exitCode !== 0) {
    const legacyResult = Bun.spawnSync(["launchctl", "list", "com.claude-fleet.harness-watchdog"], { stderr: "pipe" });
    if (legacyResult.exitCode !== 0) {
      return {
        name: "Watchdog",
        status: "skip",
        message: "plist exists but agent not loaded",
        optional: true,
        fix: `Run: launchctl load ${existsSync20(plistPath) ? plistPath : legacyPlist}`
      };
    }
  }
  if (hasRust && existsSync20(plistPath)) {
    try {
      const plistContent = readFileSync21(plistPath, "utf-8");
      if (!plistContent.includes("boring-watchdog")) {
        return {
          name: "Watchdog",
          status: "pass",
          message: `launchd agent loaded (${impl} binary available — run: boring-watchdog install to upgrade)`,
          optional: true
        };
      }
    } catch {}
  }
  return {
    name: "Watchdog",
    status: "pass",
    message: `launchd agent loaded (${impl})`,
    optional: true
  };
}
function checkTui() {
  const which = Bun.spawnSync(["which", "boring-mail-tui"], { stderr: "pipe" });
  if (which.exitCode === 0) {
    return {
      name: "Fleet Mail TUI",
      status: "pass",
      message: which.stdout.toString().trim(),
      optional: true
    };
  }
  const paths = [
    join25(HOME8, ".cargo/bin/boring-mail-tui"),
    join25(HOME8, "Desktop/zPersonalProjects/boring-mail-server/target/release/boring-mail-tui")
  ];
  for (const p of paths) {
    if (existsSync20(p)) {
      return {
        name: "Fleet Mail TUI",
        status: "pass",
        message: p,
        optional: true
      };
    }
  }
  return {
    name: "Fleet Mail TUI",
    status: "skip",
    message: "not found (optional — cargo install boring-mail-tui)",
    optional: true
  };
}
function formatCheckResult(r) {
  let icon;
  let line;
  switch (r.status) {
    case "pass":
      icon = source_default.green("✓");
      line = `${icon} ${source_default.bold(r.name)}: ${r.message}`;
      break;
    case "fail":
      icon = source_default.red("✗");
      line = `${icon} ${source_default.bold(r.name)}: ${source_default.red(r.message)}`;
      break;
    case "warn":
      icon = source_default.yellow("⚠");
      line = `${icon} ${source_default.bold(r.name)}: ${source_default.yellow(r.message)}`;
      break;
    case "skip":
      icon = source_default.yellow("○");
      line = `${icon} ${source_default.bold(r.name)}: ${source_default.yellow(r.message)}`;
      break;
  }
  console.log(line);
  if (r.fix && r.status !== "pass") {
    console.log(`  ${source_default.dim("→")} ${r.fix}`);
  }
}
async function runDoctor(globalOpts) {
  const json = globalOpts.json;
  const fix = globalOpts.fix;
  const project = globalOpts.project || null;
  const results = [];
  results.push(checkPrerequisites());
  results.push(checkSymlinks());
  results.push(checkDataDirectory());
  results.push(checkBunDeps());
  results.push(checkMcpServer());
  results.push(checkHooks());
  results.push(await checkFleetMail());
  results.push(checkDeepReview());
  results.push(checkWatchdog());
  results.push(checkTui());
  let projectName = project;
  if (!projectName) {
    try {
      const r = Bun.spawnSync(["git", "rev-parse", "--show-toplevel"], { stderr: "pipe" });
      if (r.exitCode === 0) {
        const root = r.stdout.toString().trim();
        projectName = root.split("/").pop().replace(/-w-.*$/, "");
      }
    } catch {}
  }
  if (!projectName) {
    projectName = process.cwd().split("/").pop().replace(/-w-.*$/, "");
  }
  const { runHealthChecks: runHealthChecks2 } = await Promise.resolve().then(() => (init_health(), exports_health));
  const { results: healthResults, fixes } = runHealthChecks2(projectName);
  const allHealthResults = healthResults.map((hr) => ({
    name: hr.name,
    status: hr.status,
    message: hr.message,
    fix: hr.fix
  }));
  if (json) {
    console.log(JSON.stringify({
      infrastructure: results,
      fleet_health: allHealthResults,
      fixes_available: fixes.length
    }, null, 2));
    return;
  }
  console.log(source_default.bold("Fleet Doctor"));
  console.log("============");
  console.log("");
  console.log(source_default.bold.underline("Infrastructure"));
  console.log("");
  for (const r of results)
    formatCheckResult(r);
  console.log("");
  console.log(source_default.bold.underline(`Fleet Health (${projectName})`));
  console.log("");
  for (const r of allHealthResults)
    formatCheckResult(r);
  if (fix && fixes.length > 0) {
    console.log("");
    console.log(source_default.bold.underline("Auto-fixes"));
    for (const f of fixes) {
      try {
        f.fn();
        console.log(`  ${source_default.green("✓")} ${f.action}`);
      } catch (err) {
        console.log(`  ${source_default.red("✗")} ${f.action}: ${err.message}`);
      }
    }
  } else if (fixes.length > 0 && !fix) {
    console.log("");
    console.log(source_default.dim(`${fixes.length} auto-fixable issue(s) found. Run with --fix to apply.`));
  }
  const allResults = [...results, ...allHealthResults];
  const coreResults = allResults.filter((r) => !r.optional);
  const corePassed = coreResults.filter((r) => r.status === "pass").length;
  const coreTotal = coreResults.length;
  const anyFailed = allResults.some((r) => r.status === "fail");
  console.log("");
  if (anyFailed) {
    console.log(source_default.red(`Status: unhealthy (${corePassed}/${coreTotal} checks passed)`));
  } else {
    console.log(source_default.green(`Status: healthy (${corePassed}/${coreTotal} checks passed)`));
  }
}
function register19(parent) {
  const sub = parent.command("doctor").description("Verify health of the fleet ecosystem").option("--fix", "Auto-fix issues that can be repaired automatically");
  addGlobalOpts(sub).action(async (_opts, cmd) => {
    await runDoctor(cmd.optsWithGlobals());
  });
}
var HOME8;
var init_doctor = __esm(() => {
  init_source();
  init_paths();
  init_cli();
  HOME8 = process.env.HOME || "/tmp";
});

// cli/commands/onboard.ts
import { existsSync as existsSync21, mkdirSync as mkdirSync16, readFileSync as readFileSync22, writeFileSync as writeFileSync15 } from "node:fs";
import { join as join26 } from "node:path";
function currentTmuxPane() {
  return process.env.TMUX_PANE || null;
}
function buildSeed() {
  const templatePath = join26(FLEET_DIR, "templates/onboarding-architect.md");
  return readFileSync22(templatePath, "utf-8");
}
function injectFleetContext() {
  const HOME9 = process.env.HOME || "/tmp";
  const globalClaudeMd = join26(HOME9, ".claude/CLAUDE.md");
  const symlinkPath = join26(HOME9, ".claude/fleet.md");
  const fleetClaudeMd = join26(FLEET_DIR, "CLAUDE.md");
  if (!existsSync21(symlinkPath)) {
    Bun.spawnSync(["ln", "-sfn", fleetClaudeMd, symlinkPath]);
  }
  if (existsSync21(globalClaudeMd)) {
    const content = readFileSync22(globalClaudeMd, "utf-8");
    if (!content.includes("@fleet.md") && !content.includes("@claude-fleet")) {
      const toolsEnd = content.indexOf("</tools>");
      if (toolsEnd !== -1) {
        const insertAt = content.indexOf(`
`, toolsEnd) + 1;
        const before = content.slice(0, insertAt);
        const after = content.slice(insertAt);
        writeFileSync15(globalClaudeMd, `${before}
@fleet.md
${after}`);
      } else {
        writeFileSync15(globalClaudeMd, `${content}
@fleet.md
`);
      }
      ok("Added @fleet.md to ~/.claude/CLAUDE.md");
    }
  }
}
function register20(parent) {
  const sub = parent.command("onboard").description("Set up fleet infrastructure and launch the fleet architect agent").option("--model <model>", "Override model", "opus[1m]").option("--effort <effort>", "Override effort", "high").option("--skip-setup", "Skip fleet setup (already done)");
  addGlobalOpts(sub).action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals();
    const project = globalOpts.project || resolveProject();
    const fleetConfig = getFleetConfig(project);
    const session = fleetConfig?.tmux_session || DEFAULT_SESSION;
    if (!opts.skipSetup) {
      info("Running fleet setup first...");
      const setupResult = Bun.spawnSync(["bun", "run", join26(FLEET_DIR, "cli/index.ts"), "setup"], { stdout: "inherit", stderr: "inherit" });
      if (setupResult.exitCode !== 0) {
        warn("Fleet setup had issues — details above. Common fixes:");
        console.log("");
        console.log("  Fleet Mail not available? Two paths:");
        console.log("    1. Install Rust:  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh");
        console.log("       Then re-run:   fleet onboard");
        console.log("    2. Use remote:    fleet mail-server connect http://your-server:8026");
        console.log("");
        warn("Continuing with onboard anyway — some features may not work without Fleet Mail");
      }
      console.log("");
    }
    injectFleetContext();
    info("Installing full hook manifest...");
    const setupHooks = join26(FLEET_DIR, "scripts/setup-hooks.sh");
    if (existsSync21(setupHooks)) {
      const hookResult = Bun.spawnSync(["bash", setupHooks], {
        stdout: "inherit",
        stderr: "inherit"
      });
      if (hookResult.exitCode !== 0) {
        warn("Hook installation had issues");
      }
    }
    const watchdogPlist = join26(process.env.HOME || "/tmp", "Library/LaunchAgents/com.tmux-agents.watchdog.plist");
    if (!existsSync21(watchdogPlist)) {
      info("Installing watchdog daemon...");
      const rustBinary = join26(FLEET_DIR, "extensions/watchdog-rs/target/release/boring-watchdog");
      const rustCargoDir = join26(FLEET_DIR, "extensions/watchdog-rs");
      if (existsSync21(join26(rustCargoDir, "Cargo.toml"))) {
        if (!existsSync21(rustBinary)) {
          info("Building Rust watchdog (boring-watchdog)...");
          const build = Bun.spawnSync(["cargo", "build", "--release"], { cwd: rustCargoDir, stdout: "inherit", stderr: "inherit" });
          if (build.exitCode !== 0) {
            warn("Rust build failed — falling back to TypeScript watchdog");
          }
        }
        if (existsSync21(rustBinary)) {
          const install = Bun.spawnSync([rustBinary, "install"], { stdout: "inherit", stderr: "inherit" });
          if (install.exitCode === 0) {
            ok("Rust watchdog (boring-watchdog) installed");
          } else {
            warn("Rust watchdog install failed — falling back to TypeScript");
          }
        }
      }
      if (!existsSync21(watchdogPlist)) {
        const installScript = join26(FLEET_DIR, "extensions/watchdog/install.sh");
        if (existsSync21(installScript)) {
          Bun.spawnSync(["bash", installScript], {
            stdout: "inherit",
            stderr: "inherit",
            env: { ...process.env, PROJECT_ROOT: process.cwd() }
          });
        }
      }
    } else {
      ok("Watchdog already installed");
    }
    console.log("");
    info("Launching fleet architect...");
    if (!existsSync21(FLEET_DATA)) {
      mkdirSync16(FLEET_DATA, { recursive: true });
    }
    const callingPane = currentTmuxPane();
    if (callingPane) {
      info(`Detected TMUX_PANE=${callingPane} — launching in current pane`);
      setPaneTitle(callingPane, "fleet-architect");
      const seed2 = buildSeed();
      const seedFile = `/tmp/fleet-onboard-seed-${process.pid}.txt`;
      writeFileSync15(seedFile, seed2);
      const wrapper = `/tmp/fleet-onboard-wrapper-${process.pid}.sh`;
      const script = `#!/usr/bin/env bash
(sleep 5 && tmux load-buffer "${seedFile}" && tmux paste-buffer -t "${callingPane}" && sleep 1 && tmux send-keys -t "${callingPane}" Enter && sleep 2 && rm -f "${seedFile}" "${wrapper}") &
exec claude --model "${opts.model}" --effort "${opts.effort}" --dangerously-skip-permissions --add-dir "${FLEET_DIR}" --add-dir "${FLEET_DATA}"
`;
      writeFileSync15(wrapper, script, { mode: 493 });
      info("Handing off to Claude...");
      console.log("");
      const { execSync: execSync2 } = __require("node:child_process");
      try {
        execSync2(`exec bash "${wrapper}"`, {
          cwd: process.cwd(),
          stdio: "inherit"
        });
      } catch {}
      ok("Fleet architect session ended.");
      info("To continue onboarding or make changes: fleet onboard");
      process.exit(0);
      return;
    }
    let paneId;
    if (!sessionExists(session)) {
      paneId = createSession(session, WINDOW_NAME, process.cwd());
    } else if (windowExists(session, WINDOW_NAME)) {
      const result = Bun.spawnSync(["tmux", "list-panes", "-t", `${session}:${WINDOW_NAME}`, "-F", "#{pane_id}"], { stderr: "pipe" });
      if (result.exitCode === 0) {
        const existingPane = result.stdout.toString().trim().split(`
`)[0];
        if (existingPane) {
          ok(`Onboard window already exists — focusing pane ${existingPane}`);
          Bun.spawnSync(["tmux", "select-pane", "-t", existingPane]);
          Bun.spawnSync(["tmux", "select-window", "-t", `${session}:${WINDOW_NAME}`]);
          return;
        }
      }
      paneId = createWindow(session, WINDOW_NAME, process.cwd());
    } else {
      paneId = createWindow(session, WINDOW_NAME, process.cwd());
    }
    setPaneTitle(paneId, "fleet-architect");
    let launchCmd = `claude --model "${opts.model}" --effort "${opts.effort}"`;
    launchCmd += ` --dangerously-skip-permissions`;
    launchCmd += ` --add-dir "${FLEET_DIR}"`;
    launchCmd += ` --add-dir "${FLEET_DATA}"`;
    sendKeys(paneId, launchCmd);
    sendEnter(paneId);
    info("Waiting for Claude TUI...");
    const ready = await waitForPrompt(paneId);
    if (!ready)
      warn("TUI timeout after 60s, proceeding anyway");
    await Bun.sleep(2000);
    const seed = buildSeed();
    const pasted = pasteBuffer(paneId, seed);
    if (pasted) {
      await Bun.sleep(3000);
      sendEnter(paneId);
    } else {
      warn("Failed to inject seed — agent launched without onboarding prompt");
    }
    ok(`Fleet architect launched in ${session}:${WINDOW_NAME} (pane ${paneId})`);
    info("Switch to it with: fleet attach fleet-onboard");
    info("To continue onboarding or make changes: fleet onboard");
  });
}
var WINDOW_NAME = "fleet-onboard";
var init_onboard = __esm(() => {
  init_paths();
  init_config();
  init_fmt2();
  init_cli();
});

// cli/commands/tui.ts
import { existsSync as existsSync22, readFileSync as readFileSync23 } from "node:fs";
import { join as join27 } from "node:path";
function findTuiBinary2() {
  const which = Bun.spawnSync(["which", "boring-mail-tui"], { stderr: "pipe" });
  if (which.exitCode === 0)
    return which.stdout.toString().trim();
  for (const p of TUI_BINARY_PATHS2) {
    if (existsSync22(p))
      return p;
  }
  return null;
}
function resolveProject3(override) {
  if (override)
    return override;
  if (process.env.FLEET_PROJECT)
    return process.env.FLEET_PROJECT;
  try {
    const result = Bun.spawnSync(["git", "rev-parse", "--show-toplevel"], { stderr: "pipe" });
    if (result.exitCode === 0) {
      const root = result.stdout.toString().trim();
      const name = root.split("/").pop().replace(/-w-.*$/, "");
      if (existsSync22(join27(FLEET_DATA, name)))
        return name;
    }
  } catch {}
  try {
    const entries = __require("node:fs").readdirSync(FLEET_DATA, { withFileTypes: true });
    for (const e of entries) {
      if (e.isDirectory() && !e.name.startsWith("."))
        return e.name;
    }
  } catch {}
  return "unknown";
}
function resolveToken2(project, account) {
  if (account) {
    const tokenPath = join27(FLEET_DATA, project, account, "token");
    if (existsSync22(tokenPath))
      return readFileSync23(tokenPath, "utf-8").trim();
  }
  if (process.env.BMS_TOKEN)
    return process.env.BMS_TOKEN;
  const userToken = join27(FLEET_DATA, project, "_user", "token");
  if (existsSync22(userToken))
    return readFileSync23(userToken, "utf-8").trim();
  const accountJson = join27(FLEET_DATA, project, "_user", "account.json");
  if (existsSync22(accountJson)) {
    try {
      const data = JSON.parse(readFileSync23(accountJson, "utf-8"));
      if (data.bms_token)
        return data.bms_token;
    } catch {}
  }
  if (process.env.FLEET_MAIL_TOKEN)
    return process.env.FLEET_MAIL_TOKEN;
  return null;
}
function resolveUrl2() {
  if (process.env.BMS_URL)
    return process.env.BMS_URL;
  if (FLEET_MAIL_URL)
    return FLEET_MAIL_URL;
  const dp = join27(FLEET_DATA, "defaults.json");
  if (existsSync22(dp)) {
    try {
      const d = JSON.parse(readFileSync23(dp, "utf-8"));
      if (d.fleet_mail_url)
        return d.fleet_mail_url;
    } catch {}
  }
  return "http://5.161.107.142:8026";
}
function register21(parent) {
  const sub = parent.command("tui").description("Launch Fleet Mail TUI client").option("-a, --account <name>", "Account name (reads token from fleet dirs)").option("--control", "Open in control window tmux pane");
  addGlobalOpts(sub).action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals();
    const binary = findTuiBinary2();
    if (!binary) {
      fail(`boring-mail-tui not found. Install with:
  cargo install --git https://github.com/qbg-dev/boring-mail-server boring-mail-tui`);
    }
    const project = resolveProject3(globalOpts.project);
    const account = opts.account;
    const token = resolveToken2(project, account);
    const url = resolveUrl2();
    if (!token) {
      fail(`No token found for project '${project}'. Set BMS_TOKEN or create ~/.claude/fleet/${project}/_user/token`);
    }
    const env2 = {
      ...process.env,
      BMS_URL: url,
      BMS_TOKEN: token
    };
    if (account)
      env2.BMS_ACCOUNT = account;
    if (opts.control) {
      const fleetJson = readJson(join27(FLEET_DATA, project, "fleet.json"));
      const session = fleetJson?.tmux_session || "w";
      const tmuxCmd = `BMS_URL=${url} BMS_TOKEN=${token} ${binary}`;
      const result = Bun.spawnSync(["tmux", "split-window", "-t", `${session}:control`, "-h", tmuxCmd], { stderr: "pipe" });
      if (result.exitCode !== 0) {
        Bun.spawnSync(["tmux", "new-window", "-t", session, "-n", "control"], { stderr: "pipe" });
        const retry = Bun.spawnSync(["tmux", "split-window", "-t", `${session}:control`, "-h", tmuxCmd], { stderr: "pipe" });
        if (retry.exitCode !== 0) {
          fail(`Failed to open TUI in control window (session: ${session})`);
        }
      }
      const layouts = fleetJson?.layouts;
      if (layouts?.control) {
        Bun.spawnSync(["tmux", "select-layout", "-t", `${session}:control`, layouts.control], { stderr: "pipe" });
      }
      ok(`TUI opened in ${session}:control`);
    } else {
      info(`Connecting to ${url}...`);
      const proc = Bun.spawnSync([binary], {
        env: env2,
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit"
      });
      process.exit(proc.exitCode || 0);
    }
  });
}
var HOME9, TUI_BINARY_PATHS2;
var init_tui2 = __esm(() => {
  init_paths();
  init_fmt2();
  init_cli();
  init_io();
  HOME9 = process.env.HOME || "/tmp";
  TUI_BINARY_PATHS2 = [
    join27(HOME9, ".cargo/bin/boring-mail-tui"),
    join27(HOME9, "Desktop/zPersonalProjects/boring-mail-server/target/release/boring-mail-tui")
  ];
});

// cli/commands/layout.ts
import { existsSync as existsSync23 } from "node:fs";
import { join as join28 } from "node:path";
function resolveProject4(override) {
  if (override)
    return override;
  if (process.env.FLEET_PROJECT)
    return process.env.FLEET_PROJECT;
  try {
    const result = Bun.spawnSync(["git", "rev-parse", "--show-toplevel"], { stderr: "pipe" });
    if (result.exitCode === 0) {
      const root = result.stdout.toString().trim();
      const name = root.split("/").pop().replace(/-w-.*$/, "");
      if (existsSync23(join28(FLEET_DATA, name)))
        return name;
    }
  } catch {}
  try {
    const entries = __require("node:fs").readdirSync(FLEET_DATA, { withFileTypes: true });
    for (const e of entries) {
      if (e.isDirectory() && !e.name.startsWith("."))
        return e.name;
    }
  } catch {}
  return "unknown";
}
function getFleetJson(project) {
  const path = join28(FLEET_DATA, project, "fleet.json");
  return readJson(path) || {};
}
function saveFleetJson(project, data) {
  const path = join28(FLEET_DATA, project, "fleet.json");
  writeJson(path, data);
}
function getSession(project) {
  const fj = getFleetJson(project);
  return fj.tmux_session || "w";
}
async function saveLayout(project, window) {
  const session = getSession(project);
  const target = `${session}:${window}`;
  const result = Bun.spawnSync(["tmux", "list-windows", "-t", target, "-F", "#{window_layout}"], { stderr: "pipe" });
  if (result.exitCode !== 0) {
    fail(`Window '${window}' not found in session '${session}'`);
  }
  const layout = result.stdout.toString().trim();
  if (!layout)
    fail("Could not capture layout");
  const fj = getFleetJson(project);
  if (!fj.layouts)
    fj.layouts = {};
  fj.layouts[window] = layout;
  saveFleetJson(project, fj);
  ok(`Saved layout for '${window}': ${layout.slice(0, 40)}...`);
}
async function restoreLayout(project, window) {
  const fj = getFleetJson(project);
  const layout = fj.layouts?.[window];
  if (!layout)
    fail(`No saved layout for '${window}'`);
  const session = getSession(project);
  const target = `${session}:${window}`;
  const result = Bun.spawnSync(["tmux", "select-layout", "-t", target, layout], { stderr: "pipe" });
  if (result.exitCode !== 0) {
    fail(`Failed to restore layout for '${window}' in session '${session}'`);
  }
  ok(`Restored layout for '${window}'`);
}
async function listLayouts(project) {
  const fj = getFleetJson(project);
  const layouts = fj.layouts || {};
  if (Object.keys(layouts).length === 0) {
    info("No saved layouts");
    return;
  }
  console.log(source_default.bold(`Saved Layouts
`));
  for (const [window, layout] of Object.entries(layouts)) {
    console.log(`  ${source_default.cyan(window)}: ${layout.slice(0, 60)}...`);
  }
}
async function deleteLayout(project, window) {
  const fj = getFleetJson(project);
  if (!fj.layouts?.[window]) {
    fail(`No saved layout for '${window}'`);
  }
  delete fj.layouts[window];
  if (Object.keys(fj.layouts).length === 0)
    delete fj.layouts;
  saveFleetJson(project, fj);
  ok(`Deleted layout for '${window}'`);
}
function register22(parent) {
  const sub = parent.command("layout <action> [window]").description("Save/restore tmux window layouts").addHelpText("after", `
Actions:
  save <window>     Capture current layout of window
  restore <window>  Apply saved layout to window
  list              Show all saved layouts
  delete <window>   Remove saved layout
`);
  addGlobalOpts(sub).action(async (action, window, _opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals();
    const project = resolveProject4(globalOpts.project);
    switch (action) {
      case "save":
        if (!window)
          fail("Window name required: fleet layout save <window>");
        return saveLayout(project, window);
      case "restore":
        if (!window)
          fail("Window name required: fleet layout restore <window>");
        return restoreLayout(project, window);
      case "list":
      case "ls":
        return listLayouts(project);
      case "delete":
      case "rm":
        if (!window)
          fail("Window name required: fleet layout delete <window>");
        return deleteLayout(project, window);
      default:
        fail(`Unknown action: ${action}

Usage: fleet layout <save|restore|list|delete> [window]`);
    }
  });
}
var init_layout = __esm(() => {
  init_source();
  init_paths();
  init_fmt2();
  init_cli();
  init_io();
});

// engine/program/graph.ts
class ProgramBuilder {
  _name;
  _description;
  _nodes = {};
  _edges = [];
  _entry;
  _defaults;
  _material;
  constructor(name, description) {
    this._name = name;
    this._description = description;
  }
  node(name, node) {
    if (name === END_SENTINEL)
      throw new Error(`"${END_SENTINEL}" is reserved`);
    this._nodes[name] = node;
    if (!this._entry)
      this._entry = name;
    return this;
  }
  edge(from, to, opts) {
    this._edges.push({ from, to, ...opts });
    return this;
  }
  entry(name) {
    this._entry = name;
    return this;
  }
  defaults(d) {
    this._defaults = d;
    return this;
  }
  material(m) {
    this._material = m;
    return this;
  }
  embed(sub, opts) {
    const { prefix } = opts;
    const pfx = (name) => name === END_SENTINEL ? END_SENTINEL : `${prefix}.${name}`;
    for (const [name, node] of Object.entries(sub.nodes)) {
      this._nodes[pfx(name)] = node;
    }
    for (const edge of sub.edges) {
      this._edges.push({
        ...edge,
        from: pfx(edge.from),
        to: pfx(edge.to)
      });
    }
    if (!this._entry) {
      this._entry = pfx(sub.entry);
    }
    if (!this._defaults && sub.defaults)
      this._defaults = sub.defaults;
    if (!this._material && sub.material)
      this._material = sub.material;
    return this;
  }
  build() {
    if (!this._entry)
      throw new Error("Graph has no entry node");
    if (!this._nodes[this._entry])
      throw new Error(`Entry node "${this._entry}" not found`);
    for (const edge of this._edges) {
      if (edge.from !== END_SENTINEL && !this._nodes[edge.from]) {
        throw new Error(`Edge references unknown source node: "${edge.from}"`);
      }
      if (edge.to !== END_SENTINEL && !this._nodes[edge.to]) {
        throw new Error(`Edge references unknown target node: "${edge.to}"`);
      }
    }
    return {
      name: this._name,
      description: this._description,
      nodes: this._nodes,
      edges: this._edges,
      entry: this._entry,
      defaults: this._defaults,
      material: this._material
    };
  }
}
function phasesToGraph(program2) {
  const { name, description, phases, defaults, material } = program2;
  const builder = new ProgramBuilder(name, description);
  if (phases.length === 0) {
    throw new Error("Cannot convert empty Phase[] to graph");
  }
  const nodeNames = [];
  const nameCount = {};
  for (const phase of phases) {
    nameCount[phase.name] = (nameCount[phase.name] || 0) + 1;
  }
  for (let i = 0;i < phases.length; i++) {
    const phase = phases[i];
    const nodeName = nameCount[phase.name] > 1 ? `${phase.name}-${i}` : phase.name;
    nodeNames.push(nodeName);
  }
  for (let i = 0;i < phases.length; i++) {
    const phase = phases[i];
    builder.node(nodeNames[i], {
      description: phase.description,
      agents: phase.agents,
      gate: phase.gate,
      layout: phase.layout,
      prelaunch: phase.prelaunch,
      hooks: phase.hooks
    });
  }
  for (let i = 0;i < phases.length; i++) {
    const phase = phases[i];
    if (phase.convergence) {
      const cycleTarget = typeof phase.next === "number" ? phase.next : i;
      const forwardTarget = i + 1 < phases.length ? i + 1 : null;
      builder.edge(nodeNames[i], nodeNames[cycleTarget], {
        condition: negateCondition(phase.convergence.check),
        maxIterations: phase.convergence.maxIterations || 10,
        label: "not converged",
        priority: 0
      });
      if (forwardTarget !== null) {
        builder.edge(nodeNames[i], nodeNames[forwardTarget], {
          label: "converged",
          priority: 1
        });
      } else {
        builder.edge(nodeNames[i], END_SENTINEL, {
          label: "converged",
          priority: 1
        });
      }
    } else if (phase.next !== undefined && typeof phase.next === "number") {
      builder.edge(nodeNames[i], nodeNames[phase.next]);
    } else if (i + 1 < phases.length) {
      builder.edge(nodeNames[i], nodeNames[i + 1]);
    }
  }
  if (defaults)
    builder.defaults(defaults);
  if (material)
    builder.material(material);
  builder.entry(nodeNames[0]);
  return builder.build();
}
function negateCondition(check) {
  return `! (${check})`;
}
function topologicalSort(g) {
  const nodes = Object.keys(g.nodes);
  const visited = new Set;
  const result = [];
  const adj = {};
  for (const name of nodes)
    adj[name] = [];
  for (const edge of g.edges) {
    if (edge.to === END_SENTINEL)
      continue;
    if (edge.maxIterations)
      continue;
    if (adj[edge.from])
      adj[edge.from].push(edge.to);
  }
  function visit(name) {
    if (visited.has(name))
      return;
    visited.add(name);
    for (const next of adj[name] || [])
      visit(next);
    result.push(name);
  }
  visit(g.entry);
  for (const name of nodes)
    visit(name);
  return result.reverse();
}
function buildNodeIndexMap(g) {
  const sorted = topologicalSort(g);
  const map = {};
  for (let i = 0;i < sorted.length; i++) {
    map[sorted[i]] = i;
  }
  return map;
}
function outgoingEdges(g, nodeName) {
  return g.edges.filter((e) => e.from === nodeName).sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
}
var END_SENTINEL = "$end";
var init_graph = () => {};

// engine/program/pipeline-context.ts
function generatePipelineContext(agent, nodeName, allAgentsInNode, graph, state) {
  const lines = [];
  lines.push("## Pipeline Context");
  lines.push("");
  const desc = graph.description || state.programName;
  lines.push(`You are **${agent.name}** (role: ${agent.role}) in the **${graph.name}** pipeline.`);
  const spec = state.ext?.spec;
  if (spec) {
    lines.push(`Goal: "${spec}"`);
  } else if (graph.description) {
    lines.push(`Goal: "${desc}"`);
  }
  lines.push("");
  const flow = buildFlowDiagram(graph, nodeName, state);
  lines.push("### Flow");
  lines.push(flow);
  lines.push("");
  if (allAgentsInNode.length > 1) {
    lines.push("### Your Peers");
    lines.push("| Worker | Role | Mail |");
    lines.push("|--------|------|------|");
    for (const peer of allAgentsInNode) {
      if (peer.name === agent.name)
        continue;
      lines.push(`| ${peer.name} | ${peer.role} | mail_send(to="${peer.name}") |`);
    }
    lines.push("");
  }
  const edges = outgoingEdges(graph, nodeName);
  const forwardEdges = edges.filter((e) => !e.maxIterations && e.to !== END_SENTINEL);
  if (forwardEdges.length > 0) {
    lines.push("### What Comes Next");
    for (const edge of forwardEdges) {
      const nextNode = graph.nodes[edge.to];
      const nextDesc = nextNode?.description || edge.to;
      lines.push(`The **${edge.to}** node needs output from this phase${nextDesc !== edge.to ? `: ${nextDesc}` : ""}.`);
    }
    lines.push("");
  }
  lines.push("### Your Freedom");
  lines.push("You understand the pipeline's intent. You are not following a script blindly.");
  lines.push("If you discover something that changes the plan — communicate it via Fleet Mail.");
  lines.push(`Your role is "${agent.role}" but your mission is the pipeline's goal.`);
  return lines.join(`
`);
}
function buildFlowDiagram(graph, currentNode, state) {
  const chain = [graph.entry];
  const visited = new Set([graph.entry]);
  let cur = graph.entry;
  const nodeNames = Object.keys(graph.nodes);
  for (let i = 0;i < nodeNames.length; i++) {
    const fwd = graph.edges.find((e) => e.from === cur && !e.maxIterations && !visited.has(e.to) && e.to !== END_SENTINEL);
    if (!fwd)
      break;
    chain.push(fwd.to);
    visited.add(fwd.to);
    cur = fwd.to;
  }
  const parts = chain.map((n) => {
    const isDone = state.phaseState[n]?.compiled || state.phaseState[n]?.skipped;
    const isCurrent = n === currentNode;
    if (isCurrent)
      return `[${n}] (you are here)`;
    if (isDone)
      return `${n} (done)`;
    return n;
  });
  return parts.join(" --> ");
}
var init_pipeline_context = __esm(() => {
  init_graph();
});

// engine/program/types.ts
function isDynamic(agents) {
  return !Array.isArray(agents) && "generator" in agents;
}

// node_modules/.bun/handlebars@4.7.8/node_modules/handlebars/dist/cjs/handlebars/utils.js
var require_utils = __commonJS((exports) => {
  exports.__esModule = true;
  exports.extend = extend;
  exports.indexOf = indexOf;
  exports.escapeExpression = escapeExpression;
  exports.isEmpty = isEmpty;
  exports.createFrame = createFrame;
  exports.blockParams = blockParams;
  exports.appendContextPath = appendContextPath;
  var escape = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#x27;",
    "`": "&#x60;",
    "=": "&#x3D;"
  };
  var badChars = /[&<>"'`=]/g;
  var possible = /[&<>"'`=]/;
  function escapeChar(chr) {
    return escape[chr];
  }
  function extend(obj) {
    for (var i = 1;i < arguments.length; i++) {
      for (var key in arguments[i]) {
        if (Object.prototype.hasOwnProperty.call(arguments[i], key)) {
          obj[key] = arguments[i][key];
        }
      }
    }
    return obj;
  }
  var toString = Object.prototype.toString;
  exports.toString = toString;
  var isFunction = function isFunction(value) {
    return typeof value === "function";
  };
  if (isFunction(/x/)) {
    exports.isFunction = isFunction = function(value) {
      return typeof value === "function" && toString.call(value) === "[object Function]";
    };
  }
  exports.isFunction = isFunction;
  var isArray = Array.isArray || function(value) {
    return value && typeof value === "object" ? toString.call(value) === "[object Array]" : false;
  };
  exports.isArray = isArray;
  function indexOf(array, value) {
    for (var i = 0, len = array.length;i < len; i++) {
      if (array[i] === value) {
        return i;
      }
    }
    return -1;
  }
  function escapeExpression(string) {
    if (typeof string !== "string") {
      if (string && string.toHTML) {
        return string.toHTML();
      } else if (string == null) {
        return "";
      } else if (!string) {
        return string + "";
      }
      string = "" + string;
    }
    if (!possible.test(string)) {
      return string;
    }
    return string.replace(badChars, escapeChar);
  }
  function isEmpty(value) {
    if (!value && value !== 0) {
      return true;
    } else if (isArray(value) && value.length === 0) {
      return true;
    } else {
      return false;
    }
  }
  function createFrame(object) {
    var frame = extend({}, object);
    frame._parent = object;
    return frame;
  }
  function blockParams(params, ids) {
    params.path = ids;
    return params;
  }
  function appendContextPath(contextPath, id) {
    return (contextPath ? contextPath + "." : "") + id;
  }
});

// node_modules/.bun/handlebars@4.7.8/node_modules/handlebars/dist/cjs/handlebars/exception.js
var require_exception2 = __commonJS((exports, module) => {
  exports.__esModule = true;
  var errorProps = ["description", "fileName", "lineNumber", "endLineNumber", "message", "name", "number", "stack"];
  function Exception(message, node) {
    var loc = node && node.loc, line = undefined, endLineNumber = undefined, column = undefined, endColumn = undefined;
    if (loc) {
      line = loc.start.line;
      endLineNumber = loc.end.line;
      column = loc.start.column;
      endColumn = loc.end.column;
      message += " - " + line + ":" + column;
    }
    var tmp = Error.prototype.constructor.call(this, message);
    for (var idx = 0;idx < errorProps.length; idx++) {
      this[errorProps[idx]] = tmp[errorProps[idx]];
    }
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, Exception);
    }
    try {
      if (loc) {
        this.lineNumber = line;
        this.endLineNumber = endLineNumber;
        if (Object.defineProperty) {
          Object.defineProperty(this, "column", {
            value: column,
            enumerable: true
          });
          Object.defineProperty(this, "endColumn", {
            value: endColumn,
            enumerable: true
          });
        } else {
          this.column = column;
          this.endColumn = endColumn;
        }
      }
    } catch (nop) {}
  }
  Exception.prototype = new Error;
  exports.default = Exception;
  module.exports = exports["default"];
});

// node_modules/.bun/handlebars@4.7.8/node_modules/handlebars/dist/cjs/handlebars/helpers/block-helper-missing.js
var require_block_helper_missing = __commonJS((exports, module) => {
  exports.__esModule = true;
  var _utils = require_utils();
  exports.default = function(instance) {
    instance.registerHelper("blockHelperMissing", function(context, options) {
      var { inverse, fn } = options;
      if (context === true) {
        return fn(this);
      } else if (context === false || context == null) {
        return inverse(this);
      } else if (_utils.isArray(context)) {
        if (context.length > 0) {
          if (options.ids) {
            options.ids = [options.name];
          }
          return instance.helpers.each(context, options);
        } else {
          return inverse(this);
        }
      } else {
        if (options.data && options.ids) {
          var data = _utils.createFrame(options.data);
          data.contextPath = _utils.appendContextPath(options.data.contextPath, options.name);
          options = { data };
        }
        return fn(context, options);
      }
    });
  };
  module.exports = exports["default"];
});

// node_modules/.bun/handlebars@4.7.8/node_modules/handlebars/dist/cjs/handlebars/helpers/each.js
var require_each = __commonJS((exports, module) => {
  exports.__esModule = true;
  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : { default: obj };
  }
  var _utils = require_utils();
  var _exception = require_exception2();
  var _exception2 = _interopRequireDefault(_exception);
  exports.default = function(instance) {
    instance.registerHelper("each", function(context, options) {
      if (!options) {
        throw new _exception2["default"]("Must pass iterator to #each");
      }
      var { fn, inverse } = options, i = 0, ret = "", data = undefined, contextPath = undefined;
      if (options.data && options.ids) {
        contextPath = _utils.appendContextPath(options.data.contextPath, options.ids[0]) + ".";
      }
      if (_utils.isFunction(context)) {
        context = context.call(this);
      }
      if (options.data) {
        data = _utils.createFrame(options.data);
      }
      function execIteration(field, index, last) {
        if (data) {
          data.key = field;
          data.index = index;
          data.first = index === 0;
          data.last = !!last;
          if (contextPath) {
            data.contextPath = contextPath + field;
          }
        }
        ret = ret + fn(context[field], {
          data,
          blockParams: _utils.blockParams([context[field], field], [contextPath + field, null])
        });
      }
      if (context && typeof context === "object") {
        if (_utils.isArray(context)) {
          for (var j = context.length;i < j; i++) {
            if (i in context) {
              execIteration(i, i, i === context.length - 1);
            }
          }
        } else if (typeof Symbol === "function" && context[Symbol.iterator]) {
          var newContext = [];
          var iterator = context[Symbol.iterator]();
          for (var it = iterator.next();!it.done; it = iterator.next()) {
            newContext.push(it.value);
          }
          context = newContext;
          for (var j = context.length;i < j; i++) {
            execIteration(i, i, i === context.length - 1);
          }
        } else {
          (function() {
            var priorKey = undefined;
            Object.keys(context).forEach(function(key) {
              if (priorKey !== undefined) {
                execIteration(priorKey, i - 1);
              }
              priorKey = key;
              i++;
            });
            if (priorKey !== undefined) {
              execIteration(priorKey, i - 1, true);
            }
          })();
        }
      }
      if (i === 0) {
        ret = inverse(this);
      }
      return ret;
    });
  };
  module.exports = exports["default"];
});

// node_modules/.bun/handlebars@4.7.8/node_modules/handlebars/dist/cjs/handlebars/helpers/helper-missing.js
var require_helper_missing = __commonJS((exports, module) => {
  exports.__esModule = true;
  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : { default: obj };
  }
  var _exception = require_exception2();
  var _exception2 = _interopRequireDefault(_exception);
  exports.default = function(instance) {
    instance.registerHelper("helperMissing", function() {
      if (arguments.length === 1) {
        return;
      } else {
        throw new _exception2["default"]('Missing helper: "' + arguments[arguments.length - 1].name + '"');
      }
    });
  };
  module.exports = exports["default"];
});

// node_modules/.bun/handlebars@4.7.8/node_modules/handlebars/dist/cjs/handlebars/helpers/if.js
var require_if = __commonJS((exports, module) => {
  exports.__esModule = true;
  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : { default: obj };
  }
  var _utils = require_utils();
  var _exception = require_exception2();
  var _exception2 = _interopRequireDefault(_exception);
  exports.default = function(instance) {
    instance.registerHelper("if", function(conditional, options) {
      if (arguments.length != 2) {
        throw new _exception2["default"]("#if requires exactly one argument");
      }
      if (_utils.isFunction(conditional)) {
        conditional = conditional.call(this);
      }
      if (!options.hash.includeZero && !conditional || _utils.isEmpty(conditional)) {
        return options.inverse(this);
      } else {
        return options.fn(this);
      }
    });
    instance.registerHelper("unless", function(conditional, options) {
      if (arguments.length != 2) {
        throw new _exception2["default"]("#unless requires exactly one argument");
      }
      return instance.helpers["if"].call(this, conditional, {
        fn: options.inverse,
        inverse: options.fn,
        hash: options.hash
      });
    });
  };
  module.exports = exports["default"];
});

// node_modules/.bun/handlebars@4.7.8/node_modules/handlebars/dist/cjs/handlebars/helpers/log.js
var require_log = __commonJS((exports, module) => {
  exports.__esModule = true;
  exports.default = function(instance) {
    instance.registerHelper("log", function() {
      var args = [undefined], options = arguments[arguments.length - 1];
      for (var i = 0;i < arguments.length - 1; i++) {
        args.push(arguments[i]);
      }
      var level = 1;
      if (options.hash.level != null) {
        level = options.hash.level;
      } else if (options.data && options.data.level != null) {
        level = options.data.level;
      }
      args[0] = level;
      instance.log.apply(instance, args);
    });
  };
  module.exports = exports["default"];
});

// node_modules/.bun/handlebars@4.7.8/node_modules/handlebars/dist/cjs/handlebars/helpers/lookup.js
var require_lookup = __commonJS((exports, module) => {
  exports.__esModule = true;
  exports.default = function(instance) {
    instance.registerHelper("lookup", function(obj, field, options) {
      if (!obj) {
        return obj;
      }
      return options.lookupProperty(obj, field);
    });
  };
  module.exports = exports["default"];
});

// node_modules/.bun/handlebars@4.7.8/node_modules/handlebars/dist/cjs/handlebars/helpers/with.js
var require_with = __commonJS((exports, module) => {
  exports.__esModule = true;
  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : { default: obj };
  }
  var _utils = require_utils();
  var _exception = require_exception2();
  var _exception2 = _interopRequireDefault(_exception);
  exports.default = function(instance) {
    instance.registerHelper("with", function(context, options) {
      if (arguments.length != 2) {
        throw new _exception2["default"]("#with requires exactly one argument");
      }
      if (_utils.isFunction(context)) {
        context = context.call(this);
      }
      var fn = options.fn;
      if (!_utils.isEmpty(context)) {
        var data = options.data;
        if (options.data && options.ids) {
          data = _utils.createFrame(options.data);
          data.contextPath = _utils.appendContextPath(options.data.contextPath, options.ids[0]);
        }
        return fn(context, {
          data,
          blockParams: _utils.blockParams([context], [data && data.contextPath])
        });
      } else {
        return options.inverse(this);
      }
    });
  };
  module.exports = exports["default"];
});

// node_modules/.bun/handlebars@4.7.8/node_modules/handlebars/dist/cjs/handlebars/helpers.js
var require_helpers = __commonJS((exports) => {
  exports.__esModule = true;
  exports.registerDefaultHelpers = registerDefaultHelpers;
  exports.moveHelperToHooks = moveHelperToHooks;
  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : { default: obj };
  }
  var _helpersBlockHelperMissing = require_block_helper_missing();
  var _helpersBlockHelperMissing2 = _interopRequireDefault(_helpersBlockHelperMissing);
  var _helpersEach = require_each();
  var _helpersEach2 = _interopRequireDefault(_helpersEach);
  var _helpersHelperMissing = require_helper_missing();
  var _helpersHelperMissing2 = _interopRequireDefault(_helpersHelperMissing);
  var _helpersIf = require_if();
  var _helpersIf2 = _interopRequireDefault(_helpersIf);
  var _helpersLog = require_log();
  var _helpersLog2 = _interopRequireDefault(_helpersLog);
  var _helpersLookup = require_lookup();
  var _helpersLookup2 = _interopRequireDefault(_helpersLookup);
  var _helpersWith = require_with();
  var _helpersWith2 = _interopRequireDefault(_helpersWith);
  function registerDefaultHelpers(instance) {
    _helpersBlockHelperMissing2["default"](instance);
    _helpersEach2["default"](instance);
    _helpersHelperMissing2["default"](instance);
    _helpersIf2["default"](instance);
    _helpersLog2["default"](instance);
    _helpersLookup2["default"](instance);
    _helpersWith2["default"](instance);
  }
  function moveHelperToHooks(instance, helperName, keepHelper) {
    if (instance.helpers[helperName]) {
      instance.hooks[helperName] = instance.helpers[helperName];
      if (!keepHelper) {
        delete instance.helpers[helperName];
      }
    }
  }
});

// node_modules/.bun/handlebars@4.7.8/node_modules/handlebars/dist/cjs/handlebars/decorators/inline.js
var require_inline = __commonJS((exports, module) => {
  exports.__esModule = true;
  var _utils = require_utils();
  exports.default = function(instance) {
    instance.registerDecorator("inline", function(fn, props, container, options) {
      var ret = fn;
      if (!props.partials) {
        props.partials = {};
        ret = function(context, options2) {
          var original = container.partials;
          container.partials = _utils.extend({}, original, props.partials);
          var ret2 = fn(context, options2);
          container.partials = original;
          return ret2;
        };
      }
      props.partials[options.args[0]] = options.fn;
      return ret;
    });
  };
  module.exports = exports["default"];
});

// node_modules/.bun/handlebars@4.7.8/node_modules/handlebars/dist/cjs/handlebars/decorators.js
var require_decorators = __commonJS((exports) => {
  exports.__esModule = true;
  exports.registerDefaultDecorators = registerDefaultDecorators;
  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : { default: obj };
  }
  var _decoratorsInline = require_inline();
  var _decoratorsInline2 = _interopRequireDefault(_decoratorsInline);
  function registerDefaultDecorators(instance) {
    _decoratorsInline2["default"](instance);
  }
});

// node_modules/.bun/handlebars@4.7.8/node_modules/handlebars/dist/cjs/handlebars/logger.js
var require_logger = __commonJS((exports, module) => {
  exports.__esModule = true;
  var _utils = require_utils();
  var logger = {
    methodMap: ["debug", "info", "warn", "error"],
    level: "info",
    lookupLevel: function lookupLevel(level) {
      if (typeof level === "string") {
        var levelMap = _utils.indexOf(logger.methodMap, level.toLowerCase());
        if (levelMap >= 0) {
          level = levelMap;
        } else {
          level = parseInt(level, 10);
        }
      }
      return level;
    },
    log: function log(level) {
      level = logger.lookupLevel(level);
      if (typeof console !== "undefined" && logger.lookupLevel(logger.level) <= level) {
        var method = logger.methodMap[level];
        if (!console[method]) {
          method = "log";
        }
        for (var _len = arguments.length, message = Array(_len > 1 ? _len - 1 : 0), _key = 1;_key < _len; _key++) {
          message[_key - 1] = arguments[_key];
        }
        console[method].apply(console, message);
      }
    }
  };
  exports.default = logger;
  module.exports = exports["default"];
});

// node_modules/.bun/handlebars@4.7.8/node_modules/handlebars/dist/cjs/handlebars/internal/create-new-lookup-object.js
var require_create_new_lookup_object = __commonJS((exports) => {
  exports.__esModule = true;
  exports.createNewLookupObject = createNewLookupObject;
  var _utils = require_utils();
  function createNewLookupObject() {
    for (var _len = arguments.length, sources = Array(_len), _key = 0;_key < _len; _key++) {
      sources[_key] = arguments[_key];
    }
    return _utils.extend.apply(undefined, [Object.create(null)].concat(sources));
  }
});

// node_modules/.bun/handlebars@4.7.8/node_modules/handlebars/dist/cjs/handlebars/internal/proto-access.js
var require_proto_access = __commonJS((exports) => {
  exports.__esModule = true;
  exports.createProtoAccessControl = createProtoAccessControl;
  exports.resultIsAllowed = resultIsAllowed;
  exports.resetLoggedProperties = resetLoggedProperties;
  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : { default: obj };
  }
  var _createNewLookupObject = require_create_new_lookup_object();
  var _logger = require_logger();
  var _logger2 = _interopRequireDefault(_logger);
  var loggedProperties = Object.create(null);
  function createProtoAccessControl(runtimeOptions) {
    var defaultMethodWhiteList = Object.create(null);
    defaultMethodWhiteList["constructor"] = false;
    defaultMethodWhiteList["__defineGetter__"] = false;
    defaultMethodWhiteList["__defineSetter__"] = false;
    defaultMethodWhiteList["__lookupGetter__"] = false;
    var defaultPropertyWhiteList = Object.create(null);
    defaultPropertyWhiteList["__proto__"] = false;
    return {
      properties: {
        whitelist: _createNewLookupObject.createNewLookupObject(defaultPropertyWhiteList, runtimeOptions.allowedProtoProperties),
        defaultValue: runtimeOptions.allowProtoPropertiesByDefault
      },
      methods: {
        whitelist: _createNewLookupObject.createNewLookupObject(defaultMethodWhiteList, runtimeOptions.allowedProtoMethods),
        defaultValue: runtimeOptions.allowProtoMethodsByDefault
      }
    };
  }
  function resultIsAllowed(result, protoAccessControl, propertyName) {
    if (typeof result === "function") {
      return checkWhiteList(protoAccessControl.methods, propertyName);
    } else {
      return checkWhiteList(protoAccessControl.properties, propertyName);
    }
  }
  function checkWhiteList(protoAccessControlForType, propertyName) {
    if (protoAccessControlForType.whitelist[propertyName] !== undefined) {
      return protoAccessControlForType.whitelist[propertyName] === true;
    }
    if (protoAccessControlForType.defaultValue !== undefined) {
      return protoAccessControlForType.defaultValue;
    }
    logUnexpecedPropertyAccessOnce(propertyName);
    return false;
  }
  function logUnexpecedPropertyAccessOnce(propertyName) {
    if (loggedProperties[propertyName] !== true) {
      loggedProperties[propertyName] = true;
      _logger2["default"].log("error", 'Handlebars: Access has been denied to resolve the property "' + propertyName + `" because it is not an "own property" of its parent.
` + `You can add a runtime option to disable the check or this warning:
` + "See https://handlebarsjs.com/api-reference/runtime-options.html#options-to-control-prototype-access for details");
    }
  }
  function resetLoggedProperties() {
    Object.keys(loggedProperties).forEach(function(propertyName) {
      delete loggedProperties[propertyName];
    });
  }
});

// node_modules/.bun/handlebars@4.7.8/node_modules/handlebars/dist/cjs/handlebars/base.js
var require_base = __commonJS((exports) => {
  exports.__esModule = true;
  exports.HandlebarsEnvironment = HandlebarsEnvironment;
  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : { default: obj };
  }
  var _utils = require_utils();
  var _exception = require_exception2();
  var _exception2 = _interopRequireDefault(_exception);
  var _helpers = require_helpers();
  var _decorators = require_decorators();
  var _logger = require_logger();
  var _logger2 = _interopRequireDefault(_logger);
  var _internalProtoAccess = require_proto_access();
  var VERSION = "4.7.8";
  exports.VERSION = VERSION;
  var COMPILER_REVISION = 8;
  exports.COMPILER_REVISION = COMPILER_REVISION;
  var LAST_COMPATIBLE_COMPILER_REVISION = 7;
  exports.LAST_COMPATIBLE_COMPILER_REVISION = LAST_COMPATIBLE_COMPILER_REVISION;
  var REVISION_CHANGES = {
    1: "<= 1.0.rc.2",
    2: "== 1.0.0-rc.3",
    3: "== 1.0.0-rc.4",
    4: "== 1.x.x",
    5: "== 2.0.0-alpha.x",
    6: ">= 2.0.0-beta.1",
    7: ">= 4.0.0 <4.3.0",
    8: ">= 4.3.0"
  };
  exports.REVISION_CHANGES = REVISION_CHANGES;
  var objectType = "[object Object]";
  function HandlebarsEnvironment(helpers, partials, decorators) {
    this.helpers = helpers || {};
    this.partials = partials || {};
    this.decorators = decorators || {};
    _helpers.registerDefaultHelpers(this);
    _decorators.registerDefaultDecorators(this);
  }
  HandlebarsEnvironment.prototype = {
    constructor: HandlebarsEnvironment,
    logger: _logger2["default"],
    log: _logger2["default"].log,
    registerHelper: function registerHelper(name, fn) {
      if (_utils.toString.call(name) === objectType) {
        if (fn) {
          throw new _exception2["default"]("Arg not supported with multiple helpers");
        }
        _utils.extend(this.helpers, name);
      } else {
        this.helpers[name] = fn;
      }
    },
    unregisterHelper: function unregisterHelper(name) {
      delete this.helpers[name];
    },
    registerPartial: function registerPartial(name, partial) {
      if (_utils.toString.call(name) === objectType) {
        _utils.extend(this.partials, name);
      } else {
        if (typeof partial === "undefined") {
          throw new _exception2["default"]('Attempting to register a partial called "' + name + '" as undefined');
        }
        this.partials[name] = partial;
      }
    },
    unregisterPartial: function unregisterPartial(name) {
      delete this.partials[name];
    },
    registerDecorator: function registerDecorator(name, fn) {
      if (_utils.toString.call(name) === objectType) {
        if (fn) {
          throw new _exception2["default"]("Arg not supported with multiple decorators");
        }
        _utils.extend(this.decorators, name);
      } else {
        this.decorators[name] = fn;
      }
    },
    unregisterDecorator: function unregisterDecorator(name) {
      delete this.decorators[name];
    },
    resetLoggedPropertyAccesses: function resetLoggedPropertyAccesses() {
      _internalProtoAccess.resetLoggedProperties();
    }
  };
  var log = _logger2["default"].log;
  exports.log = log;
  exports.createFrame = _utils.createFrame;
  exports.logger = _logger2["default"];
});

// node_modules/.bun/handlebars@4.7.8/node_modules/handlebars/dist/cjs/handlebars/safe-string.js
var require_safe_string = __commonJS((exports, module) => {
  exports.__esModule = true;
  function SafeString(string) {
    this.string = string;
  }
  SafeString.prototype.toString = SafeString.prototype.toHTML = function() {
    return "" + this.string;
  };
  exports.default = SafeString;
  module.exports = exports["default"];
});

// node_modules/.bun/handlebars@4.7.8/node_modules/handlebars/dist/cjs/handlebars/internal/wrapHelper.js
var require_wrapHelper = __commonJS((exports) => {
  exports.__esModule = true;
  exports.wrapHelper = wrapHelper;
  function wrapHelper(helper, transformOptionsFn) {
    if (typeof helper !== "function") {
      return helper;
    }
    var wrapper = function wrapper() {
      var options = arguments[arguments.length - 1];
      arguments[arguments.length - 1] = transformOptionsFn(options);
      return helper.apply(this, arguments);
    };
    return wrapper;
  }
});

// node_modules/.bun/handlebars@4.7.8/node_modules/handlebars/dist/cjs/handlebars/runtime.js
var require_runtime = __commonJS((exports) => {
  exports.__esModule = true;
  exports.checkRevision = checkRevision;
  exports.template = template;
  exports.wrapProgram = wrapProgram;
  exports.resolvePartial = resolvePartial;
  exports.invokePartial = invokePartial;
  exports.noop = noop;
  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : { default: obj };
  }
  function _interopRequireWildcard(obj) {
    if (obj && obj.__esModule) {
      return obj;
    } else {
      var newObj = {};
      if (obj != null) {
        for (var key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key))
            newObj[key] = obj[key];
        }
      }
      newObj["default"] = obj;
      return newObj;
    }
  }
  var _utils = require_utils();
  var Utils = _interopRequireWildcard(_utils);
  var _exception = require_exception2();
  var _exception2 = _interopRequireDefault(_exception);
  var _base = require_base();
  var _helpers = require_helpers();
  var _internalWrapHelper = require_wrapHelper();
  var _internalProtoAccess = require_proto_access();
  function checkRevision(compilerInfo) {
    var compilerRevision = compilerInfo && compilerInfo[0] || 1, currentRevision = _base.COMPILER_REVISION;
    if (compilerRevision >= _base.LAST_COMPATIBLE_COMPILER_REVISION && compilerRevision <= _base.COMPILER_REVISION) {
      return;
    }
    if (compilerRevision < _base.LAST_COMPATIBLE_COMPILER_REVISION) {
      var runtimeVersions = _base.REVISION_CHANGES[currentRevision], compilerVersions = _base.REVISION_CHANGES[compilerRevision];
      throw new _exception2["default"]("Template was precompiled with an older version of Handlebars than the current runtime. " + "Please update your precompiler to a newer version (" + runtimeVersions + ") or downgrade your runtime to an older version (" + compilerVersions + ").");
    } else {
      throw new _exception2["default"]("Template was precompiled with a newer version of Handlebars than the current runtime. " + "Please update your runtime to a newer version (" + compilerInfo[1] + ").");
    }
  }
  function template(templateSpec, env2) {
    if (!env2) {
      throw new _exception2["default"]("No environment passed to template");
    }
    if (!templateSpec || !templateSpec.main) {
      throw new _exception2["default"]("Unknown template object: " + typeof templateSpec);
    }
    templateSpec.main.decorator = templateSpec.main_d;
    env2.VM.checkRevision(templateSpec.compiler);
    var templateWasPrecompiledWithCompilerV7 = templateSpec.compiler && templateSpec.compiler[0] === 7;
    function invokePartialWrapper(partial, context, options) {
      if (options.hash) {
        context = Utils.extend({}, context, options.hash);
        if (options.ids) {
          options.ids[0] = true;
        }
      }
      partial = env2.VM.resolvePartial.call(this, partial, context, options);
      var extendedOptions = Utils.extend({}, options, {
        hooks: this.hooks,
        protoAccessControl: this.protoAccessControl
      });
      var result = env2.VM.invokePartial.call(this, partial, context, extendedOptions);
      if (result == null && env2.compile) {
        options.partials[options.name] = env2.compile(partial, templateSpec.compilerOptions, env2);
        result = options.partials[options.name](context, extendedOptions);
      }
      if (result != null) {
        if (options.indent) {
          var lines = result.split(`
`);
          for (var i = 0, l = lines.length;i < l; i++) {
            if (!lines[i] && i + 1 === l) {
              break;
            }
            lines[i] = options.indent + lines[i];
          }
          result = lines.join(`
`);
        }
        return result;
      } else {
        throw new _exception2["default"]("The partial " + options.name + " could not be compiled when running in runtime-only mode");
      }
    }
    var container = {
      strict: function strict(obj, name, loc) {
        if (!obj || !(name in obj)) {
          throw new _exception2["default"]('"' + name + '" not defined in ' + obj, {
            loc
          });
        }
        return container.lookupProperty(obj, name);
      },
      lookupProperty: function lookupProperty(parent, propertyName) {
        var result = parent[propertyName];
        if (result == null) {
          return result;
        }
        if (Object.prototype.hasOwnProperty.call(parent, propertyName)) {
          return result;
        }
        if (_internalProtoAccess.resultIsAllowed(result, container.protoAccessControl, propertyName)) {
          return result;
        }
        return;
      },
      lookup: function lookup(depths, name) {
        var len = depths.length;
        for (var i = 0;i < len; i++) {
          var result = depths[i] && container.lookupProperty(depths[i], name);
          if (result != null) {
            return depths[i][name];
          }
        }
      },
      lambda: function lambda(current, context) {
        return typeof current === "function" ? current.call(context) : current;
      },
      escapeExpression: Utils.escapeExpression,
      invokePartial: invokePartialWrapper,
      fn: function fn(i) {
        var ret2 = templateSpec[i];
        ret2.decorator = templateSpec[i + "_d"];
        return ret2;
      },
      programs: [],
      program: function program(i, data, declaredBlockParams, blockParams, depths) {
        var programWrapper = this.programs[i], fn = this.fn(i);
        if (data || depths || blockParams || declaredBlockParams) {
          programWrapper = wrapProgram(this, i, fn, data, declaredBlockParams, blockParams, depths);
        } else if (!programWrapper) {
          programWrapper = this.programs[i] = wrapProgram(this, i, fn);
        }
        return programWrapper;
      },
      data: function data(value, depth) {
        while (value && depth--) {
          value = value._parent;
        }
        return value;
      },
      mergeIfNeeded: function mergeIfNeeded(param, common) {
        var obj = param || common;
        if (param && common && param !== common) {
          obj = Utils.extend({}, common, param);
        }
        return obj;
      },
      nullContext: Object.seal({}),
      noop: env2.VM.noop,
      compilerInfo: templateSpec.compiler
    };
    function ret(context) {
      var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];
      var data = options.data;
      ret._setup(options);
      if (!options.partial && templateSpec.useData) {
        data = initData(context, data);
      }
      var depths = undefined, blockParams = templateSpec.useBlockParams ? [] : undefined;
      if (templateSpec.useDepths) {
        if (options.depths) {
          depths = context != options.depths[0] ? [context].concat(options.depths) : options.depths;
        } else {
          depths = [context];
        }
      }
      function main(context2) {
        return "" + templateSpec.main(container, context2, container.helpers, container.partials, data, blockParams, depths);
      }
      main = executeDecorators(templateSpec.main, main, container, options.depths || [], data, blockParams);
      return main(context, options);
    }
    ret.isTop = true;
    ret._setup = function(options) {
      if (!options.partial) {
        var mergedHelpers = Utils.extend({}, env2.helpers, options.helpers);
        wrapHelpersToPassLookupProperty(mergedHelpers, container);
        container.helpers = mergedHelpers;
        if (templateSpec.usePartial) {
          container.partials = container.mergeIfNeeded(options.partials, env2.partials);
        }
        if (templateSpec.usePartial || templateSpec.useDecorators) {
          container.decorators = Utils.extend({}, env2.decorators, options.decorators);
        }
        container.hooks = {};
        container.protoAccessControl = _internalProtoAccess.createProtoAccessControl(options);
        var keepHelperInHelpers = options.allowCallsToHelperMissing || templateWasPrecompiledWithCompilerV7;
        _helpers.moveHelperToHooks(container, "helperMissing", keepHelperInHelpers);
        _helpers.moveHelperToHooks(container, "blockHelperMissing", keepHelperInHelpers);
      } else {
        container.protoAccessControl = options.protoAccessControl;
        container.helpers = options.helpers;
        container.partials = options.partials;
        container.decorators = options.decorators;
        container.hooks = options.hooks;
      }
    };
    ret._child = function(i, data, blockParams, depths) {
      if (templateSpec.useBlockParams && !blockParams) {
        throw new _exception2["default"]("must pass block params");
      }
      if (templateSpec.useDepths && !depths) {
        throw new _exception2["default"]("must pass parent depths");
      }
      return wrapProgram(container, i, templateSpec[i], data, 0, blockParams, depths);
    };
    return ret;
  }
  function wrapProgram(container, i, fn, data, declaredBlockParams, blockParams, depths) {
    function prog(context) {
      var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];
      var currentDepths = depths;
      if (depths && context != depths[0] && !(context === container.nullContext && depths[0] === null)) {
        currentDepths = [context].concat(depths);
      }
      return fn(container, context, container.helpers, container.partials, options.data || data, blockParams && [options.blockParams].concat(blockParams), currentDepths);
    }
    prog = executeDecorators(fn, prog, container, depths, data, blockParams);
    prog.program = i;
    prog.depth = depths ? depths.length : 0;
    prog.blockParams = declaredBlockParams || 0;
    return prog;
  }
  function resolvePartial(partial, context, options) {
    if (!partial) {
      if (options.name === "@partial-block") {
        partial = options.data["partial-block"];
      } else {
        partial = options.partials[options.name];
      }
    } else if (!partial.call && !options.name) {
      options.name = partial;
      partial = options.partials[partial];
    }
    return partial;
  }
  function invokePartial(partial, context, options) {
    var currentPartialBlock = options.data && options.data["partial-block"];
    options.partial = true;
    if (options.ids) {
      options.data.contextPath = options.ids[0] || options.data.contextPath;
    }
    var partialBlock = undefined;
    if (options.fn && options.fn !== noop) {
      (function() {
        options.data = _base.createFrame(options.data);
        var fn = options.fn;
        partialBlock = options.data["partial-block"] = function partialBlockWrapper(context2) {
          var options2 = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];
          options2.data = _base.createFrame(options2.data);
          options2.data["partial-block"] = currentPartialBlock;
          return fn(context2, options2);
        };
        if (fn.partials) {
          options.partials = Utils.extend({}, options.partials, fn.partials);
        }
      })();
    }
    if (partial === undefined && partialBlock) {
      partial = partialBlock;
    }
    if (partial === undefined) {
      throw new _exception2["default"]("The partial " + options.name + " could not be found");
    } else if (partial instanceof Function) {
      return partial(context, options);
    }
  }
  function noop() {
    return "";
  }
  function initData(context, data) {
    if (!data || !("root" in data)) {
      data = data ? _base.createFrame(data) : {};
      data.root = context;
    }
    return data;
  }
  function executeDecorators(fn, prog, container, depths, data, blockParams) {
    if (fn.decorator) {
      var props = {};
      prog = fn.decorator(prog, props, container, depths && depths[0], data, blockParams, depths);
      Utils.extend(prog, props);
    }
    return prog;
  }
  function wrapHelpersToPassLookupProperty(mergedHelpers, container) {
    Object.keys(mergedHelpers).forEach(function(helperName) {
      var helper = mergedHelpers[helperName];
      mergedHelpers[helperName] = passLookupPropertyOption(helper, container);
    });
  }
  function passLookupPropertyOption(helper, container) {
    var lookupProperty = container.lookupProperty;
    return _internalWrapHelper.wrapHelper(helper, function(options) {
      return Utils.extend({ lookupProperty }, options);
    });
  }
});

// node_modules/.bun/handlebars@4.7.8/node_modules/handlebars/dist/cjs/handlebars/no-conflict.js
var require_no_conflict = __commonJS((exports, module) => {
  exports.__esModule = true;
  exports.default = function(Handlebars) {
    (function() {
      if (typeof globalThis === "object")
        return;
      Object.prototype.__defineGetter__("__magic__", function() {
        return this;
      });
      __magic__.globalThis = __magic__;
      delete Object.prototype.__magic__;
    })();
    var $Handlebars = globalThis.Handlebars;
    Handlebars.noConflict = function() {
      if (globalThis.Handlebars === Handlebars) {
        globalThis.Handlebars = $Handlebars;
      }
      return Handlebars;
    };
  };
  module.exports = exports["default"];
});

// node_modules/.bun/handlebars@4.7.8/node_modules/handlebars/dist/cjs/handlebars.runtime.js
var require_handlebars_runtime = __commonJS((exports, module) => {
  exports.__esModule = true;
  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : { default: obj };
  }
  function _interopRequireWildcard(obj) {
    if (obj && obj.__esModule) {
      return obj;
    } else {
      var newObj = {};
      if (obj != null) {
        for (var key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key))
            newObj[key] = obj[key];
        }
      }
      newObj["default"] = obj;
      return newObj;
    }
  }
  var _handlebarsBase = require_base();
  var base = _interopRequireWildcard(_handlebarsBase);
  var _handlebarsSafeString = require_safe_string();
  var _handlebarsSafeString2 = _interopRequireDefault(_handlebarsSafeString);
  var _handlebarsException = require_exception2();
  var _handlebarsException2 = _interopRequireDefault(_handlebarsException);
  var _handlebarsUtils = require_utils();
  var Utils = _interopRequireWildcard(_handlebarsUtils);
  var _handlebarsRuntime = require_runtime();
  var runtime = _interopRequireWildcard(_handlebarsRuntime);
  var _handlebarsNoConflict = require_no_conflict();
  var _handlebarsNoConflict2 = _interopRequireDefault(_handlebarsNoConflict);
  function create() {
    var hb = new base.HandlebarsEnvironment;
    Utils.extend(hb, base);
    hb.SafeString = _handlebarsSafeString2["default"];
    hb.Exception = _handlebarsException2["default"];
    hb.Utils = Utils;
    hb.escapeExpression = Utils.escapeExpression;
    hb.VM = runtime;
    hb.template = function(spec) {
      return runtime.template(spec, hb);
    };
    return hb;
  }
  var inst = create();
  inst.create = create;
  _handlebarsNoConflict2["default"](inst);
  inst["default"] = inst;
  exports.default = inst;
  module.exports = exports["default"];
});

// node_modules/.bun/handlebars@4.7.8/node_modules/handlebars/dist/cjs/handlebars/compiler/ast.js
var require_ast = __commonJS((exports, module) => {
  exports.__esModule = true;
  var AST = {
    helpers: {
      helperExpression: function helperExpression(node) {
        return node.type === "SubExpression" || (node.type === "MustacheStatement" || node.type === "BlockStatement") && !!(node.params && node.params.length || node.hash);
      },
      scopedId: function scopedId(path) {
        return /^\.|this\b/.test(path.original);
      },
      simpleId: function simpleId(path) {
        return path.parts.length === 1 && !AST.helpers.scopedId(path) && !path.depth;
      }
    }
  };
  exports.default = AST;
  module.exports = exports["default"];
});

// node_modules/.bun/handlebars@4.7.8/node_modules/handlebars/dist/cjs/handlebars/compiler/parser.js
var require_parser = __commonJS((exports, module) => {
  exports.__esModule = true;
  var handlebars = function() {
    var parser = {
      trace: function trace() {},
      yy: {},
      symbols_: { error: 2, root: 3, program: 4, EOF: 5, program_repetition0: 6, statement: 7, mustache: 8, block: 9, rawBlock: 10, partial: 11, partialBlock: 12, content: 13, COMMENT: 14, CONTENT: 15, openRawBlock: 16, rawBlock_repetition0: 17, END_RAW_BLOCK: 18, OPEN_RAW_BLOCK: 19, helperName: 20, openRawBlock_repetition0: 21, openRawBlock_option0: 22, CLOSE_RAW_BLOCK: 23, openBlock: 24, block_option0: 25, closeBlock: 26, openInverse: 27, block_option1: 28, OPEN_BLOCK: 29, openBlock_repetition0: 30, openBlock_option0: 31, openBlock_option1: 32, CLOSE: 33, OPEN_INVERSE: 34, openInverse_repetition0: 35, openInverse_option0: 36, openInverse_option1: 37, openInverseChain: 38, OPEN_INVERSE_CHAIN: 39, openInverseChain_repetition0: 40, openInverseChain_option0: 41, openInverseChain_option1: 42, inverseAndProgram: 43, INVERSE: 44, inverseChain: 45, inverseChain_option0: 46, OPEN_ENDBLOCK: 47, OPEN: 48, mustache_repetition0: 49, mustache_option0: 50, OPEN_UNESCAPED: 51, mustache_repetition1: 52, mustache_option1: 53, CLOSE_UNESCAPED: 54, OPEN_PARTIAL: 55, partialName: 56, partial_repetition0: 57, partial_option0: 58, openPartialBlock: 59, OPEN_PARTIAL_BLOCK: 60, openPartialBlock_repetition0: 61, openPartialBlock_option0: 62, param: 63, sexpr: 64, OPEN_SEXPR: 65, sexpr_repetition0: 66, sexpr_option0: 67, CLOSE_SEXPR: 68, hash: 69, hash_repetition_plus0: 70, hashSegment: 71, ID: 72, EQUALS: 73, blockParams: 74, OPEN_BLOCK_PARAMS: 75, blockParams_repetition_plus0: 76, CLOSE_BLOCK_PARAMS: 77, path: 78, dataName: 79, STRING: 80, NUMBER: 81, BOOLEAN: 82, UNDEFINED: 83, NULL: 84, DATA: 85, pathSegments: 86, SEP: 87, $accept: 0, $end: 1 },
      terminals_: { 2: "error", 5: "EOF", 14: "COMMENT", 15: "CONTENT", 18: "END_RAW_BLOCK", 19: "OPEN_RAW_BLOCK", 23: "CLOSE_RAW_BLOCK", 29: "OPEN_BLOCK", 33: "CLOSE", 34: "OPEN_INVERSE", 39: "OPEN_INVERSE_CHAIN", 44: "INVERSE", 47: "OPEN_ENDBLOCK", 48: "OPEN", 51: "OPEN_UNESCAPED", 54: "CLOSE_UNESCAPED", 55: "OPEN_PARTIAL", 60: "OPEN_PARTIAL_BLOCK", 65: "OPEN_SEXPR", 68: "CLOSE_SEXPR", 72: "ID", 73: "EQUALS", 75: "OPEN_BLOCK_PARAMS", 77: "CLOSE_BLOCK_PARAMS", 80: "STRING", 81: "NUMBER", 82: "BOOLEAN", 83: "UNDEFINED", 84: "NULL", 85: "DATA", 87: "SEP" },
      productions_: [0, [3, 2], [4, 1], [7, 1], [7, 1], [7, 1], [7, 1], [7, 1], [7, 1], [7, 1], [13, 1], [10, 3], [16, 5], [9, 4], [9, 4], [24, 6], [27, 6], [38, 6], [43, 2], [45, 3], [45, 1], [26, 3], [8, 5], [8, 5], [11, 5], [12, 3], [59, 5], [63, 1], [63, 1], [64, 5], [69, 1], [71, 3], [74, 3], [20, 1], [20, 1], [20, 1], [20, 1], [20, 1], [20, 1], [20, 1], [56, 1], [56, 1], [79, 2], [78, 1], [86, 3], [86, 1], [6, 0], [6, 2], [17, 0], [17, 2], [21, 0], [21, 2], [22, 0], [22, 1], [25, 0], [25, 1], [28, 0], [28, 1], [30, 0], [30, 2], [31, 0], [31, 1], [32, 0], [32, 1], [35, 0], [35, 2], [36, 0], [36, 1], [37, 0], [37, 1], [40, 0], [40, 2], [41, 0], [41, 1], [42, 0], [42, 1], [46, 0], [46, 1], [49, 0], [49, 2], [50, 0], [50, 1], [52, 0], [52, 2], [53, 0], [53, 1], [57, 0], [57, 2], [58, 0], [58, 1], [61, 0], [61, 2], [62, 0], [62, 1], [66, 0], [66, 2], [67, 0], [67, 1], [70, 1], [70, 2], [76, 1], [76, 2]],
      performAction: function anonymous(yytext, yyleng, yylineno, yy, yystate, $$, _$) {
        var $0 = $$.length - 1;
        switch (yystate) {
          case 1:
            return $$[$0 - 1];
            break;
          case 2:
            this.$ = yy.prepareProgram($$[$0]);
            break;
          case 3:
            this.$ = $$[$0];
            break;
          case 4:
            this.$ = $$[$0];
            break;
          case 5:
            this.$ = $$[$0];
            break;
          case 6:
            this.$ = $$[$0];
            break;
          case 7:
            this.$ = $$[$0];
            break;
          case 8:
            this.$ = $$[$0];
            break;
          case 9:
            this.$ = {
              type: "CommentStatement",
              value: yy.stripComment($$[$0]),
              strip: yy.stripFlags($$[$0], $$[$0]),
              loc: yy.locInfo(this._$)
            };
            break;
          case 10:
            this.$ = {
              type: "ContentStatement",
              original: $$[$0],
              value: $$[$0],
              loc: yy.locInfo(this._$)
            };
            break;
          case 11:
            this.$ = yy.prepareRawBlock($$[$0 - 2], $$[$0 - 1], $$[$0], this._$);
            break;
          case 12:
            this.$ = { path: $$[$0 - 3], params: $$[$0 - 2], hash: $$[$0 - 1] };
            break;
          case 13:
            this.$ = yy.prepareBlock($$[$0 - 3], $$[$0 - 2], $$[$0 - 1], $$[$0], false, this._$);
            break;
          case 14:
            this.$ = yy.prepareBlock($$[$0 - 3], $$[$0 - 2], $$[$0 - 1], $$[$0], true, this._$);
            break;
          case 15:
            this.$ = { open: $$[$0 - 5], path: $$[$0 - 4], params: $$[$0 - 3], hash: $$[$0 - 2], blockParams: $$[$0 - 1], strip: yy.stripFlags($$[$0 - 5], $$[$0]) };
            break;
          case 16:
            this.$ = { path: $$[$0 - 4], params: $$[$0 - 3], hash: $$[$0 - 2], blockParams: $$[$0 - 1], strip: yy.stripFlags($$[$0 - 5], $$[$0]) };
            break;
          case 17:
            this.$ = { path: $$[$0 - 4], params: $$[$0 - 3], hash: $$[$0 - 2], blockParams: $$[$0 - 1], strip: yy.stripFlags($$[$0 - 5], $$[$0]) };
            break;
          case 18:
            this.$ = { strip: yy.stripFlags($$[$0 - 1], $$[$0 - 1]), program: $$[$0] };
            break;
          case 19:
            var inverse = yy.prepareBlock($$[$0 - 2], $$[$0 - 1], $$[$0], $$[$0], false, this._$), program2 = yy.prepareProgram([inverse], $$[$0 - 1].loc);
            program2.chained = true;
            this.$ = { strip: $$[$0 - 2].strip, program: program2, chain: true };
            break;
          case 20:
            this.$ = $$[$0];
            break;
          case 21:
            this.$ = { path: $$[$0 - 1], strip: yy.stripFlags($$[$0 - 2], $$[$0]) };
            break;
          case 22:
            this.$ = yy.prepareMustache($$[$0 - 3], $$[$0 - 2], $$[$0 - 1], $$[$0 - 4], yy.stripFlags($$[$0 - 4], $$[$0]), this._$);
            break;
          case 23:
            this.$ = yy.prepareMustache($$[$0 - 3], $$[$0 - 2], $$[$0 - 1], $$[$0 - 4], yy.stripFlags($$[$0 - 4], $$[$0]), this._$);
            break;
          case 24:
            this.$ = {
              type: "PartialStatement",
              name: $$[$0 - 3],
              params: $$[$0 - 2],
              hash: $$[$0 - 1],
              indent: "",
              strip: yy.stripFlags($$[$0 - 4], $$[$0]),
              loc: yy.locInfo(this._$)
            };
            break;
          case 25:
            this.$ = yy.preparePartialBlock($$[$0 - 2], $$[$0 - 1], $$[$0], this._$);
            break;
          case 26:
            this.$ = { path: $$[$0 - 3], params: $$[$0 - 2], hash: $$[$0 - 1], strip: yy.stripFlags($$[$0 - 4], $$[$0]) };
            break;
          case 27:
            this.$ = $$[$0];
            break;
          case 28:
            this.$ = $$[$0];
            break;
          case 29:
            this.$ = {
              type: "SubExpression",
              path: $$[$0 - 3],
              params: $$[$0 - 2],
              hash: $$[$0 - 1],
              loc: yy.locInfo(this._$)
            };
            break;
          case 30:
            this.$ = { type: "Hash", pairs: $$[$0], loc: yy.locInfo(this._$) };
            break;
          case 31:
            this.$ = { type: "HashPair", key: yy.id($$[$0 - 2]), value: $$[$0], loc: yy.locInfo(this._$) };
            break;
          case 32:
            this.$ = yy.id($$[$0 - 1]);
            break;
          case 33:
            this.$ = $$[$0];
            break;
          case 34:
            this.$ = $$[$0];
            break;
          case 35:
            this.$ = { type: "StringLiteral", value: $$[$0], original: $$[$0], loc: yy.locInfo(this._$) };
            break;
          case 36:
            this.$ = { type: "NumberLiteral", value: Number($$[$0]), original: Number($$[$0]), loc: yy.locInfo(this._$) };
            break;
          case 37:
            this.$ = { type: "BooleanLiteral", value: $$[$0] === "true", original: $$[$0] === "true", loc: yy.locInfo(this._$) };
            break;
          case 38:
            this.$ = { type: "UndefinedLiteral", original: undefined, value: undefined, loc: yy.locInfo(this._$) };
            break;
          case 39:
            this.$ = { type: "NullLiteral", original: null, value: null, loc: yy.locInfo(this._$) };
            break;
          case 40:
            this.$ = $$[$0];
            break;
          case 41:
            this.$ = $$[$0];
            break;
          case 42:
            this.$ = yy.preparePath(true, $$[$0], this._$);
            break;
          case 43:
            this.$ = yy.preparePath(false, $$[$0], this._$);
            break;
          case 44:
            $$[$0 - 2].push({ part: yy.id($$[$0]), original: $$[$0], separator: $$[$0 - 1] });
            this.$ = $$[$0 - 2];
            break;
          case 45:
            this.$ = [{ part: yy.id($$[$0]), original: $$[$0] }];
            break;
          case 46:
            this.$ = [];
            break;
          case 47:
            $$[$0 - 1].push($$[$0]);
            break;
          case 48:
            this.$ = [];
            break;
          case 49:
            $$[$0 - 1].push($$[$0]);
            break;
          case 50:
            this.$ = [];
            break;
          case 51:
            $$[$0 - 1].push($$[$0]);
            break;
          case 58:
            this.$ = [];
            break;
          case 59:
            $$[$0 - 1].push($$[$0]);
            break;
          case 64:
            this.$ = [];
            break;
          case 65:
            $$[$0 - 1].push($$[$0]);
            break;
          case 70:
            this.$ = [];
            break;
          case 71:
            $$[$0 - 1].push($$[$0]);
            break;
          case 78:
            this.$ = [];
            break;
          case 79:
            $$[$0 - 1].push($$[$0]);
            break;
          case 82:
            this.$ = [];
            break;
          case 83:
            $$[$0 - 1].push($$[$0]);
            break;
          case 86:
            this.$ = [];
            break;
          case 87:
            $$[$0 - 1].push($$[$0]);
            break;
          case 90:
            this.$ = [];
            break;
          case 91:
            $$[$0 - 1].push($$[$0]);
            break;
          case 94:
            this.$ = [];
            break;
          case 95:
            $$[$0 - 1].push($$[$0]);
            break;
          case 98:
            this.$ = [$$[$0]];
            break;
          case 99:
            $$[$0 - 1].push($$[$0]);
            break;
          case 100:
            this.$ = [$$[$0]];
            break;
          case 101:
            $$[$0 - 1].push($$[$0]);
            break;
        }
      },
      table: [{ 3: 1, 4: 2, 5: [2, 46], 6: 3, 14: [2, 46], 15: [2, 46], 19: [2, 46], 29: [2, 46], 34: [2, 46], 48: [2, 46], 51: [2, 46], 55: [2, 46], 60: [2, 46] }, { 1: [3] }, { 5: [1, 4] }, { 5: [2, 2], 7: 5, 8: 6, 9: 7, 10: 8, 11: 9, 12: 10, 13: 11, 14: [1, 12], 15: [1, 20], 16: 17, 19: [1, 23], 24: 15, 27: 16, 29: [1, 21], 34: [1, 22], 39: [2, 2], 44: [2, 2], 47: [2, 2], 48: [1, 13], 51: [1, 14], 55: [1, 18], 59: 19, 60: [1, 24] }, { 1: [2, 1] }, { 5: [2, 47], 14: [2, 47], 15: [2, 47], 19: [2, 47], 29: [2, 47], 34: [2, 47], 39: [2, 47], 44: [2, 47], 47: [2, 47], 48: [2, 47], 51: [2, 47], 55: [2, 47], 60: [2, 47] }, { 5: [2, 3], 14: [2, 3], 15: [2, 3], 19: [2, 3], 29: [2, 3], 34: [2, 3], 39: [2, 3], 44: [2, 3], 47: [2, 3], 48: [2, 3], 51: [2, 3], 55: [2, 3], 60: [2, 3] }, { 5: [2, 4], 14: [2, 4], 15: [2, 4], 19: [2, 4], 29: [2, 4], 34: [2, 4], 39: [2, 4], 44: [2, 4], 47: [2, 4], 48: [2, 4], 51: [2, 4], 55: [2, 4], 60: [2, 4] }, { 5: [2, 5], 14: [2, 5], 15: [2, 5], 19: [2, 5], 29: [2, 5], 34: [2, 5], 39: [2, 5], 44: [2, 5], 47: [2, 5], 48: [2, 5], 51: [2, 5], 55: [2, 5], 60: [2, 5] }, { 5: [2, 6], 14: [2, 6], 15: [2, 6], 19: [2, 6], 29: [2, 6], 34: [2, 6], 39: [2, 6], 44: [2, 6], 47: [2, 6], 48: [2, 6], 51: [2, 6], 55: [2, 6], 60: [2, 6] }, { 5: [2, 7], 14: [2, 7], 15: [2, 7], 19: [2, 7], 29: [2, 7], 34: [2, 7], 39: [2, 7], 44: [2, 7], 47: [2, 7], 48: [2, 7], 51: [2, 7], 55: [2, 7], 60: [2, 7] }, { 5: [2, 8], 14: [2, 8], 15: [2, 8], 19: [2, 8], 29: [2, 8], 34: [2, 8], 39: [2, 8], 44: [2, 8], 47: [2, 8], 48: [2, 8], 51: [2, 8], 55: [2, 8], 60: [2, 8] }, { 5: [2, 9], 14: [2, 9], 15: [2, 9], 19: [2, 9], 29: [2, 9], 34: [2, 9], 39: [2, 9], 44: [2, 9], 47: [2, 9], 48: [2, 9], 51: [2, 9], 55: [2, 9], 60: [2, 9] }, { 20: 25, 72: [1, 35], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 20: 36, 72: [1, 35], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 4: 37, 6: 3, 14: [2, 46], 15: [2, 46], 19: [2, 46], 29: [2, 46], 34: [2, 46], 39: [2, 46], 44: [2, 46], 47: [2, 46], 48: [2, 46], 51: [2, 46], 55: [2, 46], 60: [2, 46] }, { 4: 38, 6: 3, 14: [2, 46], 15: [2, 46], 19: [2, 46], 29: [2, 46], 34: [2, 46], 44: [2, 46], 47: [2, 46], 48: [2, 46], 51: [2, 46], 55: [2, 46], 60: [2, 46] }, { 15: [2, 48], 17: 39, 18: [2, 48] }, { 20: 41, 56: 40, 64: 42, 65: [1, 43], 72: [1, 35], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 4: 44, 6: 3, 14: [2, 46], 15: [2, 46], 19: [2, 46], 29: [2, 46], 34: [2, 46], 47: [2, 46], 48: [2, 46], 51: [2, 46], 55: [2, 46], 60: [2, 46] }, { 5: [2, 10], 14: [2, 10], 15: [2, 10], 18: [2, 10], 19: [2, 10], 29: [2, 10], 34: [2, 10], 39: [2, 10], 44: [2, 10], 47: [2, 10], 48: [2, 10], 51: [2, 10], 55: [2, 10], 60: [2, 10] }, { 20: 45, 72: [1, 35], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 20: 46, 72: [1, 35], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 20: 47, 72: [1, 35], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 20: 41, 56: 48, 64: 42, 65: [1, 43], 72: [1, 35], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 33: [2, 78], 49: 49, 65: [2, 78], 72: [2, 78], 80: [2, 78], 81: [2, 78], 82: [2, 78], 83: [2, 78], 84: [2, 78], 85: [2, 78] }, { 23: [2, 33], 33: [2, 33], 54: [2, 33], 65: [2, 33], 68: [2, 33], 72: [2, 33], 75: [2, 33], 80: [2, 33], 81: [2, 33], 82: [2, 33], 83: [2, 33], 84: [2, 33], 85: [2, 33] }, { 23: [2, 34], 33: [2, 34], 54: [2, 34], 65: [2, 34], 68: [2, 34], 72: [2, 34], 75: [2, 34], 80: [2, 34], 81: [2, 34], 82: [2, 34], 83: [2, 34], 84: [2, 34], 85: [2, 34] }, { 23: [2, 35], 33: [2, 35], 54: [2, 35], 65: [2, 35], 68: [2, 35], 72: [2, 35], 75: [2, 35], 80: [2, 35], 81: [2, 35], 82: [2, 35], 83: [2, 35], 84: [2, 35], 85: [2, 35] }, { 23: [2, 36], 33: [2, 36], 54: [2, 36], 65: [2, 36], 68: [2, 36], 72: [2, 36], 75: [2, 36], 80: [2, 36], 81: [2, 36], 82: [2, 36], 83: [2, 36], 84: [2, 36], 85: [2, 36] }, { 23: [2, 37], 33: [2, 37], 54: [2, 37], 65: [2, 37], 68: [2, 37], 72: [2, 37], 75: [2, 37], 80: [2, 37], 81: [2, 37], 82: [2, 37], 83: [2, 37], 84: [2, 37], 85: [2, 37] }, { 23: [2, 38], 33: [2, 38], 54: [2, 38], 65: [2, 38], 68: [2, 38], 72: [2, 38], 75: [2, 38], 80: [2, 38], 81: [2, 38], 82: [2, 38], 83: [2, 38], 84: [2, 38], 85: [2, 38] }, { 23: [2, 39], 33: [2, 39], 54: [2, 39], 65: [2, 39], 68: [2, 39], 72: [2, 39], 75: [2, 39], 80: [2, 39], 81: [2, 39], 82: [2, 39], 83: [2, 39], 84: [2, 39], 85: [2, 39] }, { 23: [2, 43], 33: [2, 43], 54: [2, 43], 65: [2, 43], 68: [2, 43], 72: [2, 43], 75: [2, 43], 80: [2, 43], 81: [2, 43], 82: [2, 43], 83: [2, 43], 84: [2, 43], 85: [2, 43], 87: [1, 50] }, { 72: [1, 35], 86: 51 }, { 23: [2, 45], 33: [2, 45], 54: [2, 45], 65: [2, 45], 68: [2, 45], 72: [2, 45], 75: [2, 45], 80: [2, 45], 81: [2, 45], 82: [2, 45], 83: [2, 45], 84: [2, 45], 85: [2, 45], 87: [2, 45] }, { 52: 52, 54: [2, 82], 65: [2, 82], 72: [2, 82], 80: [2, 82], 81: [2, 82], 82: [2, 82], 83: [2, 82], 84: [2, 82], 85: [2, 82] }, { 25: 53, 38: 55, 39: [1, 57], 43: 56, 44: [1, 58], 45: 54, 47: [2, 54] }, { 28: 59, 43: 60, 44: [1, 58], 47: [2, 56] }, { 13: 62, 15: [1, 20], 18: [1, 61] }, { 33: [2, 86], 57: 63, 65: [2, 86], 72: [2, 86], 80: [2, 86], 81: [2, 86], 82: [2, 86], 83: [2, 86], 84: [2, 86], 85: [2, 86] }, { 33: [2, 40], 65: [2, 40], 72: [2, 40], 80: [2, 40], 81: [2, 40], 82: [2, 40], 83: [2, 40], 84: [2, 40], 85: [2, 40] }, { 33: [2, 41], 65: [2, 41], 72: [2, 41], 80: [2, 41], 81: [2, 41], 82: [2, 41], 83: [2, 41], 84: [2, 41], 85: [2, 41] }, { 20: 64, 72: [1, 35], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 26: 65, 47: [1, 66] }, { 30: 67, 33: [2, 58], 65: [2, 58], 72: [2, 58], 75: [2, 58], 80: [2, 58], 81: [2, 58], 82: [2, 58], 83: [2, 58], 84: [2, 58], 85: [2, 58] }, { 33: [2, 64], 35: 68, 65: [2, 64], 72: [2, 64], 75: [2, 64], 80: [2, 64], 81: [2, 64], 82: [2, 64], 83: [2, 64], 84: [2, 64], 85: [2, 64] }, { 21: 69, 23: [2, 50], 65: [2, 50], 72: [2, 50], 80: [2, 50], 81: [2, 50], 82: [2, 50], 83: [2, 50], 84: [2, 50], 85: [2, 50] }, { 33: [2, 90], 61: 70, 65: [2, 90], 72: [2, 90], 80: [2, 90], 81: [2, 90], 82: [2, 90], 83: [2, 90], 84: [2, 90], 85: [2, 90] }, { 20: 74, 33: [2, 80], 50: 71, 63: 72, 64: 75, 65: [1, 43], 69: 73, 70: 76, 71: 77, 72: [1, 78], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 72: [1, 79] }, { 23: [2, 42], 33: [2, 42], 54: [2, 42], 65: [2, 42], 68: [2, 42], 72: [2, 42], 75: [2, 42], 80: [2, 42], 81: [2, 42], 82: [2, 42], 83: [2, 42], 84: [2, 42], 85: [2, 42], 87: [1, 50] }, { 20: 74, 53: 80, 54: [2, 84], 63: 81, 64: 75, 65: [1, 43], 69: 82, 70: 76, 71: 77, 72: [1, 78], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 26: 83, 47: [1, 66] }, { 47: [2, 55] }, { 4: 84, 6: 3, 14: [2, 46], 15: [2, 46], 19: [2, 46], 29: [2, 46], 34: [2, 46], 39: [2, 46], 44: [2, 46], 47: [2, 46], 48: [2, 46], 51: [2, 46], 55: [2, 46], 60: [2, 46] }, { 47: [2, 20] }, { 20: 85, 72: [1, 35], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 4: 86, 6: 3, 14: [2, 46], 15: [2, 46], 19: [2, 46], 29: [2, 46], 34: [2, 46], 47: [2, 46], 48: [2, 46], 51: [2, 46], 55: [2, 46], 60: [2, 46] }, { 26: 87, 47: [1, 66] }, { 47: [2, 57] }, { 5: [2, 11], 14: [2, 11], 15: [2, 11], 19: [2, 11], 29: [2, 11], 34: [2, 11], 39: [2, 11], 44: [2, 11], 47: [2, 11], 48: [2, 11], 51: [2, 11], 55: [2, 11], 60: [2, 11] }, { 15: [2, 49], 18: [2, 49] }, { 20: 74, 33: [2, 88], 58: 88, 63: 89, 64: 75, 65: [1, 43], 69: 90, 70: 76, 71: 77, 72: [1, 78], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 65: [2, 94], 66: 91, 68: [2, 94], 72: [2, 94], 80: [2, 94], 81: [2, 94], 82: [2, 94], 83: [2, 94], 84: [2, 94], 85: [2, 94] }, { 5: [2, 25], 14: [2, 25], 15: [2, 25], 19: [2, 25], 29: [2, 25], 34: [2, 25], 39: [2, 25], 44: [2, 25], 47: [2, 25], 48: [2, 25], 51: [2, 25], 55: [2, 25], 60: [2, 25] }, { 20: 92, 72: [1, 35], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 20: 74, 31: 93, 33: [2, 60], 63: 94, 64: 75, 65: [1, 43], 69: 95, 70: 76, 71: 77, 72: [1, 78], 75: [2, 60], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 20: 74, 33: [2, 66], 36: 96, 63: 97, 64: 75, 65: [1, 43], 69: 98, 70: 76, 71: 77, 72: [1, 78], 75: [2, 66], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 20: 74, 22: 99, 23: [2, 52], 63: 100, 64: 75, 65: [1, 43], 69: 101, 70: 76, 71: 77, 72: [1, 78], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 20: 74, 33: [2, 92], 62: 102, 63: 103, 64: 75, 65: [1, 43], 69: 104, 70: 76, 71: 77, 72: [1, 78], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 33: [1, 105] }, { 33: [2, 79], 65: [2, 79], 72: [2, 79], 80: [2, 79], 81: [2, 79], 82: [2, 79], 83: [2, 79], 84: [2, 79], 85: [2, 79] }, { 33: [2, 81] }, { 23: [2, 27], 33: [2, 27], 54: [2, 27], 65: [2, 27], 68: [2, 27], 72: [2, 27], 75: [2, 27], 80: [2, 27], 81: [2, 27], 82: [2, 27], 83: [2, 27], 84: [2, 27], 85: [2, 27] }, { 23: [2, 28], 33: [2, 28], 54: [2, 28], 65: [2, 28], 68: [2, 28], 72: [2, 28], 75: [2, 28], 80: [2, 28], 81: [2, 28], 82: [2, 28], 83: [2, 28], 84: [2, 28], 85: [2, 28] }, { 23: [2, 30], 33: [2, 30], 54: [2, 30], 68: [2, 30], 71: 106, 72: [1, 107], 75: [2, 30] }, { 23: [2, 98], 33: [2, 98], 54: [2, 98], 68: [2, 98], 72: [2, 98], 75: [2, 98] }, { 23: [2, 45], 33: [2, 45], 54: [2, 45], 65: [2, 45], 68: [2, 45], 72: [2, 45], 73: [1, 108], 75: [2, 45], 80: [2, 45], 81: [2, 45], 82: [2, 45], 83: [2, 45], 84: [2, 45], 85: [2, 45], 87: [2, 45] }, { 23: [2, 44], 33: [2, 44], 54: [2, 44], 65: [2, 44], 68: [2, 44], 72: [2, 44], 75: [2, 44], 80: [2, 44], 81: [2, 44], 82: [2, 44], 83: [2, 44], 84: [2, 44], 85: [2, 44], 87: [2, 44] }, { 54: [1, 109] }, { 54: [2, 83], 65: [2, 83], 72: [2, 83], 80: [2, 83], 81: [2, 83], 82: [2, 83], 83: [2, 83], 84: [2, 83], 85: [2, 83] }, { 54: [2, 85] }, { 5: [2, 13], 14: [2, 13], 15: [2, 13], 19: [2, 13], 29: [2, 13], 34: [2, 13], 39: [2, 13], 44: [2, 13], 47: [2, 13], 48: [2, 13], 51: [2, 13], 55: [2, 13], 60: [2, 13] }, { 38: 55, 39: [1, 57], 43: 56, 44: [1, 58], 45: 111, 46: 110, 47: [2, 76] }, { 33: [2, 70], 40: 112, 65: [2, 70], 72: [2, 70], 75: [2, 70], 80: [2, 70], 81: [2, 70], 82: [2, 70], 83: [2, 70], 84: [2, 70], 85: [2, 70] }, { 47: [2, 18] }, { 5: [2, 14], 14: [2, 14], 15: [2, 14], 19: [2, 14], 29: [2, 14], 34: [2, 14], 39: [2, 14], 44: [2, 14], 47: [2, 14], 48: [2, 14], 51: [2, 14], 55: [2, 14], 60: [2, 14] }, { 33: [1, 113] }, { 33: [2, 87], 65: [2, 87], 72: [2, 87], 80: [2, 87], 81: [2, 87], 82: [2, 87], 83: [2, 87], 84: [2, 87], 85: [2, 87] }, { 33: [2, 89] }, { 20: 74, 63: 115, 64: 75, 65: [1, 43], 67: 114, 68: [2, 96], 69: 116, 70: 76, 71: 77, 72: [1, 78], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 33: [1, 117] }, { 32: 118, 33: [2, 62], 74: 119, 75: [1, 120] }, { 33: [2, 59], 65: [2, 59], 72: [2, 59], 75: [2, 59], 80: [2, 59], 81: [2, 59], 82: [2, 59], 83: [2, 59], 84: [2, 59], 85: [2, 59] }, { 33: [2, 61], 75: [2, 61] }, { 33: [2, 68], 37: 121, 74: 122, 75: [1, 120] }, { 33: [2, 65], 65: [2, 65], 72: [2, 65], 75: [2, 65], 80: [2, 65], 81: [2, 65], 82: [2, 65], 83: [2, 65], 84: [2, 65], 85: [2, 65] }, { 33: [2, 67], 75: [2, 67] }, { 23: [1, 123] }, { 23: [2, 51], 65: [2, 51], 72: [2, 51], 80: [2, 51], 81: [2, 51], 82: [2, 51], 83: [2, 51], 84: [2, 51], 85: [2, 51] }, { 23: [2, 53] }, { 33: [1, 124] }, { 33: [2, 91], 65: [2, 91], 72: [2, 91], 80: [2, 91], 81: [2, 91], 82: [2, 91], 83: [2, 91], 84: [2, 91], 85: [2, 91] }, { 33: [2, 93] }, { 5: [2, 22], 14: [2, 22], 15: [2, 22], 19: [2, 22], 29: [2, 22], 34: [2, 22], 39: [2, 22], 44: [2, 22], 47: [2, 22], 48: [2, 22], 51: [2, 22], 55: [2, 22], 60: [2, 22] }, { 23: [2, 99], 33: [2, 99], 54: [2, 99], 68: [2, 99], 72: [2, 99], 75: [2, 99] }, { 73: [1, 108] }, { 20: 74, 63: 125, 64: 75, 65: [1, 43], 72: [1, 35], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 5: [2, 23], 14: [2, 23], 15: [2, 23], 19: [2, 23], 29: [2, 23], 34: [2, 23], 39: [2, 23], 44: [2, 23], 47: [2, 23], 48: [2, 23], 51: [2, 23], 55: [2, 23], 60: [2, 23] }, { 47: [2, 19] }, { 47: [2, 77] }, { 20: 74, 33: [2, 72], 41: 126, 63: 127, 64: 75, 65: [1, 43], 69: 128, 70: 76, 71: 77, 72: [1, 78], 75: [2, 72], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 5: [2, 24], 14: [2, 24], 15: [2, 24], 19: [2, 24], 29: [2, 24], 34: [2, 24], 39: [2, 24], 44: [2, 24], 47: [2, 24], 48: [2, 24], 51: [2, 24], 55: [2, 24], 60: [2, 24] }, { 68: [1, 129] }, { 65: [2, 95], 68: [2, 95], 72: [2, 95], 80: [2, 95], 81: [2, 95], 82: [2, 95], 83: [2, 95], 84: [2, 95], 85: [2, 95] }, { 68: [2, 97] }, { 5: [2, 21], 14: [2, 21], 15: [2, 21], 19: [2, 21], 29: [2, 21], 34: [2, 21], 39: [2, 21], 44: [2, 21], 47: [2, 21], 48: [2, 21], 51: [2, 21], 55: [2, 21], 60: [2, 21] }, { 33: [1, 130] }, { 33: [2, 63] }, { 72: [1, 132], 76: 131 }, { 33: [1, 133] }, { 33: [2, 69] }, { 15: [2, 12], 18: [2, 12] }, { 14: [2, 26], 15: [2, 26], 19: [2, 26], 29: [2, 26], 34: [2, 26], 47: [2, 26], 48: [2, 26], 51: [2, 26], 55: [2, 26], 60: [2, 26] }, { 23: [2, 31], 33: [2, 31], 54: [2, 31], 68: [2, 31], 72: [2, 31], 75: [2, 31] }, { 33: [2, 74], 42: 134, 74: 135, 75: [1, 120] }, { 33: [2, 71], 65: [2, 71], 72: [2, 71], 75: [2, 71], 80: [2, 71], 81: [2, 71], 82: [2, 71], 83: [2, 71], 84: [2, 71], 85: [2, 71] }, { 33: [2, 73], 75: [2, 73] }, { 23: [2, 29], 33: [2, 29], 54: [2, 29], 65: [2, 29], 68: [2, 29], 72: [2, 29], 75: [2, 29], 80: [2, 29], 81: [2, 29], 82: [2, 29], 83: [2, 29], 84: [2, 29], 85: [2, 29] }, { 14: [2, 15], 15: [2, 15], 19: [2, 15], 29: [2, 15], 34: [2, 15], 39: [2, 15], 44: [2, 15], 47: [2, 15], 48: [2, 15], 51: [2, 15], 55: [2, 15], 60: [2, 15] }, { 72: [1, 137], 77: [1, 136] }, { 72: [2, 100], 77: [2, 100] }, { 14: [2, 16], 15: [2, 16], 19: [2, 16], 29: [2, 16], 34: [2, 16], 44: [2, 16], 47: [2, 16], 48: [2, 16], 51: [2, 16], 55: [2, 16], 60: [2, 16] }, { 33: [1, 138] }, { 33: [2, 75] }, { 33: [2, 32] }, { 72: [2, 101], 77: [2, 101] }, { 14: [2, 17], 15: [2, 17], 19: [2, 17], 29: [2, 17], 34: [2, 17], 39: [2, 17], 44: [2, 17], 47: [2, 17], 48: [2, 17], 51: [2, 17], 55: [2, 17], 60: [2, 17] }],
      defaultActions: { 4: [2, 1], 54: [2, 55], 56: [2, 20], 60: [2, 57], 73: [2, 81], 82: [2, 85], 86: [2, 18], 90: [2, 89], 101: [2, 53], 104: [2, 93], 110: [2, 19], 111: [2, 77], 116: [2, 97], 119: [2, 63], 122: [2, 69], 135: [2, 75], 136: [2, 32] },
      parseError: function parseError(str, hash) {
        throw new Error(str);
      },
      parse: function parse(input) {
        var self = this, stack = [0], vstack = [null], lstack = [], table2 = this.table, yytext = "", yylineno = 0, yyleng = 0, recovering = 0, TERROR = 2, EOF = 1;
        this.lexer.setInput(input);
        this.lexer.yy = this.yy;
        this.yy.lexer = this.lexer;
        this.yy.parser = this;
        if (typeof this.lexer.yylloc == "undefined")
          this.lexer.yylloc = {};
        var yyloc = this.lexer.yylloc;
        lstack.push(yyloc);
        var ranges = this.lexer.options && this.lexer.options.ranges;
        if (typeof this.yy.parseError === "function")
          this.parseError = this.yy.parseError;
        function popStack(n) {
          stack.length = stack.length - 2 * n;
          vstack.length = vstack.length - n;
          lstack.length = lstack.length - n;
        }
        function lex() {
          var token;
          token = self.lexer.lex() || 1;
          if (typeof token !== "number") {
            token = self.symbols_[token] || token;
          }
          return token;
        }
        var symbol, preErrorSymbol, state, action, a, r, yyval = {}, p, len, newState, expected;
        while (true) {
          state = stack[stack.length - 1];
          if (this.defaultActions[state]) {
            action = this.defaultActions[state];
          } else {
            if (symbol === null || typeof symbol == "undefined") {
              symbol = lex();
            }
            action = table2[state] && table2[state][symbol];
          }
          if (typeof action === "undefined" || !action.length || !action[0]) {
            var errStr = "";
            if (!recovering) {
              expected = [];
              for (p in table2[state])
                if (this.terminals_[p] && p > 2) {
                  expected.push("'" + this.terminals_[p] + "'");
                }
              if (this.lexer.showPosition) {
                errStr = "Parse error on line " + (yylineno + 1) + `:
` + this.lexer.showPosition() + `
Expecting ` + expected.join(", ") + ", got '" + (this.terminals_[symbol] || symbol) + "'";
              } else {
                errStr = "Parse error on line " + (yylineno + 1) + ": Unexpected " + (symbol == 1 ? "end of input" : "'" + (this.terminals_[symbol] || symbol) + "'");
              }
              this.parseError(errStr, { text: this.lexer.match, token: this.terminals_[symbol] || symbol, line: this.lexer.yylineno, loc: yyloc, expected });
            }
          }
          if (action[0] instanceof Array && action.length > 1) {
            throw new Error("Parse Error: multiple actions possible at state: " + state + ", token: " + symbol);
          }
          switch (action[0]) {
            case 1:
              stack.push(symbol);
              vstack.push(this.lexer.yytext);
              lstack.push(this.lexer.yylloc);
              stack.push(action[1]);
              symbol = null;
              if (!preErrorSymbol) {
                yyleng = this.lexer.yyleng;
                yytext = this.lexer.yytext;
                yylineno = this.lexer.yylineno;
                yyloc = this.lexer.yylloc;
                if (recovering > 0)
                  recovering--;
              } else {
                symbol = preErrorSymbol;
                preErrorSymbol = null;
              }
              break;
            case 2:
              len = this.productions_[action[1]][1];
              yyval.$ = vstack[vstack.length - len];
              yyval._$ = { first_line: lstack[lstack.length - (len || 1)].first_line, last_line: lstack[lstack.length - 1].last_line, first_column: lstack[lstack.length - (len || 1)].first_column, last_column: lstack[lstack.length - 1].last_column };
              if (ranges) {
                yyval._$.range = [lstack[lstack.length - (len || 1)].range[0], lstack[lstack.length - 1].range[1]];
              }
              r = this.performAction.call(yyval, yytext, yyleng, yylineno, this.yy, action[1], vstack, lstack);
              if (typeof r !== "undefined") {
                return r;
              }
              if (len) {
                stack = stack.slice(0, -1 * len * 2);
                vstack = vstack.slice(0, -1 * len);
                lstack = lstack.slice(0, -1 * len);
              }
              stack.push(this.productions_[action[1]][0]);
              vstack.push(yyval.$);
              lstack.push(yyval._$);
              newState = table2[stack[stack.length - 2]][stack[stack.length - 1]];
              stack.push(newState);
              break;
            case 3:
              return true;
          }
        }
        return true;
      }
    };
    var lexer = function() {
      var lexer2 = {
        EOF: 1,
        parseError: function parseError(str, hash) {
          if (this.yy.parser) {
            this.yy.parser.parseError(str, hash);
          } else {
            throw new Error(str);
          }
        },
        setInput: function setInput(input) {
          this._input = input;
          this._more = this._less = this.done = false;
          this.yylineno = this.yyleng = 0;
          this.yytext = this.matched = this.match = "";
          this.conditionStack = ["INITIAL"];
          this.yylloc = { first_line: 1, first_column: 0, last_line: 1, last_column: 0 };
          if (this.options.ranges)
            this.yylloc.range = [0, 0];
          this.offset = 0;
          return this;
        },
        input: function input() {
          var ch = this._input[0];
          this.yytext += ch;
          this.yyleng++;
          this.offset++;
          this.match += ch;
          this.matched += ch;
          var lines = ch.match(/(?:\r\n?|\n).*/g);
          if (lines) {
            this.yylineno++;
            this.yylloc.last_line++;
          } else {
            this.yylloc.last_column++;
          }
          if (this.options.ranges)
            this.yylloc.range[1]++;
          this._input = this._input.slice(1);
          return ch;
        },
        unput: function unput(ch) {
          var len = ch.length;
          var lines = ch.split(/(?:\r\n?|\n)/g);
          this._input = ch + this._input;
          this.yytext = this.yytext.substr(0, this.yytext.length - len - 1);
          this.offset -= len;
          var oldLines = this.match.split(/(?:\r\n?|\n)/g);
          this.match = this.match.substr(0, this.match.length - 1);
          this.matched = this.matched.substr(0, this.matched.length - 1);
          if (lines.length - 1)
            this.yylineno -= lines.length - 1;
          var r = this.yylloc.range;
          this.yylloc = {
            first_line: this.yylloc.first_line,
            last_line: this.yylineno + 1,
            first_column: this.yylloc.first_column,
            last_column: lines ? (lines.length === oldLines.length ? this.yylloc.first_column : 0) + oldLines[oldLines.length - lines.length].length - lines[0].length : this.yylloc.first_column - len
          };
          if (this.options.ranges) {
            this.yylloc.range = [r[0], r[0] + this.yyleng - len];
          }
          return this;
        },
        more: function more() {
          this._more = true;
          return this;
        },
        less: function less(n) {
          this.unput(this.match.slice(n));
        },
        pastInput: function pastInput() {
          var past = this.matched.substr(0, this.matched.length - this.match.length);
          return (past.length > 20 ? "..." : "") + past.substr(-20).replace(/\n/g, "");
        },
        upcomingInput: function upcomingInput() {
          var next = this.match;
          if (next.length < 20) {
            next += this._input.substr(0, 20 - next.length);
          }
          return (next.substr(0, 20) + (next.length > 20 ? "..." : "")).replace(/\n/g, "");
        },
        showPosition: function showPosition() {
          var pre = this.pastInput();
          var c = new Array(pre.length + 1).join("-");
          return pre + this.upcomingInput() + `
` + c + "^";
        },
        next: function next() {
          if (this.done) {
            return this.EOF;
          }
          if (!this._input)
            this.done = true;
          var token, match, tempMatch, index, col, lines;
          if (!this._more) {
            this.yytext = "";
            this.match = "";
          }
          var rules = this._currentRules();
          for (var i = 0;i < rules.length; i++) {
            tempMatch = this._input.match(this.rules[rules[i]]);
            if (tempMatch && (!match || tempMatch[0].length > match[0].length)) {
              match = tempMatch;
              index = i;
              if (!this.options.flex)
                break;
            }
          }
          if (match) {
            lines = match[0].match(/(?:\r\n?|\n).*/g);
            if (lines)
              this.yylineno += lines.length;
            this.yylloc = {
              first_line: this.yylloc.last_line,
              last_line: this.yylineno + 1,
              first_column: this.yylloc.last_column,
              last_column: lines ? lines[lines.length - 1].length - lines[lines.length - 1].match(/\r?\n?/)[0].length : this.yylloc.last_column + match[0].length
            };
            this.yytext += match[0];
            this.match += match[0];
            this.matches = match;
            this.yyleng = this.yytext.length;
            if (this.options.ranges) {
              this.yylloc.range = [this.offset, this.offset += this.yyleng];
            }
            this._more = false;
            this._input = this._input.slice(match[0].length);
            this.matched += match[0];
            token = this.performAction.call(this, this.yy, this, rules[index], this.conditionStack[this.conditionStack.length - 1]);
            if (this.done && this._input)
              this.done = false;
            if (token)
              return token;
            else
              return;
          }
          if (this._input === "") {
            return this.EOF;
          } else {
            return this.parseError("Lexical error on line " + (this.yylineno + 1) + `. Unrecognized text.
` + this.showPosition(), { text: "", token: null, line: this.yylineno });
          }
        },
        lex: function lex() {
          var r = this.next();
          if (typeof r !== "undefined") {
            return r;
          } else {
            return this.lex();
          }
        },
        begin: function begin(condition) {
          this.conditionStack.push(condition);
        },
        popState: function popState() {
          return this.conditionStack.pop();
        },
        _currentRules: function _currentRules() {
          return this.conditions[this.conditionStack[this.conditionStack.length - 1]].rules;
        },
        topState: function topState() {
          return this.conditionStack[this.conditionStack.length - 2];
        },
        pushState: function begin(condition) {
          this.begin(condition);
        }
      };
      lexer2.options = {};
      lexer2.performAction = function anonymous(yy, yy_, $avoiding_name_collisions, YY_START) {
        function strip(start, end) {
          return yy_.yytext = yy_.yytext.substring(start, yy_.yyleng - end + start);
        }
        var YYSTATE = YY_START;
        switch ($avoiding_name_collisions) {
          case 0:
            if (yy_.yytext.slice(-2) === "\\\\") {
              strip(0, 1);
              this.begin("mu");
            } else if (yy_.yytext.slice(-1) === "\\") {
              strip(0, 1);
              this.begin("emu");
            } else {
              this.begin("mu");
            }
            if (yy_.yytext)
              return 15;
            break;
          case 1:
            return 15;
            break;
          case 2:
            this.popState();
            return 15;
            break;
          case 3:
            this.begin("raw");
            return 15;
            break;
          case 4:
            this.popState();
            if (this.conditionStack[this.conditionStack.length - 1] === "raw") {
              return 15;
            } else {
              strip(5, 9);
              return "END_RAW_BLOCK";
            }
            break;
          case 5:
            return 15;
            break;
          case 6:
            this.popState();
            return 14;
            break;
          case 7:
            return 65;
            break;
          case 8:
            return 68;
            break;
          case 9:
            return 19;
            break;
          case 10:
            this.popState();
            this.begin("raw");
            return 23;
            break;
          case 11:
            return 55;
            break;
          case 12:
            return 60;
            break;
          case 13:
            return 29;
            break;
          case 14:
            return 47;
            break;
          case 15:
            this.popState();
            return 44;
            break;
          case 16:
            this.popState();
            return 44;
            break;
          case 17:
            return 34;
            break;
          case 18:
            return 39;
            break;
          case 19:
            return 51;
            break;
          case 20:
            return 48;
            break;
          case 21:
            this.unput(yy_.yytext);
            this.popState();
            this.begin("com");
            break;
          case 22:
            this.popState();
            return 14;
            break;
          case 23:
            return 48;
            break;
          case 24:
            return 73;
            break;
          case 25:
            return 72;
            break;
          case 26:
            return 72;
            break;
          case 27:
            return 87;
            break;
          case 28:
            break;
          case 29:
            this.popState();
            return 54;
            break;
          case 30:
            this.popState();
            return 33;
            break;
          case 31:
            yy_.yytext = strip(1, 2).replace(/\\"/g, '"');
            return 80;
            break;
          case 32:
            yy_.yytext = strip(1, 2).replace(/\\'/g, "'");
            return 80;
            break;
          case 33:
            return 85;
            break;
          case 34:
            return 82;
            break;
          case 35:
            return 82;
            break;
          case 36:
            return 83;
            break;
          case 37:
            return 84;
            break;
          case 38:
            return 81;
            break;
          case 39:
            return 75;
            break;
          case 40:
            return 77;
            break;
          case 41:
            return 72;
            break;
          case 42:
            yy_.yytext = yy_.yytext.replace(/\\([\\\]])/g, "$1");
            return 72;
            break;
          case 43:
            return "INVALID";
            break;
          case 44:
            return 5;
            break;
        }
      };
      lexer2.rules = [/^(?:[^\x00]*?(?=(\{\{)))/, /^(?:[^\x00]+)/, /^(?:[^\x00]{2,}?(?=(\{\{|\\\{\{|\\\\\{\{|$)))/, /^(?:\{\{\{\{(?=[^/]))/, /^(?:\{\{\{\{\/[^\s!"#%-,\.\/;->@\[-\^`\{-~]+(?=[=}\s\/.])\}\}\}\})/, /^(?:[^\x00]+?(?=(\{\{\{\{)))/, /^(?:[\s\S]*?--(~)?\}\})/, /^(?:\()/, /^(?:\))/, /^(?:\{\{\{\{)/, /^(?:\}\}\}\})/, /^(?:\{\{(~)?>)/, /^(?:\{\{(~)?#>)/, /^(?:\{\{(~)?#\*?)/, /^(?:\{\{(~)?\/)/, /^(?:\{\{(~)?\^\s*(~)?\}\})/, /^(?:\{\{(~)?\s*else\s*(~)?\}\})/, /^(?:\{\{(~)?\^)/, /^(?:\{\{(~)?\s*else\b)/, /^(?:\{\{(~)?\{)/, /^(?:\{\{(~)?&)/, /^(?:\{\{(~)?!--)/, /^(?:\{\{(~)?![\s\S]*?\}\})/, /^(?:\{\{(~)?\*?)/, /^(?:=)/, /^(?:\.\.)/, /^(?:\.(?=([=~}\s\/.)|])))/, /^(?:[\/.])/, /^(?:\s+)/, /^(?:\}(~)?\}\})/, /^(?:(~)?\}\})/, /^(?:"(\\["]|[^"])*")/, /^(?:'(\\[']|[^'])*')/, /^(?:@)/, /^(?:true(?=([~}\s)])))/, /^(?:false(?=([~}\s)])))/, /^(?:undefined(?=([~}\s)])))/, /^(?:null(?=([~}\s)])))/, /^(?:-?[0-9]+(?:\.[0-9]+)?(?=([~}\s)])))/, /^(?:as\s+\|)/, /^(?:\|)/, /^(?:([^\s!"#%-,\.\/;->@\[-\^`\{-~]+(?=([=~}\s\/.)|]))))/, /^(?:\[(\\\]|[^\]])*\])/, /^(?:.)/, /^(?:$)/];
      lexer2.conditions = { mu: { rules: [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44], inclusive: false }, emu: { rules: [2], inclusive: false }, com: { rules: [6], inclusive: false }, raw: { rules: [3, 4, 5], inclusive: false }, INITIAL: { rules: [0, 1, 44], inclusive: true } };
      return lexer2;
    }();
    parser.lexer = lexer;
    function Parser() {
      this.yy = {};
    }
    Parser.prototype = parser;
    parser.Parser = Parser;
    return new Parser;
  }();
  exports.default = handlebars;
  module.exports = exports["default"];
});

// node_modules/.bun/handlebars@4.7.8/node_modules/handlebars/dist/cjs/handlebars/compiler/visitor.js
var require_visitor = __commonJS((exports, module) => {
  exports.__esModule = true;
  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : { default: obj };
  }
  var _exception = require_exception2();
  var _exception2 = _interopRequireDefault(_exception);
  function Visitor() {
    this.parents = [];
  }
  Visitor.prototype = {
    constructor: Visitor,
    mutating: false,
    acceptKey: function acceptKey(node, name) {
      var value = this.accept(node[name]);
      if (this.mutating) {
        if (value && !Visitor.prototype[value.type]) {
          throw new _exception2["default"]('Unexpected node type "' + value.type + '" found when accepting ' + name + " on " + node.type);
        }
        node[name] = value;
      }
    },
    acceptRequired: function acceptRequired(node, name) {
      this.acceptKey(node, name);
      if (!node[name]) {
        throw new _exception2["default"](node.type + " requires " + name);
      }
    },
    acceptArray: function acceptArray(array) {
      for (var i = 0, l = array.length;i < l; i++) {
        this.acceptKey(array, i);
        if (!array[i]) {
          array.splice(i, 1);
          i--;
          l--;
        }
      }
    },
    accept: function accept(object) {
      if (!object) {
        return;
      }
      if (!this[object.type]) {
        throw new _exception2["default"]("Unknown type: " + object.type, object);
      }
      if (this.current) {
        this.parents.unshift(this.current);
      }
      this.current = object;
      var ret = this[object.type](object);
      this.current = this.parents.shift();
      if (!this.mutating || ret) {
        return ret;
      } else if (ret !== false) {
        return object;
      }
    },
    Program: function Program(program2) {
      this.acceptArray(program2.body);
    },
    MustacheStatement: visitSubExpression,
    Decorator: visitSubExpression,
    BlockStatement: visitBlock,
    DecoratorBlock: visitBlock,
    PartialStatement: visitPartial,
    PartialBlockStatement: function PartialBlockStatement(partial) {
      visitPartial.call(this, partial);
      this.acceptKey(partial, "program");
    },
    ContentStatement: function ContentStatement() {},
    CommentStatement: function CommentStatement() {},
    SubExpression: visitSubExpression,
    PathExpression: function PathExpression() {},
    StringLiteral: function StringLiteral() {},
    NumberLiteral: function NumberLiteral() {},
    BooleanLiteral: function BooleanLiteral() {},
    UndefinedLiteral: function UndefinedLiteral() {},
    NullLiteral: function NullLiteral() {},
    Hash: function Hash(hash) {
      this.acceptArray(hash.pairs);
    },
    HashPair: function HashPair(pair) {
      this.acceptRequired(pair, "value");
    }
  };
  function visitSubExpression(mustache) {
    this.acceptRequired(mustache, "path");
    this.acceptArray(mustache.params);
    this.acceptKey(mustache, "hash");
  }
  function visitBlock(block) {
    visitSubExpression.call(this, block);
    this.acceptKey(block, "program");
    this.acceptKey(block, "inverse");
  }
  function visitPartial(partial) {
    this.acceptRequired(partial, "name");
    this.acceptArray(partial.params);
    this.acceptKey(partial, "hash");
  }
  exports.default = Visitor;
  module.exports = exports["default"];
});

// node_modules/.bun/handlebars@4.7.8/node_modules/handlebars/dist/cjs/handlebars/compiler/whitespace-control.js
var require_whitespace_control = __commonJS((exports, module) => {
  exports.__esModule = true;
  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : { default: obj };
  }
  var _visitor = require_visitor();
  var _visitor2 = _interopRequireDefault(_visitor);
  function WhitespaceControl() {
    var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];
    this.options = options;
  }
  WhitespaceControl.prototype = new _visitor2["default"];
  WhitespaceControl.prototype.Program = function(program2) {
    var doStandalone = !this.options.ignoreStandalone;
    var isRoot = !this.isRootSeen;
    this.isRootSeen = true;
    var body = program2.body;
    for (var i = 0, l = body.length;i < l; i++) {
      var current = body[i], strip = this.accept(current);
      if (!strip) {
        continue;
      }
      var _isPrevWhitespace = isPrevWhitespace(body, i, isRoot), _isNextWhitespace = isNextWhitespace(body, i, isRoot), openStandalone = strip.openStandalone && _isPrevWhitespace, closeStandalone = strip.closeStandalone && _isNextWhitespace, inlineStandalone = strip.inlineStandalone && _isPrevWhitespace && _isNextWhitespace;
      if (strip.close) {
        omitRight(body, i, true);
      }
      if (strip.open) {
        omitLeft(body, i, true);
      }
      if (doStandalone && inlineStandalone) {
        omitRight(body, i);
        if (omitLeft(body, i)) {
          if (current.type === "PartialStatement") {
            current.indent = /([ \t]+$)/.exec(body[i - 1].original)[1];
          }
        }
      }
      if (doStandalone && openStandalone) {
        omitRight((current.program || current.inverse).body);
        omitLeft(body, i);
      }
      if (doStandalone && closeStandalone) {
        omitRight(body, i);
        omitLeft((current.inverse || current.program).body);
      }
    }
    return program2;
  };
  WhitespaceControl.prototype.BlockStatement = WhitespaceControl.prototype.DecoratorBlock = WhitespaceControl.prototype.PartialBlockStatement = function(block) {
    this.accept(block.program);
    this.accept(block.inverse);
    var program2 = block.program || block.inverse, inverse = block.program && block.inverse, firstInverse = inverse, lastInverse = inverse;
    if (inverse && inverse.chained) {
      firstInverse = inverse.body[0].program;
      while (lastInverse.chained) {
        lastInverse = lastInverse.body[lastInverse.body.length - 1].program;
      }
    }
    var strip = {
      open: block.openStrip.open,
      close: block.closeStrip.close,
      openStandalone: isNextWhitespace(program2.body),
      closeStandalone: isPrevWhitespace((firstInverse || program2).body)
    };
    if (block.openStrip.close) {
      omitRight(program2.body, null, true);
    }
    if (inverse) {
      var inverseStrip = block.inverseStrip;
      if (inverseStrip.open) {
        omitLeft(program2.body, null, true);
      }
      if (inverseStrip.close) {
        omitRight(firstInverse.body, null, true);
      }
      if (block.closeStrip.open) {
        omitLeft(lastInverse.body, null, true);
      }
      if (!this.options.ignoreStandalone && isPrevWhitespace(program2.body) && isNextWhitespace(firstInverse.body)) {
        omitLeft(program2.body);
        omitRight(firstInverse.body);
      }
    } else if (block.closeStrip.open) {
      omitLeft(program2.body, null, true);
    }
    return strip;
  };
  WhitespaceControl.prototype.Decorator = WhitespaceControl.prototype.MustacheStatement = function(mustache) {
    return mustache.strip;
  };
  WhitespaceControl.prototype.PartialStatement = WhitespaceControl.prototype.CommentStatement = function(node) {
    var strip = node.strip || {};
    return {
      inlineStandalone: true,
      open: strip.open,
      close: strip.close
    };
  };
  function isPrevWhitespace(body, i, isRoot) {
    if (i === undefined) {
      i = body.length;
    }
    var prev = body[i - 1], sibling = body[i - 2];
    if (!prev) {
      return isRoot;
    }
    if (prev.type === "ContentStatement") {
      return (sibling || !isRoot ? /\r?\n\s*?$/ : /(^|\r?\n)\s*?$/).test(prev.original);
    }
  }
  function isNextWhitespace(body, i, isRoot) {
    if (i === undefined) {
      i = -1;
    }
    var next = body[i + 1], sibling = body[i + 2];
    if (!next) {
      return isRoot;
    }
    if (next.type === "ContentStatement") {
      return (sibling || !isRoot ? /^\s*?\r?\n/ : /^\s*?(\r?\n|$)/).test(next.original);
    }
  }
  function omitRight(body, i, multiple) {
    var current = body[i == null ? 0 : i + 1];
    if (!current || current.type !== "ContentStatement" || !multiple && current.rightStripped) {
      return;
    }
    var original = current.value;
    current.value = current.value.replace(multiple ? /^\s+/ : /^[ \t]*\r?\n?/, "");
    current.rightStripped = current.value !== original;
  }
  function omitLeft(body, i, multiple) {
    var current = body[i == null ? body.length - 1 : i - 1];
    if (!current || current.type !== "ContentStatement" || !multiple && current.leftStripped) {
      return;
    }
    var original = current.value;
    current.value = current.value.replace(multiple ? /\s+$/ : /[ \t]+$/, "");
    current.leftStripped = current.value !== original;
    return current.leftStripped;
  }
  exports.default = WhitespaceControl;
  module.exports = exports["default"];
});

// node_modules/.bun/handlebars@4.7.8/node_modules/handlebars/dist/cjs/handlebars/compiler/helpers.js
var require_helpers2 = __commonJS((exports) => {
  exports.__esModule = true;
  exports.SourceLocation = SourceLocation;
  exports.id = id;
  exports.stripFlags = stripFlags;
  exports.stripComment = stripComment;
  exports.preparePath = preparePath;
  exports.prepareMustache = prepareMustache;
  exports.prepareRawBlock = prepareRawBlock;
  exports.prepareBlock = prepareBlock;
  exports.prepareProgram = prepareProgram;
  exports.preparePartialBlock = preparePartialBlock;
  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : { default: obj };
  }
  var _exception = require_exception2();
  var _exception2 = _interopRequireDefault(_exception);
  function validateClose(open, close) {
    close = close.path ? close.path.original : close;
    if (open.path.original !== close) {
      var errorNode = { loc: open.path.loc };
      throw new _exception2["default"](open.path.original + " doesn't match " + close, errorNode);
    }
  }
  function SourceLocation(source, locInfo) {
    this.source = source;
    this.start = {
      line: locInfo.first_line,
      column: locInfo.first_column
    };
    this.end = {
      line: locInfo.last_line,
      column: locInfo.last_column
    };
  }
  function id(token) {
    if (/^\[.*\]$/.test(token)) {
      return token.substring(1, token.length - 1);
    } else {
      return token;
    }
  }
  function stripFlags(open, close) {
    return {
      open: open.charAt(2) === "~",
      close: close.charAt(close.length - 3) === "~"
    };
  }
  function stripComment(comment) {
    return comment.replace(/^\{\{~?!-?-?/, "").replace(/-?-?~?\}\}$/, "");
  }
  function preparePath(data, parts, loc) {
    loc = this.locInfo(loc);
    var original = data ? "@" : "", dig = [], depth = 0;
    for (var i = 0, l = parts.length;i < l; i++) {
      var part = parts[i].part, isLiteral = parts[i].original !== part;
      original += (parts[i].separator || "") + part;
      if (!isLiteral && (part === ".." || part === "." || part === "this")) {
        if (dig.length > 0) {
          throw new _exception2["default"]("Invalid path: " + original, { loc });
        } else if (part === "..") {
          depth++;
        }
      } else {
        dig.push(part);
      }
    }
    return {
      type: "PathExpression",
      data,
      depth,
      parts: dig,
      original,
      loc
    };
  }
  function prepareMustache(path, params, hash, open, strip, locInfo) {
    var escapeFlag = open.charAt(3) || open.charAt(2), escaped = escapeFlag !== "{" && escapeFlag !== "&";
    var decorator = /\*/.test(open);
    return {
      type: decorator ? "Decorator" : "MustacheStatement",
      path,
      params,
      hash,
      escaped,
      strip,
      loc: this.locInfo(locInfo)
    };
  }
  function prepareRawBlock(openRawBlock, contents, close, locInfo) {
    validateClose(openRawBlock, close);
    locInfo = this.locInfo(locInfo);
    var program2 = {
      type: "Program",
      body: contents,
      strip: {},
      loc: locInfo
    };
    return {
      type: "BlockStatement",
      path: openRawBlock.path,
      params: openRawBlock.params,
      hash: openRawBlock.hash,
      program: program2,
      openStrip: {},
      inverseStrip: {},
      closeStrip: {},
      loc: locInfo
    };
  }
  function prepareBlock(openBlock, program2, inverseAndProgram, close, inverted, locInfo) {
    if (close && close.path) {
      validateClose(openBlock, close);
    }
    var decorator = /\*/.test(openBlock.open);
    program2.blockParams = openBlock.blockParams;
    var inverse = undefined, inverseStrip = undefined;
    if (inverseAndProgram) {
      if (decorator) {
        throw new _exception2["default"]("Unexpected inverse block on decorator", inverseAndProgram);
      }
      if (inverseAndProgram.chain) {
        inverseAndProgram.program.body[0].closeStrip = close.strip;
      }
      inverseStrip = inverseAndProgram.strip;
      inverse = inverseAndProgram.program;
    }
    if (inverted) {
      inverted = inverse;
      inverse = program2;
      program2 = inverted;
    }
    return {
      type: decorator ? "DecoratorBlock" : "BlockStatement",
      path: openBlock.path,
      params: openBlock.params,
      hash: openBlock.hash,
      program: program2,
      inverse,
      openStrip: openBlock.strip,
      inverseStrip,
      closeStrip: close && close.strip,
      loc: this.locInfo(locInfo)
    };
  }
  function prepareProgram(statements, loc) {
    if (!loc && statements.length) {
      var firstLoc = statements[0].loc, lastLoc = statements[statements.length - 1].loc;
      if (firstLoc && lastLoc) {
        loc = {
          source: firstLoc.source,
          start: {
            line: firstLoc.start.line,
            column: firstLoc.start.column
          },
          end: {
            line: lastLoc.end.line,
            column: lastLoc.end.column
          }
        };
      }
    }
    return {
      type: "Program",
      body: statements,
      strip: {},
      loc
    };
  }
  function preparePartialBlock(open, program2, close, locInfo) {
    validateClose(open, close);
    return {
      type: "PartialBlockStatement",
      name: open.path,
      params: open.params,
      hash: open.hash,
      program: program2,
      openStrip: open.strip,
      closeStrip: close && close.strip,
      loc: this.locInfo(locInfo)
    };
  }
});

// node_modules/.bun/handlebars@4.7.8/node_modules/handlebars/dist/cjs/handlebars/compiler/base.js
var require_base2 = __commonJS((exports) => {
  exports.__esModule = true;
  exports.parseWithoutProcessing = parseWithoutProcessing;
  exports.parse = parse;
  function _interopRequireWildcard(obj) {
    if (obj && obj.__esModule) {
      return obj;
    } else {
      var newObj = {};
      if (obj != null) {
        for (var key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key))
            newObj[key] = obj[key];
        }
      }
      newObj["default"] = obj;
      return newObj;
    }
  }
  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : { default: obj };
  }
  var _parser = require_parser();
  var _parser2 = _interopRequireDefault(_parser);
  var _whitespaceControl = require_whitespace_control();
  var _whitespaceControl2 = _interopRequireDefault(_whitespaceControl);
  var _helpers = require_helpers2();
  var Helpers = _interopRequireWildcard(_helpers);
  var _utils = require_utils();
  exports.parser = _parser2["default"];
  var yy = {};
  _utils.extend(yy, Helpers);
  function parseWithoutProcessing(input, options) {
    if (input.type === "Program") {
      return input;
    }
    _parser2["default"].yy = yy;
    yy.locInfo = function(locInfo) {
      return new yy.SourceLocation(options && options.srcName, locInfo);
    };
    var ast = _parser2["default"].parse(input);
    return ast;
  }
  function parse(input, options) {
    var ast = parseWithoutProcessing(input, options);
    var strip = new _whitespaceControl2["default"](options);
    return strip.accept(ast);
  }
});

// node_modules/.bun/handlebars@4.7.8/node_modules/handlebars/dist/cjs/handlebars/compiler/compiler.js
var require_compiler = __commonJS((exports) => {
  exports.__esModule = true;
  exports.Compiler = Compiler;
  exports.precompile = precompile;
  exports.compile = compile;
  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : { default: obj };
  }
  var _exception = require_exception2();
  var _exception2 = _interopRequireDefault(_exception);
  var _utils = require_utils();
  var _ast = require_ast();
  var _ast2 = _interopRequireDefault(_ast);
  var slice = [].slice;
  function Compiler() {}
  Compiler.prototype = {
    compiler: Compiler,
    equals: function equals(other) {
      var len = this.opcodes.length;
      if (other.opcodes.length !== len) {
        return false;
      }
      for (var i = 0;i < len; i++) {
        var opcode = this.opcodes[i], otherOpcode = other.opcodes[i];
        if (opcode.opcode !== otherOpcode.opcode || !argEquals(opcode.args, otherOpcode.args)) {
          return false;
        }
      }
      len = this.children.length;
      for (var i = 0;i < len; i++) {
        if (!this.children[i].equals(other.children[i])) {
          return false;
        }
      }
      return true;
    },
    guid: 0,
    compile: function compile(program2, options) {
      this.sourceNode = [];
      this.opcodes = [];
      this.children = [];
      this.options = options;
      this.stringParams = options.stringParams;
      this.trackIds = options.trackIds;
      options.blockParams = options.blockParams || [];
      options.knownHelpers = _utils.extend(Object.create(null), {
        helperMissing: true,
        blockHelperMissing: true,
        each: true,
        if: true,
        unless: true,
        with: true,
        log: true,
        lookup: true
      }, options.knownHelpers);
      return this.accept(program2);
    },
    compileProgram: function compileProgram(program2) {
      var childCompiler = new this.compiler, result = childCompiler.compile(program2, this.options), guid = this.guid++;
      this.usePartial = this.usePartial || result.usePartial;
      this.children[guid] = result;
      this.useDepths = this.useDepths || result.useDepths;
      return guid;
    },
    accept: function accept(node) {
      if (!this[node.type]) {
        throw new _exception2["default"]("Unknown type: " + node.type, node);
      }
      this.sourceNode.unshift(node);
      var ret = this[node.type](node);
      this.sourceNode.shift();
      return ret;
    },
    Program: function Program(program2) {
      this.options.blockParams.unshift(program2.blockParams);
      var body = program2.body, bodyLength = body.length;
      for (var i = 0;i < bodyLength; i++) {
        this.accept(body[i]);
      }
      this.options.blockParams.shift();
      this.isSimple = bodyLength === 1;
      this.blockParams = program2.blockParams ? program2.blockParams.length : 0;
      return this;
    },
    BlockStatement: function BlockStatement(block) {
      transformLiteralToPath(block);
      var { program: program2, inverse } = block;
      program2 = program2 && this.compileProgram(program2);
      inverse = inverse && this.compileProgram(inverse);
      var type = this.classifySexpr(block);
      if (type === "helper") {
        this.helperSexpr(block, program2, inverse);
      } else if (type === "simple") {
        this.simpleSexpr(block);
        this.opcode("pushProgram", program2);
        this.opcode("pushProgram", inverse);
        this.opcode("emptyHash");
        this.opcode("blockValue", block.path.original);
      } else {
        this.ambiguousSexpr(block, program2, inverse);
        this.opcode("pushProgram", program2);
        this.opcode("pushProgram", inverse);
        this.opcode("emptyHash");
        this.opcode("ambiguousBlockValue");
      }
      this.opcode("append");
    },
    DecoratorBlock: function DecoratorBlock(decorator) {
      var program2 = decorator.program && this.compileProgram(decorator.program);
      var params = this.setupFullMustacheParams(decorator, program2, undefined), path = decorator.path;
      this.useDecorators = true;
      this.opcode("registerDecorator", params.length, path.original);
    },
    PartialStatement: function PartialStatement(partial) {
      this.usePartial = true;
      var program2 = partial.program;
      if (program2) {
        program2 = this.compileProgram(partial.program);
      }
      var params = partial.params;
      if (params.length > 1) {
        throw new _exception2["default"]("Unsupported number of partial arguments: " + params.length, partial);
      } else if (!params.length) {
        if (this.options.explicitPartialContext) {
          this.opcode("pushLiteral", "undefined");
        } else {
          params.push({ type: "PathExpression", parts: [], depth: 0 });
        }
      }
      var partialName = partial.name.original, isDynamic2 = partial.name.type === "SubExpression";
      if (isDynamic2) {
        this.accept(partial.name);
      }
      this.setupFullMustacheParams(partial, program2, undefined, true);
      var indent = partial.indent || "";
      if (this.options.preventIndent && indent) {
        this.opcode("appendContent", indent);
        indent = "";
      }
      this.opcode("invokePartial", isDynamic2, partialName, indent);
      this.opcode("append");
    },
    PartialBlockStatement: function PartialBlockStatement(partialBlock) {
      this.PartialStatement(partialBlock);
    },
    MustacheStatement: function MustacheStatement(mustache) {
      this.SubExpression(mustache);
      if (mustache.escaped && !this.options.noEscape) {
        this.opcode("appendEscaped");
      } else {
        this.opcode("append");
      }
    },
    Decorator: function Decorator(decorator) {
      this.DecoratorBlock(decorator);
    },
    ContentStatement: function ContentStatement(content) {
      if (content.value) {
        this.opcode("appendContent", content.value);
      }
    },
    CommentStatement: function CommentStatement() {},
    SubExpression: function SubExpression(sexpr) {
      transformLiteralToPath(sexpr);
      var type = this.classifySexpr(sexpr);
      if (type === "simple") {
        this.simpleSexpr(sexpr);
      } else if (type === "helper") {
        this.helperSexpr(sexpr);
      } else {
        this.ambiguousSexpr(sexpr);
      }
    },
    ambiguousSexpr: function ambiguousSexpr(sexpr, program2, inverse) {
      var path = sexpr.path, name = path.parts[0], isBlock = program2 != null || inverse != null;
      this.opcode("getContext", path.depth);
      this.opcode("pushProgram", program2);
      this.opcode("pushProgram", inverse);
      path.strict = true;
      this.accept(path);
      this.opcode("invokeAmbiguous", name, isBlock);
    },
    simpleSexpr: function simpleSexpr(sexpr) {
      var path = sexpr.path;
      path.strict = true;
      this.accept(path);
      this.opcode("resolvePossibleLambda");
    },
    helperSexpr: function helperSexpr(sexpr, program2, inverse) {
      var params = this.setupFullMustacheParams(sexpr, program2, inverse), path = sexpr.path, name = path.parts[0];
      if (this.options.knownHelpers[name]) {
        this.opcode("invokeKnownHelper", params.length, name);
      } else if (this.options.knownHelpersOnly) {
        throw new _exception2["default"]("You specified knownHelpersOnly, but used the unknown helper " + name, sexpr);
      } else {
        path.strict = true;
        path.falsy = true;
        this.accept(path);
        this.opcode("invokeHelper", params.length, path.original, _ast2["default"].helpers.simpleId(path));
      }
    },
    PathExpression: function PathExpression(path) {
      this.addDepth(path.depth);
      this.opcode("getContext", path.depth);
      var name = path.parts[0], scoped = _ast2["default"].helpers.scopedId(path), blockParamId = !path.depth && !scoped && this.blockParamIndex(name);
      if (blockParamId) {
        this.opcode("lookupBlockParam", blockParamId, path.parts);
      } else if (!name) {
        this.opcode("pushContext");
      } else if (path.data) {
        this.options.data = true;
        this.opcode("lookupData", path.depth, path.parts, path.strict);
      } else {
        this.opcode("lookupOnContext", path.parts, path.falsy, path.strict, scoped);
      }
    },
    StringLiteral: function StringLiteral(string) {
      this.opcode("pushString", string.value);
    },
    NumberLiteral: function NumberLiteral(number) {
      this.opcode("pushLiteral", number.value);
    },
    BooleanLiteral: function BooleanLiteral(bool) {
      this.opcode("pushLiteral", bool.value);
    },
    UndefinedLiteral: function UndefinedLiteral() {
      this.opcode("pushLiteral", "undefined");
    },
    NullLiteral: function NullLiteral() {
      this.opcode("pushLiteral", "null");
    },
    Hash: function Hash(hash) {
      var pairs = hash.pairs, i = 0, l = pairs.length;
      this.opcode("pushHash");
      for (;i < l; i++) {
        this.pushParam(pairs[i].value);
      }
      while (i--) {
        this.opcode("assignToHash", pairs[i].key);
      }
      this.opcode("popHash");
    },
    opcode: function opcode(name) {
      this.opcodes.push({
        opcode: name,
        args: slice.call(arguments, 1),
        loc: this.sourceNode[0].loc
      });
    },
    addDepth: function addDepth(depth) {
      if (!depth) {
        return;
      }
      this.useDepths = true;
    },
    classifySexpr: function classifySexpr(sexpr) {
      var isSimple = _ast2["default"].helpers.simpleId(sexpr.path);
      var isBlockParam = isSimple && !!this.blockParamIndex(sexpr.path.parts[0]);
      var isHelper = !isBlockParam && _ast2["default"].helpers.helperExpression(sexpr);
      var isEligible = !isBlockParam && (isHelper || isSimple);
      if (isEligible && !isHelper) {
        var _name = sexpr.path.parts[0], options = this.options;
        if (options.knownHelpers[_name]) {
          isHelper = true;
        } else if (options.knownHelpersOnly) {
          isEligible = false;
        }
      }
      if (isHelper) {
        return "helper";
      } else if (isEligible) {
        return "ambiguous";
      } else {
        return "simple";
      }
    },
    pushParams: function pushParams(params) {
      for (var i = 0, l = params.length;i < l; i++) {
        this.pushParam(params[i]);
      }
    },
    pushParam: function pushParam(val) {
      var value = val.value != null ? val.value : val.original || "";
      if (this.stringParams) {
        if (value.replace) {
          value = value.replace(/^(\.?\.\/)*/g, "").replace(/\//g, ".");
        }
        if (val.depth) {
          this.addDepth(val.depth);
        }
        this.opcode("getContext", val.depth || 0);
        this.opcode("pushStringParam", value, val.type);
        if (val.type === "SubExpression") {
          this.accept(val);
        }
      } else {
        if (this.trackIds) {
          var blockParamIndex = undefined;
          if (val.parts && !_ast2["default"].helpers.scopedId(val) && !val.depth) {
            blockParamIndex = this.blockParamIndex(val.parts[0]);
          }
          if (blockParamIndex) {
            var blockParamChild = val.parts.slice(1).join(".");
            this.opcode("pushId", "BlockParam", blockParamIndex, blockParamChild);
          } else {
            value = val.original || value;
            if (value.replace) {
              value = value.replace(/^this(?:\.|$)/, "").replace(/^\.\//, "").replace(/^\.$/, "");
            }
            this.opcode("pushId", val.type, value);
          }
        }
        this.accept(val);
      }
    },
    setupFullMustacheParams: function setupFullMustacheParams(sexpr, program2, inverse, omitEmpty) {
      var params = sexpr.params;
      this.pushParams(params);
      this.opcode("pushProgram", program2);
      this.opcode("pushProgram", inverse);
      if (sexpr.hash) {
        this.accept(sexpr.hash);
      } else {
        this.opcode("emptyHash", omitEmpty);
      }
      return params;
    },
    blockParamIndex: function blockParamIndex(name) {
      for (var depth = 0, len = this.options.blockParams.length;depth < len; depth++) {
        var blockParams = this.options.blockParams[depth], param = blockParams && _utils.indexOf(blockParams, name);
        if (blockParams && param >= 0) {
          return [depth, param];
        }
      }
    }
  };
  function precompile(input, options, env2) {
    if (input == null || typeof input !== "string" && input.type !== "Program") {
      throw new _exception2["default"]("You must pass a string or Handlebars AST to Handlebars.precompile. You passed " + input);
    }
    options = options || {};
    if (!("data" in options)) {
      options.data = true;
    }
    if (options.compat) {
      options.useDepths = true;
    }
    var ast = env2.parse(input, options), environment = new env2.Compiler().compile(ast, options);
    return new env2.JavaScriptCompiler().compile(environment, options);
  }
  function compile(input, options, env2) {
    if (options === undefined)
      options = {};
    if (input == null || typeof input !== "string" && input.type !== "Program") {
      throw new _exception2["default"]("You must pass a string or Handlebars AST to Handlebars.compile. You passed " + input);
    }
    options = _utils.extend({}, options);
    if (!("data" in options)) {
      options.data = true;
    }
    if (options.compat) {
      options.useDepths = true;
    }
    var compiled = undefined;
    function compileInput() {
      var ast = env2.parse(input, options), environment = new env2.Compiler().compile(ast, options), templateSpec = new env2.JavaScriptCompiler().compile(environment, options, undefined, true);
      return env2.template(templateSpec);
    }
    function ret(context, execOptions) {
      if (!compiled) {
        compiled = compileInput();
      }
      return compiled.call(this, context, execOptions);
    }
    ret._setup = function(setupOptions) {
      if (!compiled) {
        compiled = compileInput();
      }
      return compiled._setup(setupOptions);
    };
    ret._child = function(i, data, blockParams, depths) {
      if (!compiled) {
        compiled = compileInput();
      }
      return compiled._child(i, data, blockParams, depths);
    };
    return ret;
  }
  function argEquals(a, b) {
    if (a === b) {
      return true;
    }
    if (_utils.isArray(a) && _utils.isArray(b) && a.length === b.length) {
      for (var i = 0;i < a.length; i++) {
        if (!argEquals(a[i], b[i])) {
          return false;
        }
      }
      return true;
    }
  }
  function transformLiteralToPath(sexpr) {
    if (!sexpr.path.parts) {
      var literal = sexpr.path;
      sexpr.path = {
        type: "PathExpression",
        data: false,
        depth: 0,
        parts: [literal.original + ""],
        original: literal.original + "",
        loc: literal.loc
      };
    }
  }
});

// node_modules/.bun/source-map@0.6.1/node_modules/source-map/lib/base64.js
var require_base64 = __commonJS((exports) => {
  var intToCharMap = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".split("");
  exports.encode = function(number) {
    if (0 <= number && number < intToCharMap.length) {
      return intToCharMap[number];
    }
    throw new TypeError("Must be between 0 and 63: " + number);
  };
  exports.decode = function(charCode) {
    var bigA = 65;
    var bigZ = 90;
    var littleA = 97;
    var littleZ = 122;
    var zero = 48;
    var nine = 57;
    var plus = 43;
    var slash = 47;
    var littleOffset = 26;
    var numberOffset = 52;
    if (bigA <= charCode && charCode <= bigZ) {
      return charCode - bigA;
    }
    if (littleA <= charCode && charCode <= littleZ) {
      return charCode - littleA + littleOffset;
    }
    if (zero <= charCode && charCode <= nine) {
      return charCode - zero + numberOffset;
    }
    if (charCode == plus) {
      return 62;
    }
    if (charCode == slash) {
      return 63;
    }
    return -1;
  };
});

// node_modules/.bun/source-map@0.6.1/node_modules/source-map/lib/base64-vlq.js
var require_base64_vlq = __commonJS((exports) => {
  var base64 = require_base64();
  var VLQ_BASE_SHIFT = 5;
  var VLQ_BASE = 1 << VLQ_BASE_SHIFT;
  var VLQ_BASE_MASK = VLQ_BASE - 1;
  var VLQ_CONTINUATION_BIT = VLQ_BASE;
  function toVLQSigned(aValue) {
    return aValue < 0 ? (-aValue << 1) + 1 : (aValue << 1) + 0;
  }
  function fromVLQSigned(aValue) {
    var isNegative = (aValue & 1) === 1;
    var shifted = aValue >> 1;
    return isNegative ? -shifted : shifted;
  }
  exports.encode = function base64VLQ_encode(aValue) {
    var encoded = "";
    var digit;
    var vlq = toVLQSigned(aValue);
    do {
      digit = vlq & VLQ_BASE_MASK;
      vlq >>>= VLQ_BASE_SHIFT;
      if (vlq > 0) {
        digit |= VLQ_CONTINUATION_BIT;
      }
      encoded += base64.encode(digit);
    } while (vlq > 0);
    return encoded;
  };
  exports.decode = function base64VLQ_decode(aStr, aIndex, aOutParam) {
    var strLen = aStr.length;
    var result = 0;
    var shift = 0;
    var continuation, digit;
    do {
      if (aIndex >= strLen) {
        throw new Error("Expected more digits in base 64 VLQ value.");
      }
      digit = base64.decode(aStr.charCodeAt(aIndex++));
      if (digit === -1) {
        throw new Error("Invalid base64 digit: " + aStr.charAt(aIndex - 1));
      }
      continuation = !!(digit & VLQ_CONTINUATION_BIT);
      digit &= VLQ_BASE_MASK;
      result = result + (digit << shift);
      shift += VLQ_BASE_SHIFT;
    } while (continuation);
    aOutParam.value = fromVLQSigned(result);
    aOutParam.rest = aIndex;
  };
});

// node_modules/.bun/source-map@0.6.1/node_modules/source-map/lib/util.js
var require_util = __commonJS((exports) => {
  function getArg(aArgs, aName, aDefaultValue) {
    if (aName in aArgs) {
      return aArgs[aName];
    } else if (arguments.length === 3) {
      return aDefaultValue;
    } else {
      throw new Error('"' + aName + '" is a required argument.');
    }
  }
  exports.getArg = getArg;
  var urlRegexp = /^(?:([\w+\-.]+):)?\/\/(?:(\w+:\w+)@)?([\w.-]*)(?::(\d+))?(.*)$/;
  var dataUrlRegexp = /^data:.+\,.+$/;
  function urlParse(aUrl) {
    var match = aUrl.match(urlRegexp);
    if (!match) {
      return null;
    }
    return {
      scheme: match[1],
      auth: match[2],
      host: match[3],
      port: match[4],
      path: match[5]
    };
  }
  exports.urlParse = urlParse;
  function urlGenerate(aParsedUrl) {
    var url = "";
    if (aParsedUrl.scheme) {
      url += aParsedUrl.scheme + ":";
    }
    url += "//";
    if (aParsedUrl.auth) {
      url += aParsedUrl.auth + "@";
    }
    if (aParsedUrl.host) {
      url += aParsedUrl.host;
    }
    if (aParsedUrl.port) {
      url += ":" + aParsedUrl.port;
    }
    if (aParsedUrl.path) {
      url += aParsedUrl.path;
    }
    return url;
  }
  exports.urlGenerate = urlGenerate;
  function normalize(aPath) {
    var path = aPath;
    var url = urlParse(aPath);
    if (url) {
      if (!url.path) {
        return aPath;
      }
      path = url.path;
    }
    var isAbsolute = exports.isAbsolute(path);
    var parts = path.split(/\/+/);
    for (var part, up = 0, i = parts.length - 1;i >= 0; i--) {
      part = parts[i];
      if (part === ".") {
        parts.splice(i, 1);
      } else if (part === "..") {
        up++;
      } else if (up > 0) {
        if (part === "") {
          parts.splice(i + 1, up);
          up = 0;
        } else {
          parts.splice(i, 2);
          up--;
        }
      }
    }
    path = parts.join("/");
    if (path === "") {
      path = isAbsolute ? "/" : ".";
    }
    if (url) {
      url.path = path;
      return urlGenerate(url);
    }
    return path;
  }
  exports.normalize = normalize;
  function join29(aRoot, aPath) {
    if (aRoot === "") {
      aRoot = ".";
    }
    if (aPath === "") {
      aPath = ".";
    }
    var aPathUrl = urlParse(aPath);
    var aRootUrl = urlParse(aRoot);
    if (aRootUrl) {
      aRoot = aRootUrl.path || "/";
    }
    if (aPathUrl && !aPathUrl.scheme) {
      if (aRootUrl) {
        aPathUrl.scheme = aRootUrl.scheme;
      }
      return urlGenerate(aPathUrl);
    }
    if (aPathUrl || aPath.match(dataUrlRegexp)) {
      return aPath;
    }
    if (aRootUrl && !aRootUrl.host && !aRootUrl.path) {
      aRootUrl.host = aPath;
      return urlGenerate(aRootUrl);
    }
    var joined = aPath.charAt(0) === "/" ? aPath : normalize(aRoot.replace(/\/+$/, "") + "/" + aPath);
    if (aRootUrl) {
      aRootUrl.path = joined;
      return urlGenerate(aRootUrl);
    }
    return joined;
  }
  exports.join = join29;
  exports.isAbsolute = function(aPath) {
    return aPath.charAt(0) === "/" || urlRegexp.test(aPath);
  };
  function relative(aRoot, aPath) {
    if (aRoot === "") {
      aRoot = ".";
    }
    aRoot = aRoot.replace(/\/$/, "");
    var level = 0;
    while (aPath.indexOf(aRoot + "/") !== 0) {
      var index = aRoot.lastIndexOf("/");
      if (index < 0) {
        return aPath;
      }
      aRoot = aRoot.slice(0, index);
      if (aRoot.match(/^([^\/]+:\/)?\/*$/)) {
        return aPath;
      }
      ++level;
    }
    return Array(level + 1).join("../") + aPath.substr(aRoot.length + 1);
  }
  exports.relative = relative;
  var supportsNullProto = function() {
    var obj = Object.create(null);
    return !("__proto__" in obj);
  }();
  function identity(s) {
    return s;
  }
  function toSetString(aStr) {
    if (isProtoString(aStr)) {
      return "$" + aStr;
    }
    return aStr;
  }
  exports.toSetString = supportsNullProto ? identity : toSetString;
  function fromSetString(aStr) {
    if (isProtoString(aStr)) {
      return aStr.slice(1);
    }
    return aStr;
  }
  exports.fromSetString = supportsNullProto ? identity : fromSetString;
  function isProtoString(s) {
    if (!s) {
      return false;
    }
    var length = s.length;
    if (length < 9) {
      return false;
    }
    if (s.charCodeAt(length - 1) !== 95 || s.charCodeAt(length - 2) !== 95 || s.charCodeAt(length - 3) !== 111 || s.charCodeAt(length - 4) !== 116 || s.charCodeAt(length - 5) !== 111 || s.charCodeAt(length - 6) !== 114 || s.charCodeAt(length - 7) !== 112 || s.charCodeAt(length - 8) !== 95 || s.charCodeAt(length - 9) !== 95) {
      return false;
    }
    for (var i = length - 10;i >= 0; i--) {
      if (s.charCodeAt(i) !== 36) {
        return false;
      }
    }
    return true;
  }
  function compareByOriginalPositions(mappingA, mappingB, onlyCompareOriginal) {
    var cmp = strcmp(mappingA.source, mappingB.source);
    if (cmp !== 0) {
      return cmp;
    }
    cmp = mappingA.originalLine - mappingB.originalLine;
    if (cmp !== 0) {
      return cmp;
    }
    cmp = mappingA.originalColumn - mappingB.originalColumn;
    if (cmp !== 0 || onlyCompareOriginal) {
      return cmp;
    }
    cmp = mappingA.generatedColumn - mappingB.generatedColumn;
    if (cmp !== 0) {
      return cmp;
    }
    cmp = mappingA.generatedLine - mappingB.generatedLine;
    if (cmp !== 0) {
      return cmp;
    }
    return strcmp(mappingA.name, mappingB.name);
  }
  exports.compareByOriginalPositions = compareByOriginalPositions;
  function compareByGeneratedPositionsDeflated(mappingA, mappingB, onlyCompareGenerated) {
    var cmp = mappingA.generatedLine - mappingB.generatedLine;
    if (cmp !== 0) {
      return cmp;
    }
    cmp = mappingA.generatedColumn - mappingB.generatedColumn;
    if (cmp !== 0 || onlyCompareGenerated) {
      return cmp;
    }
    cmp = strcmp(mappingA.source, mappingB.source);
    if (cmp !== 0) {
      return cmp;
    }
    cmp = mappingA.originalLine - mappingB.originalLine;
    if (cmp !== 0) {
      return cmp;
    }
    cmp = mappingA.originalColumn - mappingB.originalColumn;
    if (cmp !== 0) {
      return cmp;
    }
    return strcmp(mappingA.name, mappingB.name);
  }
  exports.compareByGeneratedPositionsDeflated = compareByGeneratedPositionsDeflated;
  function strcmp(aStr1, aStr2) {
    if (aStr1 === aStr2) {
      return 0;
    }
    if (aStr1 === null) {
      return 1;
    }
    if (aStr2 === null) {
      return -1;
    }
    if (aStr1 > aStr2) {
      return 1;
    }
    return -1;
  }
  function compareByGeneratedPositionsInflated(mappingA, mappingB) {
    var cmp = mappingA.generatedLine - mappingB.generatedLine;
    if (cmp !== 0) {
      return cmp;
    }
    cmp = mappingA.generatedColumn - mappingB.generatedColumn;
    if (cmp !== 0) {
      return cmp;
    }
    cmp = strcmp(mappingA.source, mappingB.source);
    if (cmp !== 0) {
      return cmp;
    }
    cmp = mappingA.originalLine - mappingB.originalLine;
    if (cmp !== 0) {
      return cmp;
    }
    cmp = mappingA.originalColumn - mappingB.originalColumn;
    if (cmp !== 0) {
      return cmp;
    }
    return strcmp(mappingA.name, mappingB.name);
  }
  exports.compareByGeneratedPositionsInflated = compareByGeneratedPositionsInflated;
  function parseSourceMapInput(str) {
    return JSON.parse(str.replace(/^\)]}'[^\n]*\n/, ""));
  }
  exports.parseSourceMapInput = parseSourceMapInput;
  function computeSourceURL(sourceRoot, sourceURL, sourceMapURL) {
    sourceURL = sourceURL || "";
    if (sourceRoot) {
      if (sourceRoot[sourceRoot.length - 1] !== "/" && sourceURL[0] !== "/") {
        sourceRoot += "/";
      }
      sourceURL = sourceRoot + sourceURL;
    }
    if (sourceMapURL) {
      var parsed = urlParse(sourceMapURL);
      if (!parsed) {
        throw new Error("sourceMapURL could not be parsed");
      }
      if (parsed.path) {
        var index = parsed.path.lastIndexOf("/");
        if (index >= 0) {
          parsed.path = parsed.path.substring(0, index + 1);
        }
      }
      sourceURL = join29(urlGenerate(parsed), sourceURL);
    }
    return normalize(sourceURL);
  }
  exports.computeSourceURL = computeSourceURL;
});

// node_modules/.bun/source-map@0.6.1/node_modules/source-map/lib/array-set.js
var require_array_set = __commonJS((exports) => {
  var util = require_util();
  var has = Object.prototype.hasOwnProperty;
  var hasNativeMap = typeof Map !== "undefined";
  function ArraySet() {
    this._array = [];
    this._set = hasNativeMap ? new Map : Object.create(null);
  }
  ArraySet.fromArray = function ArraySet_fromArray(aArray, aAllowDuplicates) {
    var set = new ArraySet;
    for (var i = 0, len = aArray.length;i < len; i++) {
      set.add(aArray[i], aAllowDuplicates);
    }
    return set;
  };
  ArraySet.prototype.size = function ArraySet_size() {
    return hasNativeMap ? this._set.size : Object.getOwnPropertyNames(this._set).length;
  };
  ArraySet.prototype.add = function ArraySet_add(aStr, aAllowDuplicates) {
    var sStr = hasNativeMap ? aStr : util.toSetString(aStr);
    var isDuplicate = hasNativeMap ? this.has(aStr) : has.call(this._set, sStr);
    var idx = this._array.length;
    if (!isDuplicate || aAllowDuplicates) {
      this._array.push(aStr);
    }
    if (!isDuplicate) {
      if (hasNativeMap) {
        this._set.set(aStr, idx);
      } else {
        this._set[sStr] = idx;
      }
    }
  };
  ArraySet.prototype.has = function ArraySet_has(aStr) {
    if (hasNativeMap) {
      return this._set.has(aStr);
    } else {
      var sStr = util.toSetString(aStr);
      return has.call(this._set, sStr);
    }
  };
  ArraySet.prototype.indexOf = function ArraySet_indexOf(aStr) {
    if (hasNativeMap) {
      var idx = this._set.get(aStr);
      if (idx >= 0) {
        return idx;
      }
    } else {
      var sStr = util.toSetString(aStr);
      if (has.call(this._set, sStr)) {
        return this._set[sStr];
      }
    }
    throw new Error('"' + aStr + '" is not in the set.');
  };
  ArraySet.prototype.at = function ArraySet_at(aIdx) {
    if (aIdx >= 0 && aIdx < this._array.length) {
      return this._array[aIdx];
    }
    throw new Error("No element indexed by " + aIdx);
  };
  ArraySet.prototype.toArray = function ArraySet_toArray() {
    return this._array.slice();
  };
  exports.ArraySet = ArraySet;
});

// node_modules/.bun/source-map@0.6.1/node_modules/source-map/lib/mapping-list.js
var require_mapping_list = __commonJS((exports) => {
  var util = require_util();
  function generatedPositionAfter(mappingA, mappingB) {
    var lineA = mappingA.generatedLine;
    var lineB = mappingB.generatedLine;
    var columnA = mappingA.generatedColumn;
    var columnB = mappingB.generatedColumn;
    return lineB > lineA || lineB == lineA && columnB >= columnA || util.compareByGeneratedPositionsInflated(mappingA, mappingB) <= 0;
  }
  function MappingList() {
    this._array = [];
    this._sorted = true;
    this._last = { generatedLine: -1, generatedColumn: 0 };
  }
  MappingList.prototype.unsortedForEach = function MappingList_forEach(aCallback, aThisArg) {
    this._array.forEach(aCallback, aThisArg);
  };
  MappingList.prototype.add = function MappingList_add(aMapping) {
    if (generatedPositionAfter(this._last, aMapping)) {
      this._last = aMapping;
      this._array.push(aMapping);
    } else {
      this._sorted = false;
      this._array.push(aMapping);
    }
  };
  MappingList.prototype.toArray = function MappingList_toArray() {
    if (!this._sorted) {
      this._array.sort(util.compareByGeneratedPositionsInflated);
      this._sorted = true;
    }
    return this._array;
  };
  exports.MappingList = MappingList;
});

// node_modules/.bun/source-map@0.6.1/node_modules/source-map/lib/source-map-generator.js
var require_source_map_generator = __commonJS((exports) => {
  var base64VLQ = require_base64_vlq();
  var util = require_util();
  var ArraySet = require_array_set().ArraySet;
  var MappingList = require_mapping_list().MappingList;
  function SourceMapGenerator(aArgs) {
    if (!aArgs) {
      aArgs = {};
    }
    this._file = util.getArg(aArgs, "file", null);
    this._sourceRoot = util.getArg(aArgs, "sourceRoot", null);
    this._skipValidation = util.getArg(aArgs, "skipValidation", false);
    this._sources = new ArraySet;
    this._names = new ArraySet;
    this._mappings = new MappingList;
    this._sourcesContents = null;
  }
  SourceMapGenerator.prototype._version = 3;
  SourceMapGenerator.fromSourceMap = function SourceMapGenerator_fromSourceMap(aSourceMapConsumer) {
    var sourceRoot = aSourceMapConsumer.sourceRoot;
    var generator = new SourceMapGenerator({
      file: aSourceMapConsumer.file,
      sourceRoot
    });
    aSourceMapConsumer.eachMapping(function(mapping) {
      var newMapping = {
        generated: {
          line: mapping.generatedLine,
          column: mapping.generatedColumn
        }
      };
      if (mapping.source != null) {
        newMapping.source = mapping.source;
        if (sourceRoot != null) {
          newMapping.source = util.relative(sourceRoot, newMapping.source);
        }
        newMapping.original = {
          line: mapping.originalLine,
          column: mapping.originalColumn
        };
        if (mapping.name != null) {
          newMapping.name = mapping.name;
        }
      }
      generator.addMapping(newMapping);
    });
    aSourceMapConsumer.sources.forEach(function(sourceFile) {
      var sourceRelative = sourceFile;
      if (sourceRoot !== null) {
        sourceRelative = util.relative(sourceRoot, sourceFile);
      }
      if (!generator._sources.has(sourceRelative)) {
        generator._sources.add(sourceRelative);
      }
      var content = aSourceMapConsumer.sourceContentFor(sourceFile);
      if (content != null) {
        generator.setSourceContent(sourceFile, content);
      }
    });
    return generator;
  };
  SourceMapGenerator.prototype.addMapping = function SourceMapGenerator_addMapping(aArgs) {
    var generated = util.getArg(aArgs, "generated");
    var original = util.getArg(aArgs, "original", null);
    var source = util.getArg(aArgs, "source", null);
    var name = util.getArg(aArgs, "name", null);
    if (!this._skipValidation) {
      this._validateMapping(generated, original, source, name);
    }
    if (source != null) {
      source = String(source);
      if (!this._sources.has(source)) {
        this._sources.add(source);
      }
    }
    if (name != null) {
      name = String(name);
      if (!this._names.has(name)) {
        this._names.add(name);
      }
    }
    this._mappings.add({
      generatedLine: generated.line,
      generatedColumn: generated.column,
      originalLine: original != null && original.line,
      originalColumn: original != null && original.column,
      source,
      name
    });
  };
  SourceMapGenerator.prototype.setSourceContent = function SourceMapGenerator_setSourceContent(aSourceFile, aSourceContent) {
    var source = aSourceFile;
    if (this._sourceRoot != null) {
      source = util.relative(this._sourceRoot, source);
    }
    if (aSourceContent != null) {
      if (!this._sourcesContents) {
        this._sourcesContents = Object.create(null);
      }
      this._sourcesContents[util.toSetString(source)] = aSourceContent;
    } else if (this._sourcesContents) {
      delete this._sourcesContents[util.toSetString(source)];
      if (Object.keys(this._sourcesContents).length === 0) {
        this._sourcesContents = null;
      }
    }
  };
  SourceMapGenerator.prototype.applySourceMap = function SourceMapGenerator_applySourceMap(aSourceMapConsumer, aSourceFile, aSourceMapPath) {
    var sourceFile = aSourceFile;
    if (aSourceFile == null) {
      if (aSourceMapConsumer.file == null) {
        throw new Error("SourceMapGenerator.prototype.applySourceMap requires either an explicit source file, " + `or the source map's "file" property. Both were omitted.`);
      }
      sourceFile = aSourceMapConsumer.file;
    }
    var sourceRoot = this._sourceRoot;
    if (sourceRoot != null) {
      sourceFile = util.relative(sourceRoot, sourceFile);
    }
    var newSources = new ArraySet;
    var newNames = new ArraySet;
    this._mappings.unsortedForEach(function(mapping) {
      if (mapping.source === sourceFile && mapping.originalLine != null) {
        var original = aSourceMapConsumer.originalPositionFor({
          line: mapping.originalLine,
          column: mapping.originalColumn
        });
        if (original.source != null) {
          mapping.source = original.source;
          if (aSourceMapPath != null) {
            mapping.source = util.join(aSourceMapPath, mapping.source);
          }
          if (sourceRoot != null) {
            mapping.source = util.relative(sourceRoot, mapping.source);
          }
          mapping.originalLine = original.line;
          mapping.originalColumn = original.column;
          if (original.name != null) {
            mapping.name = original.name;
          }
        }
      }
      var source = mapping.source;
      if (source != null && !newSources.has(source)) {
        newSources.add(source);
      }
      var name = mapping.name;
      if (name != null && !newNames.has(name)) {
        newNames.add(name);
      }
    }, this);
    this._sources = newSources;
    this._names = newNames;
    aSourceMapConsumer.sources.forEach(function(sourceFile2) {
      var content = aSourceMapConsumer.sourceContentFor(sourceFile2);
      if (content != null) {
        if (aSourceMapPath != null) {
          sourceFile2 = util.join(aSourceMapPath, sourceFile2);
        }
        if (sourceRoot != null) {
          sourceFile2 = util.relative(sourceRoot, sourceFile2);
        }
        this.setSourceContent(sourceFile2, content);
      }
    }, this);
  };
  SourceMapGenerator.prototype._validateMapping = function SourceMapGenerator_validateMapping(aGenerated, aOriginal, aSource, aName) {
    if (aOriginal && typeof aOriginal.line !== "number" && typeof aOriginal.column !== "number") {
      throw new Error("original.line and original.column are not numbers -- you probably meant to omit " + "the original mapping entirely and only map the generated position. If so, pass " + "null for the original mapping instead of an object with empty or null values.");
    }
    if (aGenerated && "line" in aGenerated && "column" in aGenerated && aGenerated.line > 0 && aGenerated.column >= 0 && !aOriginal && !aSource && !aName) {
      return;
    } else if (aGenerated && "line" in aGenerated && "column" in aGenerated && aOriginal && "line" in aOriginal && "column" in aOriginal && aGenerated.line > 0 && aGenerated.column >= 0 && aOriginal.line > 0 && aOriginal.column >= 0 && aSource) {
      return;
    } else {
      throw new Error("Invalid mapping: " + JSON.stringify({
        generated: aGenerated,
        source: aSource,
        original: aOriginal,
        name: aName
      }));
    }
  };
  SourceMapGenerator.prototype._serializeMappings = function SourceMapGenerator_serializeMappings() {
    var previousGeneratedColumn = 0;
    var previousGeneratedLine = 1;
    var previousOriginalColumn = 0;
    var previousOriginalLine = 0;
    var previousName = 0;
    var previousSource = 0;
    var result = "";
    var next;
    var mapping;
    var nameIdx;
    var sourceIdx;
    var mappings = this._mappings.toArray();
    for (var i = 0, len = mappings.length;i < len; i++) {
      mapping = mappings[i];
      next = "";
      if (mapping.generatedLine !== previousGeneratedLine) {
        previousGeneratedColumn = 0;
        while (mapping.generatedLine !== previousGeneratedLine) {
          next += ";";
          previousGeneratedLine++;
        }
      } else {
        if (i > 0) {
          if (!util.compareByGeneratedPositionsInflated(mapping, mappings[i - 1])) {
            continue;
          }
          next += ",";
        }
      }
      next += base64VLQ.encode(mapping.generatedColumn - previousGeneratedColumn);
      previousGeneratedColumn = mapping.generatedColumn;
      if (mapping.source != null) {
        sourceIdx = this._sources.indexOf(mapping.source);
        next += base64VLQ.encode(sourceIdx - previousSource);
        previousSource = sourceIdx;
        next += base64VLQ.encode(mapping.originalLine - 1 - previousOriginalLine);
        previousOriginalLine = mapping.originalLine - 1;
        next += base64VLQ.encode(mapping.originalColumn - previousOriginalColumn);
        previousOriginalColumn = mapping.originalColumn;
        if (mapping.name != null) {
          nameIdx = this._names.indexOf(mapping.name);
          next += base64VLQ.encode(nameIdx - previousName);
          previousName = nameIdx;
        }
      }
      result += next;
    }
    return result;
  };
  SourceMapGenerator.prototype._generateSourcesContent = function SourceMapGenerator_generateSourcesContent(aSources, aSourceRoot) {
    return aSources.map(function(source) {
      if (!this._sourcesContents) {
        return null;
      }
      if (aSourceRoot != null) {
        source = util.relative(aSourceRoot, source);
      }
      var key = util.toSetString(source);
      return Object.prototype.hasOwnProperty.call(this._sourcesContents, key) ? this._sourcesContents[key] : null;
    }, this);
  };
  SourceMapGenerator.prototype.toJSON = function SourceMapGenerator_toJSON() {
    var map = {
      version: this._version,
      sources: this._sources.toArray(),
      names: this._names.toArray(),
      mappings: this._serializeMappings()
    };
    if (this._file != null) {
      map.file = this._file;
    }
    if (this._sourceRoot != null) {
      map.sourceRoot = this._sourceRoot;
    }
    if (this._sourcesContents) {
      map.sourcesContent = this._generateSourcesContent(map.sources, map.sourceRoot);
    }
    return map;
  };
  SourceMapGenerator.prototype.toString = function SourceMapGenerator_toString() {
    return JSON.stringify(this.toJSON());
  };
  exports.SourceMapGenerator = SourceMapGenerator;
});

// node_modules/.bun/source-map@0.6.1/node_modules/source-map/lib/binary-search.js
var require_binary_search = __commonJS((exports) => {
  exports.GREATEST_LOWER_BOUND = 1;
  exports.LEAST_UPPER_BOUND = 2;
  function recursiveSearch(aLow, aHigh, aNeedle, aHaystack, aCompare, aBias) {
    var mid = Math.floor((aHigh - aLow) / 2) + aLow;
    var cmp = aCompare(aNeedle, aHaystack[mid], true);
    if (cmp === 0) {
      return mid;
    } else if (cmp > 0) {
      if (aHigh - mid > 1) {
        return recursiveSearch(mid, aHigh, aNeedle, aHaystack, aCompare, aBias);
      }
      if (aBias == exports.LEAST_UPPER_BOUND) {
        return aHigh < aHaystack.length ? aHigh : -1;
      } else {
        return mid;
      }
    } else {
      if (mid - aLow > 1) {
        return recursiveSearch(aLow, mid, aNeedle, aHaystack, aCompare, aBias);
      }
      if (aBias == exports.LEAST_UPPER_BOUND) {
        return mid;
      } else {
        return aLow < 0 ? -1 : aLow;
      }
    }
  }
  exports.search = function search(aNeedle, aHaystack, aCompare, aBias) {
    if (aHaystack.length === 0) {
      return -1;
    }
    var index = recursiveSearch(-1, aHaystack.length, aNeedle, aHaystack, aCompare, aBias || exports.GREATEST_LOWER_BOUND);
    if (index < 0) {
      return -1;
    }
    while (index - 1 >= 0) {
      if (aCompare(aHaystack[index], aHaystack[index - 1], true) !== 0) {
        break;
      }
      --index;
    }
    return index;
  };
});

// node_modules/.bun/source-map@0.6.1/node_modules/source-map/lib/quick-sort.js
var require_quick_sort = __commonJS((exports) => {
  function swap(ary, x, y) {
    var temp = ary[x];
    ary[x] = ary[y];
    ary[y] = temp;
  }
  function randomIntInRange(low, high) {
    return Math.round(low + Math.random() * (high - low));
  }
  function doQuickSort(ary, comparator, p, r) {
    if (p < r) {
      var pivotIndex = randomIntInRange(p, r);
      var i = p - 1;
      swap(ary, pivotIndex, r);
      var pivot = ary[r];
      for (var j = p;j < r; j++) {
        if (comparator(ary[j], pivot) <= 0) {
          i += 1;
          swap(ary, i, j);
        }
      }
      swap(ary, i + 1, j);
      var q = i + 1;
      doQuickSort(ary, comparator, p, q - 1);
      doQuickSort(ary, comparator, q + 1, r);
    }
  }
  exports.quickSort = function(ary, comparator) {
    doQuickSort(ary, comparator, 0, ary.length - 1);
  };
});

// node_modules/.bun/source-map@0.6.1/node_modules/source-map/lib/source-map-consumer.js
var require_source_map_consumer = __commonJS((exports) => {
  var util = require_util();
  var binarySearch = require_binary_search();
  var ArraySet = require_array_set().ArraySet;
  var base64VLQ = require_base64_vlq();
  var quickSort = require_quick_sort().quickSort;
  function SourceMapConsumer(aSourceMap, aSourceMapURL) {
    var sourceMap = aSourceMap;
    if (typeof aSourceMap === "string") {
      sourceMap = util.parseSourceMapInput(aSourceMap);
    }
    return sourceMap.sections != null ? new IndexedSourceMapConsumer(sourceMap, aSourceMapURL) : new BasicSourceMapConsumer(sourceMap, aSourceMapURL);
  }
  SourceMapConsumer.fromSourceMap = function(aSourceMap, aSourceMapURL) {
    return BasicSourceMapConsumer.fromSourceMap(aSourceMap, aSourceMapURL);
  };
  SourceMapConsumer.prototype._version = 3;
  SourceMapConsumer.prototype.__generatedMappings = null;
  Object.defineProperty(SourceMapConsumer.prototype, "_generatedMappings", {
    configurable: true,
    enumerable: true,
    get: function() {
      if (!this.__generatedMappings) {
        this._parseMappings(this._mappings, this.sourceRoot);
      }
      return this.__generatedMappings;
    }
  });
  SourceMapConsumer.prototype.__originalMappings = null;
  Object.defineProperty(SourceMapConsumer.prototype, "_originalMappings", {
    configurable: true,
    enumerable: true,
    get: function() {
      if (!this.__originalMappings) {
        this._parseMappings(this._mappings, this.sourceRoot);
      }
      return this.__originalMappings;
    }
  });
  SourceMapConsumer.prototype._charIsMappingSeparator = function SourceMapConsumer_charIsMappingSeparator(aStr, index) {
    var c = aStr.charAt(index);
    return c === ";" || c === ",";
  };
  SourceMapConsumer.prototype._parseMappings = function SourceMapConsumer_parseMappings(aStr, aSourceRoot) {
    throw new Error("Subclasses must implement _parseMappings");
  };
  SourceMapConsumer.GENERATED_ORDER = 1;
  SourceMapConsumer.ORIGINAL_ORDER = 2;
  SourceMapConsumer.GREATEST_LOWER_BOUND = 1;
  SourceMapConsumer.LEAST_UPPER_BOUND = 2;
  SourceMapConsumer.prototype.eachMapping = function SourceMapConsumer_eachMapping(aCallback, aContext, aOrder) {
    var context = aContext || null;
    var order = aOrder || SourceMapConsumer.GENERATED_ORDER;
    var mappings;
    switch (order) {
      case SourceMapConsumer.GENERATED_ORDER:
        mappings = this._generatedMappings;
        break;
      case SourceMapConsumer.ORIGINAL_ORDER:
        mappings = this._originalMappings;
        break;
      default:
        throw new Error("Unknown order of iteration.");
    }
    var sourceRoot = this.sourceRoot;
    mappings.map(function(mapping) {
      var source = mapping.source === null ? null : this._sources.at(mapping.source);
      source = util.computeSourceURL(sourceRoot, source, this._sourceMapURL);
      return {
        source,
        generatedLine: mapping.generatedLine,
        generatedColumn: mapping.generatedColumn,
        originalLine: mapping.originalLine,
        originalColumn: mapping.originalColumn,
        name: mapping.name === null ? null : this._names.at(mapping.name)
      };
    }, this).forEach(aCallback, context);
  };
  SourceMapConsumer.prototype.allGeneratedPositionsFor = function SourceMapConsumer_allGeneratedPositionsFor(aArgs) {
    var line = util.getArg(aArgs, "line");
    var needle = {
      source: util.getArg(aArgs, "source"),
      originalLine: line,
      originalColumn: util.getArg(aArgs, "column", 0)
    };
    needle.source = this._findSourceIndex(needle.source);
    if (needle.source < 0) {
      return [];
    }
    var mappings = [];
    var index = this._findMapping(needle, this._originalMappings, "originalLine", "originalColumn", util.compareByOriginalPositions, binarySearch.LEAST_UPPER_BOUND);
    if (index >= 0) {
      var mapping = this._originalMappings[index];
      if (aArgs.column === undefined) {
        var originalLine = mapping.originalLine;
        while (mapping && mapping.originalLine === originalLine) {
          mappings.push({
            line: util.getArg(mapping, "generatedLine", null),
            column: util.getArg(mapping, "generatedColumn", null),
            lastColumn: util.getArg(mapping, "lastGeneratedColumn", null)
          });
          mapping = this._originalMappings[++index];
        }
      } else {
        var originalColumn = mapping.originalColumn;
        while (mapping && mapping.originalLine === line && mapping.originalColumn == originalColumn) {
          mappings.push({
            line: util.getArg(mapping, "generatedLine", null),
            column: util.getArg(mapping, "generatedColumn", null),
            lastColumn: util.getArg(mapping, "lastGeneratedColumn", null)
          });
          mapping = this._originalMappings[++index];
        }
      }
    }
    return mappings;
  };
  exports.SourceMapConsumer = SourceMapConsumer;
  function BasicSourceMapConsumer(aSourceMap, aSourceMapURL) {
    var sourceMap = aSourceMap;
    if (typeof aSourceMap === "string") {
      sourceMap = util.parseSourceMapInput(aSourceMap);
    }
    var version = util.getArg(sourceMap, "version");
    var sources = util.getArg(sourceMap, "sources");
    var names = util.getArg(sourceMap, "names", []);
    var sourceRoot = util.getArg(sourceMap, "sourceRoot", null);
    var sourcesContent = util.getArg(sourceMap, "sourcesContent", null);
    var mappings = util.getArg(sourceMap, "mappings");
    var file = util.getArg(sourceMap, "file", null);
    if (version != this._version) {
      throw new Error("Unsupported version: " + version);
    }
    if (sourceRoot) {
      sourceRoot = util.normalize(sourceRoot);
    }
    sources = sources.map(String).map(util.normalize).map(function(source) {
      return sourceRoot && util.isAbsolute(sourceRoot) && util.isAbsolute(source) ? util.relative(sourceRoot, source) : source;
    });
    this._names = ArraySet.fromArray(names.map(String), true);
    this._sources = ArraySet.fromArray(sources, true);
    this._absoluteSources = this._sources.toArray().map(function(s) {
      return util.computeSourceURL(sourceRoot, s, aSourceMapURL);
    });
    this.sourceRoot = sourceRoot;
    this.sourcesContent = sourcesContent;
    this._mappings = mappings;
    this._sourceMapURL = aSourceMapURL;
    this.file = file;
  }
  BasicSourceMapConsumer.prototype = Object.create(SourceMapConsumer.prototype);
  BasicSourceMapConsumer.prototype.consumer = SourceMapConsumer;
  BasicSourceMapConsumer.prototype._findSourceIndex = function(aSource) {
    var relativeSource = aSource;
    if (this.sourceRoot != null) {
      relativeSource = util.relative(this.sourceRoot, relativeSource);
    }
    if (this._sources.has(relativeSource)) {
      return this._sources.indexOf(relativeSource);
    }
    var i;
    for (i = 0;i < this._absoluteSources.length; ++i) {
      if (this._absoluteSources[i] == aSource) {
        return i;
      }
    }
    return -1;
  };
  BasicSourceMapConsumer.fromSourceMap = function SourceMapConsumer_fromSourceMap(aSourceMap, aSourceMapURL) {
    var smc = Object.create(BasicSourceMapConsumer.prototype);
    var names = smc._names = ArraySet.fromArray(aSourceMap._names.toArray(), true);
    var sources = smc._sources = ArraySet.fromArray(aSourceMap._sources.toArray(), true);
    smc.sourceRoot = aSourceMap._sourceRoot;
    smc.sourcesContent = aSourceMap._generateSourcesContent(smc._sources.toArray(), smc.sourceRoot);
    smc.file = aSourceMap._file;
    smc._sourceMapURL = aSourceMapURL;
    smc._absoluteSources = smc._sources.toArray().map(function(s) {
      return util.computeSourceURL(smc.sourceRoot, s, aSourceMapURL);
    });
    var generatedMappings = aSourceMap._mappings.toArray().slice();
    var destGeneratedMappings = smc.__generatedMappings = [];
    var destOriginalMappings = smc.__originalMappings = [];
    for (var i = 0, length = generatedMappings.length;i < length; i++) {
      var srcMapping = generatedMappings[i];
      var destMapping = new Mapping;
      destMapping.generatedLine = srcMapping.generatedLine;
      destMapping.generatedColumn = srcMapping.generatedColumn;
      if (srcMapping.source) {
        destMapping.source = sources.indexOf(srcMapping.source);
        destMapping.originalLine = srcMapping.originalLine;
        destMapping.originalColumn = srcMapping.originalColumn;
        if (srcMapping.name) {
          destMapping.name = names.indexOf(srcMapping.name);
        }
        destOriginalMappings.push(destMapping);
      }
      destGeneratedMappings.push(destMapping);
    }
    quickSort(smc.__originalMappings, util.compareByOriginalPositions);
    return smc;
  };
  BasicSourceMapConsumer.prototype._version = 3;
  Object.defineProperty(BasicSourceMapConsumer.prototype, "sources", {
    get: function() {
      return this._absoluteSources.slice();
    }
  });
  function Mapping() {
    this.generatedLine = 0;
    this.generatedColumn = 0;
    this.source = null;
    this.originalLine = null;
    this.originalColumn = null;
    this.name = null;
  }
  BasicSourceMapConsumer.prototype._parseMappings = function SourceMapConsumer_parseMappings(aStr, aSourceRoot) {
    var generatedLine = 1;
    var previousGeneratedColumn = 0;
    var previousOriginalLine = 0;
    var previousOriginalColumn = 0;
    var previousSource = 0;
    var previousName = 0;
    var length = aStr.length;
    var index = 0;
    var cachedSegments = {};
    var temp = {};
    var originalMappings = [];
    var generatedMappings = [];
    var mapping, str, segment, end, value;
    while (index < length) {
      if (aStr.charAt(index) === ";") {
        generatedLine++;
        index++;
        previousGeneratedColumn = 0;
      } else if (aStr.charAt(index) === ",") {
        index++;
      } else {
        mapping = new Mapping;
        mapping.generatedLine = generatedLine;
        for (end = index;end < length; end++) {
          if (this._charIsMappingSeparator(aStr, end)) {
            break;
          }
        }
        str = aStr.slice(index, end);
        segment = cachedSegments[str];
        if (segment) {
          index += str.length;
        } else {
          segment = [];
          while (index < end) {
            base64VLQ.decode(aStr, index, temp);
            value = temp.value;
            index = temp.rest;
            segment.push(value);
          }
          if (segment.length === 2) {
            throw new Error("Found a source, but no line and column");
          }
          if (segment.length === 3) {
            throw new Error("Found a source and line, but no column");
          }
          cachedSegments[str] = segment;
        }
        mapping.generatedColumn = previousGeneratedColumn + segment[0];
        previousGeneratedColumn = mapping.generatedColumn;
        if (segment.length > 1) {
          mapping.source = previousSource + segment[1];
          previousSource += segment[1];
          mapping.originalLine = previousOriginalLine + segment[2];
          previousOriginalLine = mapping.originalLine;
          mapping.originalLine += 1;
          mapping.originalColumn = previousOriginalColumn + segment[3];
          previousOriginalColumn = mapping.originalColumn;
          if (segment.length > 4) {
            mapping.name = previousName + segment[4];
            previousName += segment[4];
          }
        }
        generatedMappings.push(mapping);
        if (typeof mapping.originalLine === "number") {
          originalMappings.push(mapping);
        }
      }
    }
    quickSort(generatedMappings, util.compareByGeneratedPositionsDeflated);
    this.__generatedMappings = generatedMappings;
    quickSort(originalMappings, util.compareByOriginalPositions);
    this.__originalMappings = originalMappings;
  };
  BasicSourceMapConsumer.prototype._findMapping = function SourceMapConsumer_findMapping(aNeedle, aMappings, aLineName, aColumnName, aComparator, aBias) {
    if (aNeedle[aLineName] <= 0) {
      throw new TypeError("Line must be greater than or equal to 1, got " + aNeedle[aLineName]);
    }
    if (aNeedle[aColumnName] < 0) {
      throw new TypeError("Column must be greater than or equal to 0, got " + aNeedle[aColumnName]);
    }
    return binarySearch.search(aNeedle, aMappings, aComparator, aBias);
  };
  BasicSourceMapConsumer.prototype.computeColumnSpans = function SourceMapConsumer_computeColumnSpans() {
    for (var index = 0;index < this._generatedMappings.length; ++index) {
      var mapping = this._generatedMappings[index];
      if (index + 1 < this._generatedMappings.length) {
        var nextMapping = this._generatedMappings[index + 1];
        if (mapping.generatedLine === nextMapping.generatedLine) {
          mapping.lastGeneratedColumn = nextMapping.generatedColumn - 1;
          continue;
        }
      }
      mapping.lastGeneratedColumn = Infinity;
    }
  };
  BasicSourceMapConsumer.prototype.originalPositionFor = function SourceMapConsumer_originalPositionFor(aArgs) {
    var needle = {
      generatedLine: util.getArg(aArgs, "line"),
      generatedColumn: util.getArg(aArgs, "column")
    };
    var index = this._findMapping(needle, this._generatedMappings, "generatedLine", "generatedColumn", util.compareByGeneratedPositionsDeflated, util.getArg(aArgs, "bias", SourceMapConsumer.GREATEST_LOWER_BOUND));
    if (index >= 0) {
      var mapping = this._generatedMappings[index];
      if (mapping.generatedLine === needle.generatedLine) {
        var source = util.getArg(mapping, "source", null);
        if (source !== null) {
          source = this._sources.at(source);
          source = util.computeSourceURL(this.sourceRoot, source, this._sourceMapURL);
        }
        var name = util.getArg(mapping, "name", null);
        if (name !== null) {
          name = this._names.at(name);
        }
        return {
          source,
          line: util.getArg(mapping, "originalLine", null),
          column: util.getArg(mapping, "originalColumn", null),
          name
        };
      }
    }
    return {
      source: null,
      line: null,
      column: null,
      name: null
    };
  };
  BasicSourceMapConsumer.prototype.hasContentsOfAllSources = function BasicSourceMapConsumer_hasContentsOfAllSources() {
    if (!this.sourcesContent) {
      return false;
    }
    return this.sourcesContent.length >= this._sources.size() && !this.sourcesContent.some(function(sc) {
      return sc == null;
    });
  };
  BasicSourceMapConsumer.prototype.sourceContentFor = function SourceMapConsumer_sourceContentFor(aSource, nullOnMissing) {
    if (!this.sourcesContent) {
      return null;
    }
    var index = this._findSourceIndex(aSource);
    if (index >= 0) {
      return this.sourcesContent[index];
    }
    var relativeSource = aSource;
    if (this.sourceRoot != null) {
      relativeSource = util.relative(this.sourceRoot, relativeSource);
    }
    var url;
    if (this.sourceRoot != null && (url = util.urlParse(this.sourceRoot))) {
      var fileUriAbsPath = relativeSource.replace(/^file:\/\//, "");
      if (url.scheme == "file" && this._sources.has(fileUriAbsPath)) {
        return this.sourcesContent[this._sources.indexOf(fileUriAbsPath)];
      }
      if ((!url.path || url.path == "/") && this._sources.has("/" + relativeSource)) {
        return this.sourcesContent[this._sources.indexOf("/" + relativeSource)];
      }
    }
    if (nullOnMissing) {
      return null;
    } else {
      throw new Error('"' + relativeSource + '" is not in the SourceMap.');
    }
  };
  BasicSourceMapConsumer.prototype.generatedPositionFor = function SourceMapConsumer_generatedPositionFor(aArgs) {
    var source = util.getArg(aArgs, "source");
    source = this._findSourceIndex(source);
    if (source < 0) {
      return {
        line: null,
        column: null,
        lastColumn: null
      };
    }
    var needle = {
      source,
      originalLine: util.getArg(aArgs, "line"),
      originalColumn: util.getArg(aArgs, "column")
    };
    var index = this._findMapping(needle, this._originalMappings, "originalLine", "originalColumn", util.compareByOriginalPositions, util.getArg(aArgs, "bias", SourceMapConsumer.GREATEST_LOWER_BOUND));
    if (index >= 0) {
      var mapping = this._originalMappings[index];
      if (mapping.source === needle.source) {
        return {
          line: util.getArg(mapping, "generatedLine", null),
          column: util.getArg(mapping, "generatedColumn", null),
          lastColumn: util.getArg(mapping, "lastGeneratedColumn", null)
        };
      }
    }
    return {
      line: null,
      column: null,
      lastColumn: null
    };
  };
  exports.BasicSourceMapConsumer = BasicSourceMapConsumer;
  function IndexedSourceMapConsumer(aSourceMap, aSourceMapURL) {
    var sourceMap = aSourceMap;
    if (typeof aSourceMap === "string") {
      sourceMap = util.parseSourceMapInput(aSourceMap);
    }
    var version = util.getArg(sourceMap, "version");
    var sections = util.getArg(sourceMap, "sections");
    if (version != this._version) {
      throw new Error("Unsupported version: " + version);
    }
    this._sources = new ArraySet;
    this._names = new ArraySet;
    var lastOffset = {
      line: -1,
      column: 0
    };
    this._sections = sections.map(function(s) {
      if (s.url) {
        throw new Error("Support for url field in sections not implemented.");
      }
      var offset = util.getArg(s, "offset");
      var offsetLine = util.getArg(offset, "line");
      var offsetColumn = util.getArg(offset, "column");
      if (offsetLine < lastOffset.line || offsetLine === lastOffset.line && offsetColumn < lastOffset.column) {
        throw new Error("Section offsets must be ordered and non-overlapping.");
      }
      lastOffset = offset;
      return {
        generatedOffset: {
          generatedLine: offsetLine + 1,
          generatedColumn: offsetColumn + 1
        },
        consumer: new SourceMapConsumer(util.getArg(s, "map"), aSourceMapURL)
      };
    });
  }
  IndexedSourceMapConsumer.prototype = Object.create(SourceMapConsumer.prototype);
  IndexedSourceMapConsumer.prototype.constructor = SourceMapConsumer;
  IndexedSourceMapConsumer.prototype._version = 3;
  Object.defineProperty(IndexedSourceMapConsumer.prototype, "sources", {
    get: function() {
      var sources = [];
      for (var i = 0;i < this._sections.length; i++) {
        for (var j = 0;j < this._sections[i].consumer.sources.length; j++) {
          sources.push(this._sections[i].consumer.sources[j]);
        }
      }
      return sources;
    }
  });
  IndexedSourceMapConsumer.prototype.originalPositionFor = function IndexedSourceMapConsumer_originalPositionFor(aArgs) {
    var needle = {
      generatedLine: util.getArg(aArgs, "line"),
      generatedColumn: util.getArg(aArgs, "column")
    };
    var sectionIndex = binarySearch.search(needle, this._sections, function(needle2, section2) {
      var cmp = needle2.generatedLine - section2.generatedOffset.generatedLine;
      if (cmp) {
        return cmp;
      }
      return needle2.generatedColumn - section2.generatedOffset.generatedColumn;
    });
    var section = this._sections[sectionIndex];
    if (!section) {
      return {
        source: null,
        line: null,
        column: null,
        name: null
      };
    }
    return section.consumer.originalPositionFor({
      line: needle.generatedLine - (section.generatedOffset.generatedLine - 1),
      column: needle.generatedColumn - (section.generatedOffset.generatedLine === needle.generatedLine ? section.generatedOffset.generatedColumn - 1 : 0),
      bias: aArgs.bias
    });
  };
  IndexedSourceMapConsumer.prototype.hasContentsOfAllSources = function IndexedSourceMapConsumer_hasContentsOfAllSources() {
    return this._sections.every(function(s) {
      return s.consumer.hasContentsOfAllSources();
    });
  };
  IndexedSourceMapConsumer.prototype.sourceContentFor = function IndexedSourceMapConsumer_sourceContentFor(aSource, nullOnMissing) {
    for (var i = 0;i < this._sections.length; i++) {
      var section = this._sections[i];
      var content = section.consumer.sourceContentFor(aSource, true);
      if (content) {
        return content;
      }
    }
    if (nullOnMissing) {
      return null;
    } else {
      throw new Error('"' + aSource + '" is not in the SourceMap.');
    }
  };
  IndexedSourceMapConsumer.prototype.generatedPositionFor = function IndexedSourceMapConsumer_generatedPositionFor(aArgs) {
    for (var i = 0;i < this._sections.length; i++) {
      var section = this._sections[i];
      if (section.consumer._findSourceIndex(util.getArg(aArgs, "source")) === -1) {
        continue;
      }
      var generatedPosition = section.consumer.generatedPositionFor(aArgs);
      if (generatedPosition) {
        var ret = {
          line: generatedPosition.line + (section.generatedOffset.generatedLine - 1),
          column: generatedPosition.column + (section.generatedOffset.generatedLine === generatedPosition.line ? section.generatedOffset.generatedColumn - 1 : 0)
        };
        return ret;
      }
    }
    return {
      line: null,
      column: null
    };
  };
  IndexedSourceMapConsumer.prototype._parseMappings = function IndexedSourceMapConsumer_parseMappings(aStr, aSourceRoot) {
    this.__generatedMappings = [];
    this.__originalMappings = [];
    for (var i = 0;i < this._sections.length; i++) {
      var section = this._sections[i];
      var sectionMappings = section.consumer._generatedMappings;
      for (var j = 0;j < sectionMappings.length; j++) {
        var mapping = sectionMappings[j];
        var source = section.consumer._sources.at(mapping.source);
        source = util.computeSourceURL(section.consumer.sourceRoot, source, this._sourceMapURL);
        this._sources.add(source);
        source = this._sources.indexOf(source);
        var name = null;
        if (mapping.name) {
          name = section.consumer._names.at(mapping.name);
          this._names.add(name);
          name = this._names.indexOf(name);
        }
        var adjustedMapping = {
          source,
          generatedLine: mapping.generatedLine + (section.generatedOffset.generatedLine - 1),
          generatedColumn: mapping.generatedColumn + (section.generatedOffset.generatedLine === mapping.generatedLine ? section.generatedOffset.generatedColumn - 1 : 0),
          originalLine: mapping.originalLine,
          originalColumn: mapping.originalColumn,
          name
        };
        this.__generatedMappings.push(adjustedMapping);
        if (typeof adjustedMapping.originalLine === "number") {
          this.__originalMappings.push(adjustedMapping);
        }
      }
    }
    quickSort(this.__generatedMappings, util.compareByGeneratedPositionsDeflated);
    quickSort(this.__originalMappings, util.compareByOriginalPositions);
  };
  exports.IndexedSourceMapConsumer = IndexedSourceMapConsumer;
});

// node_modules/.bun/source-map@0.6.1/node_modules/source-map/lib/source-node.js
var require_source_node = __commonJS((exports) => {
  var SourceMapGenerator = require_source_map_generator().SourceMapGenerator;
  var util = require_util();
  var REGEX_NEWLINE = /(\r?\n)/;
  var NEWLINE_CODE = 10;
  var isSourceNode = "$$$isSourceNode$$$";
  function SourceNode(aLine, aColumn, aSource, aChunks, aName) {
    this.children = [];
    this.sourceContents = {};
    this.line = aLine == null ? null : aLine;
    this.column = aColumn == null ? null : aColumn;
    this.source = aSource == null ? null : aSource;
    this.name = aName == null ? null : aName;
    this[isSourceNode] = true;
    if (aChunks != null)
      this.add(aChunks);
  }
  SourceNode.fromStringWithSourceMap = function SourceNode_fromStringWithSourceMap(aGeneratedCode, aSourceMapConsumer, aRelativePath) {
    var node = new SourceNode;
    var remainingLines = aGeneratedCode.split(REGEX_NEWLINE);
    var remainingLinesIndex = 0;
    var shiftNextLine = function() {
      var lineContents = getNextLine();
      var newLine = getNextLine() || "";
      return lineContents + newLine;
      function getNextLine() {
        return remainingLinesIndex < remainingLines.length ? remainingLines[remainingLinesIndex++] : undefined;
      }
    };
    var lastGeneratedLine = 1, lastGeneratedColumn = 0;
    var lastMapping = null;
    aSourceMapConsumer.eachMapping(function(mapping) {
      if (lastMapping !== null) {
        if (lastGeneratedLine < mapping.generatedLine) {
          addMappingWithCode(lastMapping, shiftNextLine());
          lastGeneratedLine++;
          lastGeneratedColumn = 0;
        } else {
          var nextLine = remainingLines[remainingLinesIndex] || "";
          var code = nextLine.substr(0, mapping.generatedColumn - lastGeneratedColumn);
          remainingLines[remainingLinesIndex] = nextLine.substr(mapping.generatedColumn - lastGeneratedColumn);
          lastGeneratedColumn = mapping.generatedColumn;
          addMappingWithCode(lastMapping, code);
          lastMapping = mapping;
          return;
        }
      }
      while (lastGeneratedLine < mapping.generatedLine) {
        node.add(shiftNextLine());
        lastGeneratedLine++;
      }
      if (lastGeneratedColumn < mapping.generatedColumn) {
        var nextLine = remainingLines[remainingLinesIndex] || "";
        node.add(nextLine.substr(0, mapping.generatedColumn));
        remainingLines[remainingLinesIndex] = nextLine.substr(mapping.generatedColumn);
        lastGeneratedColumn = mapping.generatedColumn;
      }
      lastMapping = mapping;
    }, this);
    if (remainingLinesIndex < remainingLines.length) {
      if (lastMapping) {
        addMappingWithCode(lastMapping, shiftNextLine());
      }
      node.add(remainingLines.splice(remainingLinesIndex).join(""));
    }
    aSourceMapConsumer.sources.forEach(function(sourceFile) {
      var content = aSourceMapConsumer.sourceContentFor(sourceFile);
      if (content != null) {
        if (aRelativePath != null) {
          sourceFile = util.join(aRelativePath, sourceFile);
        }
        node.setSourceContent(sourceFile, content);
      }
    });
    return node;
    function addMappingWithCode(mapping, code) {
      if (mapping === null || mapping.source === undefined) {
        node.add(code);
      } else {
        var source = aRelativePath ? util.join(aRelativePath, mapping.source) : mapping.source;
        node.add(new SourceNode(mapping.originalLine, mapping.originalColumn, source, code, mapping.name));
      }
    }
  };
  SourceNode.prototype.add = function SourceNode_add(aChunk) {
    if (Array.isArray(aChunk)) {
      aChunk.forEach(function(chunk) {
        this.add(chunk);
      }, this);
    } else if (aChunk[isSourceNode] || typeof aChunk === "string") {
      if (aChunk) {
        this.children.push(aChunk);
      }
    } else {
      throw new TypeError("Expected a SourceNode, string, or an array of SourceNodes and strings. Got " + aChunk);
    }
    return this;
  };
  SourceNode.prototype.prepend = function SourceNode_prepend(aChunk) {
    if (Array.isArray(aChunk)) {
      for (var i = aChunk.length - 1;i >= 0; i--) {
        this.prepend(aChunk[i]);
      }
    } else if (aChunk[isSourceNode] || typeof aChunk === "string") {
      this.children.unshift(aChunk);
    } else {
      throw new TypeError("Expected a SourceNode, string, or an array of SourceNodes and strings. Got " + aChunk);
    }
    return this;
  };
  SourceNode.prototype.walk = function SourceNode_walk(aFn) {
    var chunk;
    for (var i = 0, len = this.children.length;i < len; i++) {
      chunk = this.children[i];
      if (chunk[isSourceNode]) {
        chunk.walk(aFn);
      } else {
        if (chunk !== "") {
          aFn(chunk, {
            source: this.source,
            line: this.line,
            column: this.column,
            name: this.name
          });
        }
      }
    }
  };
  SourceNode.prototype.join = function SourceNode_join(aSep) {
    var newChildren;
    var i;
    var len = this.children.length;
    if (len > 0) {
      newChildren = [];
      for (i = 0;i < len - 1; i++) {
        newChildren.push(this.children[i]);
        newChildren.push(aSep);
      }
      newChildren.push(this.children[i]);
      this.children = newChildren;
    }
    return this;
  };
  SourceNode.prototype.replaceRight = function SourceNode_replaceRight(aPattern, aReplacement) {
    var lastChild = this.children[this.children.length - 1];
    if (lastChild[isSourceNode]) {
      lastChild.replaceRight(aPattern, aReplacement);
    } else if (typeof lastChild === "string") {
      this.children[this.children.length - 1] = lastChild.replace(aPattern, aReplacement);
    } else {
      this.children.push("".replace(aPattern, aReplacement));
    }
    return this;
  };
  SourceNode.prototype.setSourceContent = function SourceNode_setSourceContent(aSourceFile, aSourceContent) {
    this.sourceContents[util.toSetString(aSourceFile)] = aSourceContent;
  };
  SourceNode.prototype.walkSourceContents = function SourceNode_walkSourceContents(aFn) {
    for (var i = 0, len = this.children.length;i < len; i++) {
      if (this.children[i][isSourceNode]) {
        this.children[i].walkSourceContents(aFn);
      }
    }
    var sources = Object.keys(this.sourceContents);
    for (var i = 0, len = sources.length;i < len; i++) {
      aFn(util.fromSetString(sources[i]), this.sourceContents[sources[i]]);
    }
  };
  SourceNode.prototype.toString = function SourceNode_toString() {
    var str = "";
    this.walk(function(chunk) {
      str += chunk;
    });
    return str;
  };
  SourceNode.prototype.toStringWithSourceMap = function SourceNode_toStringWithSourceMap(aArgs) {
    var generated = {
      code: "",
      line: 1,
      column: 0
    };
    var map = new SourceMapGenerator(aArgs);
    var sourceMappingActive = false;
    var lastOriginalSource = null;
    var lastOriginalLine = null;
    var lastOriginalColumn = null;
    var lastOriginalName = null;
    this.walk(function(chunk, original) {
      generated.code += chunk;
      if (original.source !== null && original.line !== null && original.column !== null) {
        if (lastOriginalSource !== original.source || lastOriginalLine !== original.line || lastOriginalColumn !== original.column || lastOriginalName !== original.name) {
          map.addMapping({
            source: original.source,
            original: {
              line: original.line,
              column: original.column
            },
            generated: {
              line: generated.line,
              column: generated.column
            },
            name: original.name
          });
        }
        lastOriginalSource = original.source;
        lastOriginalLine = original.line;
        lastOriginalColumn = original.column;
        lastOriginalName = original.name;
        sourceMappingActive = true;
      } else if (sourceMappingActive) {
        map.addMapping({
          generated: {
            line: generated.line,
            column: generated.column
          }
        });
        lastOriginalSource = null;
        sourceMappingActive = false;
      }
      for (var idx = 0, length = chunk.length;idx < length; idx++) {
        if (chunk.charCodeAt(idx) === NEWLINE_CODE) {
          generated.line++;
          generated.column = 0;
          if (idx + 1 === length) {
            lastOriginalSource = null;
            sourceMappingActive = false;
          } else if (sourceMappingActive) {
            map.addMapping({
              source: original.source,
              original: {
                line: original.line,
                column: original.column
              },
              generated: {
                line: generated.line,
                column: generated.column
              },
              name: original.name
            });
          }
        } else {
          generated.column++;
        }
      }
    });
    this.walkSourceContents(function(sourceFile, sourceContent) {
      map.setSourceContent(sourceFile, sourceContent);
    });
    return { code: generated.code, map };
  };
  exports.SourceNode = SourceNode;
});

// node_modules/.bun/source-map@0.6.1/node_modules/source-map/source-map.js
var require_source_map = __commonJS((exports) => {
  exports.SourceMapGenerator = require_source_map_generator().SourceMapGenerator;
  exports.SourceMapConsumer = require_source_map_consumer().SourceMapConsumer;
  exports.SourceNode = require_source_node().SourceNode;
});

// node_modules/.bun/handlebars@4.7.8/node_modules/handlebars/dist/cjs/handlebars/compiler/code-gen.js
var require_code_gen = __commonJS((exports, module) => {
  exports.__esModule = true;
  var _utils = require_utils();
  var SourceNode = undefined;
  try {
    if (typeof define !== "function" || !define.amd) {
      SourceMap = require_source_map();
      SourceNode = SourceMap.SourceNode;
    }
  } catch (err) {}
  var SourceMap;
  if (!SourceNode) {
    SourceNode = function(line, column, srcFile, chunks) {
      this.src = "";
      if (chunks) {
        this.add(chunks);
      }
    };
    SourceNode.prototype = {
      add: function add(chunks) {
        if (_utils.isArray(chunks)) {
          chunks = chunks.join("");
        }
        this.src += chunks;
      },
      prepend: function prepend(chunks) {
        if (_utils.isArray(chunks)) {
          chunks = chunks.join("");
        }
        this.src = chunks + this.src;
      },
      toStringWithSourceMap: function toStringWithSourceMap() {
        return { code: this.toString() };
      },
      toString: function toString() {
        return this.src;
      }
    };
  }
  function castChunk(chunk, codeGen, loc) {
    if (_utils.isArray(chunk)) {
      var ret = [];
      for (var i = 0, len = chunk.length;i < len; i++) {
        ret.push(codeGen.wrap(chunk[i], loc));
      }
      return ret;
    } else if (typeof chunk === "boolean" || typeof chunk === "number") {
      return chunk + "";
    }
    return chunk;
  }
  function CodeGen(srcFile) {
    this.srcFile = srcFile;
    this.source = [];
  }
  CodeGen.prototype = {
    isEmpty: function isEmpty() {
      return !this.source.length;
    },
    prepend: function prepend(source, loc) {
      this.source.unshift(this.wrap(source, loc));
    },
    push: function push(source, loc) {
      this.source.push(this.wrap(source, loc));
    },
    merge: function merge() {
      var source = this.empty();
      this.each(function(line) {
        source.add(["  ", line, `
`]);
      });
      return source;
    },
    each: function each(iter) {
      for (var i = 0, len = this.source.length;i < len; i++) {
        iter(this.source[i]);
      }
    },
    empty: function empty() {
      var loc = this.currentLocation || { start: {} };
      return new SourceNode(loc.start.line, loc.start.column, this.srcFile);
    },
    wrap: function wrap(chunk) {
      var loc = arguments.length <= 1 || arguments[1] === undefined ? this.currentLocation || { start: {} } : arguments[1];
      if (chunk instanceof SourceNode) {
        return chunk;
      }
      chunk = castChunk(chunk, this, loc);
      return new SourceNode(loc.start.line, loc.start.column, this.srcFile, chunk);
    },
    functionCall: function functionCall(fn, type, params) {
      params = this.generateList(params);
      return this.wrap([fn, type ? "." + type + "(" : "(", params, ")"]);
    },
    quotedString: function quotedString(str) {
      return '"' + (str + "").replace(/\\/g, "\\\\").replace(/"/g, "\\\"").replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029") + '"';
    },
    objectLiteral: function objectLiteral(obj) {
      var _this = this;
      var pairs = [];
      Object.keys(obj).forEach(function(key) {
        var value = castChunk(obj[key], _this);
        if (value !== "undefined") {
          pairs.push([_this.quotedString(key), ":", value]);
        }
      });
      var ret = this.generateList(pairs);
      ret.prepend("{");
      ret.add("}");
      return ret;
    },
    generateList: function generateList(entries) {
      var ret = this.empty();
      for (var i = 0, len = entries.length;i < len; i++) {
        if (i) {
          ret.add(",");
        }
        ret.add(castChunk(entries[i], this));
      }
      return ret;
    },
    generateArray: function generateArray(entries) {
      var ret = this.generateList(entries);
      ret.prepend("[");
      ret.add("]");
      return ret;
    }
  };
  exports.default = CodeGen;
  module.exports = exports["default"];
});

// node_modules/.bun/handlebars@4.7.8/node_modules/handlebars/dist/cjs/handlebars/compiler/javascript-compiler.js
var require_javascript_compiler = __commonJS((exports, module) => {
  exports.__esModule = true;
  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : { default: obj };
  }
  var _base = require_base();
  var _exception = require_exception2();
  var _exception2 = _interopRequireDefault(_exception);
  var _utils = require_utils();
  var _codeGen = require_code_gen();
  var _codeGen2 = _interopRequireDefault(_codeGen);
  function Literal(value) {
    this.value = value;
  }
  function JavaScriptCompiler() {}
  JavaScriptCompiler.prototype = {
    nameLookup: function nameLookup(parent, name) {
      return this.internalNameLookup(parent, name);
    },
    depthedLookup: function depthedLookup(name) {
      return [this.aliasable("container.lookup"), "(depths, ", JSON.stringify(name), ")"];
    },
    compilerInfo: function compilerInfo() {
      var revision = _base.COMPILER_REVISION, versions = _base.REVISION_CHANGES[revision];
      return [revision, versions];
    },
    appendToBuffer: function appendToBuffer(source, location, explicit) {
      if (!_utils.isArray(source)) {
        source = [source];
      }
      source = this.source.wrap(source, location);
      if (this.environment.isSimple) {
        return ["return ", source, ";"];
      } else if (explicit) {
        return ["buffer += ", source, ";"];
      } else {
        source.appendToBuffer = true;
        return source;
      }
    },
    initializeBuffer: function initializeBuffer() {
      return this.quotedString("");
    },
    internalNameLookup: function internalNameLookup(parent, name) {
      this.lookupPropertyFunctionIsUsed = true;
      return ["lookupProperty(", parent, ",", JSON.stringify(name), ")"];
    },
    lookupPropertyFunctionIsUsed: false,
    compile: function compile(environment, options, context, asObject) {
      this.environment = environment;
      this.options = options;
      this.stringParams = this.options.stringParams;
      this.trackIds = this.options.trackIds;
      this.precompile = !asObject;
      this.name = this.environment.name;
      this.isChild = !!context;
      this.context = context || {
        decorators: [],
        programs: [],
        environments: []
      };
      this.preamble();
      this.stackSlot = 0;
      this.stackVars = [];
      this.aliases = {};
      this.registers = { list: [] };
      this.hashes = [];
      this.compileStack = [];
      this.inlineStack = [];
      this.blockParams = [];
      this.compileChildren(environment, options);
      this.useDepths = this.useDepths || environment.useDepths || environment.useDecorators || this.options.compat;
      this.useBlockParams = this.useBlockParams || environment.useBlockParams;
      var opcodes = environment.opcodes, opcode = undefined, firstLoc = undefined, i = undefined, l = undefined;
      for (i = 0, l = opcodes.length;i < l; i++) {
        opcode = opcodes[i];
        this.source.currentLocation = opcode.loc;
        firstLoc = firstLoc || opcode.loc;
        this[opcode.opcode].apply(this, opcode.args);
      }
      this.source.currentLocation = firstLoc;
      this.pushSource("");
      if (this.stackSlot || this.inlineStack.length || this.compileStack.length) {
        throw new _exception2["default"]("Compile completed with content left on stack");
      }
      if (!this.decorators.isEmpty()) {
        this.useDecorators = true;
        this.decorators.prepend(["var decorators = container.decorators, ", this.lookupPropertyFunctionVarDeclaration(), `;
`]);
        this.decorators.push("return fn;");
        if (asObject) {
          this.decorators = Function.apply(this, ["fn", "props", "container", "depth0", "data", "blockParams", "depths", this.decorators.merge()]);
        } else {
          this.decorators.prepend(`function(fn, props, container, depth0, data, blockParams, depths) {
`);
          this.decorators.push(`}
`);
          this.decorators = this.decorators.merge();
        }
      } else {
        this.decorators = undefined;
      }
      var fn = this.createFunctionContext(asObject);
      if (!this.isChild) {
        var ret = {
          compiler: this.compilerInfo(),
          main: fn
        };
        if (this.decorators) {
          ret.main_d = this.decorators;
          ret.useDecorators = true;
        }
        var _context = this.context;
        var programs = _context.programs;
        var decorators = _context.decorators;
        for (i = 0, l = programs.length;i < l; i++) {
          if (programs[i]) {
            ret[i] = programs[i];
            if (decorators[i]) {
              ret[i + "_d"] = decorators[i];
              ret.useDecorators = true;
            }
          }
        }
        if (this.environment.usePartial) {
          ret.usePartial = true;
        }
        if (this.options.data) {
          ret.useData = true;
        }
        if (this.useDepths) {
          ret.useDepths = true;
        }
        if (this.useBlockParams) {
          ret.useBlockParams = true;
        }
        if (this.options.compat) {
          ret.compat = true;
        }
        if (!asObject) {
          ret.compiler = JSON.stringify(ret.compiler);
          this.source.currentLocation = { start: { line: 1, column: 0 } };
          ret = this.objectLiteral(ret);
          if (options.srcName) {
            ret = ret.toStringWithSourceMap({ file: options.destName });
            ret.map = ret.map && ret.map.toString();
          } else {
            ret = ret.toString();
          }
        } else {
          ret.compilerOptions = this.options;
        }
        return ret;
      } else {
        return fn;
      }
    },
    preamble: function preamble() {
      this.lastContext = 0;
      this.source = new _codeGen2["default"](this.options.srcName);
      this.decorators = new _codeGen2["default"](this.options.srcName);
    },
    createFunctionContext: function createFunctionContext(asObject) {
      var _this = this;
      var varDeclarations = "";
      var locals = this.stackVars.concat(this.registers.list);
      if (locals.length > 0) {
        varDeclarations += ", " + locals.join(", ");
      }
      var aliasCount = 0;
      Object.keys(this.aliases).forEach(function(alias) {
        var node = _this.aliases[alias];
        if (node.children && node.referenceCount > 1) {
          varDeclarations += ", alias" + ++aliasCount + "=" + alias;
          node.children[0] = "alias" + aliasCount;
        }
      });
      if (this.lookupPropertyFunctionIsUsed) {
        varDeclarations += ", " + this.lookupPropertyFunctionVarDeclaration();
      }
      var params = ["container", "depth0", "helpers", "partials", "data"];
      if (this.useBlockParams || this.useDepths) {
        params.push("blockParams");
      }
      if (this.useDepths) {
        params.push("depths");
      }
      var source = this.mergeSource(varDeclarations);
      if (asObject) {
        params.push(source);
        return Function.apply(this, params);
      } else {
        return this.source.wrap(["function(", params.join(","), `) {
  `, source, "}"]);
      }
    },
    mergeSource: function mergeSource(varDeclarations) {
      var isSimple = this.environment.isSimple, appendOnly = !this.forceBuffer, appendFirst = undefined, sourceSeen = undefined, bufferStart = undefined, bufferEnd = undefined;
      this.source.each(function(line) {
        if (line.appendToBuffer) {
          if (bufferStart) {
            line.prepend("  + ");
          } else {
            bufferStart = line;
          }
          bufferEnd = line;
        } else {
          if (bufferStart) {
            if (!sourceSeen) {
              appendFirst = true;
            } else {
              bufferStart.prepend("buffer += ");
            }
            bufferEnd.add(";");
            bufferStart = bufferEnd = undefined;
          }
          sourceSeen = true;
          if (!isSimple) {
            appendOnly = false;
          }
        }
      });
      if (appendOnly) {
        if (bufferStart) {
          bufferStart.prepend("return ");
          bufferEnd.add(";");
        } else if (!sourceSeen) {
          this.source.push('return "";');
        }
      } else {
        varDeclarations += ", buffer = " + (appendFirst ? "" : this.initializeBuffer());
        if (bufferStart) {
          bufferStart.prepend("return buffer + ");
          bufferEnd.add(";");
        } else {
          this.source.push("return buffer;");
        }
      }
      if (varDeclarations) {
        this.source.prepend("var " + varDeclarations.substring(2) + (appendFirst ? "" : `;
`));
      }
      return this.source.merge();
    },
    lookupPropertyFunctionVarDeclaration: function lookupPropertyFunctionVarDeclaration() {
      return `
      lookupProperty = container.lookupProperty || function(parent, propertyName) {
        if (Object.prototype.hasOwnProperty.call(parent, propertyName)) {
          return parent[propertyName];
        }
        return undefined
    }
    `.trim();
    },
    blockValue: function blockValue(name) {
      var blockHelperMissing = this.aliasable("container.hooks.blockHelperMissing"), params = [this.contextName(0)];
      this.setupHelperArgs(name, 0, params);
      var blockName = this.popStack();
      params.splice(1, 0, blockName);
      this.push(this.source.functionCall(blockHelperMissing, "call", params));
    },
    ambiguousBlockValue: function ambiguousBlockValue() {
      var blockHelperMissing = this.aliasable("container.hooks.blockHelperMissing"), params = [this.contextName(0)];
      this.setupHelperArgs("", 0, params, true);
      this.flushInline();
      var current = this.topStack();
      params.splice(1, 0, current);
      this.pushSource(["if (!", this.lastHelper, ") { ", current, " = ", this.source.functionCall(blockHelperMissing, "call", params), "}"]);
    },
    appendContent: function appendContent(content) {
      if (this.pendingContent) {
        content = this.pendingContent + content;
      } else {
        this.pendingLocation = this.source.currentLocation;
      }
      this.pendingContent = content;
    },
    append: function append() {
      if (this.isInline()) {
        this.replaceStack(function(current) {
          return [" != null ? ", current, ' : ""'];
        });
        this.pushSource(this.appendToBuffer(this.popStack()));
      } else {
        var local = this.popStack();
        this.pushSource(["if (", local, " != null) { ", this.appendToBuffer(local, undefined, true), " }"]);
        if (this.environment.isSimple) {
          this.pushSource(["else { ", this.appendToBuffer("''", undefined, true), " }"]);
        }
      }
    },
    appendEscaped: function appendEscaped() {
      this.pushSource(this.appendToBuffer([this.aliasable("container.escapeExpression"), "(", this.popStack(), ")"]));
    },
    getContext: function getContext(depth) {
      this.lastContext = depth;
    },
    pushContext: function pushContext() {
      this.pushStackLiteral(this.contextName(this.lastContext));
    },
    lookupOnContext: function lookupOnContext(parts, falsy, strict, scoped) {
      var i = 0;
      if (!scoped && this.options.compat && !this.lastContext) {
        this.push(this.depthedLookup(parts[i++]));
      } else {
        this.pushContext();
      }
      this.resolvePath("context", parts, i, falsy, strict);
    },
    lookupBlockParam: function lookupBlockParam(blockParamId, parts) {
      this.useBlockParams = true;
      this.push(["blockParams[", blockParamId[0], "][", blockParamId[1], "]"]);
      this.resolvePath("context", parts, 1);
    },
    lookupData: function lookupData(depth, parts, strict) {
      if (!depth) {
        this.pushStackLiteral("data");
      } else {
        this.pushStackLiteral("container.data(data, " + depth + ")");
      }
      this.resolvePath("data", parts, 0, true, strict);
    },
    resolvePath: function resolvePath(type, parts, i, falsy, strict) {
      var _this2 = this;
      if (this.options.strict || this.options.assumeObjects) {
        this.push(strictLookup(this.options.strict && strict, this, parts, i, type));
        return;
      }
      var len = parts.length;
      for (;i < len; i++) {
        this.replaceStack(function(current) {
          var lookup = _this2.nameLookup(current, parts[i], type);
          if (!falsy) {
            return [" != null ? ", lookup, " : ", current];
          } else {
            return [" && ", lookup];
          }
        });
      }
    },
    resolvePossibleLambda: function resolvePossibleLambda() {
      this.push([this.aliasable("container.lambda"), "(", this.popStack(), ", ", this.contextName(0), ")"]);
    },
    pushStringParam: function pushStringParam(string, type) {
      this.pushContext();
      this.pushString(type);
      if (type !== "SubExpression") {
        if (typeof string === "string") {
          this.pushString(string);
        } else {
          this.pushStackLiteral(string);
        }
      }
    },
    emptyHash: function emptyHash(omitEmpty) {
      if (this.trackIds) {
        this.push("{}");
      }
      if (this.stringParams) {
        this.push("{}");
        this.push("{}");
      }
      this.pushStackLiteral(omitEmpty ? "undefined" : "{}");
    },
    pushHash: function pushHash() {
      if (this.hash) {
        this.hashes.push(this.hash);
      }
      this.hash = { values: {}, types: [], contexts: [], ids: [] };
    },
    popHash: function popHash() {
      var hash = this.hash;
      this.hash = this.hashes.pop();
      if (this.trackIds) {
        this.push(this.objectLiteral(hash.ids));
      }
      if (this.stringParams) {
        this.push(this.objectLiteral(hash.contexts));
        this.push(this.objectLiteral(hash.types));
      }
      this.push(this.objectLiteral(hash.values));
    },
    pushString: function pushString(string) {
      this.pushStackLiteral(this.quotedString(string));
    },
    pushLiteral: function pushLiteral(value) {
      this.pushStackLiteral(value);
    },
    pushProgram: function pushProgram(guid) {
      if (guid != null) {
        this.pushStackLiteral(this.programExpression(guid));
      } else {
        this.pushStackLiteral(null);
      }
    },
    registerDecorator: function registerDecorator(paramSize, name) {
      var foundDecorator = this.nameLookup("decorators", name, "decorator"), options = this.setupHelperArgs(name, paramSize);
      this.decorators.push(["fn = ", this.decorators.functionCall(foundDecorator, "", ["fn", "props", "container", options]), " || fn;"]);
    },
    invokeHelper: function invokeHelper(paramSize, name, isSimple) {
      var nonHelper = this.popStack(), helper = this.setupHelper(paramSize, name);
      var possibleFunctionCalls = [];
      if (isSimple) {
        possibleFunctionCalls.push(helper.name);
      }
      possibleFunctionCalls.push(nonHelper);
      if (!this.options.strict) {
        possibleFunctionCalls.push(this.aliasable("container.hooks.helperMissing"));
      }
      var functionLookupCode = ["(", this.itemsSeparatedBy(possibleFunctionCalls, "||"), ")"];
      var functionCall = this.source.functionCall(functionLookupCode, "call", helper.callParams);
      this.push(functionCall);
    },
    itemsSeparatedBy: function itemsSeparatedBy(items, separator) {
      var result = [];
      result.push(items[0]);
      for (var i = 1;i < items.length; i++) {
        result.push(separator, items[i]);
      }
      return result;
    },
    invokeKnownHelper: function invokeKnownHelper(paramSize, name) {
      var helper = this.setupHelper(paramSize, name);
      this.push(this.source.functionCall(helper.name, "call", helper.callParams));
    },
    invokeAmbiguous: function invokeAmbiguous(name, helperCall) {
      this.useRegister("helper");
      var nonHelper = this.popStack();
      this.emptyHash();
      var helper = this.setupHelper(0, name, helperCall);
      var helperName = this.lastHelper = this.nameLookup("helpers", name, "helper");
      var lookup = ["(", "(helper = ", helperName, " || ", nonHelper, ")"];
      if (!this.options.strict) {
        lookup[0] = "(helper = ";
        lookup.push(" != null ? helper : ", this.aliasable("container.hooks.helperMissing"));
      }
      this.push(["(", lookup, helper.paramsInit ? ["),(", helper.paramsInit] : [], "),", "(typeof helper === ", this.aliasable('"function"'), " ? ", this.source.functionCall("helper", "call", helper.callParams), " : helper))"]);
    },
    invokePartial: function invokePartial(isDynamic2, name, indent) {
      var params = [], options = this.setupParams(name, 1, params);
      if (isDynamic2) {
        name = this.popStack();
        delete options.name;
      }
      if (indent) {
        options.indent = JSON.stringify(indent);
      }
      options.helpers = "helpers";
      options.partials = "partials";
      options.decorators = "container.decorators";
      if (!isDynamic2) {
        params.unshift(this.nameLookup("partials", name, "partial"));
      } else {
        params.unshift(name);
      }
      if (this.options.compat) {
        options.depths = "depths";
      }
      options = this.objectLiteral(options);
      params.push(options);
      this.push(this.source.functionCall("container.invokePartial", "", params));
    },
    assignToHash: function assignToHash(key) {
      var value = this.popStack(), context = undefined, type = undefined, id = undefined;
      if (this.trackIds) {
        id = this.popStack();
      }
      if (this.stringParams) {
        type = this.popStack();
        context = this.popStack();
      }
      var hash = this.hash;
      if (context) {
        hash.contexts[key] = context;
      }
      if (type) {
        hash.types[key] = type;
      }
      if (id) {
        hash.ids[key] = id;
      }
      hash.values[key] = value;
    },
    pushId: function pushId(type, name, child) {
      if (type === "BlockParam") {
        this.pushStackLiteral("blockParams[" + name[0] + "].path[" + name[1] + "]" + (child ? " + " + JSON.stringify("." + child) : ""));
      } else if (type === "PathExpression") {
        this.pushString(name);
      } else if (type === "SubExpression") {
        this.pushStackLiteral("true");
      } else {
        this.pushStackLiteral("null");
      }
    },
    compiler: JavaScriptCompiler,
    compileChildren: function compileChildren(environment, options) {
      var children = environment.children, child = undefined, compiler = undefined;
      for (var i = 0, l = children.length;i < l; i++) {
        child = children[i];
        compiler = new this.compiler;
        var existing = this.matchExistingProgram(child);
        if (existing == null) {
          this.context.programs.push("");
          var index = this.context.programs.length;
          child.index = index;
          child.name = "program" + index;
          this.context.programs[index] = compiler.compile(child, options, this.context, !this.precompile);
          this.context.decorators[index] = compiler.decorators;
          this.context.environments[index] = child;
          this.useDepths = this.useDepths || compiler.useDepths;
          this.useBlockParams = this.useBlockParams || compiler.useBlockParams;
          child.useDepths = this.useDepths;
          child.useBlockParams = this.useBlockParams;
        } else {
          child.index = existing.index;
          child.name = "program" + existing.index;
          this.useDepths = this.useDepths || existing.useDepths;
          this.useBlockParams = this.useBlockParams || existing.useBlockParams;
        }
      }
    },
    matchExistingProgram: function matchExistingProgram(child) {
      for (var i = 0, len = this.context.environments.length;i < len; i++) {
        var environment = this.context.environments[i];
        if (environment && environment.equals(child)) {
          return environment;
        }
      }
    },
    programExpression: function programExpression(guid) {
      var child = this.environment.children[guid], programParams = [child.index, "data", child.blockParams];
      if (this.useBlockParams || this.useDepths) {
        programParams.push("blockParams");
      }
      if (this.useDepths) {
        programParams.push("depths");
      }
      return "container.program(" + programParams.join(", ") + ")";
    },
    useRegister: function useRegister(name) {
      if (!this.registers[name]) {
        this.registers[name] = true;
        this.registers.list.push(name);
      }
    },
    push: function push(expr) {
      if (!(expr instanceof Literal)) {
        expr = this.source.wrap(expr);
      }
      this.inlineStack.push(expr);
      return expr;
    },
    pushStackLiteral: function pushStackLiteral(item) {
      this.push(new Literal(item));
    },
    pushSource: function pushSource(source) {
      if (this.pendingContent) {
        this.source.push(this.appendToBuffer(this.source.quotedString(this.pendingContent), this.pendingLocation));
        this.pendingContent = undefined;
      }
      if (source) {
        this.source.push(source);
      }
    },
    replaceStack: function replaceStack(callback) {
      var prefix = ["("], stack = undefined, createdStack = undefined, usedLiteral = undefined;
      if (!this.isInline()) {
        throw new _exception2["default"]("replaceStack on non-inline");
      }
      var top = this.popStack(true);
      if (top instanceof Literal) {
        stack = [top.value];
        prefix = ["(", stack];
        usedLiteral = true;
      } else {
        createdStack = true;
        var _name = this.incrStack();
        prefix = ["((", this.push(_name), " = ", top, ")"];
        stack = this.topStack();
      }
      var item = callback.call(this, stack);
      if (!usedLiteral) {
        this.popStack();
      }
      if (createdStack) {
        this.stackSlot--;
      }
      this.push(prefix.concat(item, ")"));
    },
    incrStack: function incrStack() {
      this.stackSlot++;
      if (this.stackSlot > this.stackVars.length) {
        this.stackVars.push("stack" + this.stackSlot);
      }
      return this.topStackName();
    },
    topStackName: function topStackName() {
      return "stack" + this.stackSlot;
    },
    flushInline: function flushInline() {
      var inlineStack = this.inlineStack;
      this.inlineStack = [];
      for (var i = 0, len = inlineStack.length;i < len; i++) {
        var entry = inlineStack[i];
        if (entry instanceof Literal) {
          this.compileStack.push(entry);
        } else {
          var stack = this.incrStack();
          this.pushSource([stack, " = ", entry, ";"]);
          this.compileStack.push(stack);
        }
      }
    },
    isInline: function isInline() {
      return this.inlineStack.length;
    },
    popStack: function popStack(wrapped) {
      var inline = this.isInline(), item = (inline ? this.inlineStack : this.compileStack).pop();
      if (!wrapped && item instanceof Literal) {
        return item.value;
      } else {
        if (!inline) {
          if (!this.stackSlot) {
            throw new _exception2["default"]("Invalid stack pop");
          }
          this.stackSlot--;
        }
        return item;
      }
    },
    topStack: function topStack() {
      var stack = this.isInline() ? this.inlineStack : this.compileStack, item = stack[stack.length - 1];
      if (item instanceof Literal) {
        return item.value;
      } else {
        return item;
      }
    },
    contextName: function contextName(context) {
      if (this.useDepths && context) {
        return "depths[" + context + "]";
      } else {
        return "depth" + context;
      }
    },
    quotedString: function quotedString(str) {
      return this.source.quotedString(str);
    },
    objectLiteral: function objectLiteral(obj) {
      return this.source.objectLiteral(obj);
    },
    aliasable: function aliasable(name) {
      var ret = this.aliases[name];
      if (ret) {
        ret.referenceCount++;
        return ret;
      }
      ret = this.aliases[name] = this.source.wrap(name);
      ret.aliasable = true;
      ret.referenceCount = 1;
      return ret;
    },
    setupHelper: function setupHelper(paramSize, name, blockHelper) {
      var params = [], paramsInit = this.setupHelperArgs(name, paramSize, params, blockHelper);
      var foundHelper = this.nameLookup("helpers", name, "helper"), callContext = this.aliasable(this.contextName(0) + " != null ? " + this.contextName(0) + " : (container.nullContext || {})");
      return {
        params,
        paramsInit,
        name: foundHelper,
        callParams: [callContext].concat(params)
      };
    },
    setupParams: function setupParams(helper, paramSize, params) {
      var options = {}, contexts = [], types = [], ids = [], objectArgs = !params, param = undefined;
      if (objectArgs) {
        params = [];
      }
      options.name = this.quotedString(helper);
      options.hash = this.popStack();
      if (this.trackIds) {
        options.hashIds = this.popStack();
      }
      if (this.stringParams) {
        options.hashTypes = this.popStack();
        options.hashContexts = this.popStack();
      }
      var inverse = this.popStack(), program2 = this.popStack();
      if (program2 || inverse) {
        options.fn = program2 || "container.noop";
        options.inverse = inverse || "container.noop";
      }
      var i = paramSize;
      while (i--) {
        param = this.popStack();
        params[i] = param;
        if (this.trackIds) {
          ids[i] = this.popStack();
        }
        if (this.stringParams) {
          types[i] = this.popStack();
          contexts[i] = this.popStack();
        }
      }
      if (objectArgs) {
        options.args = this.source.generateArray(params);
      }
      if (this.trackIds) {
        options.ids = this.source.generateArray(ids);
      }
      if (this.stringParams) {
        options.types = this.source.generateArray(types);
        options.contexts = this.source.generateArray(contexts);
      }
      if (this.options.data) {
        options.data = "data";
      }
      if (this.useBlockParams) {
        options.blockParams = "blockParams";
      }
      return options;
    },
    setupHelperArgs: function setupHelperArgs(helper, paramSize, params, useRegister) {
      var options = this.setupParams(helper, paramSize, params);
      options.loc = JSON.stringify(this.source.currentLocation);
      options = this.objectLiteral(options);
      if (useRegister) {
        this.useRegister("options");
        params.push("options");
        return ["options=", options];
      } else if (params) {
        params.push(options);
        return "";
      } else {
        return options;
      }
    }
  };
  (function() {
    var reservedWords = ("break else new var" + " case finally return void" + " catch for switch while" + " continue function this with" + " default if throw" + " delete in try" + " do instanceof typeof" + " abstract enum int short" + " boolean export interface static" + " byte extends long super" + " char final native synchronized" + " class float package throws" + " const goto private transient" + " debugger implements protected volatile" + " double import public let yield await" + " null true false").split(" ");
    var compilerWords = JavaScriptCompiler.RESERVED_WORDS = {};
    for (var i = 0, l = reservedWords.length;i < l; i++) {
      compilerWords[reservedWords[i]] = true;
    }
  })();
  JavaScriptCompiler.isValidJavaScriptVariableName = function(name) {
    return !JavaScriptCompiler.RESERVED_WORDS[name] && /^[a-zA-Z_$][0-9a-zA-Z_$]*$/.test(name);
  };
  function strictLookup(requireTerminal, compiler, parts, i, type) {
    var stack = compiler.popStack(), len = parts.length;
    if (requireTerminal) {
      len--;
    }
    for (;i < len; i++) {
      stack = compiler.nameLookup(stack, parts[i], type);
    }
    if (requireTerminal) {
      return [compiler.aliasable("container.strict"), "(", stack, ", ", compiler.quotedString(parts[i]), ", ", JSON.stringify(compiler.source.currentLocation), " )"];
    } else {
      return stack;
    }
  }
  exports.default = JavaScriptCompiler;
  module.exports = exports["default"];
});

// node_modules/.bun/handlebars@4.7.8/node_modules/handlebars/dist/cjs/handlebars.js
var require_handlebars = __commonJS((exports, module) => {
  exports.__esModule = true;
  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : { default: obj };
  }
  var _handlebarsRuntime = require_handlebars_runtime();
  var _handlebarsRuntime2 = _interopRequireDefault(_handlebarsRuntime);
  var _handlebarsCompilerAst = require_ast();
  var _handlebarsCompilerAst2 = _interopRequireDefault(_handlebarsCompilerAst);
  var _handlebarsCompilerBase = require_base2();
  var _handlebarsCompilerCompiler = require_compiler();
  var _handlebarsCompilerJavascriptCompiler = require_javascript_compiler();
  var _handlebarsCompilerJavascriptCompiler2 = _interopRequireDefault(_handlebarsCompilerJavascriptCompiler);
  var _handlebarsCompilerVisitor = require_visitor();
  var _handlebarsCompilerVisitor2 = _interopRequireDefault(_handlebarsCompilerVisitor);
  var _handlebarsNoConflict = require_no_conflict();
  var _handlebarsNoConflict2 = _interopRequireDefault(_handlebarsNoConflict);
  var _create = _handlebarsRuntime2["default"].create;
  function create() {
    var hb = _create();
    hb.compile = function(input, options) {
      return _handlebarsCompilerCompiler.compile(input, options, hb);
    };
    hb.precompile = function(input, options) {
      return _handlebarsCompilerCompiler.precompile(input, options, hb);
    };
    hb.AST = _handlebarsCompilerAst2["default"];
    hb.Compiler = _handlebarsCompilerCompiler.Compiler;
    hb.JavaScriptCompiler = _handlebarsCompilerJavascriptCompiler2["default"];
    hb.Parser = _handlebarsCompilerBase.parser;
    hb.parse = _handlebarsCompilerBase.parse;
    hb.parseWithoutProcessing = _handlebarsCompilerBase.parseWithoutProcessing;
    return hb;
  }
  var inst = create();
  inst.create = create;
  _handlebarsNoConflict2["default"](inst);
  inst.Visitor = _handlebarsCompilerVisitor2["default"];
  inst["default"] = inst;
  exports.default = inst;
  module.exports = exports["default"];
});

// node_modules/.bun/handlebars@4.7.8/node_modules/handlebars/dist/cjs/handlebars/compiler/printer.js
var require_printer = __commonJS((exports) => {
  exports.__esModule = true;
  exports.print = print;
  exports.PrintVisitor = PrintVisitor;
  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : { default: obj };
  }
  var _visitor = require_visitor();
  var _visitor2 = _interopRequireDefault(_visitor);
  function print(ast) {
    return new PrintVisitor().accept(ast);
  }
  function PrintVisitor() {
    this.padding = 0;
  }
  PrintVisitor.prototype = new _visitor2["default"];
  PrintVisitor.prototype.pad = function(string) {
    var out = "";
    for (var i = 0, l = this.padding;i < l; i++) {
      out += "  ";
    }
    out += string + `
`;
    return out;
  };
  PrintVisitor.prototype.Program = function(program2) {
    var out = "", body = program2.body, i = undefined, l = undefined;
    if (program2.blockParams) {
      var blockParams = "BLOCK PARAMS: [";
      for (i = 0, l = program2.blockParams.length;i < l; i++) {
        blockParams += " " + program2.blockParams[i];
      }
      blockParams += " ]";
      out += this.pad(blockParams);
    }
    for (i = 0, l = body.length;i < l; i++) {
      out += this.accept(body[i]);
    }
    this.padding--;
    return out;
  };
  PrintVisitor.prototype.MustacheStatement = function(mustache) {
    return this.pad("{{ " + this.SubExpression(mustache) + " }}");
  };
  PrintVisitor.prototype.Decorator = function(mustache) {
    return this.pad("{{ DIRECTIVE " + this.SubExpression(mustache) + " }}");
  };
  PrintVisitor.prototype.BlockStatement = PrintVisitor.prototype.DecoratorBlock = function(block) {
    var out = "";
    out += this.pad((block.type === "DecoratorBlock" ? "DIRECTIVE " : "") + "BLOCK:");
    this.padding++;
    out += this.pad(this.SubExpression(block));
    if (block.program) {
      out += this.pad("PROGRAM:");
      this.padding++;
      out += this.accept(block.program);
      this.padding--;
    }
    if (block.inverse) {
      if (block.program) {
        this.padding++;
      }
      out += this.pad("{{^}}");
      this.padding++;
      out += this.accept(block.inverse);
      this.padding--;
      if (block.program) {
        this.padding--;
      }
    }
    this.padding--;
    return out;
  };
  PrintVisitor.prototype.PartialStatement = function(partial) {
    var content = "PARTIAL:" + partial.name.original;
    if (partial.params[0]) {
      content += " " + this.accept(partial.params[0]);
    }
    if (partial.hash) {
      content += " " + this.accept(partial.hash);
    }
    return this.pad("{{> " + content + " }}");
  };
  PrintVisitor.prototype.PartialBlockStatement = function(partial) {
    var content = "PARTIAL BLOCK:" + partial.name.original;
    if (partial.params[0]) {
      content += " " + this.accept(partial.params[0]);
    }
    if (partial.hash) {
      content += " " + this.accept(partial.hash);
    }
    content += " " + this.pad("PROGRAM:");
    this.padding++;
    content += this.accept(partial.program);
    this.padding--;
    return this.pad("{{> " + content + " }}");
  };
  PrintVisitor.prototype.ContentStatement = function(content) {
    return this.pad("CONTENT[ '" + content.value + "' ]");
  };
  PrintVisitor.prototype.CommentStatement = function(comment) {
    return this.pad("{{! '" + comment.value + "' }}");
  };
  PrintVisitor.prototype.SubExpression = function(sexpr) {
    var params = sexpr.params, paramStrings = [], hash = undefined;
    for (var i = 0, l = params.length;i < l; i++) {
      paramStrings.push(this.accept(params[i]));
    }
    params = "[" + paramStrings.join(", ") + "]";
    hash = sexpr.hash ? " " + this.accept(sexpr.hash) : "";
    return this.accept(sexpr.path) + " " + params + hash;
  };
  PrintVisitor.prototype.PathExpression = function(id) {
    var path = id.parts.join("/");
    return (id.data ? "@" : "") + "PATH:" + path;
  };
  PrintVisitor.prototype.StringLiteral = function(string) {
    return '"' + string.value + '"';
  };
  PrintVisitor.prototype.NumberLiteral = function(number) {
    return "NUMBER{" + number.value + "}";
  };
  PrintVisitor.prototype.BooleanLiteral = function(bool) {
    return "BOOLEAN{" + bool.value + "}";
  };
  PrintVisitor.prototype.UndefinedLiteral = function() {
    return "UNDEFINED";
  };
  PrintVisitor.prototype.NullLiteral = function() {
    return "NULL";
  };
  PrintVisitor.prototype.Hash = function(hash) {
    var pairs = hash.pairs, joinedPairs = [];
    for (var i = 0, l = pairs.length;i < l; i++) {
      joinedPairs.push(this.accept(pairs[i]));
    }
    return "HASH{" + joinedPairs.join(", ") + "}";
  };
  PrintVisitor.prototype.HashPair = function(pair) {
    return pair.key + "=" + this.accept(pair.value);
  };
});

// node_modules/.bun/handlebars@4.7.8/node_modules/handlebars/lib/index.js
var require_lib = __commonJS((exports, module) => {
  var handlebars = require_handlebars()["default"];
  var printer = require_printer();
  handlebars.PrintVisitor = printer.PrintVisitor;
  handlebars.print = printer.print;
  module.exports = handlebars;
  function extension(module2, filename) {
    var fs = __require("fs");
    var templateString = fs.readFileSync(filename, "utf8");
    module2.exports = handlebars.compile(templateString);
  }
  if (__require.extensions) {
    __require.extensions[".handlebars"] = extension;
    __require.extensions[".hbs"] = extension;
  }
});

// engine/program/seed-resolver.ts
import { existsSync as existsSync24, readFileSync as readFileSync24, readdirSync as readdirSync11, writeFileSync as writeFileSync16 } from "node:fs";
import { join as join29 } from "node:path";
function registerPartials(templateDir) {
  const dirs = [
    templateDir ? join29(templateDir, "fragments") : null,
    join29(FLEET_DIR3, "templates", "fragments")
  ].filter(Boolean);
  for (const dir of dirs) {
    if (!existsSync24(dir))
      continue;
    for (const file of readdirSync11(dir).filter((f) => f.endsWith(".md"))) {
      const name = file.replace(".md", "");
      if (!import_handlebars.default.partials[name]) {
        import_handlebars.default.registerPartial(name, readFileSync24(join29(dir, file), "utf-8"));
      }
    }
  }
  _partialsRegistered = true;
}
function substitute(content, vars) {
  const template = import_handlebars.default.compile(content, { noEscape: true, strict: false });
  return template(vars);
}
function resolveTemplatePath(templateRef, templateDir) {
  const candidates = [
    templateDir ? join29(templateDir, templateRef) : null,
    join29(FLEET_DIR3, "templates", templateRef)
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (existsSync24(candidate))
      return candidate;
  }
  return null;
}
function resolveSeed(agent, state, extraVars) {
  const seed = agent.seed;
  if ("inline" in seed) {
    let content = seed.inline;
    const allVars = { ...agent.vars || {}, ...extraVars || {} };
    if (Object.keys(allVars).length > 0) {
      content = substitute(content, allVars);
    }
    return content;
  }
  if ("template" in seed) {
    if (!_partialsRegistered)
      registerPartials(state.templateDir);
    const templatePath = resolveTemplatePath(seed.template, state.templateDir);
    if (!templatePath) {
      console.log(`  WARN: Template not found: ${seed.template}`);
      return null;
    }
    let content = readFileSync24(templatePath, "utf-8");
    const allVars = { ...seed.vars || {}, ...agent.vars || {}, ...extraVars || {} };
    if (Object.keys(allVars).length > 0) {
      content = substitute(content, allVars);
    }
    return content;
  }
  if ("generator" in seed) {
    return null;
  }
  return null;
}
function resolveSeedToFile(agent, state, sessionDir2, extraVars, pipelineContext) {
  let content = resolveSeed(agent, state, extraVars);
  const seedPath = join29(sessionDir2, `${agent.name}-seed.md`);
  if (content) {
    if (pipelineContext) {
      if (content.includes("{{> pipeline-context}}")) {
        content = content.replace("{{> pipeline-context}}", pipelineContext);
      } else {
        content += `

---

` + pipelineContext;
      }
    }
    writeFileSync16(seedPath, content);
  } else {
    writeFileSync16(seedPath, `# ${agent.name}
Seed pending — will be generated at bridge time.`);
  }
  return seedPath;
}
function buildStateVars(state) {
  const vars = {
    SESSION_DIR: state.sessionDir,
    PROJECT_ROOT: state.workDir,
    WORK_DIR: state.workDir,
    TEMPLATE_DIR: state.templateDir,
    VALIDATOR: state.validatorPath,
    SESSION_HASH: state.sessionHash,
    TMUX_SESSION: state.tmuxSession
  };
  if (state.opts) {
    for (const [k, v] of Object.entries(state.opts)) {
      if (typeof v === "string")
        vars[k.toUpperCase()] = v;
      else if (v !== null && v !== undefined)
        vars[k.toUpperCase()] = String(v);
    }
  }
  if (state.material) {
    vars.MATERIAL_FILE = state.material.materialFile;
    vars.MATERIAL_TYPE = state.material.materialType;
    vars.MATERIAL_LINES = String(state.material.diffLines);
    vars.DIFF_DESC = state.material.diffDesc;
    vars.MATERIAL_TYPES = state.material.materialTypesStr;
  }
  const spec = state.ext?.spec;
  if (spec) {
    vars.REVIEW_SPEC = spec;
  }
  const reviewConfig = state.ext?.reviewConfig;
  if (reviewConfig) {
    vars.REVIEW_CONFIG = reviewConfig;
  }
  const coordinatorName = state.ext?.coordinatorName;
  if (coordinatorName) {
    vars.COORDINATOR_NAME = coordinatorName;
  }
  const roleResult = state.ext?.roleResult;
  if (roleResult) {
    vars.NUM_PASSES = String(roleResult.totalWorkers);
    vars.NUM_FOCUS = String(roleResult.numFocus);
    vars.PASSES_PER_FOCUS = String(roleResult.passesPerFocus);
    vars.FOCUS_LIST = roleResult.focusAreas.filter((v, i, a) => a.indexOf(v) === i).join(",");
    if (roleResult.roleNames) {
      vars.ROLE_NAMES = roleResult.roleNames;
    }
  }
  return vars;
}
var import_handlebars, HOME10, FLEET_DIR3, _partialsRegistered = false;
var init_seed_resolver = __esm(() => {
  import_handlebars = __toESM(require_lib(), 1);
  HOME10 = process.env.HOME || "/tmp";
  FLEET_DIR3 = process.env.CLAUDE_FLEET_DIR || join29(HOME10, ".claude-fleet");
  import_handlebars.default.registerHelper("helperMissing", function(...args) {
    const opts = args[args.length - 1];
    return new import_handlebars.default.SafeString(`{{${opts.name}}}`);
  });
});

// engine/program/compiler.ts
import { writeFileSync as writeFileSync17, readFileSync as fsReadFileSync } from "node:fs";
import { join as join30 } from "node:path";
function compile(program2, state) {
  const g = program2.graph || phasesToGraph(program2);
  return compileGraph(g, state);
}
function compilePhase(phaseIndex, agents, phase, state, graph) {
  const stateVars = buildStateVars(state);
  const defaultModel = state.defaults.model || "sonnet[1m]";
  const panesPerWindow = phase.layout?.panesPerWindow || 4;
  const windowMap = new Map;
  for (const agent of agents) {
    const win = agent.window || phase.name;
    if (!windowMap.has(win))
      windowMap.set(win, []);
    windowMap.get(win).push(agent);
  }
  const windows = [];
  const workers = [];
  for (const [winName, winAgents] of windowMap) {
    const numSubWindows = Math.ceil(winAgents.length / panesPerWindow);
    for (let sw = 0;sw < numSubWindows; sw++) {
      const subAgents = winAgents.slice(sw * panesPerWindow, (sw + 1) * panesPerWindow);
      const windowName = numSubWindows > 1 ? `${winName}-${sw + 1}` : winName;
      windows.push({
        name: windowName,
        paneCount: subAgents.length,
        phase: phase.name,
        layout: phase.layout?.algorithm || "tiled"
      });
      for (let p = 0;p < subAgents.length; p++) {
        const agent = subAgents[p];
        const model = agent.model || defaultModel;
        let pipelineContext;
        if (graph && !agent.noPipelineContext) {
          pipelineContext = generatePipelineContext(agent, phase.name, agents, graph, state);
        }
        const resultsDir = join30(state.sessionDir, "results", agent.name);
        const seedPath = resolveSeedToFile(agent, state, state.sessionDir, { ...stateVars, RESULTS_DIR: resultsDir, ...agent.vars || {} }, pipelineContext);
        const wrapperPath = join30(state.sessionDir, `run-${agent.name}.sh`);
        const compiled = {
          name: agent.name,
          role: agent.role,
          model,
          runtime: agent.runtime,
          customLauncher: agent.customLauncher,
          seedPath,
          wrapperPath,
          window: windowName,
          paneIndex: p,
          phaseIndex,
          sleepDuration: agent.sleepDuration,
          env: agent.env,
          permissionMode: agent.permissionMode,
          timeout: agent.timeout
        };
        if (agent.tools?.length) {
          compiled.eventTools = agent.tools;
          compiled.eventToolsProgramPath = state.programPath;
        }
        workers.push(compiled);
      }
    }
  }
  const compiledPhase = {
    index: phaseIndex,
    name: phase.name,
    status: "compiled",
    agentCount: agents.length,
    agentNames: agents.map((a) => a.name),
    dynamic: false
  };
  return { phase: compiledPhase, windows, workers };
}
function resolveGateAgents(phase, agents) {
  if (!phase.gate || phase.gate === "all") {
    return phase.gate === "all" ? agents : [agents[agents.length - 1]];
  }
  const named = agents.find((a) => a.name === phase.gate);
  return named ? [named] : [agents[agents.length - 1]];
}
function compileGraph(g, state) {
  const nodeIndexMap = buildNodeIndexMap(g);
  state.nodeIndexMap = nodeIndexMap;
  const plan = {
    program: { name: g.name, description: g.description },
    phases: [],
    windows: [],
    workers: [],
    hooks: [],
    sessionDir: state.sessionDir,
    programPath: state.programPath
  };
  const sorted = topologicalSort(g);
  for (const nodeName of sorted) {
    const node = g.nodes[nodeName];
    const idx = nodeIndexMap[nodeName];
    const phaseCompat = {
      name: nodeName,
      description: node.description,
      agents: node.agents,
      gate: node.gate,
      layout: node.layout,
      prelaunch: node.prelaunch,
      hooks: node.hooks
    };
    if (isDynamic(node.agents)) {
      const estimate = node.agents.estimate || 4;
      plan.phases.push({
        index: idx,
        name: nodeName,
        status: "deferred",
        agentCount: estimate,
        agentNames: [],
        dynamic: true,
        estimate,
        nodeName
      });
      const panesPerWindow = node.layout?.panesPerWindow || 4;
      const numWindows = Math.ceil(estimate / panesPerWindow);
      for (let w = 1;w <= numWindows; w++) {
        plan.windows.push({
          name: `${nodeName}-${w}`,
          paneCount: Math.min(panesPerWindow, estimate - (w - 1) * panesPerWindow),
          phase: nodeName,
          layout: node.layout?.algorithm || "tiled"
        });
      }
    } else {
      const compiled = compilePhase(idx, node.agents, phaseCompat, state, g);
      compiled.phase.nodeName = nodeName;
      plan.phases.push(compiled.phase);
      plan.windows.push(...compiled.windows);
      plan.workers.push(...compiled.workers);
    }
    const edges = outgoingEdges(g, nodeName);
    if (edges.length > 0 && !isDynamic(node.agents)) {
      const gateAgents = resolveGateAgents(phaseCompat, node.agents);
      const isGateAll = node.gate === "all";
      for (const gateAgent of gateAgents) {
        installGraphStopHook(gateAgent.name, state.fleetProject, state.sessionDir, nodeName, edges, nodeIndexMap, isGateAll ? gateAgents.length : undefined, state.sessionHash);
        const defaultTarget = edges.find((e) => !e.condition) || edges[0];
        const targetIdx = defaultTarget.to === END_SENTINEL ? -1 : nodeIndexMap[defaultTarget.to];
        plan.hooks.push({
          workerName: gateAgent.name,
          targetPhaseIndex: targetIdx,
          targetNodeName: defaultTarget.to,
          scriptPath: join30(HOME11, ".claude/fleet", state.fleetProject, `${gateAgent.name}-${state.sessionHash}`, "hooks", `node-${nodeName}-stop.sh`),
          sessionDirPath: state.sessionDir,
          gateCount: isGateAll ? gateAgents.length : undefined
        });
      }
    }
    if (node.hooks && node.hooks.length > 0 && !isDynamic(node.agents)) {
      for (const agent of node.agents) {
        const workerHooksDir = join30(FLEET_DATA, state.fleetProject, `${agent.name}-${state.sessionHash}`, "hooks");
        installPipelineHooks(workerHooksDir, node.hooks, g.name).catch(() => {});
      }
    }
    if (!isDynamic(node.agents)) {
      for (const agent of node.agents) {
        if (agent.hooks && agent.hooks.length > 0) {
          const workerHooksDir = join30(FLEET_DATA, state.fleetProject, `${agent.name}-${state.sessionHash}`, "hooks");
          installPipelineHooks(workerHooksDir, agent.hooks, g.name).catch(() => {});
        }
        if (agent.allowedTools?.length || agent.deniedTools?.length) {
          const workerHooksDir = join30(FLEET_DATA, state.fleetProject, `${agent.name}-${state.sessionHash}`, "hooks");
          installToolRestrictionHooks(workerHooksDir, agent.allowedTools, agent.deniedTools).catch(() => {});
        }
      }
    }
  }
  return plan;
}
function installGraphStopHook(workerName, project, sessionDir2, fromNode, edges, nodeIndexMap, gateCount, sessionHash) {
  const { mkdirSync: mkdirSync17, writeFileSync: wfs } = __require("node:fs");
  const workerHooksDir = join30(FLEET_DATA, project, sessionHash ? `${workerName}-${sessionHash}` : workerName, "hooks");
  mkdirSync17(workerHooksDir, { recursive: true });
  const scriptName = `node-${fromNode}-stop.sh`;
  const destScript = join30(workerHooksDir, scriptName);
  const FLEET_DIR_DEFAULT2 = join30(process.env.HOME || "/tmp", ".claude-fleet");
  let script = `#!/usr/bin/env bash
# ${workerName} Stop -> edge evaluation from node "${fromNode}"
set -euo pipefail
SESSION_DIR="${sessionDir2}"
FLEET_DIR="\${CLAUDE_FLEET_DIR:-${FLEET_DIR_DEFAULT2}}"

# Auto-detect Xray proxy for China network
if [ -z "\${HTTPS_PROXY:-}" ]; then
  if ss -tln 2>/dev/null | grep -q ':10809' || nc -z localhost 10809 2>/dev/null; then
    export HTTPS_PROXY="http://localhost:10809"
  fi
fi
`;
  if (gateCount && gateCount > 1) {
    script += `
echo "done" > "$SESSION_DIR/${workerName}.done"
ACTUAL=$(ls "$SESSION_DIR"/*.done 2>/dev/null | wc -l | tr -d ' ')
if [ "$ACTUAL" -lt ${gateCount} ]; then
  exit 0
fi
`;
  }
  for (let i = 0;i < edges.length; i++) {
    const edge = edges[i];
    const edgeCondition = edge.condition?.replace(/\{\{SESSION_DIR\}\}/g, "$SESSION_DIR");
    const target = edge.to;
    const targetIdx = target === END_SENTINEL ? -1 : nodeIndexMap[target];
    if (edge.maxIterations) {
      const counterFile = `"$SESSION_DIR/cycle-${fromNode}-to-${target}.count"`;
      script += `
# Edge ${i}: ${edge.label || `${fromNode} -> ${target}`} (max ${edge.maxIterations} iterations)
CYCLE=$(cat ${counterFile} 2>/dev/null || echo 0)
`;
      if (edgeCondition) {
        script += `if [ "$CYCLE" -lt ${edge.maxIterations} ] && (${edgeCondition}); then
  echo $((CYCLE + 1)) > ${counterFile}
`;
      } else {
        script += `if [ "$CYCLE" -lt ${edge.maxIterations} ]; then
  echo $((CYCLE + 1)) > ${counterFile}
`;
      }
      if (target === END_SENTINEL) {
        script += `  exit 0
fi
`;
      } else {
        script += `  nohup bun "$FLEET_DIR/engine/program/bridge.ts" "$SESSION_DIR" "${targetIdx}" \\
    >> "$SESSION_DIR/bridge-${targetIdx}.log" 2>&1 &
  exit 0
fi
`;
      }
    } else if (edgeCondition) {
      script += `
# Edge ${i}: ${edge.label || `${fromNode} -> ${target}`} (conditional)
if (${edgeCondition}); then
`;
      if (target === END_SENTINEL) {
        script += `  exit 0
fi
`;
      } else {
        script += `  nohup bun "$FLEET_DIR/engine/program/bridge.ts" "$SESSION_DIR" "${targetIdx}" \\
    >> "$SESSION_DIR/bridge-${targetIdx}.log" 2>&1 &
  exit 0
fi
`;
      }
    } else {
      if (target === END_SENTINEL) {
        script += `
# Edge ${i}: ${edge.label || "pipeline complete"} (unconditional -> $end)
exit 0
`;
      } else {
        script += `
# Edge ${i}: ${edge.label || `${fromNode} -> ${target}`} (unconditional)
nohup bun "$FLEET_DIR/engine/program/bridge.ts" "$SESSION_DIR" "${targetIdx}" \\
  >> "$SESSION_DIR/bridge-${targetIdx}.log" 2>&1 &
exit 0
`;
      }
    }
  }
  script += `
# No edge matched — pipeline complete
exit 0
`;
  wfs(destScript, script, { mode: 493 });
  const hooksJsonPath = join30(workerHooksDir, "hooks.json");
  const { readFileSync: rfs } = __require("node:fs");
  let existingHooks = [];
  try {
    const existing = JSON.parse(rfs(hooksJsonPath, "utf-8"));
    existingHooks = existing.hooks || [];
  } catch {}
  existingHooks = existingHooks.filter((h) => h.script_path !== scriptName);
  existingHooks.push({
    id: `dh-stop-${fromNode}`,
    event: "Stop",
    description: `Graph: edge evaluation from node "${fromNode}" (${workerName})`,
    blocking: false,
    completed: false,
    status: "active",
    lifetime: "persistent",
    script_path: scriptName,
    registered_by: "program-api",
    ownership: "creator",
    added_at: new Date().toISOString()
  });
  wfs(hooksJsonPath, JSON.stringify({ hooks: existingHooks }, null, 2));
}
function savePipelineState(state) {
  writeFileSync17(join30(state.sessionDir, "pipeline-state.json"), JSON.stringify(state, null, 2));
}
var HOME11;
var init_compiler = __esm(() => {
  init_pipeline_context();
  init_seed_resolver();
  init_hook_generator();
  init_paths();
  init_graph();
  HOME11 = process.env.HOME || "/tmp";
});

// engine/program/manifest.ts
import { writeFileSync as writeFileSync18, existsSync as existsSync25, readFileSync as readFileSync25 } from "node:fs";
import { join as join31 } from "node:path";
function generateManifest(program2, state, compiledPhases) {
  const g = program2.graph || phasesToGraph(program2);
  return generateGraphManifest(g, state, compiledPhases);
}
function generateGraphManifest(g, state, compiledPhases) {
  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  const sorted = topologicalSort(g);
  let nodesSection = "";
  for (let i = 0;i < sorted.length; i++) {
    const nodeName = sorted[i];
    const node = g.nodes[nodeName];
    const compiled = compiledPhases.find((p) => p.nodeName === nodeName);
    const isEntry = nodeName === g.entry;
    const status = isEntry ? "RUNNING" : compiled?.status === "compiled" ? "READY" : "PENDING";
    const dynamic = isDynamic(node.agents) ? ", DYNAMIC" : "";
    nodesSection += `  ${isEntry ? ">" : " "} ${nodeName.padEnd(24)} [${status}${dynamic}]
`;
    if (compiled?.status === "compiled") {
      for (const name of compiled.agentNames) {
        nodesSection += `      ${name}
`;
      }
    } else if (isDynamic(node.agents)) {
      const est = node.agents.estimate || "?";
      nodesSection += `      ~${est} agents (dynamic)
`;
    } else {
      for (const agent of node.agents) {
        const model = agent.model || state.defaults.model || "default";
        nodesSection += `      ${agent.name} (${model})
`;
      }
    }
    if (node.hooks && node.hooks.length > 0) {
      nodesSection += `      Hooks: ${node.hooks.map((h) => `${h.event}:${h.type}`).join(", ")}
`;
    }
    nodesSection += `
`;
  }
  let edgesSection = "";
  for (const edge of g.edges) {
    const cond = edge.condition ? ` [if: ${edge.condition.slice(0, 50)}${edge.condition.length > 50 ? "..." : ""}]` : "";
    const iter = edge.maxIterations ? ` (max ${edge.maxIterations}x)` : "";
    const label = edge.label ? ` "${edge.label}"` : "";
    edgesSection += `  ${edge.from} -> ${edge.to}${label}${cond}${iter}
`;
  }
  const terminals = sorted.filter((n) => {
    const edges = outgoingEdges(g, n);
    return edges.length === 0 || edges.every((e) => e.to === END_SENTINEL);
  });
  const topology = `  ${g.entry} -> ... -> ${terminals.join(", ") || "$end"}`;
  let windowList = `  :0 manifest
`;
  const windowNames = new Set;
  for (const nodeName of sorted) {
    const node = g.nodes[nodeName];
    if (isDynamic(node.agents)) {
      const est = node.agents.estimate || 4;
      const numWindows = Math.ceil(est / (node.layout?.panesPerWindow || 4));
      for (let w = 1;w <= numWindows; w++)
        windowNames.add(`${nodeName}-${w}`);
    } else {
      for (const agent of node.agents)
        windowNames.add(agent.window || nodeName);
    }
  }
  for (const name of windowNames)
    windowList += `  :${name}
`;
  const manifest = `═══════════════════════════════════════════════════
  PIPELINE: ${g.name} (graph)
  Session:  ${state.tmuxSession}
  Created:  ${now}
═══════════════════════════════════════════════════

${state.material ? `MATERIAL
────────
  Scope:     ${state.material.diffDesc || state.material.materialType}
  Lines:     ${state.material.diffLines}
  Type:      ${state.material.materialType}
${state.ext?.spec ? `  Spec:      ${state.ext.spec}
` : ""}
` : ""}NODES (${sorted.length})
──────${sorted.length >= 10 ? "─" : ""}
${nodesSection}
EDGES (${g.edges.length})
──────${g.edges.length >= 10 ? "─" : ""}
${edgesSection}
TOPOLOGY
────────
${topology}

WINDOWS
───────
${windowList}
FILES
─────
  Program:  ${state.programPath}
  State:    ${state.sessionDir}/pipeline-state.json
  Cleanup:  ${state.sessionDir}/cleanup.sh
  Manifest: ${state.sessionDir}/manifest.txt

ATTACH
──────
  tmux switch-client -t ${state.tmuxSession}
  tmux a -t ${state.tmuxSession}
`;
  const manifestPath = join31(state.sessionDir, "manifest.txt");
  writeFileSync18(manifestPath, manifest);
  return manifestPath;
}
var init_manifest = __esm(() => {
  init_graph();
});

// engine/program/tmux-layout.ts
import { existsSync as existsSync26, readFileSync as readFileSync26, writeFileSync as writeFileSync19 } from "node:fs";
import { join as join32 } from "node:path";
function tmux2(...args) {
  const result = Bun.spawnSync(["tmux", ...args], { stderr: "pipe" });
  return { ok: result.exitCode === 0, stdout: result.stdout.toString().trim() };
}
function getPaneId(target, index) {
  const { stdout } = tmux2("list-panes", "-t", target, "-F", "#{pane_id}");
  const panes = stdout.split(`
`).filter(Boolean);
  return panes[index] || "";
}
function createTmuxSession(state, windows) {
  const session = state.tmuxSession;
  const sessionExists2 = tmux2("has-session", "-t", session).ok;
  if (sessionExists2) {
    console.log(`Killing existing session: ${session}`);
    tmux2("kill-session", "-t", session);
  }
  console.log(`Creating tmux session: ${session}`);
  tmux2("new-session", "-d", "-s", session, "-n", "manifest", "-c", state.projectRoot);
  Bun.sleepSync(300);
  const created = new Set;
  for (const win of windows) {
    if (created.has(win.name)) {
      for (let p = 0;p < win.paneCount; p++) {
        tmux2("split-window", "-d", "-t", `${session}:${win.name}`, "-c", state.projectRoot);
      }
      tmux2("select-layout", "-t", `${session}:${win.name}`, win.layout || "tiled");
      continue;
    }
    created.add(win.name);
    tmux2("new-window", "-d", "-t", session, "-n", win.name, "-c", state.projectRoot);
    for (let p = 1;p < win.paneCount; p++) {
      tmux2("split-window", "-d", "-t", `${session}:${win.name}`, "-c", state.projectRoot);
    }
    if (win.paneCount > 1) {
      tmux2("select-layout", "-t", `${session}:${win.name}`, win.layout || "tiled");
    }
  }
  Bun.sleepSync(500);
  return session;
}
function launchAgent(worker, session, state) {
  const pane = getPaneId(`${session}:${worker.window}`, worker.paneIndex);
  if (!pane) {
    console.log(`  WARN: No pane at ${session}:${worker.window}[${worker.paneIndex}]`);
    return;
  }
  tmux2("send-keys", "-t", pane, `bash '${worker.wrapperPath}'`, "Enter");
  console.log(`  ${worker.name} → ${pane} (${worker.window}[${worker.paneIndex}])`);
  if (state.fleetProject) {
    const stateFile = join32(FLEET_DATA, state.fleetProject, worker.name, "state.json");
    try {
      const s = JSON.parse(readFileSync26(stateFile, "utf-8"));
      s.pane_id = pane;
      s.pane_target = `${session}:${worker.window}`;
      writeFileSync19(stateFile, JSON.stringify(s, null, 2));
    } catch {}
  }
}
function launchAgents(workers, session, state) {
  console.log(`Launching ${workers.length} agents...`);
  for (let i = 0;i < workers.length; i++) {
    launchAgent(workers[i], session, state);
    if (i < workers.length - 1) {
      Bun.sleepSync(300);
    }
  }
}
function launchInPlanningWindow(worker, session, state, paneIndex) {
  const target = `${session}:${worker.window || "planning"}`;
  const hasWindow = tmux2("has-session", "-t", target);
  let pane;
  if (hasWindow.ok) {
    if (paneIndex && paneIndex > 0) {
      tmux2("split-window", "-d", "-t", target, "-c", state.workDir);
      Bun.sleepSync(300);
    }
    pane = getPaneId(target, paneIndex || 0);
  } else {
    tmux2("new-window", "-d", "-t", session, "-n", worker.window || "planning", "-c", state.workDir);
    Bun.sleepSync(300);
    pane = getPaneId(`${session}:${worker.window || "planning"}`, 0);
  }
  if (pane) {
    tmux2("send-keys", "-t", pane, `bash '${worker.wrapperPath}'`, "Enter");
    console.log(`  ${worker.name} → ${pane} (${worker.window || "planning"})`);
    if (state.fleetProject) {
      const stateFile = join32(FLEET_DATA, state.fleetProject, worker.name, "state.json");
      try {
        const s = JSON.parse(readFileSync26(stateFile, "utf-8"));
        s.pane_id = pane;
        s.pane_target = target;
        writeFileSync19(stateFile, JSON.stringify(s, null, 2));
      } catch {}
    }
  }
}
function showManifest(session, manifestPath) {
  if (!existsSync26(manifestPath))
    return;
  const pane = getPaneId(`${session}:manifest`, 0);
  if (pane) {
    tmux2("send-keys", "-t", pane, `cat '${manifestPath}'`, "Enter");
  }
}
var init_tmux_layout = __esm(() => {
  init_paths();
});

// engine/program/fleet-provision.ts
import { mkdirSync as mkdirSync17, writeFileSync as writeFileSync20, rmSync as rmSync4, existsSync as existsSync27, readdirSync as readdirSync12, readFileSync as readFileSync27 } from "node:fs";
import { join as join33 } from "node:path";
async function provisionWorkers(workers, state) {
  const tokens = new Map;
  const project = state.fleetProject;
  const projectDir = join33(FLEET_DATA, project);
  mkdirSync17(projectDir, { recursive: true });
  const now = new Date().toISOString();
  for (const worker of workers) {
    const workerDir2 = join33(projectDir, `${worker.name}-${state.sessionHash}`);
    mkdirSync17(workerDir2, { recursive: true });
    const isPerpetual = typeof worker.sleepDuration === "number" && worker.sleepDuration > 0;
    const config = {
      model: worker.model,
      runtime: worker.runtime || "claude",
      customLauncher: worker.customLauncher,
      reasoning_effort: state.defaults.effort || "high",
      permission_mode: state.defaults.permission || "bypassPermissions",
      sleep_duration: isPerpetual ? worker.sleepDuration : null,
      window: null,
      worktree: state.workDir,
      branch: "HEAD",
      mcp: {},
      hooks: [],
      ephemeral: !isPerpetual,
      meta: {
        created_at: now,
        created_by: state.programName,
        forked_from: null,
        project
      }
    };
    writeFileSync20(join33(workerDir2, "config.json"), JSON.stringify(config, null, 2));
    const workerState = {
      status: "active",
      pane_id: null,
      pane_target: null,
      tmux_session: state.tmuxSession,
      session_id: state.sessionHash,
      past_sessions: [],
      last_relaunch: null,
      relaunch_count: 0,
      cycles_completed: 0,
      last_cycle_at: null,
      custom: {
        role: worker.role,
        session_hash: state.sessionHash,
        program: state.programName,
        phase: worker.phaseIndex
      }
    };
    writeFileSync20(join33(workerDir2, "state.json"), JSON.stringify(workerState, null, 2));
    writeFileSync20(join33(workerDir2, "token"), "");
    writeFileSync20(join33(workerDir2, "mission.md"), `# ${worker.name}
${state.programName} ${worker.role} (${isPerpetual ? `perpetual, ${worker.sleepDuration}s cycles` : "ephemeral"})`);
    if (worker.eventTools?.length) {
      writeFileSync20(join33(workerDir2, "event-tools.json"), JSON.stringify({
        programPath: worker.eventToolsProgramPath,
        tools: worker.eventTools,
        sessionDir: state.sessionDir,
        projectRoot: state.projectRoot
      }, null, 2));
    }
  }
  if (FLEET_MAIL_URL) {
    const mailHeaders = { "Content-Type": "application/json" };
    if (FLEET_MAIL_TOKEN)
      mailHeaders["Authorization"] = `Bearer ${FLEET_MAIL_TOKEN}`;
    const names = workers.map((w) => w.name);
    const results = await Promise.allSettled(names.map(async (name) => {
      const accountName = `${name}@${project}`;
      try {
        const resp = await fetch(`${FLEET_MAIL_URL}/api/accounts`, {
          method: "POST",
          headers: mailHeaders,
          body: JSON.stringify({ name: accountName }),
          signal: AbortSignal.timeout(5000)
        });
        if (resp.ok) {
          const data = await resp.json();
          return { name, token: data.bearerToken || data.token || "" };
        }
        if (resp.status === 409 && FLEET_MAIL_TOKEN) {
          const resetResp = await fetch(`${FLEET_MAIL_URL}/api/admin/accounts/${encodeURIComponent(accountName)}/reset-token`, {
            method: "POST",
            headers: { Authorization: `Bearer ${FLEET_MAIL_TOKEN}` },
            signal: AbortSignal.timeout(5000)
          });
          if (resetResp.ok) {
            const data = await resetResp.json();
            return { name, token: data.bearerToken || data.token || "" };
          }
        }
        return { name, token: "" };
      } catch {
        return { name, token: "" };
      }
    }));
    let provisioned = 0;
    for (const result of results) {
      if (result.status === "fulfilled" && result.value.token) {
        const { name, token } = result.value;
        tokens.set(name, token);
        writeFileSync20(join33(projectDir, `${name}-${state.sessionHash}`, "token"), token);
        provisioned++;
      } else if (result.status === "fulfilled") {
        writeFileSync20(join33(projectDir, `${result.value.name}-${state.sessionHash}`, "token"), "");
      }
    }
    const failed = names.length - provisioned;
    if (failed > 0) {
      const failedNames = [];
      for (let i = 0;i < results.length; i++) {
        const r = results[i];
        if (r.status === "rejected" || r.status === "fulfilled" && !r.value.token) {
          failedNames.push(names[i]);
        }
      }
      console.log(`  Fleet Mail: ${provisioned}/${names.length} accounts provisioned (failed: ${failedNames.join(", ")})`);
      if (failed > names.length / 2 && names.length > 1) {
        throw new Error(`Fleet Mail provisioning failed for ${failed}/${names.length} workers: ${failedNames.join(", ")}. ` + `Pipeline requires messaging for coordination.`);
      }
    } else {
      console.log(`  Fleet Mail: ${provisioned}/${names.length} accounts provisioned`);
    }
  } else {
    console.log("  WARN: Fleet Mail not configured — workers will run without messaging");
  }
  return tokens;
}
function buildMailEnvExport(workerName, project, sessionHash) {
  const dirName = sessionHash ? `${workerName}-${sessionHash}` : workerName;
  const tokenPath = join33(FLEET_DATA, project, dirName, "token");
  let token = "";
  try {
    token = readFileSync27(tokenPath, "utf-8").trim();
  } catch {}
  const mailUrl = FLEET_MAIL_URL || "";
  return [
    `export WORKER_NAME="${workerName}"`,
    `export FLEET_MAIL_URL="${mailUrl}"`,
    token ? `export FLEET_MAIL_TOKEN="${token}"` : ""
  ].filter(Boolean).join(`
`);
}
function generateLaunchWrapper(worker, state) {
  const fleetEnv = buildMailEnvExport(worker.name, state.fleetProject, state.sessionHash);
  const hooksDir = join33(FLEET_DATA, state.fleetProject, `${worker.name}-${state.sessionHash}`, "hooks");
  const fleetDir = process.env.CLAUDE_FLEET_DIR || join33(process.env.HOME || "/tmp", ".claude-fleet");
  const customEnv = worker.env ? Object.entries(worker.env).map(([k, v]) => `export ${k}="${v.replace(/"/g, "\\\"")}"`).join(`
`) : "";
  const permMode = worker.permissionMode || state.defaults.permission || "bypassPermissions";
  const permFlag = permMode === "bypassPermissions" ? " --dangerously-skip-permissions" : "";
  const execPrefix = worker.timeout && worker.timeout > 0 ? `timeout ${worker.timeout} ` : "";
  const effort = state.defaults.effort || "high";
  const effortFlag = ` --effort "${effort}"`;
  const workerDir2 = join33(FLEET_DATA, state.fleetProject, `${worker.name}-${state.sessionHash}`);
  const addDirFlag = ` --add-dir "${workerDir2}"`;
  const resultsDir = join33(state.sessionDir, "results", worker.name);
  mkdirSync17(resultsDir, { recursive: true });
  if (worker.runtime === "sdk") {
    const { generateSdkLauncher: generateSdkLauncher2 } = (init_sdk_launcher(), __toCommonJS(exports_sdk_launcher));
    generateSdkLauncher2(worker, state);
  }
  const script = `#!/usr/bin/env bash
cd "${state.workDir}"
${fleetEnv}
${customEnv ? customEnv + `
` : ""}export PROJECT_ROOT="${state.workDir}"
export HOOKS_DIR="${hooksDir}"
export CLAUDE_FLEET_DIR="${fleetDir}"
export CLAUDE_CODE_SKIP_PROJECT_LOCK=1
unset CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS  # Prevent teammate pane spawning in pipelines
export RESULTS_DIR="${resultsDir}"
export CLAUDECODE=1
# Proxy for China network (cn/Xray) — check parent env, then localhost
if [ -z "\${HTTPS_PROXY:-}" ]; then
  if curl -s --connect-timeout 1 http://localhost:10809 >/dev/null 2>&1 || ss -tln 2>/dev/null | grep -q ':10809'; then
    export HTTPS_PROXY="http://localhost:10809"
  fi
fi
# Inherit OAuth token for headless/headful auth
[ -n "\${CLAUDE_CODE_OAUTH_TOKEN:-}" ] || {
  TOKEN_FILE="${process.env.HOME}/.claude/sensitive/oauth-tokens.md"
  if [ -f "$TOKEN_FILE" ]; then
    export CLAUDE_CODE_OAUTH_TOKEN="$(grep 'sk-ant-oat01' "$TOKEN_FILE" | sed -n '2p' | tr -d ' ')"
  fi
}

# Launch Claude, then inject seed via tmux paste (more reliable than CLI arg)
SEED_FILE='${worker.seedPath}'
PANE_ID="\${TMUX_PANE:-}"

if [ -n "$PANE_ID" ] && [ -f "$SEED_FILE" ]; then
  ${execPrefix}claude --model '${worker.model}'${effortFlag}${permFlag}${addDirFlag} &
  CLAUDE_PID=$!
  sleep 5
  tmux load-buffer "$SEED_FILE"
  tmux paste-buffer -t "$PANE_ID"
  # Retry Enter key with jitter — Claude may not be ready after paste
  for ATTEMPT in 1 2 3; do
    JITTER=$((RANDOM % 4 + 2))  # 2-5 seconds
    sleep $JITTER
    tmux send-keys -t "$PANE_ID" -H 0d
    # If Claude process died, stop retrying
    if ! kill -0 $CLAUDE_PID 2>/dev/null; then break; fi
  done
  wait $CLAUDE_PID
else
  # Fallback: CLI arg (works for non-tmux or missing seed)
  exec ${execPrefix}claude --model '${worker.model}'${effortFlag}${permFlag}${addDirFlag} "$(cat '\${SEED_FILE}')"
fi
`;
  writeFileSync20(worker.wrapperPath, script, { mode: 493 });
  return worker.wrapperPath;
}
function generateCleanupScript(state) {
  const fleetDir = process.env.CLAUDE_FLEET_DIR || join33(process.env.HOME || "/tmp", ".claude-fleet");
  const cleanupPath = join33(state.sessionDir, "cleanup.sh");
  const script = `#!/usr/bin/env bash
# Auto-cleanup for ${state.programName} pipeline workers
cd "${state.projectRoot}"
exec bun -e "
import('${fleetDir}/engine/program/fleet-provision.ts').then(m =>
  m.cleanupPipelineWorkers('${state.sessionHash}', '${state.fleetProject}')
).then(() => console.log('Cleanup complete'));
"
`;
  writeFileSync20(cleanupPath, script, { mode: 493 });
  return cleanupPath;
}
var init_fleet_provision = __esm(() => {
  init_paths();
});

// cli/lib/deep-review/material.ts
var exports_material = {};
__export(exports_material, {
  shouldAutoSkip: () => shouldAutoSkip,
  collectMaterial: () => collectMaterial,
  collectCodebaseMaterial: () => collectCodebaseMaterial
});
import { existsSync as existsSync28, readFileSync as readFileSync28, writeFileSync as writeFileSync21, unlinkSync, appendFileSync as appendFileSync2, mkdirSync as mkdirSync18 } from "node:fs";
import { join as join34, basename as basename5 } from "node:path";
function generateDiff(scope, sessionDir2, projectRoot) {
  const diffTmp = join34(sessionDir2, "_diff.patch");
  if (scope === "uncommitted") {
    const d1 = Bun.spawnSync(["git", "diff"], { cwd: projectRoot });
    const d2 = Bun.spawnSync(["git", "diff", "--cached"], { cwd: projectRoot });
    let content = d1.stdout.toString() + d2.stdout.toString();
    const untracked = Bun.spawnSync(["git", "ls-files", "--others", "--exclude-standard"], { cwd: projectRoot });
    for (const f of untracked.stdout.toString().trim().split(`
`).filter(Boolean)) {
      content += `diff --git a/${f} b/${f}
new file mode 100644
--- /dev/null
+++ b/${f}
`;
      try {
        const fileContent = readFileSync28(join34(projectRoot, f), "utf-8");
        content += fileContent.split(`
`).map((l) => `+${l}`).join(`
`) + `
`;
      } catch {}
    }
    writeFileSync21(diffTmp, content);
    return { lines: content.split(`
`).length, descPart: "uncommitted changes" };
  }
  if (scope.startsWith("pr:")) {
    const prNum = scope.slice(3);
    const result = Bun.spawnSync(["gh", "pr", "diff", prNum], { cwd: projectRoot });
    writeFileSync21(diffTmp, result.stdout.toString());
    return { lines: result.stdout.toString().split(`
`).length, descPart: `PR #${prNum}` };
  }
  if (scope.includes("..")) {
    const result = Bun.spawnSync(["git", "diff", scope], { cwd: projectRoot });
    writeFileSync21(diffTmp, result.stdout.toString());
    return { lines: result.stdout.toString().split(`
`).length, descPart: scope };
  }
  const verifyResult = Bun.spawnSync(["git", "rev-parse", "--verify", `${scope}^{commit}`], { cwd: projectRoot, stderr: "pipe" });
  const scopeRev = Bun.spawnSync(["git", "rev-parse", scope], { cwd: projectRoot, stderr: "pipe" }).stdout.toString().trim();
  const mergeBase = Bun.spawnSync(["git", "merge-base", scope, "HEAD"], { cwd: projectRoot, stderr: "pipe" }).stdout.toString().trim();
  if (verifyResult.exitCode === 0 && scopeRev !== mergeBase) {
    let result = Bun.spawnSync(["git", "diff", `${scope}...HEAD`], { cwd: projectRoot, stderr: "pipe" });
    let content = result.stdout.toString();
    if (!content.trim()) {
      result = Bun.spawnSync(["git", "diff", `${scope}..HEAD`], { cwd: projectRoot, stderr: "pipe" });
      content = result.stdout.toString();
    }
    if (!content.trim()) {
      const countResult = Bun.spawnSync(["git", "rev-list", `${scope}..HEAD`, "--count"], { cwd: projectRoot, stderr: "pipe" });
      const commitsAhead = parseInt(countResult.stdout.toString().trim(), 10) || 0;
      if (commitsAhead > 0) {
        console.log(`WARN: ${commitsAhead} commits ahead but tree content identical. Fallback to per-commit diffs...`);
        const revList = Bun.spawnSync(["git", "rev-list", "--reverse", `${scope}..HEAD`], { cwd: projectRoot });
        for (const sha of revList.stdout.toString().trim().split(`
`).filter(Boolean)) {
          const show = Bun.spawnSync(["git", "show", sha], { cwd: projectRoot, stderr: "pipe" });
          content += show.stdout.toString();
        }
      }
    }
    writeFileSync21(diffTmp, content);
    return { lines: content.split(`
`).length, descPart: `changes since ${scope}` };
  }
  const showResult = Bun.spawnSync(["git", "show", scope], { cwd: projectRoot, stderr: "pipe" });
  writeFileSync21(diffTmp, showResult.stdout.toString());
  return { lines: showResult.stdout.toString().split(`
`).length, descPart: `commit ${scope}` };
}
function gatherCodebaseFiles(projectRoot) {
  const result = Bun.spawnSync(["git", "ls-files", "--cached", "--others", "--exclude-standard"], { cwd: projectRoot, stderr: "pipe" });
  const allFiles = result.stdout.toString().trim().split(`
`).filter(Boolean);
  const moduleMap = new Map;
  for (const file of allFiles) {
    const parts = file.split("/");
    if (parts.some((p) => CODEBASE_IGNORE_DIRS.has(p)))
      continue;
    const ext = "." + file.split(".").pop();
    const baseName = basename5(file);
    if (!SOURCE_EXTENSIONS.has(ext) && !baseName.startsWith(".") && baseName !== "Dockerfile" && baseName !== "Makefile" && baseName !== "Rakefile" && baseName !== "Gemfile")
      continue;
    const lockfileNames = new Set([
      "bun.lock",
      "bun.lockb",
      "package-lock.json",
      "yarn.lock",
      "pnpm-lock.yaml",
      "Cargo.lock",
      "Gemfile.lock",
      "poetry.lock",
      "composer.lock"
    ]);
    if (lockfileNames.has(baseName))
      continue;
    const topDir = parts.length > 1 ? parts[0] : ".";
    if (!moduleMap.has(topDir))
      moduleMap.set(topDir, []);
    moduleMap.get(topDir).push(file);
  }
  return moduleMap;
}
function collectCodebaseMaterial(_config, sessionDir2, projectRoot) {
  console.log("Scanning codebase...");
  const moduleMap = gatherCodebaseFiles(projectRoot);
  if (moduleMap.size === 0) {
    throw new Error("No source files found in codebase");
  }
  const materialFile = join34(sessionDir2, "material-full.txt");
  const allFiles = [];
  const moduleChunksDir = join34(sessionDir2, "chunks");
  mkdirSync18(moduleChunksDir, { recursive: true });
  const sortedModules = [...moduleMap.entries()].sort((a, b) => b[1].length - a[1].length);
  let totalLines = 0;
  const moduleStats = [];
  for (const [moduleName, files] of sortedModules) {
    const chunkFile = join34(moduleChunksDir, `${moduleName.replace(/\//g, "__")}.txt`);
    let chunkContent = "";
    for (const file of files) {
      const fullPath = join34(projectRoot, file);
      if (!existsSync28(fullPath))
        continue;
      try {
        const content = readFileSync28(fullPath, "utf-8");
        const lineCount = content.split(`
`).length;
        if (lineCount > 1e4) {
          console.log(`  Skipping ${file} (${lineCount} lines — likely generated)`);
          continue;
        }
        const header = `═══ FILE: ${file} ═══
`;
        const fileBlock = header + content + `

`;
        appendFileSync2(materialFile, fileBlock);
        chunkContent += fileBlock;
        allFiles.push(file);
        totalLines += lineCount;
      } catch {}
    }
    if (chunkContent) {
      writeFileSync21(chunkFile, chunkContent);
      moduleStats.push({ name: moduleName, files: files.length, lines: chunkContent.split(`
`).length });
    }
  }
  const indexContent = moduleStats.map((m) => `${m.name}: ${m.files} files, ${m.lines} lines`).join(`
`);
  writeFileSync21(join34(sessionDir2, "module-index.txt"), indexContent);
  console.log(`  Modules: ${moduleStats.length}`);
  for (const m of moduleStats) {
    console.log(`    ${m.name}: ${m.files} files, ${m.lines} lines`);
  }
  console.log(`  Total: ${allFiles.length} files, ${totalLines} lines`);
  return {
    hasDiff: false,
    hasContent: false,
    materialType: "code_listing",
    materialFile,
    materialTypesStr: "codebase",
    diffDesc: `full codebase (${allFiles.length} files, ${moduleStats.length} modules)`,
    diffLines: totalLines,
    changedFiles: allFiles
  };
}
function collectMaterial(config, sessionDir2, projectRoot) {
  if (config.scope === "codebase") {
    return collectCodebaseMaterial(config, sessionDir2, projectRoot);
  }
  const hasDiff = !!config.scope;
  const hasContent = config.contentFiles.length > 0;
  const materialFile = join34(sessionDir2, "material-full.txt");
  const diffDescParts = [];
  const materialTypes = [];
  const changedFiles = [];
  if (hasDiff) {
    console.log("Generating diff...");
    const { lines, descPart } = generateDiff(config.scope, sessionDir2, projectRoot);
    const diffTmp = join34(sessionDir2, "_diff.patch");
    if (existsSync28(diffTmp) && lines > 1) {
      const diffContent = readFileSync28(diffTmp, "utf-8");
      appendFileSync2(materialFile, `═══ GIT DIFF ═══
${diffContent}
`);
      materialTypes.push("diff");
      console.log(`  Diff: ${lines} lines`);
      const pathMatches = diffContent.matchAll(/^diff --git a\/(.+?) b\//gm);
      for (const m of pathMatches)
        changedFiles.push(m[1]);
      unlinkSync(diffTmp);
    } else if (!hasContent) {
      throw new Error("Empty diff and no content files — nothing to review");
    } else {
      console.log("  (diff is empty, reviewing content only)");
      if (existsSync28(diffTmp))
        unlinkSync(diffTmp);
    }
    diffDescParts.push(descPart);
  }
  if (hasContent) {
    console.log("Collecting content files...");
    const contentFileNames = [];
    for (let cf of config.contentFiles) {
      cf = cf.trim().replace(/^["']|["']$/g, "");
      cf = cf.replace(/^~/, HOME12);
      if (!cf.startsWith("/"))
        cf = join34(projectRoot, cf);
      if (!existsSync28(cf)) {
        throw new Error(`Content file not found: ${cf}`);
      }
      console.log(`  + ${cf}`);
      appendFileSync2(materialFile, `═══ FILE: ${basename5(cf)} ═══
${readFileSync28(cf, "utf-8")}
`);
      contentFileNames.push(basename5(cf));
    }
    diffDescParts.push(contentFileNames.join(", "));
    materialTypes.push("content");
  }
  const diffDesc = diffDescParts.join(" + ");
  const materialContent = existsSync28(materialFile) ? readFileSync28(materialFile, "utf-8") : "";
  const diffLines = materialContent.split(`
`).length;
  console.log(`Material: ${diffLines} lines (${diffDesc})`);
  let materialType;
  if (hasDiff && !hasContent) {
    materialType = "code_diff";
  } else if (!hasDiff && hasContent) {
    const firstFile = config.contentFiles[0]?.trim() || "";
    if (/\.(json|yaml|yml|toml|xml)$/i.test(firstFile)) {
      materialType = "config";
    } else {
      materialType = "document";
    }
  } else if (hasDiff && hasContent) {
    materialType = "mixed";
  } else {
    materialType = "code_diff";
  }
  console.log(`Material type: ${materialType}`);
  return {
    hasDiff,
    hasContent,
    materialType,
    materialFile,
    materialTypesStr: materialTypes.join("+"),
    diffDesc,
    diffLines,
    changedFiles: [...new Set(changedFiles)]
  };
}
function shouldAutoSkip(material, config) {
  if (config.scope === "codebase" || material.materialType === "code_listing")
    return null;
  if (config.force || !material.hasDiff || material.hasContent)
    return null;
  const content = readFileSync28(material.materialFile, "utf-8");
  const changedPaths = material.changedFiles;
  if (changedPaths.length > 0) {
    const lockfileNames = new Set([
      "bun.lock",
      "bun.lockb",
      "package-lock.json",
      "yarn.lock",
      "pnpm-lock.yaml",
      "Cargo.lock",
      "Gemfile.lock",
      "poetry.lock",
      "composer.lock"
    ]);
    const allLockfiles = changedPaths.every((p) => lockfileNames.has(basename5(p)));
    if (allLockfiles) {
      return "AUTO-SKIP: All changed files are lockfiles. Use --force to override.";
    }
  }
  const addRemoveLines = content.match(/^\+[^+]|^-[^-]/gm) || [];
  const substantiveLines = addRemoveLines.filter((l) => !/^\+\s*$|^-\s*$/.test(l));
  if (substantiveLines.length < 5 && !config.spec) {
    return "AUTO-SKIP: <5 substantive diff lines and no --spec. Use --force to override.";
  }
  return null;
}
var HOME12, CODEBASE_IGNORE_DIRS, SOURCE_EXTENSIONS;
var init_material = __esm(() => {
  HOME12 = process.env.HOME || "/tmp";
  CODEBASE_IGNORE_DIRS = new Set([
    "node_modules",
    "dist",
    "build",
    ".git",
    ".next",
    ".nuxt",
    ".cache",
    ".turbo",
    "coverage",
    "__pycache__",
    ".mypy_cache",
    ".pytest_cache",
    "vendor",
    "target",
    ".gradle",
    ".idea",
    ".vscode",
    ".claude"
  ]);
  SOURCE_EXTENSIONS = new Set([
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".mjs",
    ".cjs",
    ".py",
    ".rs",
    ".go",
    ".java",
    ".kt",
    ".swift",
    ".c",
    ".cpp",
    ".h",
    ".hpp",
    ".cs",
    ".rb",
    ".php",
    ".lua",
    ".sh",
    ".bash",
    ".zsh",
    ".sql",
    ".graphql",
    ".gql",
    ".html",
    ".css",
    ".scss",
    ".less",
    ".svelte",
    ".vue",
    ".json",
    ".yaml",
    ".yml",
    ".toml",
    ".xml",
    ".md",
    ".mdx",
    ".Dockerfile",
    ".dockerfile"
  ]);
});

// cli/commands/pipeline.ts
import { existsSync as existsSync29, readFileSync as readFileSync29, mkdirSync as mkdirSync19, rmSync as rmSync5 } from "node:fs";
import { join as join35, basename as basename6 } from "node:path";
async function runPipeline(programName, opts) {
  const programPath = join35(FLEET_DIR4, "programs", `${programName}.program.ts`);
  if (!existsSync29(programPath)) {
    fail(`Program not found: ${programPath}
Available programs: ${listPrograms().join(", ") || "none"}`);
  }
  const programModule = await import(programPath);
  const programFn = programModule.default;
  if (typeof programFn !== "function") {
    fail(`Program ${programName} must export a default function`);
  }
  const projectRoot = process.env.PROJECT_ROOT || resolveProjectRoot();
  const fleetProject = resolveProject(projectRoot);
  const programOpts = typeof programModule.parseOpts === "function" ? programModule.parseOpts(opts, projectRoot) : buildProgramOpts(programName, opts, projectRoot);
  if (opts.set && Array.isArray(opts.set)) {
    for (const kv of opts.set) {
      const eqIdx = kv.indexOf("=");
      if (eqIdx > 0) {
        const key = kv.slice(0, eqIdx);
        const val = kv.slice(eqIdx + 1);
        if (val === "true")
          programOpts[key] = true;
        else if (val === "false")
          programOpts[key] = false;
        else if (/^\d+$/.test(val))
          programOpts[key] = parseInt(val, 10);
        else
          programOpts[key] = val;
      }
    }
  }
  const program2 = programFn(programOpts);
  const tmuxCheck = Bun.spawnSync(["tmux", "info"], { stderr: "pipe", stdout: "pipe" });
  if (tmuxCheck.exitCode !== 0 && !opts.dryRun) {
    fail("tmux not running — required for pipeline execution");
  }
  const sessionName = opts.sessionName || buildSessionName(programName, projectRoot, programOpts);
  const now = new Date;
  const pad = (n) => String(n).padStart(2, "0");
  const timePart = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}-${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;
  const sessionId = sessionName ? `${timePart}-${sessionName}` : timePart;
  const sessionDir2 = join35(projectRoot, ".claude", "state", programName, `session-${sessionId}`);
  mkdirSync19(sessionDir2, { recursive: true });
  mkdirSync19(join35(sessionDir2, "comms"), { recursive: true });
  const sessionHash = hashStr(sessionId).slice(0, 8);
  let reviewConfig = "";
  const reviewPaths = [
    join35(projectRoot, "REVIEW.md"),
    join35(projectRoot, ".claude", "REVIEW.md")
  ];
  for (const rmd of reviewPaths) {
    if (existsSync29(rmd)) {
      reviewConfig = readFileSync29(rmd, "utf-8");
      console.log(`REVIEW.md: ${rmd}`);
      break;
    }
  }
  const state = {
    programPath,
    opts: programOpts,
    programName: program2.name,
    tmuxSession: sessionName,
    sessionDir: sessionDir2,
    projectRoot,
    workDir: projectRoot,
    fleetProject,
    sessionHash,
    defaults: program2.defaults || {},
    phaseState: {},
    compiledPhases: [],
    templateDir: join35(FLEET_DIR4, "templates"),
    validatorPath: join35(FLEET_DIR4, "scripts", "validate-findings.sh"),
    ext: {
      reviewConfig,
      spec: programOpts.spec || program2.material?.spec || "",
      launchingPane: process.env.TMUX_PANE || ""
    }
  };
  if (program2.material?.scope || program2.material?.contentFiles && program2.material.contentFiles.length > 0) {
    try {
      const { collectMaterial: collectMaterial2, shouldAutoSkip: shouldAutoSkip2 } = await Promise.resolve().then(() => (init_material(), exports_material));
      const materialConfig = {
        scope: program2.material.scope || "",
        contentFiles: program2.material.contentFiles || [],
        spec: program2.material.spec || "",
        force: false,
        passesPerFocus: programOpts.passesPerFocus || 2,
        focusAreas: programOpts.focusAreas || [],
        customFocus: "",
        noJudge: false,
        noContext: false,
        verify: false,
        verifyRoles: "",
        v1Mode: false,
        maxWorkers: null,
        noWorktree: true,
        noImproveReview: false,
        sessionName: "",
        notifyTarget: "",
        workerModel: "sonnet[1m]",
        coordModel: "sonnet[1m]"
      };
      const material = collectMaterial2(materialConfig, sessionDir2, projectRoot);
      if (material) {
        const skipReason = shouldAutoSkip2(material, materialConfig);
        if (skipReason && !programOpts.force) {
          console.log(skipReason);
          rmSync5(sessionDir2, { recursive: true, force: true });
          return;
        }
        state.material = {
          materialFile: material.materialFile,
          materialType: material.materialType,
          diffLines: material.diffLines,
          diffDesc: material.diffDesc,
          materialTypesStr: material.materialTypesStr,
          hasDiff: material.hasDiff,
          hasContent: material.hasContent,
          changedFiles: material.changedFiles
        };
      }
    } catch (err) {
      console.log(`WARN: Material collection failed: ${err}`);
    }
  }
  console.log(`Session: ${sessionDir2}`);
  const nodeCount = program2.graph ? Object.keys(program2.graph.nodes).length : program2.phases.length;
  const unitLabel = program2.graph ? "node" : "phase";
  console.log(`Compiling program: ${program2.name} (${nodeCount} ${unitLabel}${nodeCount !== 1 ? "s" : ""})`);
  const plan = compile(program2, state);
  state.compiledPhases = plan.phases;
  savePipelineState(state);
  const manifestPath = generateManifest(program2, state, plan.phases);
  console.log(`Manifest: ${manifestPath}`);
  if (opts.dryRun) {
    console.log("");
    console.log(readFileSync29(manifestPath, "utf-8"));
    rmSync5(sessionDir2, { recursive: true, force: true });
    return;
  }
  const phase0Workers = plan.workers.filter((w) => w.phaseIndex === 0);
  const phase0Windows = plan.windows.filter((w) => phase0Workers.some((worker) => worker.window === w.name));
  createTmuxSession(state, phase0Windows);
  if (phase0Workers.length > 0) {
    console.log(`Provisioning Phase 0 workers (${phase0Workers.length})...`);
    await provisionWorkers(phase0Workers, state);
    for (const worker of phase0Workers) {
      generateLaunchWrapper(worker, state);
    }
    console.log("");
    console.log(`Phase 0: Launching ${phase0Workers.length} agent(s)...`);
    if (phase0Workers.length === 1) {
      launchInPlanningWindow(phase0Workers[0], sessionName, state);
    } else {
      launchAgents(phase0Workers, sessionName, state);
    }
  }
  showManifest(sessionName, manifestPath);
  generateCleanupScript(state);
  console.log("");
  console.log("════════════════════════════════════════════════════════════");
  console.log(`  PIPELINE: ${program2.name}`);
  console.log("");
  console.log(`  Session:     ${sessionName}`);
  console.log(`  Dir:         ${sessionDir2}`);
  if (state.material) {
    console.log(`  Material:    ${state.material.materialTypesStr} (${state.material.materialType})`);
    console.log(`  Reviewing:   ${state.material.diffDesc} (${state.material.diffLines} lines)`);
  }
  console.log("");
  if (program2.graph) {
    const g = program2.graph;
    const nodeNames = Object.keys(g.nodes);
    const chain = [g.entry];
    const visited = new Set([g.entry]);
    let cur = g.entry;
    for (let i = 0;i < nodeNames.length; i++) {
      const fwd = g.edges.find((e) => e.from === cur && !e.maxIterations && !visited.has(e.to));
      if (!fwd)
        break;
      chain.push(fwd.to);
      visited.add(fwd.to);
      cur = fwd.to;
    }
    const chainStr = chain.map((n) => n === g.entry ? `[${n}]` : n).join(" ──> ");
    console.log(`  Flow: ${chainStr}`);
    const backEdges = g.edges.filter((e) => e.maxIterations);
    for (const e of backEdges) {
      const label = e.label ? ` "${e.label}"` : "";
      console.log(`         ${e.to} <──${label}── ${e.from} (max ${e.maxIterations}x)`);
    }
  } else {
    const names = program2.phases.map((p) => p.name);
    const chainStr = names.map((n, i) => i === 0 ? `[${n}]` : n).join(" ──> ");
    console.log(`  Flow: ${chainStr}`);
  }
  console.log("");
  console.log("");
  console.log(`  Attach: tmux switch-client -t ${sessionName}`);
  console.log(`          tmux a -t ${sessionName}`);
  console.log(`  Report: ${sessionDir2}/report.md (after completion)`);
  console.log("════════════════════════════════════════════════════════════");
}
function listPrograms() {
  const programsDir = join35(FLEET_DIR4, "programs");
  if (!existsSync29(programsDir))
    return [];
  try {
    const { readdirSync: readdirSync13 } = __require("node:fs");
    return readdirSync13(programsDir).filter((f) => f.endsWith(".program.ts")).map((f) => f.replace(".program.ts", ""));
  } catch {
    return [];
  }
}
function buildProgramOpts(programName, opts, projectRoot) {
  if (programName === "deep-review") {
    const scope = opts.scope || "HEAD";
    const isCodebase = scope === "codebase";
    const defaultSpec = isCodebase ? "Perform a comprehensive quality review of this codebase. Look for bugs, security issues, architectural problems, error handling gaps, and opportunities for improvement." : "Review this material thoroughly for issues, gaps, and improvements.";
    return {
      scope,
      contentFiles: opts.content ? opts.content.split(",").map((s) => s.trim()) : [],
      spec: opts.spec || defaultSpec,
      passesPerFocus: parseInt(opts.passes, 10) || 2,
      focusAreas: opts.focus ? opts.focus.split(",").map((s) => s.trim()) : [],
      maxWorkers: opts.maxWorkers ? parseInt(opts.maxWorkers, 10) : null,
      verify: !!opts.verify,
      verifyRoles: opts.verifyRoles || "",
      noJudge: opts.judge === false,
      noContext: opts.context === false,
      noImproveReview: opts.improveReview === false,
      workerModel: process.env.DEEP_REVIEW_WORKER_MODEL || "sonnet",
      coordModel: process.env.DEEP_REVIEW_COORD_MODEL || "sonnet",
      notifyTarget: opts.notify || "",
      force: !!opts.force
    };
  }
  if (programName === "research-lab") {
    return {
      scope: opts.scope || "HEAD",
      contentFiles: opts.content ? opts.content.split(",").map((s) => s.trim()) : [],
      spec: opts.spec || "Analyze this material thoroughly for issues, patterns, and insights.",
      passesPerFocus: 1,
      focusAreas: [],
      maxWorkers: opts.maxWorkers ? parseInt(opts.maxWorkers, 10) : null,
      verify: false,
      verifyRoles: "",
      noJudge: true,
      noContext: opts.context === false,
      noImproveReview: true,
      workerModel: process.env.DEEP_REVIEW_WORKER_MODEL || "sonnet",
      coordModel: process.env.DEEP_REVIEW_COORD_MODEL || "sonnet",
      notifyTarget: opts.notify || "",
      force: !!opts.force
    };
  }
  return { ...opts, projectRoot };
}
function buildSessionName(programName, projectRoot, opts) {
  const worktreeName = basename6(projectRoot).replace(/^Wechat-w-/, "").replace(/^Wechat$/, "main");
  const scope = opts.scope || "HEAD";
  if (scope === "codebase") {
    const codebaseHash = hashStr(projectRoot + Date.now().toString()).slice(0, 8);
    return `${programName.slice(0, 3)}-${worktreeName}-codebase-${codebaseHash}`.slice(0, 50);
  }
  let resolvedRef = scope;
  if (scope === "uncommitted") {
    const r = Bun.spawnSync(["git", "rev-parse", "--short=8", "HEAD"], { cwd: projectRoot, stderr: "pipe" });
    resolvedRef = r.stdout.toString().trim() || "wip";
  } else if (scope.includes("..")) {
    resolvedRef = scope.split("..").pop() || scope;
  }
  const shortResult = Bun.spawnSync(["git", "rev-parse", "--short=8", resolvedRef], { cwd: projectRoot, stderr: "pipe" });
  const shortHash = shortResult.stdout.toString().trim().split(`
`)[0] || resolvedRef.replace(/[^a-zA-Z0-9]+/g, "-");
  return `${programName.slice(0, 3)}-${worktreeName}-${shortHash}`.slice(0, 50);
}
function hashStr(s) {
  let hash = 0;
  for (let i = 0;i < s.length; i++) {
    hash = (hash << 5) - hash + s.charCodeAt(i) | 0;
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}
var HOME13, FLEET_DIR4;
var init_pipeline = __esm(() => {
  init_cli();
  init_fmt2();
  init_paths();
  init_compiler();
  init_manifest();
  init_tmux_layout();
  init_fleet_provision();
  HOME13 = process.env.HOME || "/tmp";
  FLEET_DIR4 = process.env.CLAUDE_FLEET_DIR || join35(HOME13, ".claude-fleet");
});

// cli/commands/deep-review.ts
import { existsSync as existsSync30 } from "node:fs";
import { join as join36 } from "node:path";
function register23(program2) {
  const cmd = program2.command("deep-review").alias("dr").description("Launch a multi-pass deep review pipeline").option("--scope <scope>", "Git diff scope (branch, SHA, uncommitted, pr:N, HEAD, codebase)").option("--content <files>", "File path(s) to review, comma-separated").option("--spec <text>", "What to review for (guides all workers)").option("--passes <n>", "Passes per focus area (default: 2)", "2").option("--session-name <name>", "Custom tmux session name").option("--notify <target>", "Notify on completion (worker name or 'user')").option("--focus <list>", "Comma-separated focus areas (overrides auto-detect)").option("--no-judge", "Skip adversarial judge validation").option("--no-context", "Skip context pre-pass (static analysis, deps)").option("--force", "Force review even if auto-skip would trigger").option("--verify", "Enable verification phase after review").option("--verify-roles <list>", "Comma-separated user roles to test as").option("--max-workers <n>", "Max worker budget for role designer").option("--no-worktree", "Skip worktree isolation").option("--no-improve-review", "Skip REVIEW.md improvement phase").option("--dry-run", "Print manifest without launching").action(async (opts) => {
    try {
      await runDeepReview(opts);
    } catch (e) {
      fail(e.message || String(e));
    }
  });
  addGlobalOpts(cmd);
}
async function runDeepReview(opts) {
  const claudeOps = process.env.CLAUDE_FLEET_DIR || join36(HOME14, ".claude-fleet");
  const drContextBin = join36(claudeOps, "bin", "dr-context");
  if (existsSync30(drContextBin)) {
    const verify = Bun.spawnSync(["codesign", "-v", drContextBin], { stderr: "pipe" });
    if (verify.exitCode !== 0) {
      Bun.spawnSync(["codesign", "-s", "-", drContextBin], { stderr: "pipe" });
    }
  }
  await runPipeline("deep-review", opts);
}
var HOME14;
var init_deep_review = __esm(() => {
  init_cli();
  init_fmt2();
  init_pipeline();
  HOME14 = process.env.HOME || "/tmp";
});

// cli/commands/hook.ts
import {
  readFileSync as readFileSync30,
  writeFileSync as writeFileSync22,
  existsSync as existsSync31,
  mkdirSync as mkdirSync20,
  rmSync as rmSync6,
  copyFileSync as copyFileSync8
} from "node:fs";
import { join as join37, basename as basename7 } from "node:path";
function resolveWorkerName() {
  if (process.env.WORKER_NAME)
    return process.env.WORKER_NAME;
  try {
    const result = Bun.spawnSync(["git", "rev-parse", "--abbrev-ref", "HEAD"], { stderr: "pipe" });
    if (result.exitCode === 0) {
      const branch = result.stdout.toString().trim();
      if (branch.startsWith("worker/"))
        return branch.slice("worker/".length);
    }
    const dirName = basename7(process.cwd());
    const match = dirName.match(/-w-(.+)$/);
    if (match)
      return match[1];
  } catch {}
  return "operator";
}
function getHooksDir(project, workerName) {
  return join37(FLEET_DATA, project, workerName, "hooks");
}
function getHooksFile(project, workerName) {
  return join37(getHooksDir(project, workerName), "hooks.json");
}
function slugify(desc) {
  return desc.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
}
function readHooks(hooksFile) {
  if (!existsSync31(hooksFile))
    return { hooks: [], counter: 0 };
  try {
    const data = JSON.parse(readFileSync30(hooksFile, "utf-8"));
    const hooks = data.hooks || [];
    let counter = 0;
    for (const h of hooks) {
      const num = parseInt(h.id.replace("dh-", ""), 10);
      if (!isNaN(num) && num > counter)
        counter = num;
    }
    return { hooks, counter };
  } catch {
    return { hooks: [], counter: 0 };
  }
}
function writeHooks(hooksFile, hooks) {
  const dir = join37(hooksFile, "..");
  mkdirSync20(dir, { recursive: true });
  if (hooks.length === 0) {
    try {
      rmSync6(hooksFile);
    } catch {}
    return;
  }
  writeFileSync22(hooksFile, JSON.stringify({ hooks }, null, 2));
}
function scanScript(scriptContent, _project, workerName) {
  const projectRoot = resolveProjectRoot();
  const permsPath = join37(projectRoot, ".claude/workers", workerName, "permissions.json");
  if (!existsSync31(permsPath))
    return null;
  let denyList;
  try {
    const perms = JSON.parse(readFileSync30(permsPath, "utf-8"));
    denyList = perms.denyList || [];
  } catch {
    return null;
  }
  if (denyList.length === 0)
    return null;
  const lines = scriptContent.split(`
`).map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
  const normalized = lines.join(" ; ");
  for (const pattern of denyList) {
    const m = pattern.match(/^(\w+)\((.+)\)$/);
    if (!m || m[1] !== "Bash")
      continue;
    const argPattern = m[2];
    const regex = argPattern.replace(/[.[\]^$+{}|\\]/g, "\\$&").replace(/\*\*/g, ".*").replace(/\*/g, ".*").replace(/\?/g, ".");
    try {
      const re = new RegExp(regex);
      if (re.test(normalized) || re.test(scriptContent)) {
        return `Script blocked by policy: matches Bash(${argPattern}) in denyList`;
      }
    } catch {}
  }
  return null;
}
async function hookAdd(opts, globalOpts) {
  const projectRoot = resolveProjectRoot();
  const project = globalOpts.project || resolveProject(projectRoot);
  const workerName = globalOpts.worker || resolveWorkerName();
  const hooksFile = getHooksFile(project, workerName);
  const hooksDir = getHooksDir(project, workerName);
  mkdirSync20(hooksDir, { recursive: true });
  const { hooks, counter } = readHooks(hooksFile);
  const id = `dh-${counter + 1}`;
  const isBlocking = opts.blocking ?? opts.event === "Stop";
  let scriptPath;
  if (opts.script) {
    let scriptContent;
    if (opts.script.startsWith("@")) {
      const srcPath = opts.script.slice(1);
      if (!existsSync31(srcPath))
        fail(`Script source file not found: ${srcPath}`);
      scriptContent = readFileSync30(srcPath, "utf-8");
    } else {
      scriptContent = opts.script;
    }
    const blocked = scanScript(scriptContent, project, workerName);
    if (blocked)
      fail(`Hook rejected: ${blocked}`);
    const slug = slugify(opts.desc);
    const filename = slug ? `${id}-${slug}.sh` : `${id}.sh`;
    const destPath = join37(hooksDir, filename);
    if (opts.script.startsWith("@")) {
      copyFileSync8(opts.script.slice(1), destPath);
    } else {
      const content = opts.script.startsWith("#!/") ? opts.script : `#!/usr/bin/env bash
set -uo pipefail
${opts.script}
`;
      writeFileSync22(destPath, content);
    }
    Bun.spawnSync(["chmod", "+x", destPath]);
    scriptPath = filename;
  }
  let condition;
  if (opts.condition) {
    try {
      condition = JSON.parse(opts.condition);
    } catch {
      fail(`Invalid condition JSON: ${opts.condition}`);
    }
  }
  const hook = {
    id,
    event: opts.event,
    description: opts.desc,
    blocking: isBlocking,
    completed: false,
    added_at: new Date().toISOString()
  };
  if (opts.content)
    hook.content = opts.content;
  if (condition)
    hook.condition = condition;
  if (opts.agentId)
    hook.agent_id = opts.agentId;
  if (scriptPath)
    hook.script_path = scriptPath;
  hooks.push(hook);
  writeHooks(hooksFile, hooks);
  const typeLabel = isBlocking ? "blocking" : "inject";
  const scriptNote = scriptPath ? ` [script: ${scriptPath}]` : "";
  ok(`Hook [${id}] ${opts.event}/${typeLabel} — ${opts.desc}${scriptNote}`);
}
async function hookRm(id, globalOpts) {
  const projectRoot = resolveProjectRoot();
  const project = globalOpts.project || resolveProject(projectRoot);
  const workerName = globalOpts.worker || resolveWorkerName();
  const hooksFile = getHooksFile(project, workerName);
  const hooksDir = getHooksDir(project, workerName);
  const { hooks } = readHooks(hooksFile);
  if (id === "all") {
    for (const h of hooks) {
      if (h.script_path) {
        try {
          rmSync6(join37(hooksDir, h.script_path));
        } catch {}
      }
    }
    writeHooks(hooksFile, []);
    ok(`Removed all ${hooks.length} hook(s)`);
    return;
  }
  const idx = hooks.findIndex((h) => h.id === id);
  if (idx === -1)
    fail(`No hook with ID '${id}'`);
  const hook = hooks[idx];
  if (hook.script_path) {
    try {
      rmSync6(join37(hooksDir, hook.script_path));
    } catch {}
  }
  hooks.splice(idx, 1);
  writeHooks(hooksFile, hooks);
  ok(`Removed: [${id}] ${hook.description}`);
}
async function hookLs(opts, globalOpts) {
  const projectRoot = resolveProjectRoot();
  const project = globalOpts.project || resolveProject(projectRoot);
  const workerName = globalOpts.worker || resolveWorkerName();
  const hooksFile = getHooksFile(project, workerName);
  const { hooks } = readHooks(hooksFile);
  const filtered = opts.event ? hooks.filter((h) => h.event === opts.event) : hooks;
  if (filtered.length === 0) {
    info(`No hooks${opts.event ? ` for event '${opts.event}'` : ""} (worker: ${workerName})`);
    return;
  }
  if (globalOpts.json) {
    console.log(JSON.stringify(filtered, null, 2));
    return;
  }
  const rows = filtered.map((h) => {
    const type = h.blocking ? "GATE" : "INJECT";
    const status = h.blocking ? h.completed ? "DONE" : "PENDING" : "active";
    const script = h.script_path || "";
    return [h.id, h.event, type, status, h.description, script];
  });
  table(["ID", "Event", "Type", "Status", "Description", "Script"], rows);
  const pending = hooks.filter((h) => h.blocking && !h.completed);
  console.log(`
${hooks.length} total, ${pending.length} blocking pending`);
}
async function hookComplete(id, opts, globalOpts) {
  const projectRoot = resolveProjectRoot();
  const project = globalOpts.project || resolveProject(projectRoot);
  const workerName = globalOpts.worker || resolveWorkerName();
  const hooksFile = getHooksFile(project, workerName);
  const { hooks } = readHooks(hooksFile);
  const now = new Date().toISOString();
  if (id === "all") {
    let count = 0;
    for (const h of hooks) {
      if (h.blocking && !h.completed) {
        h.completed = true;
        h.completed_at = now;
        if (opts.result)
          h.result = opts.result;
        count++;
      }
    }
    if (count === 0) {
      info("No pending blocking hooks to complete.");
      return;
    }
    writeHooks(hooksFile, hooks);
    ok(`Completed ${count} hook(s). All blocking hooks cleared.`);
    return;
  }
  const hook = hooks.find((h) => h.id === id);
  if (!hook)
    fail(`No hook with ID '${id}'`);
  hook.completed = true;
  hook.completed_at = now;
  if (opts.result)
    hook.result = opts.result;
  writeHooks(hooksFile, hooks);
  const remaining = hooks.filter((h) => h.blocking && !h.completed).length;
  ok(`Completed: [${id}] ${hook.description}${opts.result ? ` (${opts.result})` : ""}`);
  if (remaining > 0)
    info(`${remaining} blocking hook(s) remaining`);
}
function register24(parent) {
  const hook = parent.command("hook").description("Manage dynamic hooks (add/rm/ls/complete)").option("--worker <name>", "Operate on another worker's hooks (default: auto-detect from branch/worktree)");
  const add = hook.command("add").description("Register a dynamic hook").requiredOption("--event <event>", "Hook event (Stop, PreToolUse, PreCompact, etc.)").requiredOption("--desc <description>", "Human-readable purpose").option("--blocking", "Block event until completed (default for Stop)").option("--no-blocking", "Don't block (inject mode)").option("--script <cmd>", "Shell script to run (inline or @filepath)").option("--content <text>", "Content to inject or block reason").option("--condition <json>", `Condition JSON (e.g. '{"tool":"Edit","file_glob":"src/**"}')`).option("--agent-id <id>", "Scope to subagent");
  addGlobalOpts(add).action(async (opts, cmd) => {
    await hookAdd(opts, cmd.optsWithGlobals());
  });
  const rm = hook.command("rm <id>").description("Remove a hook (or 'all')");
  addGlobalOpts(rm).action(async (id, _opts, cmd) => {
    await hookRm(id, cmd.optsWithGlobals());
  });
  const ls = hook.command("ls").description("List active hooks").option("--event <event>", "Filter by event");
  addGlobalOpts(ls).action(async (opts, cmd) => {
    await hookLs(opts, cmd.optsWithGlobals());
  });
  const complete = hook.command("complete <id>").description("Mark a blocking hook as completed (or 'all')").option("--result <text>", "Brief outcome (e.g. 'PASS')");
  addGlobalOpts(complete).action(async (id, opts, cmd) => {
    await hookComplete(id, opts, cmd.optsWithGlobals());
  });
}
var init_hook = __esm(() => {
  init_paths();
  init_fmt2();
  init_cli();
});

// cli/commands/recycle.ts
import { existsSync as existsSync32 } from "node:fs";
import { join as join38 } from "node:path";
function register25(parent) {
  const sub = parent.command("recycle [name]").description("Restart a worker with fresh context (stop + start, no watchdog race)").option("-a, --all", "Recycle all workers");
  addGlobalOpts(sub).action(async (name, opts, cmd) => {
    const project = cmd.optsWithGlobals().project || resolveProject();
    if (opts.all) {
      const projectDir = join38(FLEET_DATA, project);
      if (!existsSync32(projectDir))
        fail(`Project '${project}' not found`);
      const { readdirSync: readdirSync13 } = await import("node:fs");
      const workers = readdirSync13(projectDir, { withFileTypes: true }).filter((d) => d.isDirectory() && !["missions", "_user", "_config"].includes(d.name)).map((d) => d.name);
      for (const w of workers) {
        await recycleOne(w, project);
      }
      ok(`Recycled ${workers.length} workers`);
      return;
    }
    if (!name)
      return fail("Provide a worker name or use --all");
    await recycleOne(name, project);
  });
}
async function recycleOne(name, project) {
  const dir = workerDir(project, name);
  if (!existsSync32(dir)) {
    warn(`Worker '${name}' not found`);
    return;
  }
  const state = getState(project, name);
  const panes = listPaneIds();
  const paneId = state?.pane_id;
  if (paneId && panes.has(paneId)) {
    await killPaneWithProcess(paneId);
    info(`Killed pane ${paneId} and its process`);
  }
  const statePath2 = join38(dir, "state.json");
  if (existsSync32(statePath2)) {
    try {
      const stateData = JSON.parse(__require("node:fs").readFileSync(statePath2, "utf-8"));
      stateData.status = "active";
      delete stateData.sleep_until;
      if (stateData.custom)
        delete stateData.custom.sleep_until;
      writeJsonLocked(statePath2, stateData);
    } catch {}
  }
  const config = getConfig(project, name);
  if (!config) {
    warn(`No config for '${name}', skipping relaunch`);
    return;
  }
  const window = config.window || name;
  const fleetConfig = getFleetConfig(project);
  const session = fleetConfig?.tmux_session || DEFAULT_SESSION;
  if (config.worktree) {
    const projectRoot = config.worktree.replace(/-w-[^/]+$/, "");
    syncWorktree({ name, project, projectRoot, worktreeDir: config.worktree });
  }
  try {
    await launchInTmux(name, project, session, window);
    ok(`Recycled '${name}' (stop + start)`);
  } catch (e) {
    warn(`Killed '${name}' but relaunch failed: ${e}`);
    info("Watchdog will pick it up on next poll");
  }
}
var init_recycle = __esm(() => {
  init_paths();
  init_config();
  init_fmt2();
  init_launch();
  init_worktree();
  init_cli();
});

// cli/commands/pipeline.ts
import { existsSync as existsSync33, readFileSync as readFileSync31, mkdirSync as mkdirSync21, rmSync as rmSync7 } from "node:fs";
import { join as join39, basename as basename8 } from "node:path";
function register26(program2) {
  const cmd = program2.command("pipeline").alias("pipe").description("Launch a program-API pipeline").argument("<program>", "Program name (e.g. deep-review)").option("--scope <scope>", "Git diff scope").option("--content <files>", "File path(s) to review, comma-separated").option("--spec <text>", "What to review for").option("--passes <n>", "Passes per focus area", "2").option("--verify", "Enable verification phase").option("--verify-roles <list>", "User roles to test as").option("--no-judge", "Skip judge").option("--no-context", "Skip context pre-pass").option("--no-improve-review", "Skip REVIEW.md improvement").option("--max-workers <n>", "Max worker budget").option("--session-name <name>", "Custom tmux session name").option("--notify <target>", "Notify on completion").option("--dry-run", "Print manifest without launching").option("--set <kv...>", "Program-specific key=value pairs (e.g. --set problem=kv_store --set rounds=3)").action(async (programName, opts) => {
    try {
      await runPipeline2(programName, opts);
    } catch (e) {
      fail(e.message || String(e));
    }
  });
  addGlobalOpts(cmd);
}
async function runPipeline2(programName, opts) {
  const programPath = join39(FLEET_DIR5, "programs", `${programName}.program.ts`);
  if (!existsSync33(programPath)) {
    fail(`Program not found: ${programPath}
Available programs: ${listPrograms2().join(", ") || "none"}`);
  }
  const programModule = await import(programPath);
  const programFn = programModule.default;
  if (typeof programFn !== "function") {
    fail(`Program ${programName} must export a default function`);
  }
  const projectRoot = process.env.PROJECT_ROOT || resolveProjectRoot();
  const fleetProject = resolveProject(projectRoot);
  const programOpts = typeof programModule.parseOpts === "function" ? programModule.parseOpts(opts, projectRoot) : buildProgramOpts2(programName, opts, projectRoot);
  if (opts.set && Array.isArray(opts.set)) {
    for (const kv of opts.set) {
      const eqIdx = kv.indexOf("=");
      if (eqIdx > 0) {
        const key = kv.slice(0, eqIdx);
        const val = kv.slice(eqIdx + 1);
        if (val === "true")
          programOpts[key] = true;
        else if (val === "false")
          programOpts[key] = false;
        else if (/^\d+$/.test(val))
          programOpts[key] = parseInt(val, 10);
        else
          programOpts[key] = val;
      }
    }
  }
  const program2 = programFn(programOpts);
  const tmuxCheck = Bun.spawnSync(["tmux", "info"], { stderr: "pipe", stdout: "pipe" });
  if (tmuxCheck.exitCode !== 0 && !opts.dryRun) {
    fail("tmux not running — required for pipeline execution");
  }
  const sessionName = opts.sessionName || buildSessionName2(programName, projectRoot, programOpts);
  const now = new Date;
  const pad = (n) => String(n).padStart(2, "0");
  const timePart = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}-${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;
  const sessionId = sessionName ? `${timePart}-${sessionName}` : timePart;
  const sessionDir2 = join39(projectRoot, ".claude", "state", programName, `session-${sessionId}`);
  mkdirSync21(sessionDir2, { recursive: true });
  mkdirSync21(join39(sessionDir2, "comms"), { recursive: true });
  const sessionHash = hashStr2(sessionId).slice(0, 8);
  let reviewConfig = "";
  const reviewPaths = [
    join39(projectRoot, "REVIEW.md"),
    join39(projectRoot, ".claude", "REVIEW.md")
  ];
  for (const rmd of reviewPaths) {
    if (existsSync33(rmd)) {
      reviewConfig = readFileSync31(rmd, "utf-8");
      console.log(`REVIEW.md: ${rmd}`);
      break;
    }
  }
  const state = {
    programPath,
    opts: programOpts,
    programName: program2.name,
    tmuxSession: sessionName,
    sessionDir: sessionDir2,
    projectRoot,
    workDir: projectRoot,
    fleetProject,
    sessionHash,
    defaults: program2.defaults || {},
    phaseState: {},
    compiledPhases: [],
    templateDir: join39(FLEET_DIR5, "templates"),
    validatorPath: join39(FLEET_DIR5, "scripts", "validate-findings.sh"),
    ext: {
      reviewConfig,
      spec: programOpts.spec || program2.material?.spec || "",
      launchingPane: process.env.TMUX_PANE || ""
    }
  };
  if (program2.material?.scope || program2.material?.contentFiles && program2.material.contentFiles.length > 0) {
    try {
      const { collectMaterial: collectMaterial2, shouldAutoSkip: shouldAutoSkip2 } = await Promise.resolve().then(() => (init_material(), exports_material));
      const materialConfig = {
        scope: program2.material.scope || "",
        contentFiles: program2.material.contentFiles || [],
        spec: program2.material.spec || "",
        force: false,
        passesPerFocus: programOpts.passesPerFocus || 2,
        focusAreas: programOpts.focusAreas || [],
        customFocus: "",
        noJudge: false,
        noContext: false,
        verify: false,
        verifyRoles: "",
        v1Mode: false,
        maxWorkers: null,
        noWorktree: true,
        noImproveReview: false,
        sessionName: "",
        notifyTarget: "",
        workerModel: "sonnet[1m]",
        coordModel: "sonnet[1m]"
      };
      const material = collectMaterial2(materialConfig, sessionDir2, projectRoot);
      if (material) {
        const skipReason = shouldAutoSkip2(material, materialConfig);
        if (skipReason && !programOpts.force) {
          console.log(skipReason);
          rmSync7(sessionDir2, { recursive: true, force: true });
          return;
        }
        state.material = {
          materialFile: material.materialFile,
          materialType: material.materialType,
          diffLines: material.diffLines,
          diffDesc: material.diffDesc,
          materialTypesStr: material.materialTypesStr,
          hasDiff: material.hasDiff,
          hasContent: material.hasContent,
          changedFiles: material.changedFiles
        };
      }
    } catch (err) {
      console.log(`WARN: Material collection failed: ${err}`);
    }
  }
  console.log(`Session: ${sessionDir2}`);
  const nodeCount = program2.graph ? Object.keys(program2.graph.nodes).length : program2.phases.length;
  const unitLabel = program2.graph ? "node" : "phase";
  console.log(`Compiling program: ${program2.name} (${nodeCount} ${unitLabel}${nodeCount !== 1 ? "s" : ""})`);
  const plan = compile(program2, state);
  state.compiledPhases = plan.phases;
  savePipelineState(state);
  const manifestPath = generateManifest(program2, state, plan.phases);
  console.log(`Manifest: ${manifestPath}`);
  if (opts.dryRun) {
    console.log("");
    console.log(readFileSync31(manifestPath, "utf-8"));
    rmSync7(sessionDir2, { recursive: true, force: true });
    return;
  }
  const phase0Workers = plan.workers.filter((w) => w.phaseIndex === 0);
  const phase0Windows = plan.windows.filter((w) => phase0Workers.some((worker) => worker.window === w.name));
  createTmuxSession(state, phase0Windows);
  if (phase0Workers.length > 0) {
    console.log(`Provisioning Phase 0 workers (${phase0Workers.length})...`);
    await provisionWorkers(phase0Workers, state);
    for (const worker of phase0Workers) {
      generateLaunchWrapper(worker, state);
    }
    console.log("");
    console.log(`Phase 0: Launching ${phase0Workers.length} agent(s)...`);
    if (phase0Workers.length === 1) {
      launchInPlanningWindow(phase0Workers[0], sessionName, state);
    } else {
      launchAgents(phase0Workers, sessionName, state);
    }
  }
  showManifest(sessionName, manifestPath);
  generateCleanupScript(state);
  console.log("");
  console.log("════════════════════════════════════════════════════════════");
  console.log(`  PIPELINE: ${program2.name}`);
  console.log("");
  console.log(`  Session:     ${sessionName}`);
  console.log(`  Dir:         ${sessionDir2}`);
  if (state.material) {
    console.log(`  Material:    ${state.material.materialTypesStr} (${state.material.materialType})`);
    console.log(`  Reviewing:   ${state.material.diffDesc} (${state.material.diffLines} lines)`);
  }
  console.log("");
  if (program2.graph) {
    const g = program2.graph;
    const nodeNames = Object.keys(g.nodes);
    const chain = [g.entry];
    const visited = new Set([g.entry]);
    let cur = g.entry;
    for (let i = 0;i < nodeNames.length; i++) {
      const fwd = g.edges.find((e) => e.from === cur && !e.maxIterations && !visited.has(e.to));
      if (!fwd)
        break;
      chain.push(fwd.to);
      visited.add(fwd.to);
      cur = fwd.to;
    }
    const chainStr = chain.map((n) => n === g.entry ? `[${n}]` : n).join(" ──> ");
    console.log(`  Flow: ${chainStr}`);
    const backEdges = g.edges.filter((e) => e.maxIterations);
    for (const e of backEdges) {
      const label = e.label ? ` "${e.label}"` : "";
      console.log(`         ${e.to} <──${label}── ${e.from} (max ${e.maxIterations}x)`);
    }
  } else {
    const names = program2.phases.map((p) => p.name);
    const chainStr = names.map((n, i) => i === 0 ? `[${n}]` : n).join(" ──> ");
    console.log(`  Flow: ${chainStr}`);
  }
  console.log("");
  console.log("");
  console.log(`  Attach: tmux switch-client -t ${sessionName}`);
  console.log(`          tmux a -t ${sessionName}`);
  console.log(`  Report: ${sessionDir2}/report.md (after completion)`);
  console.log("════════════════════════════════════════════════════════════");
}
function listPrograms2() {
  const programsDir = join39(FLEET_DIR5, "programs");
  if (!existsSync33(programsDir))
    return [];
  try {
    const { readdirSync: readdirSync13 } = __require("node:fs");
    return readdirSync13(programsDir).filter((f) => f.endsWith(".program.ts")).map((f) => f.replace(".program.ts", ""));
  } catch {
    return [];
  }
}
function buildProgramOpts2(programName, opts, projectRoot) {
  if (programName === "deep-review") {
    const scope = opts.scope || "HEAD";
    const isCodebase = scope === "codebase";
    const defaultSpec = isCodebase ? "Perform a comprehensive quality review of this codebase. Look for bugs, security issues, architectural problems, error handling gaps, and opportunities for improvement." : "Review this material thoroughly for issues, gaps, and improvements.";
    return {
      scope,
      contentFiles: opts.content ? opts.content.split(",").map((s) => s.trim()) : [],
      spec: opts.spec || defaultSpec,
      passesPerFocus: parseInt(opts.passes, 10) || 2,
      focusAreas: opts.focus ? opts.focus.split(",").map((s) => s.trim()) : [],
      maxWorkers: opts.maxWorkers ? parseInt(opts.maxWorkers, 10) : null,
      verify: !!opts.verify,
      verifyRoles: opts.verifyRoles || "",
      noJudge: opts.judge === false,
      noContext: opts.context === false,
      noImproveReview: opts.improveReview === false,
      workerModel: process.env.DEEP_REVIEW_WORKER_MODEL || "sonnet",
      coordModel: process.env.DEEP_REVIEW_COORD_MODEL || "sonnet",
      notifyTarget: opts.notify || "",
      force: !!opts.force
    };
  }
  if (programName === "research-lab") {
    return {
      scope: opts.scope || "HEAD",
      contentFiles: opts.content ? opts.content.split(",").map((s) => s.trim()) : [],
      spec: opts.spec || "Analyze this material thoroughly for issues, patterns, and insights.",
      passesPerFocus: 1,
      focusAreas: [],
      maxWorkers: opts.maxWorkers ? parseInt(opts.maxWorkers, 10) : null,
      verify: false,
      verifyRoles: "",
      noJudge: true,
      noContext: opts.context === false,
      noImproveReview: true,
      workerModel: process.env.DEEP_REVIEW_WORKER_MODEL || "sonnet",
      coordModel: process.env.DEEP_REVIEW_COORD_MODEL || "sonnet",
      notifyTarget: opts.notify || "",
      force: !!opts.force
    };
  }
  return { ...opts, projectRoot };
}
function buildSessionName2(programName, projectRoot, opts) {
  const worktreeName = basename8(projectRoot).replace(/^Wechat-w-/, "").replace(/^Wechat$/, "main");
  const scope = opts.scope || "HEAD";
  if (scope === "codebase") {
    const codebaseHash = hashStr2(projectRoot + Date.now().toString()).slice(0, 8);
    return `${programName.slice(0, 3)}-${worktreeName}-codebase-${codebaseHash}`.slice(0, 50);
  }
  let resolvedRef = scope;
  if (scope === "uncommitted") {
    const r = Bun.spawnSync(["git", "rev-parse", "--short=8", "HEAD"], { cwd: projectRoot, stderr: "pipe" });
    resolvedRef = r.stdout.toString().trim() || "wip";
  } else if (scope.includes("..")) {
    resolvedRef = scope.split("..").pop() || scope;
  }
  const shortResult = Bun.spawnSync(["git", "rev-parse", "--short=8", resolvedRef], { cwd: projectRoot, stderr: "pipe" });
  const shortHash = shortResult.stdout.toString().trim().split(`
`)[0] || resolvedRef.replace(/[^a-zA-Z0-9]+/g, "-");
  return `${programName.slice(0, 3)}-${worktreeName}-${shortHash}`.slice(0, 50);
}
function hashStr2(s) {
  let hash = 0;
  for (let i = 0;i < s.length; i++) {
    hash = (hash << 5) - hash + s.charCodeAt(i) | 0;
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}
var HOME15, FLEET_DIR5;
var init_pipeline2 = __esm(() => {
  init_cli();
  init_fmt2();
  init_paths();
  init_compiler();
  init_manifest();
  init_tmux_layout();
  init_fleet_provision();
  HOME15 = process.env.HOME || "/tmp";
  FLEET_DIR5 = process.env.CLAUDE_FLEET_DIR || join39(HOME15, ".claude-fleet");
});

// cli/commands/completion.ts
import { readFileSync as readFileSync32 } from "fs";
import { join as join40, dirname as dirname8 } from "path";
function register27(parent) {
  parent.command("completion").description("Output shell completion (source it or add to ~/.zshrc)").action(() => {
    const fleetDir = process.env.CLAUDE_FLEET_DIR || join40(process.env.HOME, ".claude-fleet");
    const completionFile = join40(fleetDir, "completions", "_fleet");
    try {
      readFileSync32(completionFile, "utf-8");
      console.log(`# Fleet CLI completions — add to ~/.zshrc or source directly`);
      console.log(`fpath=(${dirname8(completionFile)} $fpath)`);
      console.log(`autoload -Uz compinit && compinit`);
    } catch {
      console.error(`Completion file not found: ${completionFile}`);
      console.error(`Run 'fleet setup' first.`);
      process.exit(1);
    }
  });
}
var init_completion = () => {};

// cli/commands/update.ts
import { readdirSync as readdirSync13 } from "node:fs";
function register28(parent) {
  parent.command("update").description("Pull latest fleet code, install deps, re-run setup").option("--reload", "Recycle all running workers after update").option("--extensions", "Build and install all extensions during setup").action(async (opts) => {
    console.log(`${source_default.bold("fleet update")} — updating fleet infrastructure
`);
    info("Pulling latest changes...");
    const pull = Bun.spawnSync(["git", "-C", FLEET_DIR, "pull", "origin", "main"], {
      stdout: "inherit",
      stderr: "inherit"
    });
    if (pull.exitCode !== 0)
      fail("git pull failed");
    ok("Code updated");
    info("Installing dependencies...");
    const install = Bun.spawnSync(["bun", "install"], {
      cwd: FLEET_DIR,
      stdout: "inherit",
      stderr: "inherit"
    });
    if (install.exitCode !== 0)
      fail("bun install failed");
    ok("Dependencies installed");
    const setupArgs = ["bun", "run", "cli/index.ts", "setup"];
    if (opts.extensions || opts.reload)
      setupArgs.push("--extensions");
    info(`Running fleet setup${opts.extensions || opts.reload ? " --extensions" : ""}...`);
    const setup = Bun.spawnSync(setupArgs, {
      cwd: FLEET_DIR,
      stdout: "inherit",
      stderr: "inherit"
    });
    if (setup.exitCode !== 0)
      fail("fleet setup failed");
    if (opts.reload) {
      console.log("");
      info("Reloading workers...");
      const panes = listPaneIds();
      let recycled = 0;
      let projects;
      try {
        projects = readdirSync13(FLEET_DATA, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
      } catch {
        projects = [];
      }
      for (const project of projects) {
        let workers;
        try {
          workers = readdirSync13(`${FLEET_DATA}/${project}`, { withFileTypes: true }).filter((d) => d.isDirectory() && !["missions", "_user", "_config"].includes(d.name)).map((d) => d.name);
        } catch {
          continue;
        }
        for (const name of workers) {
          const state = getState(project, name);
          const paneId = state?.pane_id;
          if (paneId && panes.has(paneId)) {
            const { join: join41 } = __require("node:path");
            const statePath2 = join41(FLEET_DATA, project, name, "state.json");
            try {
              const stateData = JSON.parse(__require("node:fs").readFileSync(statePath2, "utf-8"));
              stateData.status = "recycling";
              delete stateData.sleep_until;
              writeJsonLocked(statePath2, stateData);
            } catch {}
            killPane(paneId);
            info(`  Recycled ${name} (${project})`);
            recycled++;
          }
        }
      }
      if (recycled > 0) {
        ok(`Recycled ${recycled} worker(s) — watchdog will respawn with new config`);
      } else {
        warn("No running workers found to reload");
      }
    }
    console.log("");
    ok(source_default.bold("Fleet updated successfully."));
  });
}
var init_update = __esm(() => {
  init_source();
  init_paths();
  init_config();
  init_fmt2();
});

// node_modules/.bun/js-yaml@4.1.1/node_modules/js-yaml/dist/js-yaml.mjs
function isNothing(subject) {
  return typeof subject === "undefined" || subject === null;
}
function isObject(subject) {
  return typeof subject === "object" && subject !== null;
}
function toArray(sequence) {
  if (Array.isArray(sequence))
    return sequence;
  else if (isNothing(sequence))
    return [];
  return [sequence];
}
function extend(target, source) {
  var index, length, key, sourceKeys;
  if (source) {
    sourceKeys = Object.keys(source);
    for (index = 0, length = sourceKeys.length;index < length; index += 1) {
      key = sourceKeys[index];
      target[key] = source[key];
    }
  }
  return target;
}
function repeat(string, count) {
  var result = "", cycle;
  for (cycle = 0;cycle < count; cycle += 1) {
    result += string;
  }
  return result;
}
function isNegativeZero(number) {
  return number === 0 && Number.NEGATIVE_INFINITY === 1 / number;
}
function formatError(exception, compact) {
  var where = "", message = exception.reason || "(unknown reason)";
  if (!exception.mark)
    return message;
  if (exception.mark.name) {
    where += 'in "' + exception.mark.name + '" ';
  }
  where += "(" + (exception.mark.line + 1) + ":" + (exception.mark.column + 1) + ")";
  if (!compact && exception.mark.snippet) {
    where += `

` + exception.mark.snippet;
  }
  return message + " " + where;
}
function YAMLException$1(reason, mark) {
  Error.call(this);
  this.name = "YAMLException";
  this.reason = reason;
  this.mark = mark;
  this.message = formatError(this, false);
  if (Error.captureStackTrace) {
    Error.captureStackTrace(this, this.constructor);
  } else {
    this.stack = new Error().stack || "";
  }
}
function getLine(buffer, lineStart, lineEnd, position, maxLineLength) {
  var head = "";
  var tail = "";
  var maxHalfLength = Math.floor(maxLineLength / 2) - 1;
  if (position - lineStart > maxHalfLength) {
    head = " ... ";
    lineStart = position - maxHalfLength + head.length;
  }
  if (lineEnd - position > maxHalfLength) {
    tail = " ...";
    lineEnd = position + maxHalfLength - tail.length;
  }
  return {
    str: head + buffer.slice(lineStart, lineEnd).replace(/\t/g, "→") + tail,
    pos: position - lineStart + head.length
  };
}
function padStart(string, max) {
  return common.repeat(" ", max - string.length) + string;
}
function makeSnippet(mark, options) {
  options = Object.create(options || null);
  if (!mark.buffer)
    return null;
  if (!options.maxLength)
    options.maxLength = 79;
  if (typeof options.indent !== "number")
    options.indent = 1;
  if (typeof options.linesBefore !== "number")
    options.linesBefore = 3;
  if (typeof options.linesAfter !== "number")
    options.linesAfter = 2;
  var re = /\r?\n|\r|\0/g;
  var lineStarts = [0];
  var lineEnds = [];
  var match;
  var foundLineNo = -1;
  while (match = re.exec(mark.buffer)) {
    lineEnds.push(match.index);
    lineStarts.push(match.index + match[0].length);
    if (mark.position <= match.index && foundLineNo < 0) {
      foundLineNo = lineStarts.length - 2;
    }
  }
  if (foundLineNo < 0)
    foundLineNo = lineStarts.length - 1;
  var result = "", i, line;
  var lineNoLength = Math.min(mark.line + options.linesAfter, lineEnds.length).toString().length;
  var maxLineLength = options.maxLength - (options.indent + lineNoLength + 3);
  for (i = 1;i <= options.linesBefore; i++) {
    if (foundLineNo - i < 0)
      break;
    line = getLine(mark.buffer, lineStarts[foundLineNo - i], lineEnds[foundLineNo - i], mark.position - (lineStarts[foundLineNo] - lineStarts[foundLineNo - i]), maxLineLength);
    result = common.repeat(" ", options.indent) + padStart((mark.line - i + 1).toString(), lineNoLength) + " | " + line.str + `
` + result;
  }
  line = getLine(mark.buffer, lineStarts[foundLineNo], lineEnds[foundLineNo], mark.position, maxLineLength);
  result += common.repeat(" ", options.indent) + padStart((mark.line + 1).toString(), lineNoLength) + " | " + line.str + `
`;
  result += common.repeat("-", options.indent + lineNoLength + 3 + line.pos) + "^" + `
`;
  for (i = 1;i <= options.linesAfter; i++) {
    if (foundLineNo + i >= lineEnds.length)
      break;
    line = getLine(mark.buffer, lineStarts[foundLineNo + i], lineEnds[foundLineNo + i], mark.position - (lineStarts[foundLineNo] - lineStarts[foundLineNo + i]), maxLineLength);
    result += common.repeat(" ", options.indent) + padStart((mark.line + i + 1).toString(), lineNoLength) + " | " + line.str + `
`;
  }
  return result.replace(/\n$/, "");
}
function compileStyleAliases(map) {
  var result = {};
  if (map !== null) {
    Object.keys(map).forEach(function(style) {
      map[style].forEach(function(alias) {
        result[String(alias)] = style;
      });
    });
  }
  return result;
}
function Type$1(tag, options) {
  options = options || {};
  Object.keys(options).forEach(function(name) {
    if (TYPE_CONSTRUCTOR_OPTIONS.indexOf(name) === -1) {
      throw new exception('Unknown option "' + name + '" is met in definition of "' + tag + '" YAML type.');
    }
  });
  this.options = options;
  this.tag = tag;
  this.kind = options["kind"] || null;
  this.resolve = options["resolve"] || function() {
    return true;
  };
  this.construct = options["construct"] || function(data) {
    return data;
  };
  this.instanceOf = options["instanceOf"] || null;
  this.predicate = options["predicate"] || null;
  this.represent = options["represent"] || null;
  this.representName = options["representName"] || null;
  this.defaultStyle = options["defaultStyle"] || null;
  this.multi = options["multi"] || false;
  this.styleAliases = compileStyleAliases(options["styleAliases"] || null);
  if (YAML_NODE_KINDS.indexOf(this.kind) === -1) {
    throw new exception('Unknown kind "' + this.kind + '" is specified for "' + tag + '" YAML type.');
  }
}
function compileList(schema, name) {
  var result = [];
  schema[name].forEach(function(currentType) {
    var newIndex = result.length;
    result.forEach(function(previousType, previousIndex) {
      if (previousType.tag === currentType.tag && previousType.kind === currentType.kind && previousType.multi === currentType.multi) {
        newIndex = previousIndex;
      }
    });
    result[newIndex] = currentType;
  });
  return result;
}
function compileMap() {
  var result = {
    scalar: {},
    sequence: {},
    mapping: {},
    fallback: {},
    multi: {
      scalar: [],
      sequence: [],
      mapping: [],
      fallback: []
    }
  }, index, length;
  function collectType(type2) {
    if (type2.multi) {
      result.multi[type2.kind].push(type2);
      result.multi["fallback"].push(type2);
    } else {
      result[type2.kind][type2.tag] = result["fallback"][type2.tag] = type2;
    }
  }
  for (index = 0, length = arguments.length;index < length; index += 1) {
    arguments[index].forEach(collectType);
  }
  return result;
}
function Schema$1(definition) {
  return this.extend(definition);
}
function resolveYamlNull(data) {
  if (data === null)
    return true;
  var max = data.length;
  return max === 1 && data === "~" || max === 4 && (data === "null" || data === "Null" || data === "NULL");
}
function constructYamlNull() {
  return null;
}
function isNull(object) {
  return object === null;
}
function resolveYamlBoolean(data) {
  if (data === null)
    return false;
  var max = data.length;
  return max === 4 && (data === "true" || data === "True" || data === "TRUE") || max === 5 && (data === "false" || data === "False" || data === "FALSE");
}
function constructYamlBoolean(data) {
  return data === "true" || data === "True" || data === "TRUE";
}
function isBoolean(object) {
  return Object.prototype.toString.call(object) === "[object Boolean]";
}
function isHexCode(c) {
  return 48 <= c && c <= 57 || 65 <= c && c <= 70 || 97 <= c && c <= 102;
}
function isOctCode(c) {
  return 48 <= c && c <= 55;
}
function isDecCode(c) {
  return 48 <= c && c <= 57;
}
function resolveYamlInteger(data) {
  if (data === null)
    return false;
  var max = data.length, index = 0, hasDigits = false, ch;
  if (!max)
    return false;
  ch = data[index];
  if (ch === "-" || ch === "+") {
    ch = data[++index];
  }
  if (ch === "0") {
    if (index + 1 === max)
      return true;
    ch = data[++index];
    if (ch === "b") {
      index++;
      for (;index < max; index++) {
        ch = data[index];
        if (ch === "_")
          continue;
        if (ch !== "0" && ch !== "1")
          return false;
        hasDigits = true;
      }
      return hasDigits && ch !== "_";
    }
    if (ch === "x") {
      index++;
      for (;index < max; index++) {
        ch = data[index];
        if (ch === "_")
          continue;
        if (!isHexCode(data.charCodeAt(index)))
          return false;
        hasDigits = true;
      }
      return hasDigits && ch !== "_";
    }
    if (ch === "o") {
      index++;
      for (;index < max; index++) {
        ch = data[index];
        if (ch === "_")
          continue;
        if (!isOctCode(data.charCodeAt(index)))
          return false;
        hasDigits = true;
      }
      return hasDigits && ch !== "_";
    }
  }
  if (ch === "_")
    return false;
  for (;index < max; index++) {
    ch = data[index];
    if (ch === "_")
      continue;
    if (!isDecCode(data.charCodeAt(index))) {
      return false;
    }
    hasDigits = true;
  }
  if (!hasDigits || ch === "_")
    return false;
  return true;
}
function constructYamlInteger(data) {
  var value = data, sign = 1, ch;
  if (value.indexOf("_") !== -1) {
    value = value.replace(/_/g, "");
  }
  ch = value[0];
  if (ch === "-" || ch === "+") {
    if (ch === "-")
      sign = -1;
    value = value.slice(1);
    ch = value[0];
  }
  if (value === "0")
    return 0;
  if (ch === "0") {
    if (value[1] === "b")
      return sign * parseInt(value.slice(2), 2);
    if (value[1] === "x")
      return sign * parseInt(value.slice(2), 16);
    if (value[1] === "o")
      return sign * parseInt(value.slice(2), 8);
  }
  return sign * parseInt(value, 10);
}
function isInteger(object) {
  return Object.prototype.toString.call(object) === "[object Number]" && (object % 1 === 0 && !common.isNegativeZero(object));
}
function resolveYamlFloat(data) {
  if (data === null)
    return false;
  if (!YAML_FLOAT_PATTERN.test(data) || data[data.length - 1] === "_") {
    return false;
  }
  return true;
}
function constructYamlFloat(data) {
  var value, sign;
  value = data.replace(/_/g, "").toLowerCase();
  sign = value[0] === "-" ? -1 : 1;
  if ("+-".indexOf(value[0]) >= 0) {
    value = value.slice(1);
  }
  if (value === ".inf") {
    return sign === 1 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
  } else if (value === ".nan") {
    return NaN;
  }
  return sign * parseFloat(value, 10);
}
function representYamlFloat(object, style) {
  var res;
  if (isNaN(object)) {
    switch (style) {
      case "lowercase":
        return ".nan";
      case "uppercase":
        return ".NAN";
      case "camelcase":
        return ".NaN";
    }
  } else if (Number.POSITIVE_INFINITY === object) {
    switch (style) {
      case "lowercase":
        return ".inf";
      case "uppercase":
        return ".INF";
      case "camelcase":
        return ".Inf";
    }
  } else if (Number.NEGATIVE_INFINITY === object) {
    switch (style) {
      case "lowercase":
        return "-.inf";
      case "uppercase":
        return "-.INF";
      case "camelcase":
        return "-.Inf";
    }
  } else if (common.isNegativeZero(object)) {
    return "-0.0";
  }
  res = object.toString(10);
  return SCIENTIFIC_WITHOUT_DOT.test(res) ? res.replace("e", ".e") : res;
}
function isFloat(object) {
  return Object.prototype.toString.call(object) === "[object Number]" && (object % 1 !== 0 || common.isNegativeZero(object));
}
function resolveYamlTimestamp(data) {
  if (data === null)
    return false;
  if (YAML_DATE_REGEXP.exec(data) !== null)
    return true;
  if (YAML_TIMESTAMP_REGEXP.exec(data) !== null)
    return true;
  return false;
}
function constructYamlTimestamp(data) {
  var match, year, month, day, hour, minute, second, fraction = 0, delta = null, tz_hour, tz_minute, date;
  match = YAML_DATE_REGEXP.exec(data);
  if (match === null)
    match = YAML_TIMESTAMP_REGEXP.exec(data);
  if (match === null)
    throw new Error("Date resolve error");
  year = +match[1];
  month = +match[2] - 1;
  day = +match[3];
  if (!match[4]) {
    return new Date(Date.UTC(year, month, day));
  }
  hour = +match[4];
  minute = +match[5];
  second = +match[6];
  if (match[7]) {
    fraction = match[7].slice(0, 3);
    while (fraction.length < 3) {
      fraction += "0";
    }
    fraction = +fraction;
  }
  if (match[9]) {
    tz_hour = +match[10];
    tz_minute = +(match[11] || 0);
    delta = (tz_hour * 60 + tz_minute) * 60000;
    if (match[9] === "-")
      delta = -delta;
  }
  date = new Date(Date.UTC(year, month, day, hour, minute, second, fraction));
  if (delta)
    date.setTime(date.getTime() - delta);
  return date;
}
function representYamlTimestamp(object) {
  return object.toISOString();
}
function resolveYamlMerge(data) {
  return data === "<<" || data === null;
}
function resolveYamlBinary(data) {
  if (data === null)
    return false;
  var code, idx, bitlen = 0, max = data.length, map2 = BASE64_MAP;
  for (idx = 0;idx < max; idx++) {
    code = map2.indexOf(data.charAt(idx));
    if (code > 64)
      continue;
    if (code < 0)
      return false;
    bitlen += 6;
  }
  return bitlen % 8 === 0;
}
function constructYamlBinary(data) {
  var idx, tailbits, input = data.replace(/[\r\n=]/g, ""), max = input.length, map2 = BASE64_MAP, bits = 0, result = [];
  for (idx = 0;idx < max; idx++) {
    if (idx % 4 === 0 && idx) {
      result.push(bits >> 16 & 255);
      result.push(bits >> 8 & 255);
      result.push(bits & 255);
    }
    bits = bits << 6 | map2.indexOf(input.charAt(idx));
  }
  tailbits = max % 4 * 6;
  if (tailbits === 0) {
    result.push(bits >> 16 & 255);
    result.push(bits >> 8 & 255);
    result.push(bits & 255);
  } else if (tailbits === 18) {
    result.push(bits >> 10 & 255);
    result.push(bits >> 2 & 255);
  } else if (tailbits === 12) {
    result.push(bits >> 4 & 255);
  }
  return new Uint8Array(result);
}
function representYamlBinary(object) {
  var result = "", bits = 0, idx, tail, max = object.length, map2 = BASE64_MAP;
  for (idx = 0;idx < max; idx++) {
    if (idx % 3 === 0 && idx) {
      result += map2[bits >> 18 & 63];
      result += map2[bits >> 12 & 63];
      result += map2[bits >> 6 & 63];
      result += map2[bits & 63];
    }
    bits = (bits << 8) + object[idx];
  }
  tail = max % 3;
  if (tail === 0) {
    result += map2[bits >> 18 & 63];
    result += map2[bits >> 12 & 63];
    result += map2[bits >> 6 & 63];
    result += map2[bits & 63];
  } else if (tail === 2) {
    result += map2[bits >> 10 & 63];
    result += map2[bits >> 4 & 63];
    result += map2[bits << 2 & 63];
    result += map2[64];
  } else if (tail === 1) {
    result += map2[bits >> 2 & 63];
    result += map2[bits << 4 & 63];
    result += map2[64];
    result += map2[64];
  }
  return result;
}
function isBinary(obj) {
  return Object.prototype.toString.call(obj) === "[object Uint8Array]";
}
function resolveYamlOmap(data) {
  if (data === null)
    return true;
  var objectKeys = [], index, length, pair, pairKey, pairHasKey, object = data;
  for (index = 0, length = object.length;index < length; index += 1) {
    pair = object[index];
    pairHasKey = false;
    if (_toString$2.call(pair) !== "[object Object]")
      return false;
    for (pairKey in pair) {
      if (_hasOwnProperty$3.call(pair, pairKey)) {
        if (!pairHasKey)
          pairHasKey = true;
        else
          return false;
      }
    }
    if (!pairHasKey)
      return false;
    if (objectKeys.indexOf(pairKey) === -1)
      objectKeys.push(pairKey);
    else
      return false;
  }
  return true;
}
function constructYamlOmap(data) {
  return data !== null ? data : [];
}
function resolveYamlPairs(data) {
  if (data === null)
    return true;
  var index, length, pair, keys, result, object = data;
  result = new Array(object.length);
  for (index = 0, length = object.length;index < length; index += 1) {
    pair = object[index];
    if (_toString$1.call(pair) !== "[object Object]")
      return false;
    keys = Object.keys(pair);
    if (keys.length !== 1)
      return false;
    result[index] = [keys[0], pair[keys[0]]];
  }
  return true;
}
function constructYamlPairs(data) {
  if (data === null)
    return [];
  var index, length, pair, keys, result, object = data;
  result = new Array(object.length);
  for (index = 0, length = object.length;index < length; index += 1) {
    pair = object[index];
    keys = Object.keys(pair);
    result[index] = [keys[0], pair[keys[0]]];
  }
  return result;
}
function resolveYamlSet(data) {
  if (data === null)
    return true;
  var key, object = data;
  for (key in object) {
    if (_hasOwnProperty$2.call(object, key)) {
      if (object[key] !== null)
        return false;
    }
  }
  return true;
}
function constructYamlSet(data) {
  return data !== null ? data : {};
}
function _class(obj) {
  return Object.prototype.toString.call(obj);
}
function is_EOL(c) {
  return c === 10 || c === 13;
}
function is_WHITE_SPACE(c) {
  return c === 9 || c === 32;
}
function is_WS_OR_EOL(c) {
  return c === 9 || c === 32 || c === 10 || c === 13;
}
function is_FLOW_INDICATOR(c) {
  return c === 44 || c === 91 || c === 93 || c === 123 || c === 125;
}
function fromHexCode(c) {
  var lc;
  if (48 <= c && c <= 57) {
    return c - 48;
  }
  lc = c | 32;
  if (97 <= lc && lc <= 102) {
    return lc - 97 + 10;
  }
  return -1;
}
function escapedHexLen(c) {
  if (c === 120) {
    return 2;
  }
  if (c === 117) {
    return 4;
  }
  if (c === 85) {
    return 8;
  }
  return 0;
}
function fromDecimalCode(c) {
  if (48 <= c && c <= 57) {
    return c - 48;
  }
  return -1;
}
function simpleEscapeSequence(c) {
  return c === 48 ? "\x00" : c === 97 ? "\x07" : c === 98 ? "\b" : c === 116 ? "\t" : c === 9 ? "\t" : c === 110 ? `
` : c === 118 ? "\v" : c === 102 ? "\f" : c === 114 ? "\r" : c === 101 ? "\x1B" : c === 32 ? " " : c === 34 ? '"' : c === 47 ? "/" : c === 92 ? "\\" : c === 78 ? "" : c === 95 ? " " : c === 76 ? "\u2028" : c === 80 ? "\u2029" : "";
}
function charFromCodepoint(c) {
  if (c <= 65535) {
    return String.fromCharCode(c);
  }
  return String.fromCharCode((c - 65536 >> 10) + 55296, (c - 65536 & 1023) + 56320);
}
function setProperty(object, key, value) {
  if (key === "__proto__") {
    Object.defineProperty(object, key, {
      configurable: true,
      enumerable: true,
      writable: true,
      value
    });
  } else {
    object[key] = value;
  }
}
function State$1(input, options) {
  this.input = input;
  this.filename = options["filename"] || null;
  this.schema = options["schema"] || _default;
  this.onWarning = options["onWarning"] || null;
  this.legacy = options["legacy"] || false;
  this.json = options["json"] || false;
  this.listener = options["listener"] || null;
  this.implicitTypes = this.schema.compiledImplicit;
  this.typeMap = this.schema.compiledTypeMap;
  this.length = input.length;
  this.position = 0;
  this.line = 0;
  this.lineStart = 0;
  this.lineIndent = 0;
  this.firstTabInLine = -1;
  this.documents = [];
}
function generateError(state, message) {
  var mark = {
    name: state.filename,
    buffer: state.input.slice(0, -1),
    position: state.position,
    line: state.line,
    column: state.position - state.lineStart
  };
  mark.snippet = snippet(mark);
  return new exception(message, mark);
}
function throwError(state, message) {
  throw generateError(state, message);
}
function throwWarning(state, message) {
  if (state.onWarning) {
    state.onWarning.call(null, generateError(state, message));
  }
}
function captureSegment(state, start, end, checkJson) {
  var _position, _length, _character, _result;
  if (start < end) {
    _result = state.input.slice(start, end);
    if (checkJson) {
      for (_position = 0, _length = _result.length;_position < _length; _position += 1) {
        _character = _result.charCodeAt(_position);
        if (!(_character === 9 || 32 <= _character && _character <= 1114111)) {
          throwError(state, "expected valid JSON character");
        }
      }
    } else if (PATTERN_NON_PRINTABLE.test(_result)) {
      throwError(state, "the stream contains non-printable characters");
    }
    state.result += _result;
  }
}
function mergeMappings(state, destination, source, overridableKeys) {
  var sourceKeys, key, index, quantity;
  if (!common.isObject(source)) {
    throwError(state, "cannot merge mappings; the provided source object is unacceptable");
  }
  sourceKeys = Object.keys(source);
  for (index = 0, quantity = sourceKeys.length;index < quantity; index += 1) {
    key = sourceKeys[index];
    if (!_hasOwnProperty$1.call(destination, key)) {
      setProperty(destination, key, source[key]);
      overridableKeys[key] = true;
    }
  }
}
function storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, startLine, startLineStart, startPos) {
  var index, quantity;
  if (Array.isArray(keyNode)) {
    keyNode = Array.prototype.slice.call(keyNode);
    for (index = 0, quantity = keyNode.length;index < quantity; index += 1) {
      if (Array.isArray(keyNode[index])) {
        throwError(state, "nested arrays are not supported inside keys");
      }
      if (typeof keyNode === "object" && _class(keyNode[index]) === "[object Object]") {
        keyNode[index] = "[object Object]";
      }
    }
  }
  if (typeof keyNode === "object" && _class(keyNode) === "[object Object]") {
    keyNode = "[object Object]";
  }
  keyNode = String(keyNode);
  if (_result === null) {
    _result = {};
  }
  if (keyTag === "tag:yaml.org,2002:merge") {
    if (Array.isArray(valueNode)) {
      for (index = 0, quantity = valueNode.length;index < quantity; index += 1) {
        mergeMappings(state, _result, valueNode[index], overridableKeys);
      }
    } else {
      mergeMappings(state, _result, valueNode, overridableKeys);
    }
  } else {
    if (!state.json && !_hasOwnProperty$1.call(overridableKeys, keyNode) && _hasOwnProperty$1.call(_result, keyNode)) {
      state.line = startLine || state.line;
      state.lineStart = startLineStart || state.lineStart;
      state.position = startPos || state.position;
      throwError(state, "duplicated mapping key");
    }
    setProperty(_result, keyNode, valueNode);
    delete overridableKeys[keyNode];
  }
  return _result;
}
function readLineBreak(state) {
  var ch;
  ch = state.input.charCodeAt(state.position);
  if (ch === 10) {
    state.position++;
  } else if (ch === 13) {
    state.position++;
    if (state.input.charCodeAt(state.position) === 10) {
      state.position++;
    }
  } else {
    throwError(state, "a line break is expected");
  }
  state.line += 1;
  state.lineStart = state.position;
  state.firstTabInLine = -1;
}
function skipSeparationSpace(state, allowComments, checkIndent) {
  var lineBreaks = 0, ch = state.input.charCodeAt(state.position);
  while (ch !== 0) {
    while (is_WHITE_SPACE(ch)) {
      if (ch === 9 && state.firstTabInLine === -1) {
        state.firstTabInLine = state.position;
      }
      ch = state.input.charCodeAt(++state.position);
    }
    if (allowComments && ch === 35) {
      do {
        ch = state.input.charCodeAt(++state.position);
      } while (ch !== 10 && ch !== 13 && ch !== 0);
    }
    if (is_EOL(ch)) {
      readLineBreak(state);
      ch = state.input.charCodeAt(state.position);
      lineBreaks++;
      state.lineIndent = 0;
      while (ch === 32) {
        state.lineIndent++;
        ch = state.input.charCodeAt(++state.position);
      }
    } else {
      break;
    }
  }
  if (checkIndent !== -1 && lineBreaks !== 0 && state.lineIndent < checkIndent) {
    throwWarning(state, "deficient indentation");
  }
  return lineBreaks;
}
function testDocumentSeparator(state) {
  var _position = state.position, ch;
  ch = state.input.charCodeAt(_position);
  if ((ch === 45 || ch === 46) && ch === state.input.charCodeAt(_position + 1) && ch === state.input.charCodeAt(_position + 2)) {
    _position += 3;
    ch = state.input.charCodeAt(_position);
    if (ch === 0 || is_WS_OR_EOL(ch)) {
      return true;
    }
  }
  return false;
}
function writeFoldedLines(state, count) {
  if (count === 1) {
    state.result += " ";
  } else if (count > 1) {
    state.result += common.repeat(`
`, count - 1);
  }
}
function readPlainScalar(state, nodeIndent, withinFlowCollection) {
  var preceding, following, captureStart, captureEnd, hasPendingContent, _line, _lineStart, _lineIndent, _kind = state.kind, _result = state.result, ch;
  ch = state.input.charCodeAt(state.position);
  if (is_WS_OR_EOL(ch) || is_FLOW_INDICATOR(ch) || ch === 35 || ch === 38 || ch === 42 || ch === 33 || ch === 124 || ch === 62 || ch === 39 || ch === 34 || ch === 37 || ch === 64 || ch === 96) {
    return false;
  }
  if (ch === 63 || ch === 45) {
    following = state.input.charCodeAt(state.position + 1);
    if (is_WS_OR_EOL(following) || withinFlowCollection && is_FLOW_INDICATOR(following)) {
      return false;
    }
  }
  state.kind = "scalar";
  state.result = "";
  captureStart = captureEnd = state.position;
  hasPendingContent = false;
  while (ch !== 0) {
    if (ch === 58) {
      following = state.input.charCodeAt(state.position + 1);
      if (is_WS_OR_EOL(following) || withinFlowCollection && is_FLOW_INDICATOR(following)) {
        break;
      }
    } else if (ch === 35) {
      preceding = state.input.charCodeAt(state.position - 1);
      if (is_WS_OR_EOL(preceding)) {
        break;
      }
    } else if (state.position === state.lineStart && testDocumentSeparator(state) || withinFlowCollection && is_FLOW_INDICATOR(ch)) {
      break;
    } else if (is_EOL(ch)) {
      _line = state.line;
      _lineStart = state.lineStart;
      _lineIndent = state.lineIndent;
      skipSeparationSpace(state, false, -1);
      if (state.lineIndent >= nodeIndent) {
        hasPendingContent = true;
        ch = state.input.charCodeAt(state.position);
        continue;
      } else {
        state.position = captureEnd;
        state.line = _line;
        state.lineStart = _lineStart;
        state.lineIndent = _lineIndent;
        break;
      }
    }
    if (hasPendingContent) {
      captureSegment(state, captureStart, captureEnd, false);
      writeFoldedLines(state, state.line - _line);
      captureStart = captureEnd = state.position;
      hasPendingContent = false;
    }
    if (!is_WHITE_SPACE(ch)) {
      captureEnd = state.position + 1;
    }
    ch = state.input.charCodeAt(++state.position);
  }
  captureSegment(state, captureStart, captureEnd, false);
  if (state.result) {
    return true;
  }
  state.kind = _kind;
  state.result = _result;
  return false;
}
function readSingleQuotedScalar(state, nodeIndent) {
  var ch, captureStart, captureEnd;
  ch = state.input.charCodeAt(state.position);
  if (ch !== 39) {
    return false;
  }
  state.kind = "scalar";
  state.result = "";
  state.position++;
  captureStart = captureEnd = state.position;
  while ((ch = state.input.charCodeAt(state.position)) !== 0) {
    if (ch === 39) {
      captureSegment(state, captureStart, state.position, true);
      ch = state.input.charCodeAt(++state.position);
      if (ch === 39) {
        captureStart = state.position;
        state.position++;
        captureEnd = state.position;
      } else {
        return true;
      }
    } else if (is_EOL(ch)) {
      captureSegment(state, captureStart, captureEnd, true);
      writeFoldedLines(state, skipSeparationSpace(state, false, nodeIndent));
      captureStart = captureEnd = state.position;
    } else if (state.position === state.lineStart && testDocumentSeparator(state)) {
      throwError(state, "unexpected end of the document within a single quoted scalar");
    } else {
      state.position++;
      captureEnd = state.position;
    }
  }
  throwError(state, "unexpected end of the stream within a single quoted scalar");
}
function readDoubleQuotedScalar(state, nodeIndent) {
  var captureStart, captureEnd, hexLength, hexResult, tmp, ch;
  ch = state.input.charCodeAt(state.position);
  if (ch !== 34) {
    return false;
  }
  state.kind = "scalar";
  state.result = "";
  state.position++;
  captureStart = captureEnd = state.position;
  while ((ch = state.input.charCodeAt(state.position)) !== 0) {
    if (ch === 34) {
      captureSegment(state, captureStart, state.position, true);
      state.position++;
      return true;
    } else if (ch === 92) {
      captureSegment(state, captureStart, state.position, true);
      ch = state.input.charCodeAt(++state.position);
      if (is_EOL(ch)) {
        skipSeparationSpace(state, false, nodeIndent);
      } else if (ch < 256 && simpleEscapeCheck[ch]) {
        state.result += simpleEscapeMap[ch];
        state.position++;
      } else if ((tmp = escapedHexLen(ch)) > 0) {
        hexLength = tmp;
        hexResult = 0;
        for (;hexLength > 0; hexLength--) {
          ch = state.input.charCodeAt(++state.position);
          if ((tmp = fromHexCode(ch)) >= 0) {
            hexResult = (hexResult << 4) + tmp;
          } else {
            throwError(state, "expected hexadecimal character");
          }
        }
        state.result += charFromCodepoint(hexResult);
        state.position++;
      } else {
        throwError(state, "unknown escape sequence");
      }
      captureStart = captureEnd = state.position;
    } else if (is_EOL(ch)) {
      captureSegment(state, captureStart, captureEnd, true);
      writeFoldedLines(state, skipSeparationSpace(state, false, nodeIndent));
      captureStart = captureEnd = state.position;
    } else if (state.position === state.lineStart && testDocumentSeparator(state)) {
      throwError(state, "unexpected end of the document within a double quoted scalar");
    } else {
      state.position++;
      captureEnd = state.position;
    }
  }
  throwError(state, "unexpected end of the stream within a double quoted scalar");
}
function readFlowCollection(state, nodeIndent) {
  var readNext = true, _line, _lineStart, _pos, _tag = state.tag, _result, _anchor = state.anchor, following, terminator, isPair, isExplicitPair, isMapping, overridableKeys = Object.create(null), keyNode, keyTag, valueNode, ch;
  ch = state.input.charCodeAt(state.position);
  if (ch === 91) {
    terminator = 93;
    isMapping = false;
    _result = [];
  } else if (ch === 123) {
    terminator = 125;
    isMapping = true;
    _result = {};
  } else {
    return false;
  }
  if (state.anchor !== null) {
    state.anchorMap[state.anchor] = _result;
  }
  ch = state.input.charCodeAt(++state.position);
  while (ch !== 0) {
    skipSeparationSpace(state, true, nodeIndent);
    ch = state.input.charCodeAt(state.position);
    if (ch === terminator) {
      state.position++;
      state.tag = _tag;
      state.anchor = _anchor;
      state.kind = isMapping ? "mapping" : "sequence";
      state.result = _result;
      return true;
    } else if (!readNext) {
      throwError(state, "missed comma between flow collection entries");
    } else if (ch === 44) {
      throwError(state, "expected the node content, but found ','");
    }
    keyTag = keyNode = valueNode = null;
    isPair = isExplicitPair = false;
    if (ch === 63) {
      following = state.input.charCodeAt(state.position + 1);
      if (is_WS_OR_EOL(following)) {
        isPair = isExplicitPair = true;
        state.position++;
        skipSeparationSpace(state, true, nodeIndent);
      }
    }
    _line = state.line;
    _lineStart = state.lineStart;
    _pos = state.position;
    composeNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
    keyTag = state.tag;
    keyNode = state.result;
    skipSeparationSpace(state, true, nodeIndent);
    ch = state.input.charCodeAt(state.position);
    if ((isExplicitPair || state.line === _line) && ch === 58) {
      isPair = true;
      ch = state.input.charCodeAt(++state.position);
      skipSeparationSpace(state, true, nodeIndent);
      composeNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
      valueNode = state.result;
    }
    if (isMapping) {
      storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, _line, _lineStart, _pos);
    } else if (isPair) {
      _result.push(storeMappingPair(state, null, overridableKeys, keyTag, keyNode, valueNode, _line, _lineStart, _pos));
    } else {
      _result.push(keyNode);
    }
    skipSeparationSpace(state, true, nodeIndent);
    ch = state.input.charCodeAt(state.position);
    if (ch === 44) {
      readNext = true;
      ch = state.input.charCodeAt(++state.position);
    } else {
      readNext = false;
    }
  }
  throwError(state, "unexpected end of the stream within a flow collection");
}
function readBlockScalar(state, nodeIndent) {
  var captureStart, folding, chomping = CHOMPING_CLIP, didReadContent = false, detectedIndent = false, textIndent = nodeIndent, emptyLines = 0, atMoreIndented = false, tmp, ch;
  ch = state.input.charCodeAt(state.position);
  if (ch === 124) {
    folding = false;
  } else if (ch === 62) {
    folding = true;
  } else {
    return false;
  }
  state.kind = "scalar";
  state.result = "";
  while (ch !== 0) {
    ch = state.input.charCodeAt(++state.position);
    if (ch === 43 || ch === 45) {
      if (CHOMPING_CLIP === chomping) {
        chomping = ch === 43 ? CHOMPING_KEEP : CHOMPING_STRIP;
      } else {
        throwError(state, "repeat of a chomping mode identifier");
      }
    } else if ((tmp = fromDecimalCode(ch)) >= 0) {
      if (tmp === 0) {
        throwError(state, "bad explicit indentation width of a block scalar; it cannot be less than one");
      } else if (!detectedIndent) {
        textIndent = nodeIndent + tmp - 1;
        detectedIndent = true;
      } else {
        throwError(state, "repeat of an indentation width identifier");
      }
    } else {
      break;
    }
  }
  if (is_WHITE_SPACE(ch)) {
    do {
      ch = state.input.charCodeAt(++state.position);
    } while (is_WHITE_SPACE(ch));
    if (ch === 35) {
      do {
        ch = state.input.charCodeAt(++state.position);
      } while (!is_EOL(ch) && ch !== 0);
    }
  }
  while (ch !== 0) {
    readLineBreak(state);
    state.lineIndent = 0;
    ch = state.input.charCodeAt(state.position);
    while ((!detectedIndent || state.lineIndent < textIndent) && ch === 32) {
      state.lineIndent++;
      ch = state.input.charCodeAt(++state.position);
    }
    if (!detectedIndent && state.lineIndent > textIndent) {
      textIndent = state.lineIndent;
    }
    if (is_EOL(ch)) {
      emptyLines++;
      continue;
    }
    if (state.lineIndent < textIndent) {
      if (chomping === CHOMPING_KEEP) {
        state.result += common.repeat(`
`, didReadContent ? 1 + emptyLines : emptyLines);
      } else if (chomping === CHOMPING_CLIP) {
        if (didReadContent) {
          state.result += `
`;
        }
      }
      break;
    }
    if (folding) {
      if (is_WHITE_SPACE(ch)) {
        atMoreIndented = true;
        state.result += common.repeat(`
`, didReadContent ? 1 + emptyLines : emptyLines);
      } else if (atMoreIndented) {
        atMoreIndented = false;
        state.result += common.repeat(`
`, emptyLines + 1);
      } else if (emptyLines === 0) {
        if (didReadContent) {
          state.result += " ";
        }
      } else {
        state.result += common.repeat(`
`, emptyLines);
      }
    } else {
      state.result += common.repeat(`
`, didReadContent ? 1 + emptyLines : emptyLines);
    }
    didReadContent = true;
    detectedIndent = true;
    emptyLines = 0;
    captureStart = state.position;
    while (!is_EOL(ch) && ch !== 0) {
      ch = state.input.charCodeAt(++state.position);
    }
    captureSegment(state, captureStart, state.position, false);
  }
  return true;
}
function readBlockSequence(state, nodeIndent) {
  var _line, _tag = state.tag, _anchor = state.anchor, _result = [], following, detected = false, ch;
  if (state.firstTabInLine !== -1)
    return false;
  if (state.anchor !== null) {
    state.anchorMap[state.anchor] = _result;
  }
  ch = state.input.charCodeAt(state.position);
  while (ch !== 0) {
    if (state.firstTabInLine !== -1) {
      state.position = state.firstTabInLine;
      throwError(state, "tab characters must not be used in indentation");
    }
    if (ch !== 45) {
      break;
    }
    following = state.input.charCodeAt(state.position + 1);
    if (!is_WS_OR_EOL(following)) {
      break;
    }
    detected = true;
    state.position++;
    if (skipSeparationSpace(state, true, -1)) {
      if (state.lineIndent <= nodeIndent) {
        _result.push(null);
        ch = state.input.charCodeAt(state.position);
        continue;
      }
    }
    _line = state.line;
    composeNode(state, nodeIndent, CONTEXT_BLOCK_IN, false, true);
    _result.push(state.result);
    skipSeparationSpace(state, true, -1);
    ch = state.input.charCodeAt(state.position);
    if ((state.line === _line || state.lineIndent > nodeIndent) && ch !== 0) {
      throwError(state, "bad indentation of a sequence entry");
    } else if (state.lineIndent < nodeIndent) {
      break;
    }
  }
  if (detected) {
    state.tag = _tag;
    state.anchor = _anchor;
    state.kind = "sequence";
    state.result = _result;
    return true;
  }
  return false;
}
function readBlockMapping(state, nodeIndent, flowIndent) {
  var following, allowCompact, _line, _keyLine, _keyLineStart, _keyPos, _tag = state.tag, _anchor = state.anchor, _result = {}, overridableKeys = Object.create(null), keyTag = null, keyNode = null, valueNode = null, atExplicitKey = false, detected = false, ch;
  if (state.firstTabInLine !== -1)
    return false;
  if (state.anchor !== null) {
    state.anchorMap[state.anchor] = _result;
  }
  ch = state.input.charCodeAt(state.position);
  while (ch !== 0) {
    if (!atExplicitKey && state.firstTabInLine !== -1) {
      state.position = state.firstTabInLine;
      throwError(state, "tab characters must not be used in indentation");
    }
    following = state.input.charCodeAt(state.position + 1);
    _line = state.line;
    if ((ch === 63 || ch === 58) && is_WS_OR_EOL(following)) {
      if (ch === 63) {
        if (atExplicitKey) {
          storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
          keyTag = keyNode = valueNode = null;
        }
        detected = true;
        atExplicitKey = true;
        allowCompact = true;
      } else if (atExplicitKey) {
        atExplicitKey = false;
        allowCompact = true;
      } else {
        throwError(state, "incomplete explicit mapping pair; a key node is missed; or followed by a non-tabulated empty line");
      }
      state.position += 1;
      ch = following;
    } else {
      _keyLine = state.line;
      _keyLineStart = state.lineStart;
      _keyPos = state.position;
      if (!composeNode(state, flowIndent, CONTEXT_FLOW_OUT, false, true)) {
        break;
      }
      if (state.line === _line) {
        ch = state.input.charCodeAt(state.position);
        while (is_WHITE_SPACE(ch)) {
          ch = state.input.charCodeAt(++state.position);
        }
        if (ch === 58) {
          ch = state.input.charCodeAt(++state.position);
          if (!is_WS_OR_EOL(ch)) {
            throwError(state, "a whitespace character is expected after the key-value separator within a block mapping");
          }
          if (atExplicitKey) {
            storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
            keyTag = keyNode = valueNode = null;
          }
          detected = true;
          atExplicitKey = false;
          allowCompact = false;
          keyTag = state.tag;
          keyNode = state.result;
        } else if (detected) {
          throwError(state, "can not read an implicit mapping pair; a colon is missed");
        } else {
          state.tag = _tag;
          state.anchor = _anchor;
          return true;
        }
      } else if (detected) {
        throwError(state, "can not read a block mapping entry; a multiline key may not be an implicit key");
      } else {
        state.tag = _tag;
        state.anchor = _anchor;
        return true;
      }
    }
    if (state.line === _line || state.lineIndent > nodeIndent) {
      if (atExplicitKey) {
        _keyLine = state.line;
        _keyLineStart = state.lineStart;
        _keyPos = state.position;
      }
      if (composeNode(state, nodeIndent, CONTEXT_BLOCK_OUT, true, allowCompact)) {
        if (atExplicitKey) {
          keyNode = state.result;
        } else {
          valueNode = state.result;
        }
      }
      if (!atExplicitKey) {
        storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, _keyLine, _keyLineStart, _keyPos);
        keyTag = keyNode = valueNode = null;
      }
      skipSeparationSpace(state, true, -1);
      ch = state.input.charCodeAt(state.position);
    }
    if ((state.line === _line || state.lineIndent > nodeIndent) && ch !== 0) {
      throwError(state, "bad indentation of a mapping entry");
    } else if (state.lineIndent < nodeIndent) {
      break;
    }
  }
  if (atExplicitKey) {
    storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
  }
  if (detected) {
    state.tag = _tag;
    state.anchor = _anchor;
    state.kind = "mapping";
    state.result = _result;
  }
  return detected;
}
function readTagProperty(state) {
  var _position, isVerbatim = false, isNamed = false, tagHandle, tagName, ch;
  ch = state.input.charCodeAt(state.position);
  if (ch !== 33)
    return false;
  if (state.tag !== null) {
    throwError(state, "duplication of a tag property");
  }
  ch = state.input.charCodeAt(++state.position);
  if (ch === 60) {
    isVerbatim = true;
    ch = state.input.charCodeAt(++state.position);
  } else if (ch === 33) {
    isNamed = true;
    tagHandle = "!!";
    ch = state.input.charCodeAt(++state.position);
  } else {
    tagHandle = "!";
  }
  _position = state.position;
  if (isVerbatim) {
    do {
      ch = state.input.charCodeAt(++state.position);
    } while (ch !== 0 && ch !== 62);
    if (state.position < state.length) {
      tagName = state.input.slice(_position, state.position);
      ch = state.input.charCodeAt(++state.position);
    } else {
      throwError(state, "unexpected end of the stream within a verbatim tag");
    }
  } else {
    while (ch !== 0 && !is_WS_OR_EOL(ch)) {
      if (ch === 33) {
        if (!isNamed) {
          tagHandle = state.input.slice(_position - 1, state.position + 1);
          if (!PATTERN_TAG_HANDLE.test(tagHandle)) {
            throwError(state, "named tag handle cannot contain such characters");
          }
          isNamed = true;
          _position = state.position + 1;
        } else {
          throwError(state, "tag suffix cannot contain exclamation marks");
        }
      }
      ch = state.input.charCodeAt(++state.position);
    }
    tagName = state.input.slice(_position, state.position);
    if (PATTERN_FLOW_INDICATORS.test(tagName)) {
      throwError(state, "tag suffix cannot contain flow indicator characters");
    }
  }
  if (tagName && !PATTERN_TAG_URI.test(tagName)) {
    throwError(state, "tag name cannot contain such characters: " + tagName);
  }
  try {
    tagName = decodeURIComponent(tagName);
  } catch (err) {
    throwError(state, "tag name is malformed: " + tagName);
  }
  if (isVerbatim) {
    state.tag = tagName;
  } else if (_hasOwnProperty$1.call(state.tagMap, tagHandle)) {
    state.tag = state.tagMap[tagHandle] + tagName;
  } else if (tagHandle === "!") {
    state.tag = "!" + tagName;
  } else if (tagHandle === "!!") {
    state.tag = "tag:yaml.org,2002:" + tagName;
  } else {
    throwError(state, 'undeclared tag handle "' + tagHandle + '"');
  }
  return true;
}
function readAnchorProperty(state) {
  var _position, ch;
  ch = state.input.charCodeAt(state.position);
  if (ch !== 38)
    return false;
  if (state.anchor !== null) {
    throwError(state, "duplication of an anchor property");
  }
  ch = state.input.charCodeAt(++state.position);
  _position = state.position;
  while (ch !== 0 && !is_WS_OR_EOL(ch) && !is_FLOW_INDICATOR(ch)) {
    ch = state.input.charCodeAt(++state.position);
  }
  if (state.position === _position) {
    throwError(state, "name of an anchor node must contain at least one character");
  }
  state.anchor = state.input.slice(_position, state.position);
  return true;
}
function readAlias(state) {
  var _position, alias, ch;
  ch = state.input.charCodeAt(state.position);
  if (ch !== 42)
    return false;
  ch = state.input.charCodeAt(++state.position);
  _position = state.position;
  while (ch !== 0 && !is_WS_OR_EOL(ch) && !is_FLOW_INDICATOR(ch)) {
    ch = state.input.charCodeAt(++state.position);
  }
  if (state.position === _position) {
    throwError(state, "name of an alias node must contain at least one character");
  }
  alias = state.input.slice(_position, state.position);
  if (!_hasOwnProperty$1.call(state.anchorMap, alias)) {
    throwError(state, 'unidentified alias "' + alias + '"');
  }
  state.result = state.anchorMap[alias];
  skipSeparationSpace(state, true, -1);
  return true;
}
function composeNode(state, parentIndent, nodeContext, allowToSeek, allowCompact) {
  var allowBlockStyles, allowBlockScalars, allowBlockCollections, indentStatus = 1, atNewLine = false, hasContent = false, typeIndex, typeQuantity, typeList, type2, flowIndent, blockIndent;
  if (state.listener !== null) {
    state.listener("open", state);
  }
  state.tag = null;
  state.anchor = null;
  state.kind = null;
  state.result = null;
  allowBlockStyles = allowBlockScalars = allowBlockCollections = CONTEXT_BLOCK_OUT === nodeContext || CONTEXT_BLOCK_IN === nodeContext;
  if (allowToSeek) {
    if (skipSeparationSpace(state, true, -1)) {
      atNewLine = true;
      if (state.lineIndent > parentIndent) {
        indentStatus = 1;
      } else if (state.lineIndent === parentIndent) {
        indentStatus = 0;
      } else if (state.lineIndent < parentIndent) {
        indentStatus = -1;
      }
    }
  }
  if (indentStatus === 1) {
    while (readTagProperty(state) || readAnchorProperty(state)) {
      if (skipSeparationSpace(state, true, -1)) {
        atNewLine = true;
        allowBlockCollections = allowBlockStyles;
        if (state.lineIndent > parentIndent) {
          indentStatus = 1;
        } else if (state.lineIndent === parentIndent) {
          indentStatus = 0;
        } else if (state.lineIndent < parentIndent) {
          indentStatus = -1;
        }
      } else {
        allowBlockCollections = false;
      }
    }
  }
  if (allowBlockCollections) {
    allowBlockCollections = atNewLine || allowCompact;
  }
  if (indentStatus === 1 || CONTEXT_BLOCK_OUT === nodeContext) {
    if (CONTEXT_FLOW_IN === nodeContext || CONTEXT_FLOW_OUT === nodeContext) {
      flowIndent = parentIndent;
    } else {
      flowIndent = parentIndent + 1;
    }
    blockIndent = state.position - state.lineStart;
    if (indentStatus === 1) {
      if (allowBlockCollections && (readBlockSequence(state, blockIndent) || readBlockMapping(state, blockIndent, flowIndent)) || readFlowCollection(state, flowIndent)) {
        hasContent = true;
      } else {
        if (allowBlockScalars && readBlockScalar(state, flowIndent) || readSingleQuotedScalar(state, flowIndent) || readDoubleQuotedScalar(state, flowIndent)) {
          hasContent = true;
        } else if (readAlias(state)) {
          hasContent = true;
          if (state.tag !== null || state.anchor !== null) {
            throwError(state, "alias node should not have any properties");
          }
        } else if (readPlainScalar(state, flowIndent, CONTEXT_FLOW_IN === nodeContext)) {
          hasContent = true;
          if (state.tag === null) {
            state.tag = "?";
          }
        }
        if (state.anchor !== null) {
          state.anchorMap[state.anchor] = state.result;
        }
      }
    } else if (indentStatus === 0) {
      hasContent = allowBlockCollections && readBlockSequence(state, blockIndent);
    }
  }
  if (state.tag === null) {
    if (state.anchor !== null) {
      state.anchorMap[state.anchor] = state.result;
    }
  } else if (state.tag === "?") {
    if (state.result !== null && state.kind !== "scalar") {
      throwError(state, 'unacceptable node kind for !<?> tag; it should be "scalar", not "' + state.kind + '"');
    }
    for (typeIndex = 0, typeQuantity = state.implicitTypes.length;typeIndex < typeQuantity; typeIndex += 1) {
      type2 = state.implicitTypes[typeIndex];
      if (type2.resolve(state.result)) {
        state.result = type2.construct(state.result);
        state.tag = type2.tag;
        if (state.anchor !== null) {
          state.anchorMap[state.anchor] = state.result;
        }
        break;
      }
    }
  } else if (state.tag !== "!") {
    if (_hasOwnProperty$1.call(state.typeMap[state.kind || "fallback"], state.tag)) {
      type2 = state.typeMap[state.kind || "fallback"][state.tag];
    } else {
      type2 = null;
      typeList = state.typeMap.multi[state.kind || "fallback"];
      for (typeIndex = 0, typeQuantity = typeList.length;typeIndex < typeQuantity; typeIndex += 1) {
        if (state.tag.slice(0, typeList[typeIndex].tag.length) === typeList[typeIndex].tag) {
          type2 = typeList[typeIndex];
          break;
        }
      }
    }
    if (!type2) {
      throwError(state, "unknown tag !<" + state.tag + ">");
    }
    if (state.result !== null && type2.kind !== state.kind) {
      throwError(state, "unacceptable node kind for !<" + state.tag + '> tag; it should be "' + type2.kind + '", not "' + state.kind + '"');
    }
    if (!type2.resolve(state.result, state.tag)) {
      throwError(state, "cannot resolve a node with !<" + state.tag + "> explicit tag");
    } else {
      state.result = type2.construct(state.result, state.tag);
      if (state.anchor !== null) {
        state.anchorMap[state.anchor] = state.result;
      }
    }
  }
  if (state.listener !== null) {
    state.listener("close", state);
  }
  return state.tag !== null || state.anchor !== null || hasContent;
}
function readDocument(state) {
  var documentStart = state.position, _position, directiveName, directiveArgs, hasDirectives = false, ch;
  state.version = null;
  state.checkLineBreaks = state.legacy;
  state.tagMap = Object.create(null);
  state.anchorMap = Object.create(null);
  while ((ch = state.input.charCodeAt(state.position)) !== 0) {
    skipSeparationSpace(state, true, -1);
    ch = state.input.charCodeAt(state.position);
    if (state.lineIndent > 0 || ch !== 37) {
      break;
    }
    hasDirectives = true;
    ch = state.input.charCodeAt(++state.position);
    _position = state.position;
    while (ch !== 0 && !is_WS_OR_EOL(ch)) {
      ch = state.input.charCodeAt(++state.position);
    }
    directiveName = state.input.slice(_position, state.position);
    directiveArgs = [];
    if (directiveName.length < 1) {
      throwError(state, "directive name must not be less than one character in length");
    }
    while (ch !== 0) {
      while (is_WHITE_SPACE(ch)) {
        ch = state.input.charCodeAt(++state.position);
      }
      if (ch === 35) {
        do {
          ch = state.input.charCodeAt(++state.position);
        } while (ch !== 0 && !is_EOL(ch));
        break;
      }
      if (is_EOL(ch))
        break;
      _position = state.position;
      while (ch !== 0 && !is_WS_OR_EOL(ch)) {
        ch = state.input.charCodeAt(++state.position);
      }
      directiveArgs.push(state.input.slice(_position, state.position));
    }
    if (ch !== 0)
      readLineBreak(state);
    if (_hasOwnProperty$1.call(directiveHandlers, directiveName)) {
      directiveHandlers[directiveName](state, directiveName, directiveArgs);
    } else {
      throwWarning(state, 'unknown document directive "' + directiveName + '"');
    }
  }
  skipSeparationSpace(state, true, -1);
  if (state.lineIndent === 0 && state.input.charCodeAt(state.position) === 45 && state.input.charCodeAt(state.position + 1) === 45 && state.input.charCodeAt(state.position + 2) === 45) {
    state.position += 3;
    skipSeparationSpace(state, true, -1);
  } else if (hasDirectives) {
    throwError(state, "directives end mark is expected");
  }
  composeNode(state, state.lineIndent - 1, CONTEXT_BLOCK_OUT, false, true);
  skipSeparationSpace(state, true, -1);
  if (state.checkLineBreaks && PATTERN_NON_ASCII_LINE_BREAKS.test(state.input.slice(documentStart, state.position))) {
    throwWarning(state, "non-ASCII line breaks are interpreted as content");
  }
  state.documents.push(state.result);
  if (state.position === state.lineStart && testDocumentSeparator(state)) {
    if (state.input.charCodeAt(state.position) === 46) {
      state.position += 3;
      skipSeparationSpace(state, true, -1);
    }
    return;
  }
  if (state.position < state.length - 1) {
    throwError(state, "end of the stream or a document separator is expected");
  } else {
    return;
  }
}
function loadDocuments(input, options) {
  input = String(input);
  options = options || {};
  if (input.length !== 0) {
    if (input.charCodeAt(input.length - 1) !== 10 && input.charCodeAt(input.length - 1) !== 13) {
      input += `
`;
    }
    if (input.charCodeAt(0) === 65279) {
      input = input.slice(1);
    }
  }
  var state = new State$1(input, options);
  var nullpos = input.indexOf("\x00");
  if (nullpos !== -1) {
    state.position = nullpos;
    throwError(state, "null byte is not allowed in input");
  }
  state.input += "\x00";
  while (state.input.charCodeAt(state.position) === 32) {
    state.lineIndent += 1;
    state.position += 1;
  }
  while (state.position < state.length - 1) {
    readDocument(state);
  }
  return state.documents;
}
function loadAll$1(input, iterator, options) {
  if (iterator !== null && typeof iterator === "object" && typeof options === "undefined") {
    options = iterator;
    iterator = null;
  }
  var documents = loadDocuments(input, options);
  if (typeof iterator !== "function") {
    return documents;
  }
  for (var index = 0, length = documents.length;index < length; index += 1) {
    iterator(documents[index]);
  }
}
function load$1(input, options) {
  var documents = loadDocuments(input, options);
  if (documents.length === 0) {
    return;
  } else if (documents.length === 1) {
    return documents[0];
  }
  throw new exception("expected a single document in the stream, but found more");
}
function compileStyleMap(schema2, map2) {
  var result, keys, index, length, tag, style, type2;
  if (map2 === null)
    return {};
  result = {};
  keys = Object.keys(map2);
  for (index = 0, length = keys.length;index < length; index += 1) {
    tag = keys[index];
    style = String(map2[tag]);
    if (tag.slice(0, 2) === "!!") {
      tag = "tag:yaml.org,2002:" + tag.slice(2);
    }
    type2 = schema2.compiledTypeMap["fallback"][tag];
    if (type2 && _hasOwnProperty.call(type2.styleAliases, style)) {
      style = type2.styleAliases[style];
    }
    result[tag] = style;
  }
  return result;
}
function encodeHex(character) {
  var string, handle, length;
  string = character.toString(16).toUpperCase();
  if (character <= 255) {
    handle = "x";
    length = 2;
  } else if (character <= 65535) {
    handle = "u";
    length = 4;
  } else if (character <= 4294967295) {
    handle = "U";
    length = 8;
  } else {
    throw new exception("code point within a string may not be greater than 0xFFFFFFFF");
  }
  return "\\" + handle + common.repeat("0", length - string.length) + string;
}
function State(options) {
  this.schema = options["schema"] || _default;
  this.indent = Math.max(1, options["indent"] || 2);
  this.noArrayIndent = options["noArrayIndent"] || false;
  this.skipInvalid = options["skipInvalid"] || false;
  this.flowLevel = common.isNothing(options["flowLevel"]) ? -1 : options["flowLevel"];
  this.styleMap = compileStyleMap(this.schema, options["styles"] || null);
  this.sortKeys = options["sortKeys"] || false;
  this.lineWidth = options["lineWidth"] || 80;
  this.noRefs = options["noRefs"] || false;
  this.noCompatMode = options["noCompatMode"] || false;
  this.condenseFlow = options["condenseFlow"] || false;
  this.quotingType = options["quotingType"] === '"' ? QUOTING_TYPE_DOUBLE : QUOTING_TYPE_SINGLE;
  this.forceQuotes = options["forceQuotes"] || false;
  this.replacer = typeof options["replacer"] === "function" ? options["replacer"] : null;
  this.implicitTypes = this.schema.compiledImplicit;
  this.explicitTypes = this.schema.compiledExplicit;
  this.tag = null;
  this.result = "";
  this.duplicates = [];
  this.usedDuplicates = null;
}
function indentString(string, spaces) {
  var ind = common.repeat(" ", spaces), position = 0, next = -1, result = "", line, length = string.length;
  while (position < length) {
    next = string.indexOf(`
`, position);
    if (next === -1) {
      line = string.slice(position);
      position = length;
    } else {
      line = string.slice(position, next + 1);
      position = next + 1;
    }
    if (line.length && line !== `
`)
      result += ind;
    result += line;
  }
  return result;
}
function generateNextLine(state, level) {
  return `
` + common.repeat(" ", state.indent * level);
}
function testImplicitResolving(state, str2) {
  var index, length, type2;
  for (index = 0, length = state.implicitTypes.length;index < length; index += 1) {
    type2 = state.implicitTypes[index];
    if (type2.resolve(str2)) {
      return true;
    }
  }
  return false;
}
function isWhitespace(c) {
  return c === CHAR_SPACE || c === CHAR_TAB;
}
function isPrintable(c) {
  return 32 <= c && c <= 126 || 161 <= c && c <= 55295 && c !== 8232 && c !== 8233 || 57344 <= c && c <= 65533 && c !== CHAR_BOM || 65536 <= c && c <= 1114111;
}
function isNsCharOrWhitespace(c) {
  return isPrintable(c) && c !== CHAR_BOM && c !== CHAR_CARRIAGE_RETURN && c !== CHAR_LINE_FEED;
}
function isPlainSafe(c, prev, inblock) {
  var cIsNsCharOrWhitespace = isNsCharOrWhitespace(c);
  var cIsNsChar = cIsNsCharOrWhitespace && !isWhitespace(c);
  return (inblock ? cIsNsCharOrWhitespace : cIsNsCharOrWhitespace && c !== CHAR_COMMA && c !== CHAR_LEFT_SQUARE_BRACKET && c !== CHAR_RIGHT_SQUARE_BRACKET && c !== CHAR_LEFT_CURLY_BRACKET && c !== CHAR_RIGHT_CURLY_BRACKET) && c !== CHAR_SHARP && !(prev === CHAR_COLON && !cIsNsChar) || isNsCharOrWhitespace(prev) && !isWhitespace(prev) && c === CHAR_SHARP || prev === CHAR_COLON && cIsNsChar;
}
function isPlainSafeFirst(c) {
  return isPrintable(c) && c !== CHAR_BOM && !isWhitespace(c) && c !== CHAR_MINUS && c !== CHAR_QUESTION && c !== CHAR_COLON && c !== CHAR_COMMA && c !== CHAR_LEFT_SQUARE_BRACKET && c !== CHAR_RIGHT_SQUARE_BRACKET && c !== CHAR_LEFT_CURLY_BRACKET && c !== CHAR_RIGHT_CURLY_BRACKET && c !== CHAR_SHARP && c !== CHAR_AMPERSAND && c !== CHAR_ASTERISK && c !== CHAR_EXCLAMATION && c !== CHAR_VERTICAL_LINE && c !== CHAR_EQUALS && c !== CHAR_GREATER_THAN && c !== CHAR_SINGLE_QUOTE && c !== CHAR_DOUBLE_QUOTE && c !== CHAR_PERCENT && c !== CHAR_COMMERCIAL_AT && c !== CHAR_GRAVE_ACCENT;
}
function isPlainSafeLast(c) {
  return !isWhitespace(c) && c !== CHAR_COLON;
}
function codePointAt(string, pos) {
  var first = string.charCodeAt(pos), second;
  if (first >= 55296 && first <= 56319 && pos + 1 < string.length) {
    second = string.charCodeAt(pos + 1);
    if (second >= 56320 && second <= 57343) {
      return (first - 55296) * 1024 + second - 56320 + 65536;
    }
  }
  return first;
}
function needIndentIndicator(string) {
  var leadingSpaceRe = /^\n* /;
  return leadingSpaceRe.test(string);
}
function chooseScalarStyle(string, singleLineOnly, indentPerLevel, lineWidth, testAmbiguousType, quotingType, forceQuotes, inblock) {
  var i2;
  var char = 0;
  var prevChar = null;
  var hasLineBreak = false;
  var hasFoldableLine = false;
  var shouldTrackWidth = lineWidth !== -1;
  var previousLineBreak = -1;
  var plain = isPlainSafeFirst(codePointAt(string, 0)) && isPlainSafeLast(codePointAt(string, string.length - 1));
  if (singleLineOnly || forceQuotes) {
    for (i2 = 0;i2 < string.length; char >= 65536 ? i2 += 2 : i2++) {
      char = codePointAt(string, i2);
      if (!isPrintable(char)) {
        return STYLE_DOUBLE;
      }
      plain = plain && isPlainSafe(char, prevChar, inblock);
      prevChar = char;
    }
  } else {
    for (i2 = 0;i2 < string.length; char >= 65536 ? i2 += 2 : i2++) {
      char = codePointAt(string, i2);
      if (char === CHAR_LINE_FEED) {
        hasLineBreak = true;
        if (shouldTrackWidth) {
          hasFoldableLine = hasFoldableLine || i2 - previousLineBreak - 1 > lineWidth && string[previousLineBreak + 1] !== " ";
          previousLineBreak = i2;
        }
      } else if (!isPrintable(char)) {
        return STYLE_DOUBLE;
      }
      plain = plain && isPlainSafe(char, prevChar, inblock);
      prevChar = char;
    }
    hasFoldableLine = hasFoldableLine || shouldTrackWidth && (i2 - previousLineBreak - 1 > lineWidth && string[previousLineBreak + 1] !== " ");
  }
  if (!hasLineBreak && !hasFoldableLine) {
    if (plain && !forceQuotes && !testAmbiguousType(string)) {
      return STYLE_PLAIN;
    }
    return quotingType === QUOTING_TYPE_DOUBLE ? STYLE_DOUBLE : STYLE_SINGLE;
  }
  if (indentPerLevel > 9 && needIndentIndicator(string)) {
    return STYLE_DOUBLE;
  }
  if (!forceQuotes) {
    return hasFoldableLine ? STYLE_FOLDED : STYLE_LITERAL;
  }
  return quotingType === QUOTING_TYPE_DOUBLE ? STYLE_DOUBLE : STYLE_SINGLE;
}
function writeScalar(state, string, level, iskey, inblock) {
  state.dump = function() {
    if (string.length === 0) {
      return state.quotingType === QUOTING_TYPE_DOUBLE ? '""' : "''";
    }
    if (!state.noCompatMode) {
      if (DEPRECATED_BOOLEANS_SYNTAX.indexOf(string) !== -1 || DEPRECATED_BASE60_SYNTAX.test(string)) {
        return state.quotingType === QUOTING_TYPE_DOUBLE ? '"' + string + '"' : "'" + string + "'";
      }
    }
    var indent = state.indent * Math.max(1, level);
    var lineWidth = state.lineWidth === -1 ? -1 : Math.max(Math.min(state.lineWidth, 40), state.lineWidth - indent);
    var singleLineOnly = iskey || state.flowLevel > -1 && level >= state.flowLevel;
    function testAmbiguity(string2) {
      return testImplicitResolving(state, string2);
    }
    switch (chooseScalarStyle(string, singleLineOnly, state.indent, lineWidth, testAmbiguity, state.quotingType, state.forceQuotes && !iskey, inblock)) {
      case STYLE_PLAIN:
        return string;
      case STYLE_SINGLE:
        return "'" + string.replace(/'/g, "''") + "'";
      case STYLE_LITERAL:
        return "|" + blockHeader(string, state.indent) + dropEndingNewline(indentString(string, indent));
      case STYLE_FOLDED:
        return ">" + blockHeader(string, state.indent) + dropEndingNewline(indentString(foldString(string, lineWidth), indent));
      case STYLE_DOUBLE:
        return '"' + escapeString(string) + '"';
      default:
        throw new exception("impossible error: invalid scalar style");
    }
  }();
}
function blockHeader(string, indentPerLevel) {
  var indentIndicator = needIndentIndicator(string) ? String(indentPerLevel) : "";
  var clip = string[string.length - 1] === `
`;
  var keep = clip && (string[string.length - 2] === `
` || string === `
`);
  var chomp = keep ? "+" : clip ? "" : "-";
  return indentIndicator + chomp + `
`;
}
function dropEndingNewline(string) {
  return string[string.length - 1] === `
` ? string.slice(0, -1) : string;
}
function foldString(string, width) {
  var lineRe = /(\n+)([^\n]*)/g;
  var result = function() {
    var nextLF = string.indexOf(`
`);
    nextLF = nextLF !== -1 ? nextLF : string.length;
    lineRe.lastIndex = nextLF;
    return foldLine(string.slice(0, nextLF), width);
  }();
  var prevMoreIndented = string[0] === `
` || string[0] === " ";
  var moreIndented;
  var match;
  while (match = lineRe.exec(string)) {
    var prefix = match[1], line = match[2];
    moreIndented = line[0] === " ";
    result += prefix + (!prevMoreIndented && !moreIndented && line !== "" ? `
` : "") + foldLine(line, width);
    prevMoreIndented = moreIndented;
  }
  return result;
}
function foldLine(line, width) {
  if (line === "" || line[0] === " ")
    return line;
  var breakRe = / [^ ]/g;
  var match;
  var start = 0, end, curr = 0, next = 0;
  var result = "";
  while (match = breakRe.exec(line)) {
    next = match.index;
    if (next - start > width) {
      end = curr > start ? curr : next;
      result += `
` + line.slice(start, end);
      start = end + 1;
    }
    curr = next;
  }
  result += `
`;
  if (line.length - start > width && curr > start) {
    result += line.slice(start, curr) + `
` + line.slice(curr + 1);
  } else {
    result += line.slice(start);
  }
  return result.slice(1);
}
function escapeString(string) {
  var result = "";
  var char = 0;
  var escapeSeq;
  for (var i2 = 0;i2 < string.length; char >= 65536 ? i2 += 2 : i2++) {
    char = codePointAt(string, i2);
    escapeSeq = ESCAPE_SEQUENCES[char];
    if (!escapeSeq && isPrintable(char)) {
      result += string[i2];
      if (char >= 65536)
        result += string[i2 + 1];
    } else {
      result += escapeSeq || encodeHex(char);
    }
  }
  return result;
}
function writeFlowSequence(state, level, object) {
  var _result = "", _tag = state.tag, index, length, value;
  for (index = 0, length = object.length;index < length; index += 1) {
    value = object[index];
    if (state.replacer) {
      value = state.replacer.call(object, String(index), value);
    }
    if (writeNode(state, level, value, false, false) || typeof value === "undefined" && writeNode(state, level, null, false, false)) {
      if (_result !== "")
        _result += "," + (!state.condenseFlow ? " " : "");
      _result += state.dump;
    }
  }
  state.tag = _tag;
  state.dump = "[" + _result + "]";
}
function writeBlockSequence(state, level, object, compact) {
  var _result = "", _tag = state.tag, index, length, value;
  for (index = 0, length = object.length;index < length; index += 1) {
    value = object[index];
    if (state.replacer) {
      value = state.replacer.call(object, String(index), value);
    }
    if (writeNode(state, level + 1, value, true, true, false, true) || typeof value === "undefined" && writeNode(state, level + 1, null, true, true, false, true)) {
      if (!compact || _result !== "") {
        _result += generateNextLine(state, level);
      }
      if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
        _result += "-";
      } else {
        _result += "- ";
      }
      _result += state.dump;
    }
  }
  state.tag = _tag;
  state.dump = _result || "[]";
}
function writeFlowMapping(state, level, object) {
  var _result = "", _tag = state.tag, objectKeyList = Object.keys(object), index, length, objectKey, objectValue, pairBuffer;
  for (index = 0, length = objectKeyList.length;index < length; index += 1) {
    pairBuffer = "";
    if (_result !== "")
      pairBuffer += ", ";
    if (state.condenseFlow)
      pairBuffer += '"';
    objectKey = objectKeyList[index];
    objectValue = object[objectKey];
    if (state.replacer) {
      objectValue = state.replacer.call(object, objectKey, objectValue);
    }
    if (!writeNode(state, level, objectKey, false, false)) {
      continue;
    }
    if (state.dump.length > 1024)
      pairBuffer += "? ";
    pairBuffer += state.dump + (state.condenseFlow ? '"' : "") + ":" + (state.condenseFlow ? "" : " ");
    if (!writeNode(state, level, objectValue, false, false)) {
      continue;
    }
    pairBuffer += state.dump;
    _result += pairBuffer;
  }
  state.tag = _tag;
  state.dump = "{" + _result + "}";
}
function writeBlockMapping(state, level, object, compact) {
  var _result = "", _tag = state.tag, objectKeyList = Object.keys(object), index, length, objectKey, objectValue, explicitPair, pairBuffer;
  if (state.sortKeys === true) {
    objectKeyList.sort();
  } else if (typeof state.sortKeys === "function") {
    objectKeyList.sort(state.sortKeys);
  } else if (state.sortKeys) {
    throw new exception("sortKeys must be a boolean or a function");
  }
  for (index = 0, length = objectKeyList.length;index < length; index += 1) {
    pairBuffer = "";
    if (!compact || _result !== "") {
      pairBuffer += generateNextLine(state, level);
    }
    objectKey = objectKeyList[index];
    objectValue = object[objectKey];
    if (state.replacer) {
      objectValue = state.replacer.call(object, objectKey, objectValue);
    }
    if (!writeNode(state, level + 1, objectKey, true, true, true)) {
      continue;
    }
    explicitPair = state.tag !== null && state.tag !== "?" || state.dump && state.dump.length > 1024;
    if (explicitPair) {
      if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
        pairBuffer += "?";
      } else {
        pairBuffer += "? ";
      }
    }
    pairBuffer += state.dump;
    if (explicitPair) {
      pairBuffer += generateNextLine(state, level);
    }
    if (!writeNode(state, level + 1, objectValue, true, explicitPair)) {
      continue;
    }
    if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
      pairBuffer += ":";
    } else {
      pairBuffer += ": ";
    }
    pairBuffer += state.dump;
    _result += pairBuffer;
  }
  state.tag = _tag;
  state.dump = _result || "{}";
}
function detectType(state, object, explicit) {
  var _result, typeList, index, length, type2, style;
  typeList = explicit ? state.explicitTypes : state.implicitTypes;
  for (index = 0, length = typeList.length;index < length; index += 1) {
    type2 = typeList[index];
    if ((type2.instanceOf || type2.predicate) && (!type2.instanceOf || typeof object === "object" && object instanceof type2.instanceOf) && (!type2.predicate || type2.predicate(object))) {
      if (explicit) {
        if (type2.multi && type2.representName) {
          state.tag = type2.representName(object);
        } else {
          state.tag = type2.tag;
        }
      } else {
        state.tag = "?";
      }
      if (type2.represent) {
        style = state.styleMap[type2.tag] || type2.defaultStyle;
        if (_toString.call(type2.represent) === "[object Function]") {
          _result = type2.represent(object, style);
        } else if (_hasOwnProperty.call(type2.represent, style)) {
          _result = type2.represent[style](object, style);
        } else {
          throw new exception("!<" + type2.tag + '> tag resolver accepts not "' + style + '" style');
        }
        state.dump = _result;
      }
      return true;
    }
  }
  return false;
}
function writeNode(state, level, object, block, compact, iskey, isblockseq) {
  state.tag = null;
  state.dump = object;
  if (!detectType(state, object, false)) {
    detectType(state, object, true);
  }
  var type2 = _toString.call(state.dump);
  var inblock = block;
  var tagStr;
  if (block) {
    block = state.flowLevel < 0 || state.flowLevel > level;
  }
  var objectOrArray = type2 === "[object Object]" || type2 === "[object Array]", duplicateIndex, duplicate;
  if (objectOrArray) {
    duplicateIndex = state.duplicates.indexOf(object);
    duplicate = duplicateIndex !== -1;
  }
  if (state.tag !== null && state.tag !== "?" || duplicate || state.indent !== 2 && level > 0) {
    compact = false;
  }
  if (duplicate && state.usedDuplicates[duplicateIndex]) {
    state.dump = "*ref_" + duplicateIndex;
  } else {
    if (objectOrArray && duplicate && !state.usedDuplicates[duplicateIndex]) {
      state.usedDuplicates[duplicateIndex] = true;
    }
    if (type2 === "[object Object]") {
      if (block && Object.keys(state.dump).length !== 0) {
        writeBlockMapping(state, level, state.dump, compact);
        if (duplicate) {
          state.dump = "&ref_" + duplicateIndex + state.dump;
        }
      } else {
        writeFlowMapping(state, level, state.dump);
        if (duplicate) {
          state.dump = "&ref_" + duplicateIndex + " " + state.dump;
        }
      }
    } else if (type2 === "[object Array]") {
      if (block && state.dump.length !== 0) {
        if (state.noArrayIndent && !isblockseq && level > 0) {
          writeBlockSequence(state, level - 1, state.dump, compact);
        } else {
          writeBlockSequence(state, level, state.dump, compact);
        }
        if (duplicate) {
          state.dump = "&ref_" + duplicateIndex + state.dump;
        }
      } else {
        writeFlowSequence(state, level, state.dump);
        if (duplicate) {
          state.dump = "&ref_" + duplicateIndex + " " + state.dump;
        }
      }
    } else if (type2 === "[object String]") {
      if (state.tag !== "?") {
        writeScalar(state, state.dump, level, iskey, inblock);
      }
    } else if (type2 === "[object Undefined]") {
      return false;
    } else {
      if (state.skipInvalid)
        return false;
      throw new exception("unacceptable kind of an object to dump " + type2);
    }
    if (state.tag !== null && state.tag !== "?") {
      tagStr = encodeURI(state.tag[0] === "!" ? state.tag.slice(1) : state.tag).replace(/!/g, "%21");
      if (state.tag[0] === "!") {
        tagStr = "!" + tagStr;
      } else if (tagStr.slice(0, 18) === "tag:yaml.org,2002:") {
        tagStr = "!!" + tagStr.slice(18);
      } else {
        tagStr = "!<" + tagStr + ">";
      }
      state.dump = tagStr + " " + state.dump;
    }
  }
  return true;
}
function getDuplicateReferences(object, state) {
  var objects = [], duplicatesIndexes = [], index, length;
  inspectNode(object, objects, duplicatesIndexes);
  for (index = 0, length = duplicatesIndexes.length;index < length; index += 1) {
    state.duplicates.push(objects[duplicatesIndexes[index]]);
  }
  state.usedDuplicates = new Array(length);
}
function inspectNode(object, objects, duplicatesIndexes) {
  var objectKeyList, index, length;
  if (object !== null && typeof object === "object") {
    index = objects.indexOf(object);
    if (index !== -1) {
      if (duplicatesIndexes.indexOf(index) === -1) {
        duplicatesIndexes.push(index);
      }
    } else {
      objects.push(object);
      if (Array.isArray(object)) {
        for (index = 0, length = object.length;index < length; index += 1) {
          inspectNode(object[index], objects, duplicatesIndexes);
        }
      } else {
        objectKeyList = Object.keys(object);
        for (index = 0, length = objectKeyList.length;index < length; index += 1) {
          inspectNode(object[objectKeyList[index]], objects, duplicatesIndexes);
        }
      }
    }
  }
}
function dump$1(input, options) {
  options = options || {};
  var state = new State(options);
  if (!state.noRefs)
    getDuplicateReferences(input, state);
  var value = input;
  if (state.replacer) {
    value = state.replacer.call({ "": value }, "", value);
  }
  if (writeNode(state, 0, value, true, true))
    return state.dump + `
`;
  return "";
}
function renamed(from, to) {
  return function() {
    throw new Error("Function yaml." + from + " is removed in js-yaml 4. " + "Use yaml." + to + " instead, which is now safe by default.");
  };
}
var isNothing_1, isObject_1, toArray_1, repeat_1, isNegativeZero_1, extend_1, common, exception, snippet, TYPE_CONSTRUCTOR_OPTIONS, YAML_NODE_KINDS, type, schema, str, seq, map, failsafe, _null, bool, int, YAML_FLOAT_PATTERN, SCIENTIFIC_WITHOUT_DOT, float, json, core, YAML_DATE_REGEXP, YAML_TIMESTAMP_REGEXP, timestamp, merge, BASE64_MAP = `ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=
\r`, binary, _hasOwnProperty$3, _toString$2, omap, _toString$1, pairs, _hasOwnProperty$2, set, _default, _hasOwnProperty$1, CONTEXT_FLOW_IN = 1, CONTEXT_FLOW_OUT = 2, CONTEXT_BLOCK_IN = 3, CONTEXT_BLOCK_OUT = 4, CHOMPING_CLIP = 1, CHOMPING_STRIP = 2, CHOMPING_KEEP = 3, PATTERN_NON_PRINTABLE, PATTERN_NON_ASCII_LINE_BREAKS, PATTERN_FLOW_INDICATORS, PATTERN_TAG_HANDLE, PATTERN_TAG_URI, simpleEscapeCheck, simpleEscapeMap, i, directiveHandlers, loadAll_1, load_1, loader, _toString, _hasOwnProperty, CHAR_BOM = 65279, CHAR_TAB = 9, CHAR_LINE_FEED = 10, CHAR_CARRIAGE_RETURN = 13, CHAR_SPACE = 32, CHAR_EXCLAMATION = 33, CHAR_DOUBLE_QUOTE = 34, CHAR_SHARP = 35, CHAR_PERCENT = 37, CHAR_AMPERSAND = 38, CHAR_SINGLE_QUOTE = 39, CHAR_ASTERISK = 42, CHAR_COMMA = 44, CHAR_MINUS = 45, CHAR_COLON = 58, CHAR_EQUALS = 61, CHAR_GREATER_THAN = 62, CHAR_QUESTION = 63, CHAR_COMMERCIAL_AT = 64, CHAR_LEFT_SQUARE_BRACKET = 91, CHAR_RIGHT_SQUARE_BRACKET = 93, CHAR_GRAVE_ACCENT = 96, CHAR_LEFT_CURLY_BRACKET = 123, CHAR_VERTICAL_LINE = 124, CHAR_RIGHT_CURLY_BRACKET = 125, ESCAPE_SEQUENCES, DEPRECATED_BOOLEANS_SYNTAX, DEPRECATED_BASE60_SYNTAX, QUOTING_TYPE_SINGLE = 1, QUOTING_TYPE_DOUBLE = 2, STYLE_PLAIN = 1, STYLE_SINGLE = 2, STYLE_LITERAL = 3, STYLE_FOLDED = 4, STYLE_DOUBLE = 5, dump_1, dumper, Type, Schema, FAILSAFE_SCHEMA, JSON_SCHEMA, CORE_SCHEMA, DEFAULT_SCHEMA, load, loadAll, dump, YAMLException, types, safeLoad, safeLoadAll, safeDump, jsYaml;
var init_js_yaml = __esm(() => {
  /*! js-yaml 4.1.1 https://github.com/nodeca/js-yaml @license MIT */
  isNothing_1 = isNothing;
  isObject_1 = isObject;
  toArray_1 = toArray;
  repeat_1 = repeat;
  isNegativeZero_1 = isNegativeZero;
  extend_1 = extend;
  common = {
    isNothing: isNothing_1,
    isObject: isObject_1,
    toArray: toArray_1,
    repeat: repeat_1,
    isNegativeZero: isNegativeZero_1,
    extend: extend_1
  };
  YAMLException$1.prototype = Object.create(Error.prototype);
  YAMLException$1.prototype.constructor = YAMLException$1;
  YAMLException$1.prototype.toString = function toString(compact) {
    return this.name + ": " + formatError(this, compact);
  };
  exception = YAMLException$1;
  snippet = makeSnippet;
  TYPE_CONSTRUCTOR_OPTIONS = [
    "kind",
    "multi",
    "resolve",
    "construct",
    "instanceOf",
    "predicate",
    "represent",
    "representName",
    "defaultStyle",
    "styleAliases"
  ];
  YAML_NODE_KINDS = [
    "scalar",
    "sequence",
    "mapping"
  ];
  type = Type$1;
  Schema$1.prototype.extend = function extend2(definition) {
    var implicit = [];
    var explicit = [];
    if (definition instanceof type) {
      explicit.push(definition);
    } else if (Array.isArray(definition)) {
      explicit = explicit.concat(definition);
    } else if (definition && (Array.isArray(definition.implicit) || Array.isArray(definition.explicit))) {
      if (definition.implicit)
        implicit = implicit.concat(definition.implicit);
      if (definition.explicit)
        explicit = explicit.concat(definition.explicit);
    } else {
      throw new exception("Schema.extend argument should be a Type, [ Type ], " + "or a schema definition ({ implicit: [...], explicit: [...] })");
    }
    implicit.forEach(function(type$1) {
      if (!(type$1 instanceof type)) {
        throw new exception("Specified list of YAML types (or a single Type object) contains a non-Type object.");
      }
      if (type$1.loadKind && type$1.loadKind !== "scalar") {
        throw new exception("There is a non-scalar type in the implicit list of a schema. Implicit resolving of such types is not supported.");
      }
      if (type$1.multi) {
        throw new exception("There is a multi type in the implicit list of a schema. Multi tags can only be listed as explicit.");
      }
    });
    explicit.forEach(function(type$1) {
      if (!(type$1 instanceof type)) {
        throw new exception("Specified list of YAML types (or a single Type object) contains a non-Type object.");
      }
    });
    var result = Object.create(Schema$1.prototype);
    result.implicit = (this.implicit || []).concat(implicit);
    result.explicit = (this.explicit || []).concat(explicit);
    result.compiledImplicit = compileList(result, "implicit");
    result.compiledExplicit = compileList(result, "explicit");
    result.compiledTypeMap = compileMap(result.compiledImplicit, result.compiledExplicit);
    return result;
  };
  schema = Schema$1;
  str = new type("tag:yaml.org,2002:str", {
    kind: "scalar",
    construct: function(data) {
      return data !== null ? data : "";
    }
  });
  seq = new type("tag:yaml.org,2002:seq", {
    kind: "sequence",
    construct: function(data) {
      return data !== null ? data : [];
    }
  });
  map = new type("tag:yaml.org,2002:map", {
    kind: "mapping",
    construct: function(data) {
      return data !== null ? data : {};
    }
  });
  failsafe = new schema({
    explicit: [
      str,
      seq,
      map
    ]
  });
  _null = new type("tag:yaml.org,2002:null", {
    kind: "scalar",
    resolve: resolveYamlNull,
    construct: constructYamlNull,
    predicate: isNull,
    represent: {
      canonical: function() {
        return "~";
      },
      lowercase: function() {
        return "null";
      },
      uppercase: function() {
        return "NULL";
      },
      camelcase: function() {
        return "Null";
      },
      empty: function() {
        return "";
      }
    },
    defaultStyle: "lowercase"
  });
  bool = new type("tag:yaml.org,2002:bool", {
    kind: "scalar",
    resolve: resolveYamlBoolean,
    construct: constructYamlBoolean,
    predicate: isBoolean,
    represent: {
      lowercase: function(object) {
        return object ? "true" : "false";
      },
      uppercase: function(object) {
        return object ? "TRUE" : "FALSE";
      },
      camelcase: function(object) {
        return object ? "True" : "False";
      }
    },
    defaultStyle: "lowercase"
  });
  int = new type("tag:yaml.org,2002:int", {
    kind: "scalar",
    resolve: resolveYamlInteger,
    construct: constructYamlInteger,
    predicate: isInteger,
    represent: {
      binary: function(obj) {
        return obj >= 0 ? "0b" + obj.toString(2) : "-0b" + obj.toString(2).slice(1);
      },
      octal: function(obj) {
        return obj >= 0 ? "0o" + obj.toString(8) : "-0o" + obj.toString(8).slice(1);
      },
      decimal: function(obj) {
        return obj.toString(10);
      },
      hexadecimal: function(obj) {
        return obj >= 0 ? "0x" + obj.toString(16).toUpperCase() : "-0x" + obj.toString(16).toUpperCase().slice(1);
      }
    },
    defaultStyle: "decimal",
    styleAliases: {
      binary: [2, "bin"],
      octal: [8, "oct"],
      decimal: [10, "dec"],
      hexadecimal: [16, "hex"]
    }
  });
  YAML_FLOAT_PATTERN = new RegExp("^(?:[-+]?(?:[0-9][0-9_]*)(?:\\.[0-9_]*)?(?:[eE][-+]?[0-9]+)?" + "|\\.[0-9_]+(?:[eE][-+]?[0-9]+)?" + "|[-+]?\\.(?:inf|Inf|INF)" + "|\\.(?:nan|NaN|NAN))$");
  SCIENTIFIC_WITHOUT_DOT = /^[-+]?[0-9]+e/;
  float = new type("tag:yaml.org,2002:float", {
    kind: "scalar",
    resolve: resolveYamlFloat,
    construct: constructYamlFloat,
    predicate: isFloat,
    represent: representYamlFloat,
    defaultStyle: "lowercase"
  });
  json = failsafe.extend({
    implicit: [
      _null,
      bool,
      int,
      float
    ]
  });
  core = json;
  YAML_DATE_REGEXP = new RegExp("^([0-9][0-9][0-9][0-9])" + "-([0-9][0-9])" + "-([0-9][0-9])$");
  YAML_TIMESTAMP_REGEXP = new RegExp("^([0-9][0-9][0-9][0-9])" + "-([0-9][0-9]?)" + "-([0-9][0-9]?)" + "(?:[Tt]|[ \\t]+)" + "([0-9][0-9]?)" + ":([0-9][0-9])" + ":([0-9][0-9])" + "(?:\\.([0-9]*))?" + "(?:[ \\t]*(Z|([-+])([0-9][0-9]?)" + "(?::([0-9][0-9]))?))?$");
  timestamp = new type("tag:yaml.org,2002:timestamp", {
    kind: "scalar",
    resolve: resolveYamlTimestamp,
    construct: constructYamlTimestamp,
    instanceOf: Date,
    represent: representYamlTimestamp
  });
  merge = new type("tag:yaml.org,2002:merge", {
    kind: "scalar",
    resolve: resolveYamlMerge
  });
  binary = new type("tag:yaml.org,2002:binary", {
    kind: "scalar",
    resolve: resolveYamlBinary,
    construct: constructYamlBinary,
    predicate: isBinary,
    represent: representYamlBinary
  });
  _hasOwnProperty$3 = Object.prototype.hasOwnProperty;
  _toString$2 = Object.prototype.toString;
  omap = new type("tag:yaml.org,2002:omap", {
    kind: "sequence",
    resolve: resolveYamlOmap,
    construct: constructYamlOmap
  });
  _toString$1 = Object.prototype.toString;
  pairs = new type("tag:yaml.org,2002:pairs", {
    kind: "sequence",
    resolve: resolveYamlPairs,
    construct: constructYamlPairs
  });
  _hasOwnProperty$2 = Object.prototype.hasOwnProperty;
  set = new type("tag:yaml.org,2002:set", {
    kind: "mapping",
    resolve: resolveYamlSet,
    construct: constructYamlSet
  });
  _default = core.extend({
    implicit: [
      timestamp,
      merge
    ],
    explicit: [
      binary,
      omap,
      pairs,
      set
    ]
  });
  _hasOwnProperty$1 = Object.prototype.hasOwnProperty;
  PATTERN_NON_PRINTABLE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x84\x86-\x9F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/;
  PATTERN_NON_ASCII_LINE_BREAKS = /[\x85\u2028\u2029]/;
  PATTERN_FLOW_INDICATORS = /[,\[\]\{\}]/;
  PATTERN_TAG_HANDLE = /^(?:!|!!|![a-z\-]+!)$/i;
  PATTERN_TAG_URI = /^(?:!|[^,\[\]\{\}])(?:%[0-9a-f]{2}|[0-9a-z\-#;\/\?:@&=\+\$,_\.!~\*'\(\)\[\]])*$/i;
  simpleEscapeCheck = new Array(256);
  simpleEscapeMap = new Array(256);
  for (i = 0;i < 256; i++) {
    simpleEscapeCheck[i] = simpleEscapeSequence(i) ? 1 : 0;
    simpleEscapeMap[i] = simpleEscapeSequence(i);
  }
  directiveHandlers = {
    YAML: function handleYamlDirective(state, name, args) {
      var match, major, minor;
      if (state.version !== null) {
        throwError(state, "duplication of %YAML directive");
      }
      if (args.length !== 1) {
        throwError(state, "YAML directive accepts exactly one argument");
      }
      match = /^([0-9]+)\.([0-9]+)$/.exec(args[0]);
      if (match === null) {
        throwError(state, "ill-formed argument of the YAML directive");
      }
      major = parseInt(match[1], 10);
      minor = parseInt(match[2], 10);
      if (major !== 1) {
        throwError(state, "unacceptable YAML version of the document");
      }
      state.version = args[0];
      state.checkLineBreaks = minor < 2;
      if (minor !== 1 && minor !== 2) {
        throwWarning(state, "unsupported YAML version of the document");
      }
    },
    TAG: function handleTagDirective(state, name, args) {
      var handle, prefix;
      if (args.length !== 2) {
        throwError(state, "TAG directive accepts exactly two arguments");
      }
      handle = args[0];
      prefix = args[1];
      if (!PATTERN_TAG_HANDLE.test(handle)) {
        throwError(state, "ill-formed tag handle (first argument) of the TAG directive");
      }
      if (_hasOwnProperty$1.call(state.tagMap, handle)) {
        throwError(state, 'there is a previously declared suffix for "' + handle + '" tag handle');
      }
      if (!PATTERN_TAG_URI.test(prefix)) {
        throwError(state, "ill-formed tag prefix (second argument) of the TAG directive");
      }
      try {
        prefix = decodeURIComponent(prefix);
      } catch (err) {
        throwError(state, "tag prefix is malformed: " + prefix);
      }
      state.tagMap[handle] = prefix;
    }
  };
  loadAll_1 = loadAll$1;
  load_1 = load$1;
  loader = {
    loadAll: loadAll_1,
    load: load_1
  };
  _toString = Object.prototype.toString;
  _hasOwnProperty = Object.prototype.hasOwnProperty;
  ESCAPE_SEQUENCES = {};
  ESCAPE_SEQUENCES[0] = "\\0";
  ESCAPE_SEQUENCES[7] = "\\a";
  ESCAPE_SEQUENCES[8] = "\\b";
  ESCAPE_SEQUENCES[9] = "\\t";
  ESCAPE_SEQUENCES[10] = "\\n";
  ESCAPE_SEQUENCES[11] = "\\v";
  ESCAPE_SEQUENCES[12] = "\\f";
  ESCAPE_SEQUENCES[13] = "\\r";
  ESCAPE_SEQUENCES[27] = "\\e";
  ESCAPE_SEQUENCES[34] = "\\\"";
  ESCAPE_SEQUENCES[92] = "\\\\";
  ESCAPE_SEQUENCES[133] = "\\N";
  ESCAPE_SEQUENCES[160] = "\\_";
  ESCAPE_SEQUENCES[8232] = "\\L";
  ESCAPE_SEQUENCES[8233] = "\\P";
  DEPRECATED_BOOLEANS_SYNTAX = [
    "y",
    "Y",
    "yes",
    "Yes",
    "YES",
    "on",
    "On",
    "ON",
    "n",
    "N",
    "no",
    "No",
    "NO",
    "off",
    "Off",
    "OFF"
  ];
  DEPRECATED_BASE60_SYNTAX = /^[-+]?[0-9_]+(?::[0-9_]+)+(?:\.[0-9_]*)?$/;
  dump_1 = dump$1;
  dumper = {
    dump: dump_1
  };
  Type = type;
  Schema = schema;
  FAILSAFE_SCHEMA = failsafe;
  JSON_SCHEMA = json;
  CORE_SCHEMA = core;
  DEFAULT_SCHEMA = _default;
  load = loader.load;
  loadAll = loader.loadAll;
  dump = dumper.dump;
  YAMLException = exception;
  types = {
    binary,
    float,
    map,
    null: _null,
    pairs,
    set,
    timestamp,
    bool,
    int,
    merge,
    omap,
    seq,
    str
  };
  safeLoad = renamed("safeLoad", "load");
  safeLoadAll = renamed("safeLoadAll", "loadAll");
  safeDump = renamed("safeDump", "dump");
  jsYaml = {
    Type,
    Schema,
    FAILSAFE_SCHEMA,
    JSON_SCHEMA,
    CORE_SCHEMA,
    DEFAULT_SCHEMA,
    load,
    loadAll,
    dump,
    YAMLException,
    types,
    safeLoad,
    safeLoadAll,
    safeDump
  };
});

// cli/commands/launch.ts
import { existsSync as existsSync34, readFileSync as readFileSync33, writeFileSync as writeFileSync23, mkdirSync as mkdirSync22 } from "node:fs";
import { join as join41, resolve as resolve2 } from "node:path";
function findManifest(manifestPath) {
  if (manifestPath) {
    const p = resolve2(manifestPath);
    if (!existsSync34(p))
      fail(`Manifest not found: ${p}`);
    return p;
  }
  const root = resolveProjectRoot();
  const candidates = [
    join41(root, ".fleet/manifest.yaml"),
    join41(root, ".fleet/manifest.yml")
  ];
  for (const c of candidates) {
    if (existsSync34(c))
      return c;
  }
  fail("No .fleet/manifest.yaml found. Create one or use --manifest <path>");
}
function parseManifest(path) {
  const raw = readFileSync33(path, "utf-8");
  const doc = jsYaml.load(raw);
  if (!doc || typeof doc !== "object")
    fail("Invalid manifest: not a YAML object");
  if (!doc.workers || typeof doc.workers !== "object")
    fail("Invalid manifest: missing 'workers' map");
  return doc;
}
function isAlive(project, name, panes) {
  const state = getState(project, name);
  return !!(state?.pane_id && panes.has(state.pane_id));
}
async function runLaunch(opts, globalOpts) {
  const manifestPath = findManifest(opts.manifest);
  const manifest = parseManifest(manifestPath);
  const projectRoot = resolveProjectRoot();
  const project = manifest.project || globalOpts.project || resolveProject(projectRoot);
  info(`Manifest: ${manifestPath}`);
  info(`Project: ${project}`);
  const fleetJsonDir = join41(FLEET_DATA, project);
  mkdirSync22(fleetJsonDir, { recursive: true });
  const fleetJsonPath2 = join41(fleetJsonDir, "fleet.json");
  if (!existsSync34(fleetJsonPath2)) {
    writeFileSync23(fleetJsonPath2, JSON.stringify({
      project_name: project,
      tmux_session: manifest.tmux_session || "w",
      commit_notify: [],
      deploy_authority: "operator",
      merge_authority: "operator",
      mission_authority: "operator"
    }, null, 2) + `
`);
    ok("Created fleet.json");
  } else if (manifest.tmux_session) {
    const fleetConfig = getFleetConfig(project);
    if (fleetConfig && fleetConfig.tmux_session !== manifest.tmux_session) {
      const fc = JSON.parse(readFileSync33(fleetJsonPath2, "utf-8"));
      fc.tmux_session = manifest.tmux_session;
      writeFileSync23(fleetJsonPath2, JSON.stringify(fc, null, 2) + `
`);
      info(`Updated tmux_session to '${manifest.tmux_session}'`);
    }
  }
  let workerNames = Object.keys(manifest.workers);
  if (opts.only) {
    const only = opts.only.split(",").map((s) => s.trim());
    workerNames = workerNames.filter((n) => only.includes(n));
    if (workerNames.length === 0)
      fail(`No matching workers for --only ${opts.only}`);
  }
  const panes = listPaneIds();
  const results = [];
  for (const name of workerNames) {
    const spec = manifest.workers[name];
    const dir = workerDir(project, name);
    const exists2 = existsSync34(dir);
    const alive = exists2 && isAlive(project, name, panes);
    let action;
    if (alive && !opts.force) {
      action = "skip (running)";
    } else if (alive && opts.force) {
      action = "restart";
    } else if (exists2) {
      action = "start";
    } else {
      action = "create";
    }
    if (opts.dryRun) {
      results.push({ name, action });
      continue;
    }
    const missionDir = join41(manifestPath, "..");
    const missionFile = join41(missionDir, `${name}.md`);
    const hasMission = existsSync34(missionFile);
    if (action === "create") {
      const mission = hasMission ? `@${missionFile}` : `You are worker '${name}'. Await instructions from the operator.`;
      await runCreate2(name, mission, {
        model: spec.model,
        effort: spec.effort,
        permissionMode: spec.permission_mode,
        type: spec.type,
        window: spec.window
      }, { ...globalOpts, project });
      if (spec.sleep_duration !== undefined) {
        setConfigValue(project, name, "sleep_duration", spec.sleep_duration);
      }
      results.push({ name, action: "created" });
    } else if (action === "start" || action === "restart") {
      applyManifestOverrides(project, name, spec);
      const args = ["bun", "run", join41(import.meta.dir, "../index.ts"), "start", name, "-p", project];
      if (opts.force)
        args.push("--force");
      const result = Bun.spawnSync(args, { stderr: "pipe", stdout: "pipe" });
      if (result.exitCode !== 0) {
        warn(`Failed to start ${name}: ${result.stderr.toString()}`);
        results.push({ name, action: "failed" });
      } else {
        results.push({ name, action: action === "restart" ? "restarted" : "started" });
      }
    } else {
      results.push({ name, action: "skipped" });
    }
  }
  console.log();
  const created = results.filter((r) => r.action === "created").length;
  const started = results.filter((r) => r.action === "started").length;
  const restarted = results.filter((r) => r.action === "restarted").length;
  const skipped = results.filter((r) => r.action.startsWith("skip")).length;
  const failed = results.filter((r) => r.action === "failed").length;
  if (opts.dryRun) {
    info("Dry run — no changes made");
    table(["Worker", "Action"], results.map((r) => [r.name, r.action]));
  } else {
    const parts = [];
    if (created)
      parts.push(`${created} created`);
    if (started)
      parts.push(`${started} started`);
    if (restarted)
      parts.push(`${restarted} restarted`);
    if (skipped)
      parts.push(`${skipped} skipped`);
    if (failed)
      parts.push(`${failed} failed`);
    ok(parts.join(", ") || "Nothing to do");
  }
}
function applyManifestOverrides(project, name, spec) {
  const config = getConfig(project, name);
  if (!config)
    return;
  if (spec.model && spec.model !== config.model) {
    setConfigValue(project, name, "model", spec.model);
  }
  if (spec.effort && spec.effort !== config.reasoning_effort) {
    setConfigValue(project, name, "reasoning_effort", spec.effort);
  }
  if (spec.permission_mode && spec.permission_mode !== config.permission_mode) {
    setConfigValue(project, name, "permission_mode", spec.permission_mode);
  }
  if (spec.sleep_duration !== undefined && spec.sleep_duration !== config.sleep_duration) {
    setConfigValue(project, name, "sleep_duration", spec.sleep_duration);
  }
}
function register29(parent) {
  const sub = parent.command("launch").description("Launch fleet from .fleet/manifest.yaml").option("--manifest <path>", "Path to manifest YAML").option("--dry-run", "Show what would happen without doing it").option("--only <names>", "Comma-separated worker names to launch").option("-f, --force", "Restart even if workers are already running");
  addGlobalOpts(sub).action(async (opts, cmd) => {
    await runLaunch(opts, cmd.optsWithGlobals());
  });
}
var init_launch2 = __esm(() => {
  init_js_yaml();
  init_paths();
  init_config();
  init_fmt2();
  init_create2();
  init_cli();
});

// cli/commands/deploy.ts
function ssh(host, cmd) {
  const result = Bun.spawnSync(["ssh", "-o", "ConnectTimeout=10", "-o", "BatchMode=yes", host, cmd], { stderr: "pipe" });
  return {
    ok: result.exitCode === 0,
    stdout: result.stdout.toString().trim(),
    stderr: result.stderr.toString().trim()
  };
}
async function runDeploy(host, repoUrl, opts) {
  const branch = opts.branch || "main";
  info(`Deploying to ${host}`);
  info("Checking SSH connectivity...");
  const ping = ssh(host, "echo ok");
  if (!ping.ok)
    fail(`Cannot SSH to ${host}: ${ping.stderr}`);
  ok("SSH connected");
  info("Checking remote dependencies...");
  const deps = ssh(host, "which bun && which tmux && which git && which claude");
  if (!deps.ok) {
    const missing = [];
    for (const tool of ["bun", "tmux", "git", "claude"]) {
      const check = ssh(host, `which ${tool}`);
      if (!check.ok)
        missing.push(tool);
    }
    fail(`Missing dependencies on ${host}: ${missing.join(", ")}`);
  }
  ok("Dependencies verified");
  if (opts.unlockKeychain) {
    info("Unlocking keychain...");
    const keychainPw = ssh(host, 'security unlock-keychain -p "$(cat ~/.keychain-password 2>/dev/null)" 2>/dev/null; echo $?');
    if (keychainPw.stdout.trim() !== "0") {
      warn("Keychain unlock may have failed — Claude auth might not work");
    } else {
      ok("Keychain unlocked");
    }
  }
  const repoName = repoUrl.split("/").pop()?.replace(/\.git$/, "") || "repo";
  const remoteDir = opts.dir || `~/${repoName}`;
  info(`Setting up repo at ${remoteDir}...`);
  const repoExists = ssh(host, `test -d ${remoteDir}/.git && echo yes || echo no`);
  if (opts.dryRun) {
    info("[dry-run] Would clone/pull repo");
    info("[dry-run] Would run fleet setup");
    info("[dry-run] Would run fleet launch");
    return;
  }
  if (repoExists.stdout === "yes") {
    info("Repo exists, pulling latest...");
    const pull = ssh(host, `cd ${remoteDir} && git fetch origin && git checkout ${branch} && git pull origin ${branch}`);
    if (!pull.ok) {
      warn(`Pull failed: ${pull.stderr}`);
      warn("Continuing with existing state...");
    } else {
      ok("Repo updated");
    }
  } else {
    info("Cloning repo...");
    const clone = ssh(host, `git clone -b ${branch} ${repoUrl} ${remoteDir}`);
    if (!clone.ok)
      fail(`Clone failed: ${clone.stderr}`);
    ok("Repo cloned");
  }
  info("Running fleet setup...");
  const setup = ssh(host, `cd ${remoteDir} && fleet setup`);
  if (!setup.ok) {
    warn(`fleet setup issues: ${setup.stderr}`);
  } else {
    ok("Fleet setup complete");
  }
  info("Launching fleet from manifest...");
  const launch = ssh(host, `cd ${remoteDir} && fleet launch`);
  if (!launch.ok) {
    warn(`fleet launch issues: ${launch.stderr}`);
    console.log(launch.stdout);
  } else {
    ok("Fleet launched");
    console.log(launch.stdout);
  }
  ok(`Deploy to ${host} complete`);
}
function register30(parent) {
  const sub = parent.command("deploy <host> <repo-url>").description("Deploy fleet to a remote machine via SSH").option("--branch <branch>", "Git branch to checkout (default: main)").option("--unlock-keychain", "Unlock macOS keychain before launching").option("--dir <path>", "Remote directory (default: ~/<repo-name>)").option("--dry-run", "Show what would happen without doing it");
  addGlobalOpts(sub).action(async (host, repoUrl, opts) => {
    await runDeploy(host, repoUrl, opts);
  });
}
var init_deploy = __esm(() => {
  init_fmt2();
  init_cli();
});

// cli/commands/get.ts
import { existsSync as existsSync35, readFileSync as readFileSync34 } from "node:fs";
import { join as join42 } from "node:path";
function register31(parent) {
  const cmd = parent.command("get <name>").description("Show a worker's mission and key info").option("--mission-only", "Print only the mission text");
  addGlobalOpts(cmd).action((name, opts, cmd2) => {
    const project = cmd2.optsWithGlobals().project || resolveProject();
    const dir = workerDir(project, name);
    if (!existsSync35(dir))
      fail(`Worker '${name}' not found in project '${project}'`);
    const missionPath = join42(dir, "mission.md");
    const mission = existsSync35(missionPath) ? readFileSync34(missionPath, "utf-8").trim() : null;
    if (opts.missionOnly) {
      if (mission) {
        console.log(mission);
      } else {
        fail(`No mission.md for worker '${name}'`);
      }
      return;
    }
    const config = getConfig(project, name);
    const state = getState(project, name);
    console.log(`Worker: ${name}`);
    console.log(`Project: ${project}`);
    if (config) {
      console.log(`Model: ${config.model || "default"} | Effort: ${config.reasoning_effort || "default"} | Mode: ${config.permission_mode || "default"}`);
      if (config.sleep_duration != null)
        console.log(`Sleep: ${config.sleep_duration}s (perpetual)`);
      if (config.worktree)
        console.log(`Worktree: ${config.worktree}`);
    }
    if (state) {
      console.log(`Status: ${state.status || "unknown"}${state.cycles_completed ? ` | Cycles: ${state.cycles_completed}` : ""}`);
    }
    console.log("");
    if (mission) {
      console.log(mission);
    } else {
      console.log("(no mission.md)");
    }
  });
}
var init_get = __esm(() => {
  init_paths();
  init_config();
  init_fmt2();
  init_cli();
});

// cli/commands/register.ts
import { mkdirSync as mkdirSync23, writeFileSync as writeFileSync24, readFileSync as readFileSync35, readdirSync as readdirSync14, existsSync as existsSync36, renameSync, rmSync as rmSync8 } from "node:fs";
import { join as join43 } from "node:path";
function register32(parent) {
  const sub = parent.command("register").description("Register current session with Fleet Mail").option("-n, --name <name>", "Custom name (default: auto-detect from worktree or 'session')").option("--session-id <id>", "Session ID (default: detect from TMUX_PANE)").option("--quiet", "Suppress output (for hook scripts)");
  addGlobalOpts(sub).action(async (opts) => {
    const sessionId = resolveSessionId({ sessionId: opts.sessionId });
    if (!sessionId) {
      if (!opts.quiet)
        fail("Cannot detect session ID. Pass --session-id or run inside tmux.");
      process.exit(1);
    }
    const existing = loadSessionIdentity(sessionId);
    if (existing && !opts.name) {
      ensureWorkerEntry(existing, opts.quiet);
      if (!opts.quiet) {
        ok(`Already registered: ${existing.mailName}`);
      } else {
        process.stdout.write(existing.mailName);
      }
      return;
    }
    if (!FLEET_MAIL_URL) {
      if (!opts.quiet)
        fail("Fleet Mail not configured — run: fleet mail-server connect <url>");
      process.exit(1);
    }
    const dirSlug = resolveDirSlug();
    const customName = sanitizeName(opts.name || detectCustomName());
    const mailName = buildMailName(customName, dirSlug, sessionId);
    const siblings = findSiblingSessions(dirSlug, sessionId);
    const resp = await fetch(`${FLEET_MAIL_URL}/api/accounts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: mailName,
        bio: `Fleet session: ${customName} in ${dirSlug} (session ${sessionId.slice(0, 8)}...)`
      })
    });
    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      if (resp.status === 409) {
        if (!opts.quiet)
          warn(`Account '${mailName}' already exists on server (re-registration)`);
      } else {
        if (!opts.quiet)
          fail(`Fleet Mail register failed (${resp.status}): ${errText}`);
        process.exit(1);
      }
    }
    const data = resp.ok ? await resp.json() : null;
    const token = data?.bearerToken;
    const dir = sessionDir(sessionId);
    mkdirSync23(dir, { recursive: true });
    const paneId = process.env.TMUX_PANE || null;
    const identity = {
      mailName,
      sessionId,
      dirSlug,
      customName,
      cwd: process.cwd(),
      paneId,
      registeredAt: new Date().toISOString()
    };
    writeFileSync24(join43(dir, "identity.json"), JSON.stringify(identity, null, 2) + `
`);
    if (token)
      writeFileSync24(join43(dir, "token"), token);
    writeFileSync24(join43(dir, "state.json"), JSON.stringify({}, null, 2) + `
`);
    const missionPath = join43(dir, "mission.md");
    try {
      readFileSync35(missionPath);
    } catch {
      writeFileSync24(missionPath, `# Mission

<!-- Fill in your mission as you understand your task -->
`);
    }
    if (existing && opts.name) {
      const oldWorkerName = existing.customName;
      const project = resolveProject();
      existing.mailName = mailName;
      existing.customName = customName;
      writeFileSync24(join43(dir, "identity.json"), JSON.stringify(existing, null, 2) + `
`);
      const oldDir = workerDir(project, oldWorkerName);
      const newDir = workerDir(project, customName);
      if (existsSync36(oldDir) && oldDir !== newDir) {
        if (existsSync36(newDir)) {
          rmSync8(newDir, { recursive: true });
        }
        renameSync(oldDir, newDir);
        if (!opts.quiet)
          info(`  Renamed worker: ${oldWorkerName} → ${customName}`);
      }
      ensureWorkerEntry(existing, opts.quiet);
      if (!opts.quiet) {
        ok(`Renamed: ${mailName}`);
      } else {
        process.stdout.write(mailName);
      }
      return;
    }
    ensureWorkerEntry(identity, opts.quiet);
    if (!opts.quiet) {
      ok(`Registered: ${mailName}`);
      info(`  Session: ${sessionId}`);
      info(`  Dir: ${dirSlug}`);
      info(`  Worker: ${customName} (in fleet ls)`);
      if (paneId)
        info(`  Pane: ${paneId}`);
      if (siblings.length > 0) {
        warn(`Other sessions in ${dirSlug}: ${siblings.map((s) => s.mailName).join(", ")}`);
        info("  Consider running: fleet register --name <unique-name>");
      }
    } else {
      process.stdout.write(mailName);
    }
  });
}
function ensureWorkerEntry(identity, quiet) {
  const project = resolveProject();
  const name = identity.customName;
  const dir = workerDir(project, name);
  if (existsSync36(join43(dir, "config.json"))) {
    const state = getState(project, name);
    if (state && (state.session_id !== identity.sessionId || state.pane_id !== identity.paneId)) {
      const updatedState = {
        ...state,
        status: "active",
        pane_id: identity.paneId,
        session_id: identity.sessionId
      };
      writeFileSync24(join43(dir, "state.json"), JSON.stringify(updatedState, null, 2) + `
`);
    }
    return;
  }
  mkdirSync23(dir, { recursive: true });
  const config = {
    model: "opus[1m]",
    reasoning_effort: "high",
    permission_mode: "bypassPermissions",
    sleep_duration: null,
    window: null,
    worktree: identity.cwd,
    branch: "HEAD",
    mcp: {},
    hooks: [],
    ephemeral: true,
    meta: {
      created_at: identity.registeredAt,
      created_by: "fleet-register",
      forked_from: null,
      project
    }
  };
  writeFileSync24(join43(dir, "config.json"), JSON.stringify(config, null, 2) + `
`);
  const workerState = {
    status: "active",
    pane_id: identity.paneId,
    pane_target: null,
    tmux_session: null,
    session_id: identity.sessionId,
    past_sessions: [],
    last_relaunch: null,
    relaunch_count: 0,
    cycles_completed: 0,
    last_cycle_at: null,
    custom: {}
  };
  writeFileSync24(join43(dir, "state.json"), JSON.stringify(workerState, null, 2) + `
`);
  const sessionMission = join43(sessionDir(identity.sessionId), "mission.md");
  const workerMission = join43(dir, "mission.md");
  if (!existsSync36(workerMission)) {
    try {
      const { symlinkSync } = __require("node:fs");
      symlinkSync(sessionMission, workerMission);
    } catch {
      writeFileSync24(workerMission, `# Mission

<!-- Fill in your mission -->
`);
    }
  }
  if (!quiet)
    info(`  Worker entry created: ${project}/${name}`);
}
function detectCustomName() {
  if (process.env.WORKER_NAME)
    return process.env.WORKER_NAME;
  try {
    const { execSync: execSync2 } = __require("child_process");
    const branch = execSync2("git rev-parse --abbrev-ref HEAD", {
      encoding: "utf-8",
      timeout: 5000
    }).trim();
    if (branch.startsWith("worker/"))
      return branch.slice("worker/".length);
  } catch {}
  const dirName = __require("path").basename(process.cwd());
  const match = dirName.match(/-w-(.+)$/);
  if (match)
    return match[1];
  return "session";
}
function findSiblingSessions(dirSlug, excludeSessionId) {
  try {
    const dirs = readdirSync14(sessionsDir());
    return dirs.filter((d) => d !== excludeSessionId).map((d) => {
      try {
        const id = JSON.parse(readFileSync35(join43(sessionsDir(), d, "identity.json"), "utf-8"));
        if (id.dirSlug !== dirSlug)
          return null;
        if (id.paneId) {
          try {
            const { spawnSync: spawnSync2 } = __require("child_process");
            const r = spawnSync2("tmux", ["display-message", "-t", id.paneId, "-p", ""], {
              encoding: "utf-8",
              timeout: 2000,
              stdio: "pipe"
            });
            if (r.status !== 0)
              return null;
          } catch {
            return null;
          }
        }
        return id;
      } catch {
        return null;
      }
    }).filter((id) => id !== null);
  } catch {
    return [];
  }
}
var init_register = __esm(() => {
  init_cli();
  init_paths();
  init_fmt2();
  init_config();
  init_identity();
});

// cli/commands/state.ts
import { readFileSync as readFileSync36, writeFileSync as writeFileSync25, mkdirSync as mkdirSync24, rmdirSync } from "node:fs";
import { join as join44, dirname as dirname9 } from "node:path";
function register33(parent) {
  const state = parent.command("state").description("Persistent key-value state");
  const get = state.command("get [key]").description("Read state (all or a specific key)");
  addGlobalOpts(get).action(async (key) => {
    const statePath2 = getStatePath();
    let data = {};
    try {
      data = JSON.parse(readFileSync36(statePath2, "utf-8"));
    } catch {}
    if (key) {
      const val = data[key];
      if (val === undefined) {
        console.log("(not set)");
      } else {
        console.log(typeof val === "string" ? val : JSON.stringify(val));
      }
    } else {
      console.log(JSON.stringify(data, null, 2));
    }
  });
  const set2 = state.command("set <key> <value>").description("Set a key-value pair");
  addGlobalOpts(set2).action(async (key, value) => {
    const statePath2 = getStatePath();
    const dir = dirname9(statePath2);
    mkdirSync24(dir, { recursive: true });
    const lockDir = join44(dir, ".state.lock");
    const maxRetries = 10;
    const retryDelay = 100;
    let acquired = false;
    for (let i2 = 0;i2 < maxRetries; i2++) {
      try {
        mkdirSync24(lockDir);
        acquired = true;
        break;
      } catch (err) {
        if (err.code === "EEXIST") {
          await new Promise((r) => setTimeout(r, retryDelay));
        } else {
          throw err;
        }
      }
    }
    if (!acquired) {
      fail("Cannot acquire state lock — another process is writing. Retry shortly.");
    }
    try {
      let data = {};
      try {
        data = JSON.parse(readFileSync36(statePath2, "utf-8"));
      } catch {}
      try {
        data[key] = JSON.parse(value);
      } catch {
        data[key] = value;
      }
      writeFileSync25(statePath2, JSON.stringify(data, null, 2) + `
`);
      ok(`${key} = ${typeof data[key] === "string" ? data[key] : JSON.stringify(data[key])}`);
    } finally {
      try {
        rmdirSync(lockDir);
      } catch {}
    }
  });
}
function getStatePath() {
  const identity = resolveIdentity();
  if (identity?.type === "session") {
    return join44(sessionDir(identity.identity.sessionId), "state.json");
  }
  if (identity?.type === "legacy") {
    const project = resolveDirSlug();
    return join44(FLEET_DATA, project, identity.workerName, "state.json");
  }
  const sid = resolveSessionId();
  if (sid)
    return join44(sessionDir(sid), "state.json");
  return fail("Cannot detect session/worker identity");
}
var init_state = __esm(() => {
  init_cli();
  init_fmt2();
  init_identity();
  init_paths();
});

// cli/commands/checkpoint.ts
import { mkdirSync as mkdirSync25, writeFileSync as writeFileSync26 } from "node:fs";
import { join as join45 } from "node:path";
function register34(parent) {
  const sub = parent.command("checkpoint <summary>").description("Save a state checkpoint for crash recovery").option("--key-facts <facts>", "Comma-separated key facts");
  addGlobalOpts(sub).action(async (summary, opts) => {
    const dir = getCheckpointDir();
    mkdirSync25(dir, { recursive: true });
    const ts = new Date().toISOString();
    const filename = `checkpoint-${ts.replace(/[:.]/g, "-")}.json`;
    const checkpoint = {
      summary,
      key_facts: opts.keyFacts?.split(",").map((f) => f.trim()) || [],
      timestamp: ts,
      cwd: process.cwd()
    };
    writeFileSync26(join45(dir, filename), JSON.stringify(checkpoint, null, 2) + `
`);
    ok(`Checkpoint saved: ${filename}`);
  });
}
function getCheckpointDir() {
  const identity = resolveIdentity();
  if (identity?.type === "session") {
    return join45(sessionDir(identity.identity.sessionId), "checkpoints");
  }
  if (identity?.type === "legacy") {
    return join45(FLEET_DATA, resolveDirSlug(), identity.workerName, "checkpoints");
  }
  const sid = resolveSessionId();
  if (sid)
    return join45(sessionDir(sid), "checkpoints");
  return fail("Cannot detect session/worker identity");
}
var init_checkpoint = __esm(() => {
  init_cli();
  init_fmt2();
  init_identity();
  init_paths();
});

// cli/commands/session.ts
import { readFileSync as readFileSync37, existsSync as existsSync37, statSync as statSync2 } from "node:fs";
import { join as join46 } from "node:path";
function register35(parent) {
  const session = parent.command("session").description("Session lifecycle management");
  const ls = session.command("ls").description("List all registered sessions");
  addGlobalOpts(ls).action(async () => {
    const sessions = listSessionIdentities();
    if (!sessions.length) {
      info("No sessions registered. Sessions auto-register on first prompt.");
      return;
    }
    const rows = sessions.map((s) => {
      const alive = isSessionAlive(s);
      return [
        s.customName,
        s.dirSlug,
        s.sessionId.slice(0, 8) + "...",
        s.paneId || "-",
        alive ? "alive" : "dead",
        s.registeredAt.slice(0, 19)
      ];
    });
    table(["Name", "Dir", "Session", "Pane", "Status", "Registered"], rows);
  });
  const infoCmd = session.command("info").description("Show session identity and state").option("--session-id <id>", "Session ID");
  addGlobalOpts(infoCmd).action(async (opts) => {
    const sessionId = resolveSessionId({ sessionId: opts.sessionId });
    if (!sessionId)
      return fail("Cannot detect session ID");
    const identity = loadSessionIdentity(sessionId);
    if (!identity)
      return fail(`No identity found for session ${sessionId}`);
    console.log(JSON.stringify({
      ...identity,
      alive: isSessionAlive(identity),
      state: loadState(sessionId)
    }, null, 2));
  });
  const sync = session.command("sync").description("Upload session file to Fleet Mail server").option("--session-id <id>", "Session ID");
  addGlobalOpts(sync).action(async (opts) => {
    if (!FLEET_MAIL_URL)
      return fail("Fleet Mail not configured");
    const sessionId = resolveSessionId({ sessionId: opts.sessionId });
    if (!sessionId)
      return fail("Cannot detect session ID");
    const identity = loadSessionIdentity(sessionId);
    if (!identity)
      return fail(`No identity found for session ${sessionId}`);
    const transcriptPath = findTranscriptPath(sessionId);
    if (!transcriptPath) {
      info("No transcript file found — nothing to sync");
      return;
    }
    const fileSize = statSync2(transcriptPath).size;
    if (fileSize === 0) {
      info("Transcript file is empty — nothing to sync");
      return;
    }
    const tokenPath = join46(sessionDir(sessionId), "token");
    if (!existsSync37(tokenPath))
      return fail("No Fleet Mail token — run: fleet register");
    const token = readFileSync37(tokenPath, "utf-8").trim();
    const fileData = readFileSync37(transcriptPath);
    const resp = await fetch(`${FLEET_MAIL_URL}/api/accounts/me/session`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/octet-stream"
      },
      body: fileData
    });
    if (!resp.ok) {
      const err = await resp.text().catch(() => "");
      return fail(`Upload failed (${resp.status}): ${err}`);
    }
    const data = await resp.json();
    ok(`Synced ${(fileSize / 1024).toFixed(1)}KB → blob:${data.hash.slice(0, 12)}...`);
  });
  const clean = session.command("clean").description("Remove dead session entries (pane no longer exists)");
  addGlobalOpts(clean).action(async () => {
    const sessions = listSessionIdentities();
    let cleaned = 0;
    for (const s of sessions) {
      if (!isSessionAlive(s)) {
        const dir = sessionDir(s.sessionId);
        try {
          const { rmSync: rmSync9 } = __require("fs");
          rmSync9(dir, { recursive: true });
          cleaned++;
          info(`Cleaned: ${s.customName} (${s.sessionId.slice(0, 8)}...)`);
        } catch {}
      }
    }
    if (cleaned === 0) {
      ok("No dead sessions to clean");
    } else {
      ok(`Cleaned ${cleaned} dead session(s)`);
    }
  });
}
function isSessionAlive(identity) {
  if (!identity.paneId)
    return false;
  try {
    const { spawnSync: spawnSync2 } = __require("child_process");
    const r = spawnSync2("tmux", ["display-message", "-t", identity.paneId, "-p", ""], {
      encoding: "utf-8",
      timeout: 3000,
      stdio: "pipe"
    });
    return r.status === 0;
  } catch {
    return false;
  }
}
function loadState(sessionId) {
  const statePath2 = join46(sessionDir(sessionId), "state.json");
  try {
    return JSON.parse(readFileSync37(statePath2, "utf-8"));
  } catch {
    return {};
  }
}
function findTranscriptPath(sessionId) {
  const HOME16 = process.env.HOME || "/tmp";
  const projectsDir = join46(HOME16, ".claude/projects");
  try {
    const { readdirSync: readdirSync15 } = __require("fs");
    for (const slug of readdirSync15(projectsDir)) {
      const candidate = join46(projectsDir, slug, `${sessionId}.jsonl`);
      if (existsSync37(candidate))
        return candidate;
    }
  } catch {}
  return null;
}
var init_session = __esm(() => {
  init_cli();
  init_fmt2();
  init_paths();
  init_identity();
});

// cli/index.ts
function addGlobalOpts(cmd) {
  return cmd.addOption(new Option("-p, --project <name>").hideHelp()).addOption(new Option("--json").hideHelp()).addOption(new Option("--human").hideHelp());
}
var program2;
var init_cli = __esm(() => {
  init_esm();
  init_fmt();
  init_setup();
  init_create();
  init_start();
  init_stop();
  init_ls();
  init_status();
  init_attach();
  init_config2();
  init_defaults();
  init_log();
  init_mail();
  init_mail_server2();
  init_fork();
  init_mcp();
  init_run();
  init_nuke();
  init_doctor();
  init_onboard();
  init_tui2();
  init_layout();
  init_deep_review();
  init_hook();
  init_recycle();
  init_pipeline2();
  init_completion();
  init_update();
  init_launch2();
  init_deploy();
  init_get();
  init_register();
  init_state();
  init_checkpoint();
  init_session();
  program2 = new Command().name("fleet").description("Fleet \u2014 persistent Claude Code agents in tmux").version("2.0.0", "-v, --version").option("-p, --project <name>", "Override project detection").option("--json", "JSON output for supported commands").option("--human", "Human-friendly output (default when HUMAN=1)");
  program2.hook("preAction", (thisCommand) => {
    const opts = thisCommand.optsWithGlobals();
    setOutputMode({ human: opts.human });
  });
  program2.action(async (_opts, cmd) => {
    const { runStatus: runStatus2 } = await Promise.resolve().then(() => (init_status(), exports_status));
    await runStatus2(cmd.optsWithGlobals());
  });
  register2(program2);
  register3(program2);
  register17(program2);
  register4(program2);
  register5(program2);
  register6(program2);
  register7(program2);
  register8(program2);
  register9(program2);
  register10(program2);
  register11(program2);
  register12(program2);
  register13(program2);
  register15(program2);
  register16(program2);
  register18(program2);
  register19(program2);
  register20(program2);
  register21(program2);
  register22(program2);
  register23(program2);
  register24(program2);
  register25(program2);
  register26(program2);
  register27(program2);
  register28(program2);
  register29(program2);
  register30(program2);
  register31(program2);
  register32(program2);
  register33(program2);
  register34(program2);
  register35(program2);
  program2.parse();
});
init_cli();

export {
  addGlobalOpts
};
