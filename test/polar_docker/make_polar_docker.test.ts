import {deepStrictEqual} from 'node:assert/strict';
import {strictEqual} from 'node:assert/strict';
import test from 'node:test';

import type {LoadExecuteTool} from '../../src/polar_docker/make_polar_docker.js';
import makePolarDocker from '../../src/polar_docker/make_polar_docker.js';
import {rejection} from '../fixtures/rejection.js';

// The data folder is not the Polar home, so no Polar app check runs
const dataDir = '/tmp/polarln-make-polar-docker-test';

const make = (loadExecuteTool?: LoadExecuteTool) =>
  makePolarDocker({dataDir, env: {}, home: '/home/test', loadExecuteTool});

test('The tool runner loads at the first tool call', async () => {
  const calls: object[] = [];
  let loads = 0;

  const {polar} = make(async () => {
    loads += 1;

    return {
      default: async args => {
        calls.push({
          args: args.args,
          dataDir: args.folder.dataDir,
          tool: args.tool,
        });

        return {ok: true};
      },
    };
  });

  strictEqual(loads, 0);

  deepStrictEqual(await polar.execute('list_networks', {a: 1}), {ok: true});
  deepStrictEqual(await polar.execute('mine_blocks', {b: 2}), {ok: true});

  strictEqual(loads, 2);

  deepStrictEqual(calls, [
    {args: {a: 1}, dataDir, tool: 'list_networks'},
    {args: {b: 2}, dataDir, tool: 'mine_blocks'},
  ]);
});

test('The default loader gives the Docker tool runner', async () => {
  const {polar} = make();

  // The tool runner refuses an unknown tool before it reads files
  const err = await rejection(polar.execute('export_network_to_zip', {}));

  strictEqual((err as unknown[])[0], 501);
  strictEqual((err as unknown[])[1], 'PolarToolNotSupported');
});

const loadFailures: {description: string; load: LoadExecuteTool}[] = [
  {
    description: 'A loader that rejects',
    load: async () => {
      throw new Error('Cannot find package');
    },
  },
  {
    description: 'A loader that throws',
    load: () => {
      throw new Error('Cannot find package');
    },
  },
];

loadFailures.forEach(({description, load}) => {
  test(`${description} gives FailedToLoadDockerBackend`, async () => {
    let loads = 0;

    const {polar} = make(() => {
      loads += 1;

      return load();
    });

    const err = await rejection(polar.execute('list_networks', {}));

    deepStrictEqual(err, [
      503,
      'FailedToLoadDockerBackend',
      {err: new Error('Cannot find package')},
    ]);

    // A later call tries the load again
    deepStrictEqual(await rejection(polar.execute('list_networks', {})), err);

    strictEqual(loads, 2);
  });
});
