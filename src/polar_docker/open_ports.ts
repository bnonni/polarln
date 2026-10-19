// Ported from jamaljsr/polar (MIT): src/utils/network.ts (getOpenPorts).

import {createServer} from 'node:net';

import type {Network} from '../typescript/index.js';
import type {PolarNode} from '../typescript/index.js';

/** New Host Ports for Each Node Name */
export type OpenPorts = {[name: string]: {[port: string]: number}};

const isRunning = (n: PolarNode) =>
  n.status === 'Started' || n.status === 'Locked';
const maxPort = 65535;

// Docker publishes a port on all IPv4 and IPv6 addresses
const canListen = (port: number, host?: string) => {
  return new Promise<boolean>(resolve => {
    const server = createServer();

    server.once('error', () => resolve(false));
    server.listen({host, port}, () => server.close(() => resolve(true)));
  });
};

const isFree = async (port: number) =>
  (await canListen(port)) && (await canListen(port, '0.0.0.0'));

// Get the first free port at or above a port
const detectPort = async (port: number): Promise<number> => {
  for (let p = port; p <= maxPort; p += 1) {
    if (await isFree(p)) {
      return p;
    }
  }

  throw new Error(`No free port at or above port ${port}`);
};

/** Get free ports for a list of ports

  The list must be in ascending order. A 0 port stays 0.

  [<Port Number>]

  @returns via Promise
  [<Free Port Number>]
*/
export const openPortRange = async (ports: number[]): Promise<number[]> => {
  const open: number[] = [];

  for (const port of ports) {
    const last = open.at(-1);

    if (port === 0) {
      open.push(0);
    } else {
      open.push(await detectPort(!!last && port <= last ? last + 1 : port));
    }
  }

  return open;
};

/** Get new host ports for the nodes with ports that are not free

  The nodes that run hold their own ports, so they keep their ports

  {
    network: <Network Object>
  }

  @returns via Promise
  [<New Ports For Each Node Name Object>]
*/
export default async ({
  network,
}: {
  network: Network;
}): Promise<OpenPorts | undefined> => {
  const ports: OpenPorts = {};

  const check = async (nodes: PolarNode[], keys: string[]) => {
    for (const key of keys) {
      const existing = nodes.map(
        n => (n.ports as {[port: string]: number})[key],
      );

      const open = await openPortRange(existing);

      if (open.join() === existing.join()) {
        continue;
      }

      open.forEach((port, i) => {
        ports[nodes[i].name] = {...ports[nodes[i].name], [key]: port};
      });
    }
  };

  const bitcoin = network.nodes.bitcoin.filter(n => !isRunning(n));
  const lnd = network.nodes.lightning.filter(n => {
    return n.implementation === 'LND' && !isRunning(n);
  });

  await check(bitcoin, ['rpc', 'p2p', 'zmqBlock', 'zmqTx']);
  await check(lnd, ['grpc', 'rest', 'p2p']);

  return !!Object.keys(ports).length ? ports : undefined;
};
