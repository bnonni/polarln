import {parseArgs} from 'node:util';
import type {ParseArgsOptionsConfig} from 'node:util';

import type {PolarTool} from '../polar_bridge/index.js';
import type {PolarError} from '../typescript/index.js';
import {flagName} from './names.js';

type Property = {enum?: unknown[]; type?: string};
type Values = {[flag: string]: boolean | string | undefined};

/** Flags That All Commands Take */
export const globalOptions = {
  help: {short: 'h', type: 'boolean'},
  url: {type: 'string'},
} satisfies ParseArgsOptionsConfig;

export type ParseFlagsResult = {
  /** Tool Arguments */
  args: {[name: string]: unknown};
  /** Show the Command Help */
  help: boolean;
};

// Get a JSON array or object from a flag value
const jsonOf = (flag: string, type: string, raw: string) => {
  let value: unknown;

  try {
    value = JSON.parse(raw);
  } catch {
    value = undefined;
  }

  const isArray = Array.isArray(value);
  const isObject = !!value && typeof value === 'object' && !isArray;

  if (type === 'array' ? !isArray : !isObject) {
    throw [400, 'ExpectedJsonForFlag', {flag, type, value: raw}];
  }

  return value;
};

// Get a number from a flag value
const numberOf = (flag: string, type: string, raw: string) => {
  const value = Number(raw);

  const isNumber =
    type === 'integer' ? Number.isSafeInteger(value) : Number.isFinite(value);

  if (!raw.trim() || !isNumber) {
    throw [400, 'ExpectedNumberForFlag', {flag, type, value: raw}];
  }

  return value;
};

// Get the argument value of a flag value
const valueOf = (flag: string, property: Property, raw: boolean | string) => {
  if (typeof raw === 'boolean') {
    return raw;
  }

  switch (property.type) {
    case 'array':
    case 'object':
      return jsonOf(flag, property.type, raw);

    case 'integer':
    case 'number':
      return numberOf(flag, property.type, raw);

    default:
      return raw;
  }
};

/** Parse the flags of a command with the arguments schema of its tool

  A boolean argument is a flag without a value: --is-private, --no-auto-fund

  An array or object argument is a JSON flag value

  {
    argv: [<Flag Argument String>]
    tool: <Polar Tool Object>
  }

  @throws <PolarError>

  @returns
  {
    args: {<Argument Name String>: <Argument Value>}
    help: <Show Command Help Bool>
  }
*/
export default (args: {argv: string[]; tool: PolarTool}): ParseFlagsResult => {
  const {properties} = args.tool.inputSchema;

  const entries = Object.entries(properties) as [string, Property][];

  const options: ParseArgsOptionsConfig = {...globalOptions};

  entries.forEach(([name, property]) => {
    const type = property.type === 'boolean' ? 'boolean' : 'string';

    options[flagName(name)] = {type};
  });

  let values: Values;

  try {
    values = parseArgs({
      allowNegative: true,
      args: args.argv,
      options,
      strict: true,
    }).values as Values;
  } catch (err) {
    throw [400, 'InvalidFlags', {err}] satisfies PolarError;
  }

  const help = values.help === true;

  if (help) {
    return {args: {}, help};
  }

  const missing = (args.tool.inputSchema.required || [])
    .map(flagName)
    .filter(flag => values[flag] === undefined)
    .map(flag => `--${flag}`);

  if (!!missing.length) {
    throw [400, 'MissingRequiredFlags', {flags: missing}] satisfies PolarError;
  }

  const toolArgs: {[name: string]: unknown} = {};

  entries.forEach(([name, property]) => {
    const flag = `--${flagName(name)}`;
    const raw = values[flagName(name)];

    if (raw === undefined) {
      return;
    }

    const value = valueOf(flag, property, raw);

    if (!!property.enum && !property.enum.includes(value)) {
      const allowed = property.enum;

      throw [400, 'ExpectedAllowedValueForFlag', {allowed, flag, value: raw}];
    }

    toolArgs[name] = value;
  });

  return {args: toolArgs, help};
};
