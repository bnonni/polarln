import type {PolarError} from '../typescript/index.js';

/** Backends That the CLI Can Use */
export const backendNames = ['bridge', 'docker'] as const;

export type BackendName = (typeof backendNames)[number];

export type BackendSource = '--backend' | 'POLARLN_BACKEND' | 'default';

export type SelectBackendResult = {
  /** Backend Name */
  backend: BackendName;
  /** Source of the Backend Name */
  from: BackendSource;
};

type Values = {[flag: string]: boolean | string | undefined};

const allowed = [...backendNames];
const env = 'POLARLN_BACKEND';
const flag = '--backend';
const isName = (n: unknown): n is BackendName =>
  allowed.includes(n as BackendName);

// The flag that only the other backend takes
const otherFlag: {[name in BackendName]: string} = {
  bridge: 'data-dir',
  docker: 'url',
};

/** Select the backend of a command

  The --backend flag comes first, then the POLARLN_BACKEND environment
  variable, then the bridge. An empty value is the same as no value.

  {
    env: {<Environment Variable Name String>: <Value String>}
    values: {<Global Flag Name String>: <Flag Value>}
  }

  @throws <PolarError>

  @returns
  {
    backend: <Backend Name String>
    from: <Backend Source String>
  }
*/
export default (args: {
  env: {[name: string]: string | undefined};
  values: Values;
}): SelectBackendResult => {
  const value = args.values.backend;
  const envValue = args.env[env];

  // A --backend flag without a value gives true
  if (value !== undefined && value !== '' && !isName(value)) {
    throw [
      400,
      'ExpectedAllowedValueForFlag',
      {allowed, flag, value},
    ] satisfies PolarError;
  }

  if (!value && !!envValue && !isName(envValue)) {
    throw [
      400,
      'ExpectedAllowedValueForEnv',
      {allowed, env, value: envValue},
    ] satisfies PolarError;
  }

  const selected: SelectBackendResult = isName(value)
    ? {backend: value, from: flag}
    : isName(envValue)
      ? {backend: envValue, from: env}
      : {backend: 'bridge', from: 'default'};

  const other = otherFlag[selected.backend];

  if (args.values[other] !== undefined) {
    throw [
      400,
      'UnexpectedFlagForBackend',
      {backend: selected.backend, flag: `--${other}`, from: selected.from},
    ] satisfies PolarError;
  }

  return selected;
};
