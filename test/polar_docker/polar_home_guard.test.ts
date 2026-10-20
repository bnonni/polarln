import {deepStrictEqual} from 'node:assert/strict';
import {equal} from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync} from 'node:fs';
import {readFileSync} from 'node:fs';
import {writeFileSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {mkdtemp} from 'node:fs/promises';
import {readFile} from 'node:fs/promises';
import {readdir} from 'node:fs/promises';
import {rm} from 'node:fs/promises';
import {writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import type {AddressInfo} from 'node:net';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {relative} from 'node:path';
import test from 'node:test';

import type {Network} from '../../src/index.js';
import type {PolarAppCheck} from '../../src/polar_app/check_polar_app.js';
import dataFolder from '../../src/polar_docker/data_folder.js';
import type {CheckApp} from '../../src/polar_docker/data_folder.js';
import {dockerToolNames} from '../../src/polar_docker/docker_tool_names.js';
import {readToolNames} from '../../src/polar_docker/docker_tool_names.js';
import executeTool from '../../src/polar_docker/execute_tool.js';
import makePolarDocker from '../../src/polar_docker/make_polar_docker.js';
import type {DockerCall} from '../fixtures/fake_docker_runner.js';
import {fakeDockerRunner} from '../fixtures/fake_docker_runner.js';
import {withPolarHome} from '../fixtures/polar_home.js';
import {rejection} from '../fixtures/rejection.js';

const hint =
  'The Polar app runs. polarln does not change the Polar files while the ' +
  'app runs. Use --backend bridge, or quit the app.';

const bridge: PolarAppCheck = {
  found: 'bridge',
  runs: true,
  url: 'http://localhost:37373',
};

// Arguments for each tool (the guard refuses before the tool reads them).
// There is no network 99, so a tool that runs by error cannot start nodes.
const toolArgs = {
  name: 'renamed',
  networkId: 99,
  newName: 'zed',
  nodeName: 'alice',
  oldName: 'alice',
};

const readTools: readonly string[] = readToolNames;

const writeTools = dockerToolNames.filter(n => !readTools.includes(n));

// Get a fake app check that gives the results in order, and then the last
const fakeCheckApp = (...results: (PolarAppCheck | Error)[]) => {
  const calls: number[] = [];

  const checkApp: CheckApp = async () => {
    const result = results[Math.min(calls.length, results.length - 1)];

    calls.push(calls.length);

    if (result instanceof Error) {
      throw result;
    }

    return result;
  };

  return {calls, checkApp};
};

// Make the backend with a fake docker runner. The fixture has the Polar
// names, so a test must never run the docker program on it.
const makeBackend = (args: {
  checkApp?: CheckApp;
  dataDir: string;
  env?: NodeJS.ProcessEnv;
  home: string;
  respond?: (call: DockerCall) => string | undefined;
}) => {
  const {calls, docker} = fakeDockerRunner({respond: args.respond});

  const {polar} = makePolarDocker({
    checkApp: args.checkApp,
    dataDir: args.dataDir,
    docker,
    env: args.env || {},
    home: args.home,
  });

  return {calls, polar};
};

// Get the sha256 of each file in a folder
const snapshot = async (dir: string) => {
  const entries = await readdir(dir, {recursive: true, withFileTypes: true});

  const files = entries
    .filter(n => n.isFile())
    .map(n => join(n.parentPath, n.name))
    .sort();

  const hashes: [string, string][] = [];

  for (const file of files) {
    const hash = createHash('sha256').update(await readFile(file));

    hashes.push([relative(dir, file), hash.digest('hex')]);
  }

  return hashes;
};

test('The read list has 16 tools, and 14 tools get the guard', () => {
  equal(readToolNames.length, 16, 'Got 16 read tools');

  deepStrictEqual(
    writeTools,
    [
      'add_node',
      'create_network',
      'delete_network',
      'remove_node',
      'rename_network',
      'rename_node',
      'restart_node',
      'set_auto_mine_mode',
      'set_lightning_backend',
      'start_network',
      'start_node',
      'stop_network',
      'stop_node',
      'update_node_command',
    ],
    'Got the 14 tools that change files or containers',
  );
});

test('Each tool that changes files refuses while the Polar app runs', () => {
  return withPolarHome(async ({dataDir, home}) => {
    const app = fakeCheckApp(bridge);

    const {calls, polar} = makeBackend({checkApp: app.checkApp, dataDir, home});

    const before = await snapshot(home);

    for (const tool of writeTools) {
      deepStrictEqual(
        await rejection(polar.execute(tool, toolArgs)),
        [
          409,
          'PolarAppIsRunning',
          {
            dataDir,
            found: 'bridge',
            hint,
            stage: 'before-tool',
            url: bridge.url,
          },
        ],
        `${tool} gives the error`,
      );
    }

    deepStrictEqual(app.calls.length, 14, 'Each tool checked the app');
    deepStrictEqual(calls, [], 'No docker command ran');
    deepStrictEqual(await snapshot(home), before, 'The files are the same');
  });
});

test('A Polar process gives its process id', () => {
  return withPolarHome(async ({dataDir, file, home}) => {
    const {checkApp} = fakeCheckApp({found: 'process', pid: 4242, runs: true});

    const {calls, polar} = makeBackend({checkApp, dataDir, home});

    const before = await readFile(file, 'utf8');

    deepStrictEqual(
      await rejection(polar.execute('stop_network', {networkId: 1})),
      [
        409,
        'PolarAppIsRunning',
        {dataDir, found: 'process', hint, pid: 4242, stage: 'before-tool'},
      ],
      'Got the process',
    );

    deepStrictEqual(calls, [], 'No docker command ran');
    equal(await readFile(file, 'utf8'), before, 'The file is the same');
  });
});

test('The read tools run while the Polar app runs', () => {
  return withPolarHome(async ({dataDir, home}) => {
    const app = fakeCheckApp(bridge);
    const ran: string[] = [];

    // Fake tools, so that no tool connects to a node
    const tools = Object.fromEntries(
      dockerToolNames.map(name => [
        name,
        async () => {
          ran.push(name);

          return {name};
        },
      ]),
    );

    const folder = dataFolder({
      checkApp: app.checkApp,
      dataDir,
      docker: fakeDockerRunner().docker,
      isPolarHome: true,
    });

    for (const tool of readTools) {
      deepStrictEqual(
        await executeTool({args: {}, folder, tool, tools}),
        {name: tool},
        `${tool} runs`,
      );
    }

    deepStrictEqual(app.calls, [], 'No read tool checked the app');

    for (const tool of writeTools) {
      const err = await rejection(executeTool({args: {}, folder, tool, tools}));

      equal((err as unknown[])[1], 'PolarAppIsRunning', `${tool} is refused`);
    }

    deepStrictEqual(ran, readTools, 'Only the read tools ran');

    // The read tools with no node connection also run with the real tools
    const {polar} = makeBackend({checkApp: app.checkApp, dataDir, home});

    const {networks} = (await polar.execute('list_networks', {})) as {
      networks: Network[];
    };

    deepStrictEqual(
      networks.map(n => [n.id, n.status]),
      [
        [1, 'Stopped'],
        [2, 'Stopped'],
        [3, 'Stopped'],
      ],
      'Got the networks',
    );

    await polar.execute('list_node_versions', {});
    await polar.execute('get_default_node_command', {implementation: 'LND'});

    equal(app.calls.length, 14, 'Only the 14 write tools checked the app');
  });
});

test('An app check with no clear result gives 503', () => {
  return withPolarHome(async ({dataDir, file, home}) => {
    const err = new Error('The Polar process check gave no clear result');

    const {checkApp} = fakeCheckApp(err);

    const {polar} = makeBackend({checkApp, dataDir, home});

    const before = await readFile(file, 'utf8');

    deepStrictEqual(
      await rejection(
        polar.execute('rename_network', {name: 'x', networkId: 1}),
      ),
      [503, 'FailedToCheckPolarApp', {dataDir, err}],
      'Got the error',
    );

    equal(await readFile(file, 'utf8'), before, 'The file is the same');
  });
});

test('A Polar home folder with no app check refuses each change', async () => {
  // The check does not touch the folder, so the folder does not have to exist
  const dataDir = join(tmpdir(), 'polarln-no-app-check');
  const {docker} = fakeDockerRunner();

  const polarHome = dataFolder({dataDir, docker, isPolarHome: true});
  const other = dataFolder({dataDir, docker});

  const [code, message, details] = (await rejection(
    polarHome.assertAppOff({stage: 'before-save'}),
  )) as [number, string, {dataDir: string; err: Error}];

  deepStrictEqual(
    [code, message, details.dataDir, details.err.message],
    [
      503,
      'FailedToCheckPolarApp',
      dataDir,
      'The data folder has no Polar app check',
    ],
    'The Polar home fails closed',
  );

  equal(
    await other.assertAppOff({stage: 'before-save'}),
    undefined,
    'A different folder needs no app check',
  );
});

test('The save checks the Polar app again', () => {
  return withPolarHome(async ({dataDir, file, home}) => {
    const app = fakeCheckApp({runs: false}, bridge);

    const {polar} = makeBackend({checkApp: app.checkApp, dataDir, home});

    const before = await readFile(file, 'utf8');

    deepStrictEqual(
      await rejection(
        polar.execute('rename_network', {name: 'x', networkId: 1}),
      ),
      [
        409,
        'PolarAppIsRunning',
        {dataDir, found: 'bridge', hint, stage: 'before-save', url: bridge.url},
      ],
      'The save is refused',
    );

    deepStrictEqual(app.calls, [0, 1], 'The app check ran 2 times');
    equal(await readFile(file, 'utf8'), before, 'The file is the same');

    deepStrictEqual(
      (await readdir(join(dataDir, 'networks'))).sort(),
      ['1', '2', '3', 'networks.json'],
      'No temporary file and no lock stay',
    );
  });
});

test('A network delete checks the Polar app before the folder delete', () => {
  return withPolarHome(async ({dataDir, file, home}) => {
    const app = fakeCheckApp({runs: false}, bridge);

    const {polar} = makeBackend({checkApp: app.checkApp, dataDir, home});

    const before = await snapshot(join(dataDir, 'networks'));

    deepStrictEqual(
      await rejection(polar.execute('delete_network', {networkId: 1})),
      [
        409,
        'PolarAppIsRunning',
        {
          dataDir,
          found: 'bridge',
          hint,
          stage: 'before-delete',
          url: bridge.url,
        },
      ],
      'The delete is refused',
    );

    deepStrictEqual(
      await snapshot(join(dataDir, 'networks')),
      before,
      'The network folder and the file are the same',
    );

    equal(existsSync(file), true, 'The file is there');
  });
});

test('A node rename checks the Polar app before the folder move', () => {
  return withPolarHome(async ({dataDir, home}) => {
    // A compose config call gets the node names, so the services match
    let services = '';

    const respond = (call: DockerCall) =>
      call.args.includes('config') ? services : undefined;

    const maker = (checkApp: CheckApp) =>
      makeBackend({checkApp, dataDir, home, respond}).polar;

    // A network with only bitcoind and LND nodes
    const created = (await maker(fakeCheckApp({runs: false}).checkApp).execute(
      'create_network',
      {name: 'n'},
    )) as {network: Network};

    const {network} = created;
    const {bitcoin, lightning} = network.nodes;

    services = [...bitcoin, ...lightning].map(n => n.name).join('\n');

    const alice = join(network.path, 'volumes', 'lnd', 'alice');

    await mkdir(alice, {recursive: true});
    await writeFile(join(alice, 'tls.cert'), 'cert');
    await writeFile(join(alice, 'tls.key'), 'key');

    const before = await snapshot(join(dataDir, 'networks'));

    const renames = fakeCheckApp({runs: false}, bridge);

    deepStrictEqual(
      await rejection(
        maker(renames.checkApp).execute('rename_node', {
          networkId: network.id,
          newName: 'zed',
          oldName: 'alice',
        }),
      ),
      [
        409,
        'PolarAppIsRunning',
        {
          dataDir,
          found: 'bridge',
          hint,
          stage: 'before-delete',
          url: bridge.url,
        },
      ],
      'The rename is refused',
    );

    deepStrictEqual(
      await snapshot(join(dataDir, 'networks')),
      before,
      'The node folder, the TLS files, and the file are the same',
    );
  });
});

test('A write tool on a file of a different version changes nothing', () => {
  return withPolarHome(async ({dataDir, file, home}) => {
    const json = JSON.parse(await readFile(file, 'utf8'));

    json.version = '3.2.0';

    await writeFile(file, JSON.stringify(json, null, 2));

    const {checkApp} = fakeCheckApp({runs: false});

    const {polar} = makeBackend({checkApp, dataDir, home});

    const before = await snapshot(join(dataDir, 'networks'));

    deepStrictEqual(
      await rejection(polar.execute('delete_network', {networkId: 1})),
      [
        501,
        'PolarToolNotSupported',
        {
          err: 'polarDocker does not support the networks file version "3.2.0" (only 4.0.0)',
          tool: 'delete_network',
        },
      ],
      'Got the error',
    );

    deepStrictEqual(
      await snapshot(join(dataDir, 'networks')),
      before,
      'The network folder and the file are the same',
    );
  });
});

test('A folder that is not the Polar home never checks the Polar app', async () => {
  const dataDir = await mkdtemp(join(tmpdir(), 'polarln-docker-'));

  try {
    const app = fakeCheckApp(bridge);

    const {polar} = makeBackend({
      checkApp: app.checkApp,
      dataDir,
      home: join(dataDir, 'home'),
    });

    await polar.execute('create_network', {name: 'n'});
    await polar.execute('rename_network', {name: 'm', networkId: 1});
    await polar.execute('set_auto_mine_mode', {mode: 0, networkId: 1});
    await polar.execute('delete_network', {networkId: 1});

    deepStrictEqual(app.calls, [], 'No app check ran');
  } finally {
    await rm(dataDir, {force: true, recursive: true});
  }
});

test('The default app check probes the bridge port of the environment', () => {
  return withPolarHome(async ({dataDir, file, home}) => {
    const server = createServer((_, res) => {
      res.writeHead(200, {'content-type': 'application/json'});
      res.end(JSON.stringify({status: 'ok', service: 'polar-mcp-bridge'}));
    });

    await new Promise<void>(resolve => server.listen(0, 'localhost', resolve));

    const {port} = server.address() as AddressInfo;

    try {
      const {calls, polar} = makeBackend({
        dataDir,
        env: {POLAR_MCP_PORT: String(port)},
        home,
      });

      const before = await readFile(file, 'utf8');

      deepStrictEqual(
        await rejection(polar.execute('stop_network', {networkId: 1})),
        [
          409,
          'PolarAppIsRunning',
          {
            dataDir,
            found: 'bridge',
            hint,
            stage: 'before-tool',
            url: `http://localhost:${port}`,
          },
        ],
        'Got the bridge of the environment port',
      );

      deepStrictEqual(calls, [], 'No docker command ran');
      equal(await readFile(file, 'utf8'), before, 'The file is the same');
    } finally {
      server.closeAllConnections();

      await new Promise(resolve => server.close(resolve));
    }
  });
});

// Get an app check that finds no app, and runs a step at the call with the
// index (0 is the call before the tool)
const stepCheckApp = (index: number, step: () => Promise<void>) => {
  let calls = 0;

  const checkApp: CheckApp = async () => {
    if (calls++ === index) {
      await step();
    }

    return {runs: false};
  };

  return checkApp;
};

// Make a network with only bitcoind and LND nodes, with the TLS files of
// alice. The responder gives the node names for a compose config call.
const makeLndNetwork = async (args: {dataDir: string; home: string}) => {
  const {polar} = makeBackend({
    checkApp: fakeCheckApp({runs: false}).checkApp,
    dataDir: args.dataDir,
    home: args.home,
  });

  const {network} = (await polar.execute('create_network', {
    name: 'n',
  })) as {network: Network};

  const {bitcoin, lightning} = network.nodes;
  const services = [...bitcoin, ...lightning].map(n => n.name).join('\n');

  const alice = join(network.path, 'volumes', 'lnd', 'alice');

  await mkdir(alice, {recursive: true});
  await writeFile(join(alice, 'tls.cert'), 'cert');
  await writeFile(join(alice, 'tls.key'), 'key');

  const respond = (call: DockerCall) =>
    call.args.includes('config') ? services : undefined;

  return {network, respond};
};

// Change the networks file to a version that polarDocker cannot write
const writeOtherVersion = (file: string) => {
  const json = JSON.parse(readFileSync(file, 'utf8'));

  json.version = '3.2.0';

  writeFileSync(file, JSON.stringify(json, null, 2));
};

const otherVersion = (tool: string) => [
  501,
  'PolarToolNotSupported',
  {
    err: 'polarDocker does not support the networks file version "3.2.0" (only 4.0.0)',
    tool,
  },
];

test('A busy lock at the save of a node rename keeps the node folder', () => {
  return withPolarHome(async ({dataDir, home}) => {
    const {network, respond} = await makeLndNetwork({dataDir, home});
    const networks = join(dataDir, 'networks');

    let before: unknown;

    // A different change holds the lock after the check before the move
    const checkApp = stepCheckApp(1, async () => {
      await mkdir(join(networks, 'networks.json.lock'));

      before = await snapshot(networks);
    });

    const {polar} = makeBackend({checkApp, dataDir, home, respond});

    deepStrictEqual(
      await rejection(
        polar.execute('rename_node', {
          networkId: network.id,
          newName: 'zed',
          oldName: 'alice',
        }),
      ),
      [409, 'NetworksFileBusy', {dataDir}],
      'The save is refused',
    );

    deepStrictEqual(
      await snapshot(networks),
      before,
      'The node folder, the TLS files, the compose file, and the file stay',
    );
  });
});

test('A different file version at the save of a delete keeps the folder', () => {
  return withPolarHome(async ({dataDir, file, home}) => {
    const networks = join(dataDir, 'networks');

    let before: unknown;

    // A different process writes the file after the check before the tool
    const checkApp = stepCheckApp(1, async () => {
      writeOtherVersion(file);

      before = await snapshot(networks);
    });

    const {polar} = makeBackend({checkApp, dataDir, home});

    deepStrictEqual(
      await rejection(polar.execute('delete_network', {networkId: 1})),
      otherVersion('delete_network'),
      'The save is refused',
    );

    deepStrictEqual(
      await snapshot(networks),
      before,
      'The network folder and the file stay',
    );
  });
});

test('The app check of a delete save comes before the folder delete', () => {
  return withPolarHome(async ({dataDir, home}) => {
    const networks = join(dataDir, 'networks');
    const app = fakeCheckApp({runs: false}, {runs: false}, bridge);

    const {polar} = makeBackend({checkApp: app.checkApp, dataDir, home});

    const before = await snapshot(networks);

    deepStrictEqual(
      await rejection(polar.execute('delete_network', {networkId: 1})),
      [
        409,
        'PolarAppIsRunning',
        {dataDir, found: 'bridge', hint, stage: 'before-save', url: bridge.url},
      ],
      'The save is refused',
    );

    deepStrictEqual(
      await snapshot(networks),
      before,
      'The network folder and the file stay',
    );
  });
});

test('A different file version at the save of a node removal keeps the node', () => {
  return withPolarHome(async ({dataDir, file, home}) => {
    const created = await makeLndNetwork({dataDir, home});
    const {network} = created;

    // alice runs, so the tool removes its container before the save
    const json = JSON.parse(await readFile(file, 'utf8'));

    json.networks
      .find((n: Network) => n.id === network.id)
      .nodes.lightning.find(
        (n: {name: string}) => n.name === 'alice',
      ).status = 1;

    await writeFile(file, JSON.stringify(json, null, 2));

    const folder = await snapshot(network.path);

    let written = '';

    // A different process writes the file during the container stop
    const respond = (call: DockerCall) => {
      if (call.args.includes('stop')) {
        writeOtherVersion(file);

        written = readFileSync(file, 'utf8');
      }

      return created.respond(call);
    };

    const {polar} = makeBackend({
      checkApp: fakeCheckApp({runs: false}).checkApp,
      dataDir,
      home,
      respond,
    });

    deepStrictEqual(
      await rejection(
        polar.execute('remove_node', {
          networkId: network.id,
          nodeName: 'alice',
        }),
      ),
      otherVersion('remove_node'),
      'The save is refused',
    );

    deepStrictEqual(
      await snapshot(network.path),
      folder,
      'The compose file and the node folder stay',
    );

    equal(await readFile(file, 'utf8'), written, 'The file is the same');
  });
});
