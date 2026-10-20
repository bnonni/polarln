import type {PolarError} from '../typescript/index.js';

/** Backend Choices of the CLI (auto selects the bridge or docker) */
export const backendNames = ['auto', 'bridge', 'docker'] as const;

export type BackendChoice = (typeof backendNames)[number];

/** Backends That Run a Command */
export type BackendName = Exclude<BackendChoice, 'auto'>;

export type BackendSource =
  | '--backend'
  | '--data-dir'
  | '--url'
  | 'POLARLN_BACKEND'
  | 'default';

export type SelectBackendResult = {
  /** Backend Choice */
  backend: BackendChoice;
  /** Source of the Backend Choice */
  from: BackendSource;
};

type Values = {[flag: string]: boolean | string | undefined};

const allowed = [...backendNames];
const env = 'POLARLN_BACKEND';
const flag = '--backend';
const isName = (n: unknown): n is BackendChoice =>
  allowed.includes(n as BackendChoice);

// The flag that only the other backend takes
const otherFlag: {[name in BackendName]: string} = {
  bridge: 'data-dir',
  docker: 'url',
};

/** Select the backend of a command

  The --backend flag comes first, then the POLARLN_BACKEND environment
  variable, then auto. An empty value is the same as no value.

  Under auto, a --url flag selects the bridge, and a --data-dir flag selects
  docker. A flag with an empty value or with no value is the same as no
  flag. With neither flag, the result stays auto, and the CLI probes the
  Polar bridge. The POLARLN_DATA_DIR environment variable does not select
  docker.

  The bridge does not take --data-dir, and docker does not take --url. If
  --backend or POLARLN_BACKEND selects the backend, the flag of the other
  backend is an error, also with an empty value.

  {
    env: {<Environment Variable Name String>: <Value String>}
    values: {<Global Flag Name String>: <Flag Value>}
  }

  @throws <PolarError>

  @returns
  {
    backend: <Backend Choice String> // auto, bridge, or docker
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

  const chosen: SelectBackendResult = isName(value)
    ? {backend: value, from: flag}
    : isName(envValue)
      ? {backend: envValue, from: env}
      : {backend: 'auto', from: 'default'};

  // Under auto, an empty flag or a flag with no value is the same as no flag
  const isSet = (name: string) => {
    const flagValue = args.values[name];

    return chosen.backend === 'auto'
      ? typeof flagValue === 'string' && !!flagValue
      : flagValue !== undefined;
  };

  // Under auto, the flag of a backend shows the intent to use that backend
  const selected: SelectBackendResult =
    chosen.backend !== 'auto'
      ? chosen
      : isSet('url')
        ? {backend: 'bridge', from: '--url'}
        : isSet('data-dir')
          ? {backend: 'docker', from: '--data-dir'}
          : chosen;

  if (selected.backend === 'auto') {
    return selected;
  }

  const other = otherFlag[selected.backend];

  if (isSet(other)) {
    throw [
      400,
      'UnexpectedFlagForBackend',
      {backend: selected.backend, flag: `--${other}`, from: selected.from},
    ] satisfies PolarError;
  }

  return selected;
};
