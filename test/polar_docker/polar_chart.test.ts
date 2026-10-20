import {deepStrictEqual} from 'node:assert/strict';
import {equal} from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {writeFile} from 'node:fs/promises';
import test from 'node:test';

import type {LightningNode} from '../../src/index.js';
import type {Network} from '../../src/index.js';
import type {TapdNode} from '../../src/index.js';
import {addLndNode} from '../../src/polar_docker/create_nodes.js';
import dataFolder from '../../src/polar_docker/data_folder.js';
import {changeNetworks} from '../../src/polar_docker/network_file.js';
import newNetwork from '../../src/polar_docker/new_network.js';
import planNetwork from '../../src/polar_docker/plan_network.js';
import {chartIcons} from '../../src/polar_docker/polar_chart.js';
import {initChartFromNetwork} from '../../src/polar_docker/polar_chart.js';
import type {PolarChart} from '../../src/polar_docker/polar_chart.js';
import {renameChartNode} from '../../src/polar_docker/polar_chart.js';
import syncChart from '../../src/polar_docker/polar_chart.js';
import setStatus from '../../src/polar_docker/set_status.js';
import {assertPolarLoadable} from '../fixtures/assert_polar_loadable.js';
import {withPolarHome} from '../fixtures/polar_home.js';
import {rejection} from '../fixtures/rejection.js';

const icons = chartIcons({charts: {}, networks: []});

const bitcoinIcon = './static/media/bitcoin.c9f33461.svg';
const lndIcon = './static/media/lnd.095d2fef.png';
const tapIcon = './static/media/tap.b0998959.svg';

// Make a stopped network with 2 bitcoind nodes, 2 LND nodes, and 1 tapd node
const makeNetwork = (id = 1): Network => {
  const network = newNetwork({
    dataDir: '/data',
    description: '',
    id,
    name: 'n',
    plan: planNetwork({
      nodes: [
        {count: 2, implementation: 'bitcoind'},
        {count: 2, implementation: 'LND'},
      ],
    }),
  });

  const tapd: TapdNode = {
    id: 0,
    networkId: id,
    name: 'alice-tap',
    type: 'tap',
    implementation: 'tapd',
    version: '0.7.0-alpha',
    status: 'Stopped',
    lndName: 'alice',
    paths: {adminMacaroon: '', tlsCert: ''},
    ports: {grpc: 12029, rest: 8289},
    docker: {command: '', image: ''},
  };

  network.nodes.tap.push(tapd);

  return network;
};

const port = (id: string, type: string) => ({id, type});

const chartNode = (args: {
  icon: string;
  id: string;
  ports: {id: string; type: string}[];
  type: string;
  x: number;
  y: number;
}) => ({
  id: args.id,
  type: args.type,
  position: {x: args.x, y: args.y},
  ports: Object.fromEntries(args.ports.map(n => [n.id, n])),
  size: {width: 200, height: 36},
  properties: {status: 3, icon: args.icon},
});

const link = (from: string, to: string, ports: string[], type: string) => ({
  id: `${from}-${to}`,
  from: {nodeId: from, portId: ports[0]},
  to: {nodeId: to, portId: ports[1]},
  properties: {type},
});

const bitcoinPorts = [
  port('backend', 'top'),
  port('peer-left', 'left'),
  port('peer-right', 'right'),
];

const lndPorts = [
  port('empty-left', 'left'),
  port('empty-right', 'right'),
  port('backend', 'bottom'),
  port('lndbackend', 'top'),
];

// Add a channel between alice and bob, as Polar updateChartFromNodes saves it
const addChannel = (chart: PolarChart) => {
  const properties = (nodeId: string, initiator: boolean) => ({
    nodeId,
    initiator,
    hasAssets: false,
  });

  chart.nodes.alice.ports.chan = {
    ...port('chan', 'right'),
    properties: properties('alice', true),
  };

  chart.nodes.bob.ports.chan = {
    ...port('chan', 'left'),
    properties: properties('bob', false),
  };

  chart.links.chan = {
    ...link('alice', 'bob', ['chan', 'chan'], 'open-channel'),
    id: 'chan',
  };
};

test('A new chart has the Polar positions, ports, sizes, and links', () => {
  const network = makeNetwork();

  // backend1, alice, bob, and alice-tap have the positions of a Polar app
  // chart of a network with a tapd node
  const expected = {
    offset: {x: 0, y: 0},
    nodes: {
      backend1: chartNode({
        icon: bitcoinIcon,
        id: 'backend1',
        ports: bitcoinPorts,
        type: 'bitcoin',
        x: 250,
        y: 600,
      }),
      backend2: chartNode({
        icon: bitcoinIcon,
        id: 'backend2',
        ports: bitcoinPorts,
        type: 'bitcoin',
        x: 500,
        y: 700,
      }),
      alice: chartNode({
        icon: lndIcon,
        id: 'alice',
        ports: lndPorts,
        type: 'lightning',
        x: 50,
        y: 300,
      }),
      bob: chartNode({
        icon: lndIcon,
        id: 'bob',
        ports: lndPorts,
        type: 'lightning',
        x: 300,
        y: 400,
      }),
      'alice-tap': chartNode({
        icon: tapIcon,
        id: 'alice-tap',
        ports: [port('lndbackend', 'bottom')],
        type: 'tap',
        x: 100,
        y: 100,
      }),
    },
    links: {
      'backend1-backend2': link(
        'backend1',
        'backend2',
        ['peer-right', 'peer-left'],
        'btcpeer',
      ),
      'alice-backend1': link(
        'alice',
        'backend1',
        ['backend', 'backend'],
        'backend',
      ),
      'bob-backend2': link(
        'bob',
        'backend2',
        ['backend', 'backend'],
        'backend',
      ),
      'alice-tap-alice': link(
        'alice-tap',
        'alice',
        ['lndbackend', 'lndbackend'],
        'lndbackend',
      ),
    },
    selected: {},
    hovered: {},
    scale: 1,
  };

  const chart = initChartFromNetwork({network});

  deepStrictEqual(chart, expected, 'Got the Polar chart');

  equal(
    JSON.stringify(chart),
    JSON.stringify(expected),
    'The keys have the Polar order',
  );

  deepStrictEqual(
    syncChart({chart: undefined, icons, network}),
    expected,
    'A network with no chart gets a new chart',
  );
});

test('A removed node loses its chart node, its links, and the selection', () => {
  const network = makeNetwork();
  const chart = initChartFromNetwork({network});

  addChannel(chart);

  chart.nodes.alice.position = {x: 7, y: 8};
  chart.selected = {type: 'node', id: 'bob'};
  chart.hovered = {type: 'link', id: 'chan'};

  network.nodes.lightning = network.nodes.lightning.filter(n => {
    return n.name !== 'bob';
  });

  const synced = syncChart({chart, icons, network});

  deepStrictEqual(
    [
      Object.keys(synced.nodes),
      Object.keys(synced.links),
      Object.keys(synced.nodes.alice.ports),
      synced.nodes.alice.position,
      synced.selected,
      synced.hovered,
    ],
    [
      ['backend1', 'backend2', 'alice', 'alice-tap'],
      ['backend1-backend2', 'alice-backend1', 'alice-tap-alice'],
      ['empty-left', 'empty-right', 'backend', 'lndbackend'],
      {x: 7, y: 8},
      {},
      {},
    ],
    'The node, its links, its channel ports, and the selection are gone',
  );

  synced.selected = {type: 'node', id: 'alice'};

  deepStrictEqual(
    syncChart({chart: synced, icons, network}).selected,
    {type: 'node', id: 'alice'},
    'A node that is there stays selected',
  );
});

test('A renamed node keeps its position, and its links get the new name', () => {
  const network = makeNetwork();
  const charts: {[id: string]: PolarChart} = {
    1: initChartFromNetwork({network}),
  };

  addChannel(charts[1]);

  charts[1].nodes.alice.position = {x: 7, y: 8};

  renameChartNode({charts, id: 1, name: 'zed', nodeId: 'alice'});

  // The network changes as in the rename_node tool
  network.nodes.lightning[0].name = 'zed';
  network.nodes.tap[0].lndName = 'zed';

  const synced = syncChart({chart: charts[1], icons, network});

  deepStrictEqual(
    [
      Object.keys(synced.nodes),
      synced.nodes.zed.id,
      synced.nodes.zed.position,
      synced.links,
    ],
    [
      ['backend1', 'backend2', 'bob', 'alice-tap', 'zed'],
      'zed',
      {x: 7, y: 8},
      {
        'backend1-backend2': link(
          'backend1',
          'backend2',
          ['peer-right', 'peer-left'],
          'btcpeer',
        ),
        'zed-backend1': link(
          'zed',
          'backend1',
          ['backend', 'backend'],
          'backend',
        ),
        'bob-backend2': link(
          'bob',
          'backend2',
          ['backend', 'backend'],
          'backend',
        ),
        'alice-tap-zed': link(
          'alice-tap',
          'zed',
          ['lndbackend', 'lndbackend'],
          'lndbackend',
        ),
        chan: {
          ...link('zed', 'bob', ['chan', 'chan'], 'open-channel'),
          id: 'chan',
        },
      },
    ],
    'Got the renamed node and links',
  );

  const missing = {};

  renameChartNode({charts: missing, id: 1, name: 'zed', nodeId: 'alice'});

  deepStrictEqual(missing, {}, 'No chart does not change');
});

test('A backend change moves the backend link', () => {
  const network = makeNetwork();
  const chart = initChartFromNetwork({network});

  network.nodes.lightning[0].backendName = 'backend2';

  const synced = syncChart({chart, icons, network});

  deepStrictEqual(
    [Object.keys(synced.links), synced.links['alice-backend2']],
    [
      [
        'backend1-backend2',
        'bob-backend2',
        'alice-tap-alice',
        'alice-backend2',
      ],
      link('alice', 'backend2', ['backend', 'backend'], 'backend'),
    ],
    'The link goes to the new backend',
  );
});

test('The chart statuses follow the node statuses', () => {
  const network = makeNetwork();
  const chart = initChartFromNetwork({network});

  setStatus({network, status: 'Started'});
  setStatus({network, only: 'alice', status: 'Error'});

  const synced = syncChart({chart, icons, network});

  deepStrictEqual(
    Object.values(synced.nodes).map(n => [n.id, n.properties.status]),
    [
      ['backend1', 1],
      ['backend2', 1],
      ['alice', 4],
      ['bob', 1],
      ['alice-tap', 1],
    ],
    'Got the status numbers',
  );
});

test('A new chart node gets the icon of the file, else the build icon', () => {
  const network = makeNetwork();
  const chart = initChartFromNetwork({network});

  chart.nodes.alice.properties.icon = './static/media/lnd.other.png';

  const fileIcons = chartIcons({charts: {1: chart}, networks: [network]});

  const carol = addLndNode({network, version: '0.20.0-beta'});

  const other = (name: string, implementation: string) =>
    ({...carol, id: carol.id + 1, implementation, name}) as LightningNode;

  network.nodes.lightning.push(other('dave', 'litd'), other('erin', 'eclair'));

  const synced = syncChart({chart, icons: fileIcons, network});

  deepStrictEqual(
    ['carol', 'dave', 'erin', 'backend1'].map(name => {
      return synced.nodes[name].properties.icon;
    }),
    [
      './static/media/lnd.other.png',
      './static/media/litd.81cee05a.svg',
      '',
      bitcoinIcon,
    ],
    'Got the icons',
  );

  // Polar puts carol at this position in a network with a tapd node
  deepStrictEqual(
    synced.nodes.carol.position,
    {x: 550, y: 300},
    'A new node gets the Polar start position',
  );
});

test('A change keeps the chart bytes of the other networks', () => {
  return withPolarHome(async ({dataDir, file}) => {
    const docker = async () => {
      throw new Error('UnexpectedDockerCall');
    };

    const folder = dataFolder({dataDir, docker});
    const before = JSON.parse(await readFile(file, 'utf8'));

    await changeNetworks({
      change: (networks, charts) => {
        const network = networks[2];

        network.nodes.lightning[0].name = 'zed';

        renameChartNode({charts, id: 3, name: 'zed', nodeId: 'alice'});

        setStatus({network, status: 'Started'});
      },
      folder,
    });

    const after = JSON.parse(await readFile(file, 'utf8'));

    deepStrictEqual(
      [1, 2].map(id => JSON.stringify(after.charts[id])),
      [1, 2].map(id => JSON.stringify(before.charts[id])),
      'The charts of the other networks did not change',
    );

    const chart = after.charts[3];

    deepStrictEqual(
      [
        chart.nodes.zed.position,
        Object.keys(chart.links),
        Object.values(chart.nodes).map((n: any) => n.properties.status),
      ],
      [before.charts[3].nodes.alice.position, ['zed-backend1'], [1, 1]],
      'The changed network has a renamed chart node and the statuses',
    );

    await assertPolarLoadable(file);
  });
});

test('A removed network loses its chart, and a new network gets a chart', () => {
  return withPolarHome(async ({dataDir, file}) => {
    const docker = async () => {
      throw new Error('UnexpectedDockerCall');
    };

    const folder = dataFolder({dataDir, docker});

    await changeNetworks({
      change: networks => networks.splice(1, 1),
      folder,
    });

    const network = makeNetwork(4);

    await changeNetworks({
      change: (networks, charts) => {
        // An old chart with the id of the new network
        charts[4] = {nodes: {}, links: {}};

        networks.push(network);
      },
      folder,
    });

    const saved = JSON.parse(await readFile(file, 'utf8'));

    deepStrictEqual(
      [Object.keys(saved.charts), saved.charts[4]],
      [['1', '3', '4'], initChartFromNetwork({network})],
      'Got the charts',
    );

    await assertPolarLoadable(file);
  });
});

test('A write needs charts that are an object, and adds missing charts', () => {
  return withPolarHome(async ({dataDir, file}) => {
    const docker = async () => {
      throw new Error('UnexpectedDockerCall');
    };

    const folder = dataFolder({dataDir, docker});
    const json = JSON.parse(await readFile(file, 'utf8'));

    await writeFile(file, JSON.stringify({...json, charts: []}, null, 2));

    const before = await readFile(file, 'utf8');

    deepStrictEqual(
      await rejection(changeNetworks({change: () => {}, folder})),
      [
        503,
        'FailedToReadNetworksFile',
        {err: 'The charts key is not an object', path: file},
      ],
      'Got the error',
    );

    equal(await readFile(file, 'utf8'), before, 'The file did not change');

    delete json.charts;

    await writeFile(file, JSON.stringify(json, null, 2));

    await changeNetworks({
      change: networks => (networks[0].name = 'renamed'),
      folder,
    });

    const saved = JSON.parse(await readFile(file, 'utf8'));

    deepStrictEqual(
      [Object.keys(saved), Object.keys(saved.charts)],
      [['version', 'networks', 'charts'], ['1']],
      'A changed network gets a chart in new charts',
    );

    deepStrictEqual(
      saved.charts['1'],
      initChartFromNetwork({network: saved.networks[0]}),
      'The new chart is the Polar chart of the network',
    );
  });
});
