// Network and chart shapes from jamaljsr/polar (MIT): src/utils/network.ts,
// src/utils/chart.ts, src/lib/docker/nodeTemplates.ts.

import {mkdir} from 'node:fs/promises';
import {mkdtemp} from 'node:fs/promises';
import {realpath} from 'node:fs/promises';
import {rm} from 'node:fs/promises';
import {writeFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import {tmpdir} from 'node:os';
import {dirname} from 'node:path';
import {join} from 'node:path';
import {sep} from 'node:path';

/** Polar Home Fixture in a Temporary Folder */
export type PolarHomeFixture = {
  /** Polar Data Directory Path (<home>/.polar) */
  dataDir: string;
  /** Networks File Path */
  file: string;
  /** Home Directory Path */
  home: string;
};

const icons = {
  bitcoind: './static/media/bitcoin.c9f33461.svg',
  litd: './static/media/litd.81cee05a.svg',
  LND: './static/media/lnd.095d2fef.png',
  tapd: './static/media/tap.b0998959.svg',
};

const lndPaths = (dir: string) => ({
  tlsCert: join(dir, 'tls.cert'),
  adminMacaroon: join(dir, 'data/chain/bitcoin/regtest/admin.macaroon'),
  invoiceMacaroon: join(dir, 'data/chain/bitcoin/regtest/invoice.macaroon'),
  readonlyMacaroon: join(dir, 'data/chain/bitcoin/regtest/readonly.macaroon'),
});

const bitcoind = (networkId: number) => ({
  id: 0,
  networkId,
  name: 'backend1',
  type: 'bitcoin',
  implementation: 'bitcoind',
  version: '30.0',
  peers: [],
  status: 3,
  ports: {rpc: 18443, p2p: 19444, zmqBlock: 28334, zmqTx: 29335},
  docker: {image: '', command: ''},
});

const lnd = (networkId: number, path: string) => ({
  id: 0,
  networkId,
  name: 'alice',
  type: 'lightning',
  implementation: 'LND',
  version: '0.20.0-beta',
  status: 3,
  backendName: 'backend1',
  paths: lndPaths(join(path, 'volumes/lnd/alice')),
  ports: {rest: 8081, grpc: 10001, p2p: 9735},
  docker: {image: '', command: ''},
});

const litd = (networkId: number, path: string) => {
  const dir = join(path, 'volumes/litd/bob');

  return {
    id: 1,
    networkId,
    name: 'bob',
    type: 'lightning',
    implementation: 'litd',
    version: '0.16.0-alpha',
    status: 3,
    backendName: 'backend1',
    lndName: 'bob',
    paths: {
      ...lndPaths(join(dir, 'lnd')),
      litTlsCert: join(dir, 'lit/tls.cert'),
      litMacaroon: join(dir, 'lit/regtest/lit.macaroon'),
      tapMacaroon: join(dir, 'tapd/data/regtest/admin.macaroon'),
    },
    ports: {rest: 8382, grpc: 13002, p2p: 9636, web: 8444},
    docker: {image: '', command: ''},
  };
};

const tapd = (networkId: number, path: string) => ({
  id: 0,
  networkId,
  name: 'alice-tap',
  type: 'tap',
  implementation: 'tapd',
  version: '0.7.0-alpha',
  status: 3,
  lndName: 'alice',
  paths: {
    tlsCert: join(path, 'volumes/tapd/alice-tap/tls.cert'),
    adminMacaroon: join(
      path,
      'volumes/tapd/alice-tap/data/regtest/admin.macaroon',
    ),
  },
  ports: {rest: 8289, grpc: 12029},
  // Polar keeps the node keys that it does not know
  fixtureNodeKey: 'kept',
  docker: {image: '', command: ''},
});

type ChartPort = {id: string; position?: {x: number; y: number}; type: string};

const chartNode = (args: {
  height: number;
  icon: string;
  id: string;
  ports: ChartPort[];
  type: string;
  x: number;
  y: number;
}) => ({
  id: args.id,
  type: args.type,
  position: {x: args.x, y: args.y},
  ports: Object.fromEntries(args.ports.map(port => [port.id, port])),
  size: {width: 200, height: args.height},
  properties: {status: 3, icon: args.icon},
});

const chartLink = (from: string, to: string, port: string, type: string) => ({
  id: `${from}-${to}`,
  from: {nodeId: from, portId: port},
  to: {nodeId: to, portId: port},
  properties: {type},
});

// Bitcoin chart node ports, as the Polar app saves them
const bitcoinPorts = (height: number) => [
  {id: 'backend', type: 'top', position: {x: 100, y: 0}},
  {id: 'peer-left', type: 'left', position: {x: 0, y: height / 2}},
  {id: 'peer-right', type: 'right', position: {x: 200, y: height / 2}},
];

// Chart of network 1, as the Polar app saves it after a drag and a select
const tapdChart = () => ({
  offset: {x: 360, y: 20},
  nodes: {
    backend1: chartNode({
      height: 42,
      icon: icons.bitcoind,
      id: 'backend1',
      ports: bitcoinPorts(42),
      type: 'bitcoin',
      x: 250,
      y: 600,
    }),
    alice: chartNode({
      height: 59,
      icon: icons.LND,
      id: 'alice',
      ports: [
        {id: 'empty-left', type: 'left', position: {x: 0, y: 30}},
        {id: 'empty-right', type: 'right', position: {x: 200, y: 30}},
        {id: 'backend', type: 'bottom', position: {x: 100, y: 59}},
        {id: 'lndbackend', type: 'top', position: {x: 100, y: 0}},
      ],
      type: 'lightning',
      x: 50,
      y: 300,
    }),
    'alice-tap': chartNode({
      height: 42,
      icon: icons.tapd,
      id: 'alice-tap',
      ports: [{id: 'lndbackend', type: 'bottom', position: {x: 100, y: 42}}],
      type: 'tap',
      x: 100,
      y: 100,
    }),
  },
  links: {
    'alice-backend1': chartLink('alice', 'backend1', 'backend', 'backend'),
    'alice-tap-alice': chartLink(
      'alice-tap',
      'alice',
      'lndbackend',
      'lndbackend',
    ),
  },
  selected: {type: 'node', id: 'alice-tap'},
  hovered: {},
  scale: 1,
});

// Chart of a network with no tap nodes, as Polar initChartFromNetwork makes it
const lightningChart = (litd: boolean) => {
  const lightning = (id: string, icon: string, x: number, y: number) =>
    chartNode({
      height: 36,
      icon,
      id,
      ports: [
        {id: 'empty-left', type: 'left'},
        {id: 'empty-right', type: 'right'},
        {id: 'backend', type: 'bottom'},
        ...(icon === icons.LND ? [{id: 'lndbackend', type: 'top'}] : []),
      ],
      type: 'lightning',
      x,
      y,
    });

  const backend1 = chartNode({
    height: 36,
    icon: icons.bitcoind,
    id: 'backend1',
    ports: [
      {id: 'backend', type: 'top'},
      {id: 'peer-left', type: 'left'},
      {id: 'peer-right', type: 'right'},
    ],
    type: 'bitcoin',
    x: 250,
    y: 400,
  });

  const alice = lightning('alice', icons.LND, 50, 100);
  const aliceLink = chartLink('alice', 'backend1', 'backend', 'backend');
  const bobLink = chartLink('bob', 'backend1', 'backend', 'backend');

  return {
    offset: {x: 0, y: 0},
    nodes: litd
      ? {backend1, alice, bob: lightning('bob', icons.litd, 300, 200)}
      : {backend1, alice},
    links: litd
      ? {'alice-backend1': aliceLink, 'bob-backend1': bobLink}
      : {'alice-backend1': aliceLink},
    selected: {},
    hovered: {},
    scale: 1,
  };
};

const network = (args: {
  id: number;
  lightning: object[];
  name: string;
  path: string;
  tap: object[];
}) => ({
  id: args.id,
  name: args.name,
  status: 3,
  path: args.path,
  nodes: {
    bitcoin: [bitcoind(args.id)],
    lightning: args.lightning,
    tap: args.tap,
  },
  autoMineMode: 0,
  manualMineCount: 6,
});

// Compose service in the Polar YAML layout
const service = (args: {
  container: string;
  image: string;
  name: string;
  ports: string[];
  volumes: string[];
}) =>
  [
    `  ${args.name}:`,
    '    environment:',
    '      USERID: ${USERID:-1000}',
    '      GROUPID: ${GROUPID:-1000}',
    `    image: ${args.image}`,
    `    container_name: ${args.container}`,
    `    hostname: ${args.name}`,
    '    volumes:',
    ...args.volumes.map(volume => `      - ${volume}`),
    '    ports:',
    ...args.ports.map(port => `      - '${port}'`),
  ].join('\n');

const composeFile = (id: number, extra: string[]) =>
  [
    `name: polar-network-${id}`,
    'services:',
    service({
      container: `polar-n${id}-backend1`,
      image: 'polarlightning/bitcoind:30.0',
      name: 'backend1',
      ports: ['18443:18443', '19444:18444', '28334:28334', '29335:28335'],
      volumes: ['./volumes/bitcoind/backend1:/home/bitcoin/.bitcoin'],
    }),
    service({
      container: `polar-n${id}-alice`,
      image: 'polarlightning/lnd:0.20.0-beta',
      name: 'alice',
      ports: ['8081:8080', '10001:10009', '9735:9735'],
      volumes: ['./volumes/lnd/alice:/home/lnd/.lnd'],
    }),
    ...extra,
    '',
  ].join('\n');

/** Run a function with a Polar home in a new temporary folder

  The home has <home>/.polar with a Polar v4.0.0 networks file, the compose
  files, and the LND TLS files. The networks file has status numbers, charts,
  and keys that polarDocker does not know. The layout is the Polar layout:
  JSON with 2 spaces and no end newline.

  - Network 1: backend1, alice (LND), and alice-tap (tapd)
  - Network 2: backend1, alice (LND), and bob (litd)
  - Network 3: backend1 and alice (LND), and an electrs compose service

  The fixture throws if its folder is not in the temporary folder. It removes
  the folder after the function.

  <Use the Polar Home Function>

  @returns via Promise
*/
export const withPolarHome = async (
  use: (fixture: PolarHomeFixture) => Promise<void>,
) => {
  const root = await mkdtemp(join(tmpdir(), 'polarln-polar-home-'));

  try {
    const real = await realpath(root);
    const temp = await realpath(tmpdir());

    if (!real.startsWith(`${temp}${sep}`)) {
      throw new Error('ExpectedPolarHomeFixtureInTemporaryFolder');
    }

    const home = join(real, 'home');
    const dataDir = join(home, '.polar');

    if (dataDir === join(homedir(), '.polar')) {
      throw new Error('ExpectedPolarHomeFixtureNotInRealHome');
    }

    const path = (id: number) => join(dataDir, 'networks', `${id}`);

    const networks = [
      {
        ...network({
          id: 1,
          lightning: [lnd(1, path(1))],
          name: 'tapd-net',
          path: path(1),
          tap: [tapd(1, path(1))],
        }),
        // Polar keeps the network keys that it does not know
        fixtureNetworkKey: {kept: true},
      },
      network({
        id: 2,
        lightning: [lnd(2, path(2)), litd(2, path(2))],
        name: 'litd-net',
        path: path(2),
        tap: [],
      }),
      network({
        id: 3,
        lightning: [lnd(3, path(3))],
        name: 'electrs-net',
        path: path(3),
        tap: [],
      }),
    ];

    const file = join(dataDir, 'networks', 'networks.json');

    const json = {
      version: '4.0.0',
      networks,
      charts: {
        1: tapdChart(),
        2: lightningChart(true),
        3: lightningChart(false),
      },
    };

    const composeFiles = [
      composeFile(1, [
        service({
          container: 'polar-n1-alice-tap',
          image: 'polarlightning/tapd:0.7.0-alpha',
          name: 'alice-tap',
          ports: ['8289:8089', '12029:10029'],
          volumes: [
            './volumes/lnd/alice:/home/tap/.lnd',
            './volumes/tapd/alice-tap:/home/tap/.tapd',
          ],
        }),
      ]),
      composeFile(2, [
        service({
          container: 'polar-n2-bob',
          image: 'polarlightning/litd:0.16.0-alpha',
          name: 'bob',
          ports: ['8382:8080', '13002:10009', '9636:9735', '8444:8443'],
          volumes: [
            './volumes/litd/bob/lit:/home/litd/.lit',
            './volumes/litd/bob/lnd:/home/litd/.lnd',
            './volumes/litd/bob/tapd:/home/litd/.tapd',
          ],
        }),
      ]),
      composeFile(3, [
        service({
          container: 'esplora-electrs',
          image: 'jintek/esplora-electrs:latest',
          name: 'electrs',
          ports: ['3000:3000'],
          volumes: ['./volumes/bitcoind/backend1:/data/.bitcoin'],
        }),
      ]),
    ];

    const tlsFiles = [
      join(path(1), 'volumes/lnd/alice/tls.cert'),
      join(path(2), 'volumes/lnd/alice/tls.cert'),
      join(path(2), 'volumes/litd/bob/lnd/tls.cert'),
      join(path(3), 'volumes/lnd/alice/tls.cert'),
    ];

    for (const [index, compose] of composeFiles.entries()) {
      await mkdir(path(index + 1), {recursive: true});

      await writeFile(join(path(index + 1), 'docker-compose.yml'), compose);
    }

    for (const tlsFile of tlsFiles) {
      await mkdir(dirname(tlsFile), {recursive: true});

      await writeFile(tlsFile, 'fixture tls.cert');
      await writeFile(join(dirname(tlsFile), 'tls.key'), 'fixture tls.key');
    }

    await writeFile(file, JSON.stringify(json, null, 2));

    await use({dataDir, file, home});
  } finally {
    await rm(root, {force: true, recursive: true});
  }
};
