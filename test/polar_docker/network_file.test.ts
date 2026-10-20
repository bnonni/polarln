import {deepStrictEqual} from 'node:assert/strict';
import {equal} from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdirSync} from 'node:fs';
import {readFileSync} from 'node:fs';
import {rmSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {mkdtemp} from 'node:fs/promises';
import {readFile} from 'node:fs/promises';
import {readdir} from 'node:fs/promises';
import {rm} from 'node:fs/promises';
import {writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';

import type {Network} from '../../src/index.js';
import dataFolder from '../../src/polar_docker/data_folder.js';
import type {DataFolder} from '../../src/polar_docker/data_folder.js';
import executeTool from '../../src/polar_docker/execute_tool.js';
import {changeNetworks} from '../../src/polar_docker/network_file.js';
import {networkById} from '../../src/polar_docker/network_file.js';
import {saveNetwork} from '../../src/polar_docker/network_file.js';
import {withPolarHome} from '../fixtures/polar_home.js';
import {rejection} from '../fixtures/rejection.js';
import {spyOnSync} from '../fixtures/sync_spy.js';

// A data folder with no docker runner calls and no Polar app check
const folderOf = (args: {
  dataDir: string;
  isPolarHome?: boolean;
}): DataFolder => ({
  ...dataFolder({
    dataDir: args.dataDir,
    docker: async () => {
      throw new Error('UnexpectedDockerCall');
    },
  }),
  isPolarHome: !!args.isPolarHome,
});

const listNetworks = async (folder: DataFolder) => {
  const result = await executeTool({args: {}, folder, tool: 'list_networks'});

  return (result as {networks: Network[]}).networks;
};

const renameNetwork = (folder: DataFolder, networkId: number, name: string) =>
  executeTool({args: {name, networkId}, folder, tool: 'rename_network'});

// Change the networks file as JSON, in the Polar layout
const editFile = async (path: string, edit: (file: any) => void) => {
  const file = JSON.parse(await readFile(path, 'utf8'));

  edit(file);

  await writeFile(path, JSON.stringify(file, null, 2));
};

const statusesOf = (network: {nodes: Network['nodes']; status: unknown}) => [
  network.status,
  ...network.nodes.bitcoin.map(n => n.status),
  ...network.nodes.lightning.map(n => n.status),
  ...network.nodes.tap.map(n => n.status),
];

const withDataDir = async (use: (dataDir: string) => Promise<void>) => {
  const dataDir = await mkdtemp(join(tmpdir(), 'polarln-docker-'));

  try {
    await use(dataDir);
  } finally {
    await rm(dataDir, {force: true, recursive: true});
  }
};

test('Results show status labels, and the file keeps numbers', () => {
  return withPolarHome(async ({dataDir, file}) => {
    const folder = folderOf({dataDir});

    const networks = await listNetworks(folder);

    deepStrictEqual(
      networks.map(statusesOf),
      [
        ['Stopped', 'Stopped', 'Stopped', 'Stopped'],
        ['Stopped', 'Stopped', 'Stopped', 'Stopped'],
        ['Stopped', 'Stopped', 'Stopped'],
      ],
      'Got the labels',
    );

    const renamed = await renameNetwork(folder, 1, 'renamed');

    deepStrictEqual(
      statusesOf((renamed as {network: Network}).network),
      ['Stopped', 'Stopped', 'Stopped', 'Stopped'],
      'The result has the labels',
    );

    const saved = JSON.parse(await readFile(file, 'utf8'));

    deepStrictEqual(
      [saved.networks[0].name, saved.networks.map(statusesOf)],
      [
        'renamed',
        [
          [3, 3, 3, 3],
          [3, 3, 3, 3],
          [3, 3, 3],
        ],
      ],
      'The file has the numbers',
    );
  });
});

test('Each Polar status number gets its label', () => {
  return withPolarHome(async ({dataDir, file}) => {
    const folder = folderOf({dataDir});

    await editFile(file, json => {
      const [one, two, three] = json.networks;

      one.status = 0;
      one.nodes.bitcoin[0].status = 1;
      one.nodes.lightning[0].status = 2;
      one.nodes.tap[0].status = 3;
      two.status = 4;
      three.simulation = {activity: [], status: 4, errorMsg: 'e'};

      // A file from before Polar v2.0.0 has no tap nodes
      delete three.nodes.tap;
    });

    const [one, two, three] = await listNetworks(folder);

    deepStrictEqual(
      [statusesOf(one), two.status, three.simulation, three.nodes.tap],
      [
        ['Starting', 'Started', 'Stopping', 'Stopped'],
        'Error',
        {activity: [], status: 'Error', errorMsg: 'e'},
        [],
      ],
      'Got the labels',
    );

    await renameNetwork(folder, 2, 'renamed');

    const saved = JSON.parse(await readFile(file, 'utf8'));

    deepStrictEqual(
      [
        statusesOf(saved.networks[0]),
        saved.networks[1].status,
        saved.networks[2].simulation.status,
        saved.networks[2].nodes.tap,
      ],
      [[0, 1, 2, 3], 4, 4, []],
      'The file has the numbers again',
    );
  });
});

test('A change with no effect gives the same bytes', () => {
  return withPolarHome(async ({dataDir, file}) => {
    const folder = folderOf({dataDir});
    const before = await readFile(file, 'utf8');

    await changeNetworks({change: () => {}, folder});

    equal(await readFile(file, 'utf8'), before, 'No change');

    await saveNetwork({folder, network: await networkById({folder, id: 1})});

    equal(await readFile(file, 'utf8'), before, 'A network save is the same');

    await renameNetwork(folder, 2, 'litd-net');

    equal(await readFile(file, 'utf8'), before, 'A tool save is the same');

    equal(before.endsWith('}'), true, 'The file has no end newline');
  });
});

test('Charts, key order, and unknown keys stay', () => {
  return withPolarHome(async ({dataDir, file}) => {
    const folder = folderOf({dataDir});

    // Polar does not write a top-level key that it does not know
    await editFile(file, json => (json.fixtureFileKey = 'kept'));

    const before = await readFile(file, 'utf8');

    await renameNetwork(folder, 2, 'renamed');

    const after = await readFile(file, 'utf8');

    equal(
      after,
      before.replace('"name": "litd-net"', '"name": "renamed"'),
      'Only the name changed',
    );

    const saved = JSON.parse(after);

    deepStrictEqual(
      [
        Object.keys(saved),
        saved.networks[0].fixtureNetworkKey,
        saved.networks[0].nodes.tap[0].fixtureNodeKey,
        Object.keys(saved.charts),
      ],
      [
        ['version', 'networks', 'charts', 'fixtureFileKey'],
        {kept: true},
        'kept',
        ['1', '2', '3'],
      ],
      'Got the keys',
    );
  });
});

test('A file with a different version can be read, but not written', () => {
  return withPolarHome(async ({dataDir, file}) => {
    const folder = folderOf({dataDir});

    await editFile(file, json => (json.version = '3.2.0'));

    const before = await readFile(file, 'utf8');

    deepStrictEqual(
      (await listNetworks(folder)).map(n => n.name),
      ['tapd-net', 'litd-net', 'electrs-net'],
      'Got the networks',
    );

    deepStrictEqual(
      await rejection(renameNetwork(folder, 1, 'renamed')),
      [
        501,
        'PolarToolNotSupported',
        {
          err: 'polarDocker does not support the networks file version "3.2.0" (only 4.0.0)',
          tool: 'rename_network',
        },
      ],
      'Got the error',
    );

    equal(await readFile(file, 'utf8'), before, 'The file did not change');
  });
});

test('A status that is not a Polar status cannot be written', () => {
  return withPolarHome(async ({dataDir, file}) => {
    const folder = folderOf({dataDir});

    await editFile(
      file,
      json => (json.networks[0].nodes.bitcoin[0].status = 7),
    );

    const before = await readFile(file, 'utf8');

    const [network] = await listNetworks(folder);

    equal(network.nodes.bitcoin[0].status, 7, 'The number stays as it is');

    deepStrictEqual(
      await rejection(renameNetwork(folder, 2, 'renamed')),
      [
        501,
        'PolarToolNotSupported',
        {
          err: 'polarDocker does not support the status 7 in network 1',
          tool: 'rename_network',
        },
      ],
      'Got the error',
    );

    equal(await readFile(file, 'utf8'), before, 'The file did not change');
  });
});

test('A file that is not a networks file gives 503 and does not change', () => {
  return withPolarHome(async ({dataDir, file}) => {
    const folder = folderOf({dataDir});

    await writeFile(file, '{"version": "4.0.0", "networks": [');

    const [code, message, details] = (await rejection(
      listNetworks(folder),
    )) as [number, string, {err: string; path: string}];

    deepStrictEqual(
      [code, message, typeof details.err, details.path],
      [503, 'FailedToReadNetworksFile', 'string', file],
      'Got the parse error',
    );

    deepStrictEqual(
      ((await rejection(renameNetwork(folder, 1, 'renamed'))) as []).slice(
        0,
        2,
      ),
      [503, 'FailedToReadNetworksFile'],
      'A write gets the parse error',
    );

    equal(
      await readFile(file, 'utf8'),
      '{"version": "4.0.0", "networks": [',
      'The file did not change',
    );

    await writeFile(file, '{"version": "4.0.0"}');

    deepStrictEqual(
      await rejection(changeNetworks({change: () => {}, folder})),
      [
        503,
        'FailedToReadNetworksFile',
        {err: 'The file has no networks array', path: file},
      ],
      'Got the error for no networks',
    );

    const noNodes = {
      err: 'A network has no node arrays, or a node is not an object',
      path: file,
    };

    await writeFile(file, '{"version": "4.0.0", "networks": [{"id": 1}]}');

    deepStrictEqual(
      await rejection(listNetworks(folder)),
      [503, 'FailedToReadNetworksFile', noNodes],
      'Got the error for no nodes',
    );

    equal(
      await readFile(file, 'utf8'),
      '{"version": "4.0.0", "networks": [{"id": 1}]}',
      'The file did not change',
    );

    const nullNode = JSON.stringify({
      version: '4.0.0',
      networks: [{id: 1, nodes: {bitcoin: [null], lightning: []}}],
    });

    await writeFile(file, nullNode);

    deepStrictEqual(
      await rejection(renameNetwork(folder, 1, 'renamed')),
      [503, 'FailedToReadNetworksFile', noNodes],
      'Got the error for a node that is not an object',
    );

    equal(await readFile(file, 'utf8'), nullNode, 'The file did not change');
  });
});

test('A missing file gives the Polar version and empty charts', () => {
  return withDataDir(async dataDir => {
    const folder = folderOf({dataDir});

    deepStrictEqual(await listNetworks(folder), [], 'No networks');

    await changeNetworks({change: () => {}, folder});

    equal(
      await readFile(join(dataDir, 'networks', 'networks.json'), 'utf8'),
      '{\n  "version": "4.0.0",\n  "networks": [],\n  "charts": {}\n}',
      'Got a new file in the Polar layout',
    );
  });
});

test('A missing file next to network folders in the Polar home gives 503', () => {
  return withDataDir(async dataDir => {
    const file = join(dataDir, 'networks', 'networks.json');

    await mkdir(join(dataDir, 'networks', '3'), {recursive: true});

    deepStrictEqual(
      await rejection(
        changeNetworks({
          change: () => {},
          folder: folderOf({dataDir, isPolarHome: true}),
        }),
      ),
      [
        503,
        'FailedToReadNetworksFile',
        {
          err: 'The networks file is not there, but the network folders are',
          path: file,
        },
      ],
      'Got the error',
    );

    equal(existsSync(file), false, 'No new file');

    await changeNetworks({change: () => {}, folder: folderOf({dataDir})});

    equal(existsSync(file), true, 'A different folder gets a new file');
  });
});

test('No temporary file stays after a change', () => {
  return withPolarHome(async ({dataDir, file}) => {
    const folder = folderOf({dataDir});

    await renameNetwork(folder, 1, 'renamed');

    await editFile(file, json => (json.networks[0].status = 7));

    await rejection(renameNetwork(folder, 1, 'again'));

    await editFile(file, json => (json.networks[0].status = 3));

    // A folder in place of the file makes the rename of the new file fail
    const failed = await rejection(
      changeNetworks({
        change: () => {
          rmSync(file);
          mkdirSync(join(file, 'folder'), {recursive: true});
        },
        folder,
      }),
    );

    equal((failed as NodeJS.ErrnoException).syscall, 'rename', 'Got error');

    deepStrictEqual(
      (await readdir(join(dataDir, 'networks'))).filter(n =>
        n.endsWith('.tmp'),
      ),
      [],
      'No temporary file',
    );
  });
});

test('A change syncs the new file to the disk before the rename', () => {
  return withPolarHome(async ({dataDir, file}) => {
    const folder = folderOf({dataDir});
    const before = await readFile(file, 'utf8');

    // At each sync, get the name of the network in the file
    const names: string[] = [];

    const restore = await spyOnSync(() => {
      names.push(JSON.parse(readFileSync(file, 'utf8')).networks[0].name);
    });

    try {
      await renameNetwork(folder, 1, 'renamed');
    } finally {
      restore();
    }

    deepStrictEqual(
      names,
      [JSON.parse(before).networks[0].name, 'renamed'],
      'The new file syncs before the rename, and the folder after it',
    );
  });
});

test('A save effect runs just before the rename, and its failure keeps the file', () => {
  return withPolarHome(async ({dataDir, file}) => {
    const folder = folderOf({dataDir});
    const before = await readFile(file, 'utf8');

    let seen = '';

    await changeNetworks({
      change: networks => (networks[0].name = 'renamed'),
      effect: async () => {
        seen = await readFile(file, 'utf8');
      },
      folder,
    });

    equal(seen, before, 'The effect ran before the new file replaced it');

    const changed = await readFile(file, 'utf8');

    equal(JSON.parse(changed).networks[0].name, 'renamed', 'Got the change');

    const failed = await rejection(
      changeNetworks({
        change: networks => (networks[0].name = 'again'),
        effect: async () => {
          throw new Error('EffectFailed');
        },
        folder,
      }),
    );

    equal((failed as Error).message, 'EffectFailed', 'Got the error');
    equal(await readFile(file, 'utf8'), changed, 'The file is the same');

    deepStrictEqual(
      (await readdir(join(dataDir, 'networks'))).filter(n =>
        n.endsWith('.tmp'),
      ),
      [],
      'No temporary file',
    );
  });
});
