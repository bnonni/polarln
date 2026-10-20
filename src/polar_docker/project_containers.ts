import realPath from '../polar_app/real_path.js';
import type {Network} from '../typescript/index.js';
import type {PolarError} from '../typescript/index.js';
import type {DataFolder} from './data_folder.js';
import {containerName} from './node_names.js';
import {projectName} from './node_names.js';
import {composeError} from './run_compose.js';

/** Container of the Compose Project of a Network */
export type ProjectContainer = {
  /** Container Name */
  name: string;
  /** Container State (created, running, paused, restarting, exited, dead) */
  state: string;
};

type ListedContainer = ProjectContainer & {
  /** Compose Project Label */
  project: string;
  /** Compose Project Working Directory Label */
  workingDir: string;
};

// Each line is a JSON array, so that a label with a space or a tab is clear
const format = [
  '[{{json .Names}}',
  '{{json .State}}',
  '{{json (.Label "com.docker.compose.project")}}',
  '{{json (.Label "com.docker.compose.project.working_dir")}}]',
].join(',');

// A container in these states holds its published ports
const upStates = new Set(['paused', 'restarting', 'running']);

const isText = (value: unknown): value is string => typeof value === 'string';

// Get a container from a line of the docker ps output
const parseLine = (line: string): ListedContainer => {
  let row: unknown;

  try {
    row = JSON.parse(line);
  } catch {
    row = undefined;
  }

  if (!Array.isArray(row) || row.length !== 4 || !row.every(isText)) {
    throw new Error(`Unexpected docker ps output: ${line}`);
  }

  const [names, state, project, workingDir] = row;

  // A link alias has a slash, and the container name has none
  const all = names.split(',');
  const name = all.find(n => !n.includes('/')) || all[0];

  return {name, project, state, workingDir};
};

/** Check if the state of a container holds its published ports

  <Container State String> or undefined

  @returns
  <Container Is Up Bool>
*/
export const isUp = (state?: string) => !!state && upStates.has(state);

/** Get the containers of the compose project of a network

  One docker ps call gets the name, the state, the compose project, and the
  compose working directory of each container. A container is in the network
  if its project is <prefix>-network-<id> and its working directory is the
  network folder.

  Docker compose acts on the containers of a project name, and the container
  names must be unique. Thus the method refuses if a different folder uses
  the project name or the container name of a node. For example, a copy of a
  data folder must not stop or replace the containers of the original
  folder. Run this check before each docker compose command that changes
  containers.

  {
    folder: <Data Folder Object>
    network: <Network Object>
  }

  @throws
  [409, 'ContainerNameInUse', {container, project, workingDir}]
  <Error>

  @returns via Promise
  {
    containers: [<Network Container Object>]
    states: {<Node Name String>: <Container State String>}
  }
*/
export default async ({
  folder,
  network,
}: {
  folder: DataFolder;
  network: Network;
}) => {
  const {bitcoin, lightning, tap} = network.nodes;
  const nodes = [...bitcoin, ...lightning, ...tap];

  // runCompose gives docker compose the same project name
  const project = projectName(network, folder.prefix);
  const root = realPath(network.path);

  const nodeNames = new Map(
    nodes.map(n => [containerName(n, folder.prefix), n.name]),
  );

  let stdout: string;

  try {
    ({stdout} = await folder.docker(['ps', '-a', '--format', format], {}));
  } catch (err) {
    // The network folder exists, so a missing program means no Docker
    throw composeError({
      err: err as {message: string},
      hasDir: true,
      path: network.path,
    });
  }

  const listed = stdout
    .split('\n')
    .map(line => line.trim())
    .filter(line => !!line)
    .map(parseLine);

  // Only these containers need the real path of their working directory
  const named = listed.filter(c => {
    return c.project === project || nodeNames.has(c.name);
  });

  const containers: ProjectContainer[] = [];
  const states: {[name: string]: string} = {};

  named.forEach(container => {
    const isOwn =
      container.project === project &&
      !!container.workingDir &&
      realPath(container.workingDir) === root;

    if (!isOwn) {
      throw [
        409,
        'ContainerNameInUse',
        {
          container: container.name,
          project: container.project,
          workingDir: container.workingDir,
        },
      ] satisfies PolarError;
    }

    containers.push({name: container.name, state: container.state});

    const node = nodeNames.get(container.name);

    if (!!node) {
      states[node] = container.state;
    }
  });

  return {containers, states};
};
