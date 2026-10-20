// Ported from jamaljsr/polar (MIT): src/utils/network.ts (getOpenPorts,
// getOpenPortRange).

import {createServer} from 'node:net';

import type {Network} from '../typescript/index.js';
import type {PolarNode} from '../typescript/index.js';

/** New Host Ports for Each Node Name */
export type OpenPorts = {[name: string]: {[port: string]: number}};

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

  The check covers each port in node.ports of each node kind. The nodes of
  one kind get ports in node order, as in Polar. A node that runs holds its
  own ports, so its ports stay. By default, a node runs if it has the Started
  status, as in Polar.

  {
    [isRunning]: <Node Runs and Holds Its Ports Function>
    network: <Network Object>
  }

  @returns via Promise
  [<New Ports For Each Node Name Object>]
*/
export default async ({
  isRunning = n => n.status === 'Started',
  network,
}: {
  isRunning?: (node: PolarNode) => boolean;
  network: Network;
}): Promise<OpenPorts | undefined> => {
  const ports: OpenPorts = {};

  const portsOf = (node: PolarNode) =>
    node.ports as {[port: string]: number | undefined};

  const check = async (nodes: PolarNode[], key: string) => {
    const existing = nodes.map(n => portsOf(n)[key] as number);

    const open = await openPortRange(existing);

    if (open.join() === existing.join()) {
      return;
    }

    open.forEach((port, i) => {
      ports[nodes[i].name] = {...ports[nodes[i].name], [key]: port};
    });
  };

  const {bitcoin, lightning, tap} = network.nodes;

  // Group the nodes that do not run by kind, in node order
  const groups = new Map<string, PolarNode[]>();

  [...bitcoin, ...lightning, ...tap]
    .filter(n => !isRunning(n))
    .forEach(n => {
      groups.set(n.implementation, [
        ...(groups.get(n.implementation) || []),
        n,
      ]);
    });

  for (const nodes of groups.values()) {
    const keys = new Set(nodes.flatMap(n => Object.keys(n.ports)));

    for (const key of keys) {
      const withPort = nodes.filter(n => typeof portsOf(n)[key] === 'number');

      await check(withPort, key);
    }
  }

  return !!Object.keys(ports).length ? ports : undefined;
};
