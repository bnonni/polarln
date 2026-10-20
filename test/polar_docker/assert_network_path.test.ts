import {deepStrictEqual} from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {mkdtemp} from 'node:fs/promises';
import {realpath} from 'node:fs/promises';
import {rm} from 'node:fs/promises';
import {symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {sep} from 'node:path';
import test from 'node:test';

import assertNetworkPath from '../../src/polar_docker/assert_network_path.js';
import dataFolder from '../../src/polar_docker/data_folder.js';
import type {Network} from '../../src/typescript/index.js';

type Setup = {
  /** Folder of the Data Folder and the Other Folders */
  root: string;
  /** Data Directory Path */
  dataDir: string;
};

// Run a function with a data folder in a new temporary folder
const withRoot = async (use: (setup: Setup) => Promise<void>) => {
  const root = await realpath(
    await mkdtemp(join(tmpdir(), 'polarln-network-path-')),
  );

  try {
    await use({dataDir: join(root, 'data'), root});
  } finally {
    await rm(root, {force: true, recursive: true});
  }
};

// Get the result of the check: undefined if it passes, else the error
const check = (args: {dataDir: string; path: string; paths?: string[]}) => {
  const folder = dataFolder({dataDir: args.dataDir});
  const network = {id: 1, path: args.path} as Network;

  try {
    assertNetworkPath({folder, network, paths: args.paths});

    return undefined;
  } catch (err) {
    return err;
  }
};

test('A network folder in the data folder passes the check', () => {
  return withRoot(async ({dataDir, root}) => {
    const path = join(dataDir, 'networks', '1');
    const link = join(root, 'link');

    const node = join(path, 'volumes', 'lnd', 'alice');

    deepStrictEqual(
      check({dataDir, path, paths: [node]}),
      undefined,
      'A network folder that is not there passes',
    );

    await mkdir(node, {recursive: true});
    await symlink(path, link);
    await symlink(dataDir, join(root, 'data-link'));

    deepStrictEqual(
      [
        check({dataDir, path, paths: [node, join(node, 'tls.cert')]}),
        check({dataDir, path: link, paths: [join(link, 'volumes', 'x')]}),
        check({dataDir: join(root, 'data-link'), path}),
      ],
      [undefined, undefined, undefined],
      'Each path to the same folder passes',
    );
  });
});

test('A network folder outside the data folder gives 409', () => {
  return withRoot(async ({dataDir, root}) => {
    const copy = join(root, 'copy', 'networks', '1');

    await mkdir(join(dataDir, 'networks', '1'), {recursive: true});
    await mkdir(join(copy, 'volumes'), {recursive: true});

    // A link in the network folder to a folder in the copy. The '..' after
    // the link goes to the copy, but the text of the path shows the network
    // folder.
    await symlink(join(copy, 'volumes'), join(dataDir, 'networks', '1', 'up'));

    const error = (path: string) => [
      409,
      'NetworkPathOutsideDataFolder',
      {expected: join(dataDir, 'networks', '1'), networkId: 1, path},
    ];

    const tests = [
      copy,
      join(dataDir, 'networks', '2'),
      join(dataDir, 'networks'),
      join(dataDir, 'networks', '1', 'volumes'),
      `${join(dataDir, 'networks', '1', 'up')}${sep}..`,
    ];

    deepStrictEqual(
      tests.map(path => check({dataDir, path})),
      tests.map(error),
      'Got the error for each path',
    );
  });
});

test('A node file outside the network folder gives 409', () => {
  return withRoot(async ({dataDir, root}) => {
    const path = join(dataDir, 'networks', '1');
    const outside = join(root, 'outside');

    await mkdir(join(path, 'volumes', 'lnd'), {recursive: true});
    await mkdir(outside);

    // A link in the network folder to a folder outside of it
    await symlink(outside, join(path, 'volumes', 'lnd', 'linked'));

    const tests = [
      join(outside, 'tls.cert'),
      join(path, 'volumes', 'lnd', '..', '..', '..', '2'),
      join(path, 'volumes', 'lnd', 'linked', 'tls.cert'),
      // The '..' after the link goes to the folder above the outside folder
      [join(path, 'volumes', 'lnd', 'linked'), '..', 'tls.cert'].join(sep),
      path,
    ];

    deepStrictEqual(
      tests.map(file => check({dataDir, path, paths: [file]})),
      tests.map(file => [
        409,
        'NetworkPathOutsideDataFolder',
        {expected: path, networkId: 1, path: file},
      ]),
      'Got the error for each file',
    );
  });
});
