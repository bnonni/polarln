// The rules of the Polar app load, from jamaljsr/polar (MIT):
// src/lib/docker/dockerService.ts (loadNetworks), src/store/models/designer.ts
// (setActiveId, onNetworkSetStatus), src/utils/network.ts (getMissingImages).

import {deepStrictEqual} from 'node:assert/strict';
import {equal} from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

type Item = {[key: string]: any};

const isObject = (value: unknown): value is Item =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const isStatus = (status: unknown) =>
  Number.isInteger(status) &&
  (status as number) >= 0 &&
  (status as number) <= 4;

/** Check that the Polar v4.0.0 app can load a networks file

  - The version is "4.0.0", and the file has the charts key.
  - Each status is a number from 0 to 4.
  - Each network has a tap node array.
  - Each node has a docker image and a docker command.
  - Each network has a chart with a chart node for each node.
  - The status of each chart node is the status of its node.
  - Each link end is a chart node.

  <Networks File Path String>

  @throws
  <AssertionError>

  @returns via Promise
*/
export const assertPolarLoadable = async (path: string) => {
  const file = JSON.parse(await readFile(path, 'utf8'));

  equal(file.version, '4.0.0', 'The file has the Polar version');
  equal(isObject(file.charts), true, 'The file has the charts');

  for (const network of file.networks as Item[]) {
    const label = `network ${network.id}`;

    equal(Array.isArray(network.nodes.tap), true, `${label} has tap nodes`);

    const nodes: Item[] = [
      ...network.nodes.bitcoin,
      ...network.nodes.lightning,
      ...network.nodes.tap,
    ];

    const statuses = [
      network.status,
      ...nodes.map(n => n.status),
      ...(isObject(network.simulation) ? [network.simulation.status] : []),
    ];

    deepStrictEqual(
      statuses.filter(n => !isStatus(n)),
      [],
      `${label} has only Polar status numbers`,
    );

    deepStrictEqual(
      nodes
        .filter(n => typeof n.docker?.image !== 'string')
        .concat(nodes.filter(n => typeof n.docker?.command !== 'string'))
        .map(n => n.name),
      [],
      `Each node of ${label} has a docker image and command`,
    );

    const chart = file.charts[network.id];

    equal(
      isObject(chart) && isObject(chart.nodes) && isObject(chart.links),
      true,
      `${label} has a chart`,
    );

    deepStrictEqual(
      nodes.map(n => [n.name, chart.nodes[n.name]?.properties?.status]),
      nodes.map(n => [n.name, n.status]),
      `Each node of ${label} has a chart node with its status`,
    );

    const ends = Object.values(chart.links as Item).flatMap(link => [
      link.from.nodeId,
      link.to.nodeId,
    ]);

    deepStrictEqual(
      ends.filter(end => !Object.hasOwn(chart.nodes, end)),
      [],
      `Each link end of ${label} is a chart node`,
    );
  }
};
