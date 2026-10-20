import {execFile} from 'node:child_process';
import {readdir} from 'node:fs/promises';
import {readFile} from 'node:fs/promises';
import {readlink} from 'node:fs/promises';
import {basename} from 'node:path';
import {join} from 'node:path';
import {promisify} from 'node:util';

/** Result of the Polar Process Scan */
export type PolarProcessScan =
  | {pid: number; result: 'found'}
  | {result: 'none'}
  | {err: unknown; result: 'unknown'};

/** Arguments of the Polar Process Scan */
export type FindPolarProcessArgs = {
  /** Process Id to Skip (default: the own process id) */
  pid?: number;
  /** Platform Name (default: the platform of the process) */
  platform?: string;
  /** Path of the proc File System on Linux (default: /proc) */
  procRoot?: string;
  /** Get the Process Ids and Names on macOS (default: ps) */
  ps?: () => Promise<string>;
};

// The PID namespace of the host: the first PID namespace of Linux
const hostPidNamespace = 'pid:[4026531836]';

// The name of the Polar app process on Linux (/opt/polar/polar) and on macOS
const linuxName = 'polar';
const macName = 'Polar';

// Number of process names to read at the same time
const readsAtOnce = 32;

// A process that ends during the scan, or a process of a different user
const skipCodes = ['EACCES', 'ENOENT', 'EPERM', 'ESRCH'];

const run = promisify(execFile);

const unknown = (message: string): PolarProcessScan => ({
  err: new Error(message),
  result: 'unknown',
});

// Get the process ids and the program paths on macOS
const runPs = async () => {
  const {stdout} = await run('ps', ['-A', '-o', 'pid=,comm=']);

  return stdout;
};

// Get the name of a process, or undefined for a process to skip
const commOf = (procRoot: string, pid: number) =>
  readFile(join(procRoot, String(pid), 'comm'), 'utf8').catch(err => {
    if (skipCodes.includes((err as NodeJS.ErrnoException).code || '')) {
      return undefined;
    }

    throw err;
  });

// Scan the proc file system for a process with the Polar name
const scanProc = async (args: {
  pid: number;
  procRoot: string;
}): Promise<PolarProcessScan> => {
  const namespace = await readlink(join(args.procRoot, 'self', 'ns', 'pid'));

  // In a different PID namespace, the scan does not see the host processes
  if (namespace !== hostPidNamespace) {
    return unknown('A PID namespace hides the processes of the host');
  }

  const status = await readFile(join(args.procRoot, 'self', 'status'), 'utf8');

  const line = status.split('\n').find(n => n.startsWith('NSpid:'));

  if (!line) {
    return unknown('The process status has no NSpid line');
  }

  // More than 1 process id in the NSpid line also shows a PID namespace
  if (line.slice('NSpid:'.length).trim().split(/\s+/).length > 1) {
    return unknown('The NSpid line shows a PID namespace');
  }

  const pids = (await readdir(args.procRoot))
    .filter(n => /^\d+$/.test(n))
    .map(Number)
    .filter(n => n !== args.pid)
    .sort((a, b) => a - b);

  // Read some names at the same time, with a limit on the open files
  for (let start = 0; start < pids.length; start += readsAtOnce) {
    const group = pids.slice(start, start + readsAtOnce);

    const comms = await Promise.all(group.map(n => commOf(args.procRoot, n)));

    const index = comms.findIndex(n => n?.replace(/\n$/, '') === linuxName);

    if (index !== -1) {
      return {pid: group[index], result: 'found'};
    }
  }

  return {result: 'none'};
};

// Look in the ps output for a program with the Polar name
const scanPs = (args: {output: string; pid: number}): PolarProcessScan => {
  for (const line of args.output.split('\n')) {
    const match = /^\s*(\d+)\s+(.+)$/.exec(line);

    if (!match) {
      continue;
    }

    const pid = Number(match[1]);

    if (pid !== args.pid && basename(match[2].trim()) === macName) {
      return {pid, result: 'found'};
    }
  }

  return {result: 'none'};
};

/** Look for a process of the Polar app

  On Linux, the method reads the name of each process in /proc. The Polar
  process has the name polar. In a PID namespace, for example in a
  container, the method does not see the processes of the host, so the
  result is unknown. The own process is in a PID namespace if the
  /proc/self/ns/pid link is not pid:[4026531836] (the first PID namespace of
  Linux), or if the NSpid line of /proc/self/status has more than 1 value.

  On macOS, the method runs ps. The Polar program has the name Polar. This
  scan is not checked on a Mac.

  On a different platform, the result is unknown. Each failure to read the
  processes also gives an unknown result. The own process is not a result.

  {
    [pid]: <Process Id to Skip Number> // Default: process.pid
    [platform]: <Platform Name String> // Default: process.platform
    [procRoot]: <proc File System Path String> // Default: /proc
    [ps]: <Get the ps Output Function> // Default: ps -A -o pid=,comm=
  }

  @returns via Promise
  {
    [err]: <Error Object> // Only for an unknown result
    [pid]: <Polar Process Id Number> // Only for a found process
    result: <Scan Result String> // found, none, or unknown
  }
*/
export default async (
  args: FindPolarProcessArgs = {},
): Promise<PolarProcessScan> => {
  const pid = args.pid ?? process.pid;
  const platform = args.platform ?? process.platform;

  try {
    switch (platform) {
      case 'darwin':
        return scanPs({output: await (args.ps || runPs)(), pid});

      case 'linux':
        return await scanProc({pid, procRoot: args.procRoot ?? '/proc'});

      default:
        return unknown(`polarln cannot scan the processes on ${platform}`);
    }
  } catch (err) {
    return {err, result: 'unknown'};
  }
};
