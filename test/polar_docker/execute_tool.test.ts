import {deepStrictEqual} from 'node:assert/strict';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';

import dataFolder from '../../src/polar_docker/data_folder.js';
import executeTool from '../../src/polar_docker/execute_tool.js';
import type {ToolArgs} from '../../src/polar_docker/tools/types.js';
import {rejection} from '../fixtures/rejection.js';

const folder = dataFolder({dataDir: join(tmpdir(), 'polarln-unused')});

test('A PolarError from a tool passes through with no change', async () => {
  const tools = {
    conflict: async () => {
      throw [409, 'X', {}];
    },
  };

  deepStrictEqual(
    await rejection(executeTool({args: {}, folder, tool: 'conflict', tools})),
    [409, 'X', {}],
    'Got the same tuple',
  );
});

test('An Error from a tool gets a code from its message', async () => {
  const tools = {
    stop: async () => {
      throw new Error('Network directory /x does not exist');
    },
  };

  deepStrictEqual(
    await rejection(executeTool({args: {}, folder, tool: 'stop', tools})),
    [
      404,
      'PolarObjectNotFound',
      {err: 'Network directory /x does not exist', tool: 'stop'},
    ],
    'Got the bridge error shape',
  );
});

test('A tool gets its arguments and the data folder', async () => {
  const tools = {
    echo: async (args: ToolArgs<object>) => ({
      args: args.args,
      dataDir: args.folder.dataDir,
      date: new Date(0),
    }),
  };

  deepStrictEqual(
    await executeTool({args: {a: 1}, folder, tool: 'echo', tools}),
    {args: {a: 1}, dataDir: folder.dataDir, date: '1970-01-01T00:00:00.000Z'},
    'Got a plain JSON result',
  );
});
