// Ported from jamaljsr/polar (MIT): src/utils/chart.ts (createLightningChartNode,
// createTapdChartNode, createBitcoinChartNode, initChartFromNetwork,
// updateChartFromNodes), src/store/models/designer.ts (removeNode,
// renameNode), src/utils/constants.ts (dockerConfigs logos).

import type {BitcoinNode} from '../typescript/index.js';
import type {LightningNode} from '../typescript/index.js';
import type {Network} from '../typescript/index.js';
import type {PolarNode} from '../typescript/index.js';
import type {TapdNode} from '../typescript/index.js';
import {statusCode} from './status_codes.js';

type Position = {x: number; y: number};

/** Polar Chart Port */
type ChartPort = {[key: string]: unknown; id: string; type: string};

/** Polar Chart Node (react-flow-chart INode) */
export type ChartNode = {
  [key: string]: unknown;
  /** Node Name */
  id: string;
  ports: {[id: string]: ChartPort};
  position: Position;
  /** Status Number and Icon Path */
  properties: {[key: string]: unknown};
  size?: {height: number; width: number};
  /** bitcoin, lightning, or tap */
  type: string;
};

/** Polar Chart Link (react-flow-chart ILink) */
export type ChartLink = {
  [key: string]: unknown;
  from: {[key: string]: unknown; nodeId: string; portId: string};
  id: string;
  /** Link Type: backend, btcpeer, lndbackend, or a channel type */
  properties: {[key: string]: unknown};
  to: {[key: string]: unknown; nodeId: string; portId: string};
};

/** Selected or Hovered Chart Item */
type ChartItem = {[key: string]: unknown; id?: string; type?: string};

/** Polar Chart of a Network (react-flow-chart IChart) */
export type PolarChart = {
  [key: string]: unknown;
  hovered: ChartItem;
  links: {[id: string]: ChartLink};
  nodes: {[id: string]: ChartNode};
  offset: Position;
  scale: number;
  selected: ChartItem;
};

/** Charts of the Networks File, With the Network Id as the Key */
export type PolarCharts = {[networkId: string]: unknown};

/** Chart Icon Paths, With the Node Implementation as the Key */
export type ChartIcons = {[implementation: string]: string};

/** Icon paths of the Polar v4.0.0 build (/opt/polar/resources/app.asar)

  webpack puts the eclair icon into the app code, so eclair has no path
*/
const buildIcons: ChartIcons = {
  bitcoind: './static/media/bitcoin.c9f33461.svg',
  btcd: '',
  'c-lightning': './static/media/clightning.fb8d2dc7.png',
  eclair: '',
  litd: './static/media/litd.81cee05a.svg',
  LND: './static/media/lnd.095d2fef.png',
  tapd: './static/media/tap.b0998959.svg',
};

// Adds a gap from the top and left edges of the canvas
const baseline = {x: 100, y: 100};
// Nodes on the same row or column are moved by this amount
const stagger = {x: 50, y: 100};
// The space between each node
const space = {x: 250, y: 200};

// The links that Polar makes from the nodes, and not from the channels
const nodeLinkTypes = ['backend', 'btcpeer', 'lndbackend'];

// The ports that are not channel ports
const nodePortIds = [
  'backend',
  'empty-left',
  'empty-right',
  'lndbackend',
  'peer-left',
  'peer-right',
];

const isObject = (value: unknown): value is {[key: string]: unknown} =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const isChart = (value: unknown): value is PolarChart =>
  isObject(value) && isObject(value.nodes) && isObject(value.links);

const isLink = (value: unknown): value is ChartLink =>
  isObject(value) && isObject(value.from) && isObject(value.to);

const hasKey = (object: object, key: unknown): key is string =>
  typeof key === 'string' && Object.hasOwn(object, key);

const hasNode = (chart: PolarChart, name: unknown) =>
  hasKey(chart.nodes, name) && isObject(chart.nodes[name]);

// Get the type of a link
const type = (link: ChartLink) =>
  isObject(link.properties) ? String(link.properties.type) : '';

const allNodes = (network: Network): PolarNode[] => {
  const {bitcoin, lightning, tap} = network.nodes;

  return [...bitcoin, ...lightning, ...tap];
};

const nodeLink = (args: {
  from: string;
  port: string;
  to: string;
  type: string;
}): ChartLink => ({
  id: `${args.from}-${args.to}`,
  from: {nodeId: args.from, portId: args.port},
  to: {nodeId: args.to, portId: args.port},
  properties: {type: args.type},
});

// Link of a lightning node to its bitcoin backend
const backendLink = (ln: LightningNode) =>
  nodeLink({
    from: ln.name,
    port: 'backend',
    to: ln.backendName,
    type: 'backend',
  });

// Link of a tapd node to its LND backend
const tapdLink = (tapd: TapdNode) =>
  nodeLink({
    from: tapd.name,
    port: 'lndbackend',
    to: tapd.lndName,
    type: 'lndbackend',
  });

// Link of a bitcoind node to its previous peer
const peerLink = (btc: BitcoinNode, peer: string): ChartLink => ({
  id: `${peer}-${btc.name}`,
  from: {nodeId: peer, portId: 'peer-right'},
  to: {nodeId: btc.name, portId: 'peer-left'},
  properties: {type: 'btcpeer'},
});

const properties = (node: PolarNode, icons: ChartIcons) => ({
  status: statusCode(node.status),
  icon: icons[node.implementation] ?? '',
});

/** Get the chart node and the backend link of a lightning node

  An LND node also gets the lndbackend port for a tapd node

  {
    icons: <Icon Path for Each Implementation Object>
    node: <Lightning Node Object>
    [yOffset]: <Vertical Offset Number> // Default: 0
  }

  @returns
  {
    link: <Chart Link Object>
    node: <Chart Node Object>
  }
*/
export const createLightningChartNode = ({
  icons,
  node: ln,
  yOffset = 0,
}: {
  icons: ChartIcons;
  node: LightningNode;
  yOffset?: number;
}) => {
  const node: ChartNode = {
    id: ln.name,
    type: 'lightning',
    position: {
      x: ln.id * space.x + stagger.x,
      y: baseline.y + yOffset + (ln.id % 2 === 0 ? 0 : stagger.y),
    },
    ports: {
      'empty-left': {id: 'empty-left', type: 'left'},
      'empty-right': {id: 'empty-right', type: 'right'},
      backend: {id: 'backend', type: 'bottom'},
    },
    size: {width: 200, height: 36},
    properties: properties(ln, icons),
  };

  if (ln.implementation === 'LND') {
    node.ports.lndbackend = {id: 'lndbackend', type: 'top'};
  }

  return {link: backendLink(ln), node};
};

/** Get the chart node and the LND backend link of a tapd node

  If the chart has the LND node, the tapd node goes above the LND node

  {
    [chart]: <Polar Chart Object>
    icons: <Icon Path for Each Implementation Object>
    node: <tapd Node Object>
  }

  @returns
  {
    link: <Chart Link Object>
    node: <Chart Node Object>
  }
*/
export const createTapdChartNode = ({
  chart,
  icons,
  node: tap,
}: {
  chart?: PolarChart;
  icons: ChartIcons;
  node: TapdNode;
}) => {
  const node: ChartNode = {
    id: tap.name,
    type: 'tap',
    position: {
      x: tap.id * space.x + baseline.x,
      y: baseline.y + (tap.id % 2 === 0 ? 0 : stagger.y),
    },
    ports: {
      lndbackend: {id: 'lndbackend', type: 'bottom'},
    },
    size: {width: 200, height: 36},
    properties: properties(tap, icons),
  };

  const lnd = chart && hasNode(chart, tap.lndName) && chart.nodes[tap.lndName];

  if (!!lnd && isObject(lnd.position)) {
    node.position = {
      x: lnd.position.x + stagger.x,
      y: lnd.position.y - space.y,
    };
  }

  return {link: tapdLink(tap), node};
};

/** Get the chart node of a bitcoin node, and the link to its previous peer

  Only a node with a name after the name of its first peer gets a link, so
  that 2 peers get one link

  {
    icons: <Icon Path for Each Implementation Object>
    node: <Bitcoin Node Object>
    [yOffset]: <Vertical Offset Number> // Default: 0
  }

  @returns
  {
    [link]: <Chart Link Object>
    node: <Chart Node Object>
  }
*/
export const createBitcoinChartNode = ({
  icons,
  node: btc,
  yOffset = 0,
}: {
  icons: ChartIcons;
  node: BitcoinNode;
  yOffset?: number;
}) => {
  const node: ChartNode = {
    id: btc.name,
    type: 'bitcoin',
    position: {
      x: btc.id * 250 + space.x,
      y: yOffset + space.y + space.y + (btc.id % 2 === 0 ? 0 : stagger.y),
    },
    ports: {
      backend: {id: 'backend', type: 'top'},
      'peer-left': {id: 'peer-left', type: 'left'},
      'peer-right': {id: 'peer-right', type: 'right'},
    },
    size: {width: 200, height: 36},
    properties: properties(btc, icons),
  };

  const [peer] = btc.peers;

  // Only one link from right to left, for example backend3 to backend2
  const link = !!peer && btc.name > peer ? peerLink(btc, peer) : undefined;

  return {link, node};
};

/** Get a new chart for a network

  The bitcoin and lightning nodes go one row lower if the network has tapd
  nodes

  {
    [icons]: <Icon Path for Each Implementation Object> // Default: v4.0.0
    network: <Network Object>
  }

  @returns
  <Polar Chart Object>
*/
export const initChartFromNetwork = ({
  icons = buildIcons,
  network,
}: {
  icons?: ChartIcons;
  network: Network;
}) => {
  const chart: PolarChart = {
    offset: {x: 0, y: 0},
    nodes: {},
    links: {},
    selected: {},
    hovered: {},
    scale: 1,
  };

  const yOffset = network.nodes.tap.length > 0 ? space.y : 0;

  network.nodes.bitcoin.forEach(n => {
    const {link, node} = createBitcoinChartNode({icons, node: n, yOffset});

    chart.nodes[node.id] = node;

    if (!!link) {
      chart.links[link.id] = link;
    }
  });

  network.nodes.lightning.forEach(n => {
    const {link, node} = createLightningChartNode({icons, node: n, yOffset});

    chart.nodes[node.id] = node;
    chart.links[link.id] = link;
  });

  network.nodes.tap.forEach(n => {
    const {link, node} = createTapdChartNode({chart, icons, node: n});

    chart.nodes[node.id] = node;
    chart.links[link.id] = link;
  });

  return chart;
};

/** Get the icon path of each node implementation

  An implementation gets the icon of a chart node of the same implementation
  in the charts, so that a different Polar build shows the icon. Else it gets
  the Polar v4.0.0 build path.

  {
    charts: <Charts of the Networks File Object>
    networks: [<Network Object>]
  }

  @returns
  <Icon Path for Each Implementation Object>
*/
export const chartIcons = ({
  charts,
  networks,
}: {
  charts: PolarCharts;
  networks: Network[];
}): ChartIcons => {
  const icons: ChartIcons = {};

  networks.forEach(network => {
    const chart = charts[network.id];

    if (!isChart(chart)) {
      return;
    }

    allNodes(network)
      .filter(n => hasNode(chart, n.name))
      .forEach(n => {
        const {properties} = chart.nodes[n.name];
        const icon = isObject(properties) ? properties.icon : undefined;

        if (typeof icon === 'string' && !!icon) {
          icons[n.implementation] ??= icon;
        }
      });
  });

  return {...buildIcons, ...icons};
};

/** Rename a node in the chart of a network

  The chart node keeps its position. The links of the node get the new name,
  and a backend, btcpeer, or lndbackend link gets a new id. A chart with no
  node of the old name does not change.

  {
    charts: <Charts of the Networks File Object>
    id: <Network Id Number>
    name: <New Node Name String>
    nodeId: <Old Node Name String>
  }
*/
export const renameChartNode = ({
  charts,
  id,
  name,
  nodeId,
}: {
  charts: PolarCharts;
  id: number;
  name: string;
  nodeId: string;
}) => {
  const chart = charts[id];

  if (!isChart(chart) || !hasNode(chart, nodeId) || name === nodeId) {
    return;
  }

  const links: PolarChart['links'] = {};

  Object.entries(chart.links).forEach(([key, link]) => {
    if (!isLink(link)) {
      links[key] = link;

      return;
    }

    if (link.from.nodeId === nodeId) {
      link.from.nodeId = name;
    }

    if (link.to.nodeId === nodeId) {
      link.to.nodeId = name;
    }

    if (nodeLinkTypes.includes(type(link))) {
      link.id = `${link.from.nodeId}-${link.to.nodeId}`;
    }

    links[link.id] = link;
  });

  const nodes = {...chart.nodes, [name]: {...chart.nodes[nodeId], id: name}};

  delete nodes[nodeId];

  charts[id] = {...chart, nodes, links};
};

// Get the links that Polar makes from the nodes of a network
const nodeLinks = (network: Network) => {
  const links = new Map<string, ChartLink>();

  network.nodes.lightning.forEach(ln => {
    const link = backendLink(ln);

    links.set(link.id, link);
  });

  // The first peer of each bitcoind node after the first is the previous node
  network.nodes.bitcoin.slice(1).forEach(btc => {
    const [peer] = btc.peers;

    if (!!peer) {
      links.set(`${peer}-${btc.name}`, peerLink(btc, peer));
    }
  });

  network.nodes.tap
    .filter(n => n.implementation === 'tapd')
    .forEach(tapd => {
      const link = tapdLink(tapd);

      links.set(link.id, link);
    });

  return links;
};

// A selected or hovered item that points to a node or a link that is gone
const isGone = (chart: PolarChart, item: unknown) => {
  if (!isObject(item)) {
    return false;
  }

  switch (item.type) {
    case 'link':
      return !hasKey(chart.links, item.id);

    case 'node':
      return !hasNode(chart, item.id);

    default:
      return false;
  }
};

/** Make the chart of a network match the nodes of the network

  - A network with no chart gets a new chart.
  - A node with no chart node gets a chart node at the Polar start position.
  - A chart node with no network node goes away, with its links and the
    channel ports of its links.
  - The backend, btcpeer, and lndbackend links match the nodes, as in Polar
    updateChartFromNodes.
  - A selected or hovered node or link that is gone is not selected or
    hovered.
  - The status of each chart node is the status number of its node.

  The positions, the sizes, and the channel links of the other nodes stay.

  {
    chart: <Polar Chart Object or Undefined>
    icons: <Icon Path for Each Implementation Object>
    network: <Network Object>
  }

  @returns
  <Polar Chart Object>
*/
export default ({
  chart,
  icons,
  network,
}: {
  chart: unknown;
  icons: ChartIcons;
  network: Network;
}): PolarChart => {
  const synced = isChart(chart)
    ? chart
    : initChartFromNetwork({icons, network});

  const {bitcoin, lightning, tap} = network.nodes;
  const names = new Set(allNodes(network).map(n => n.name));
  const yOffset = tap.length > 0 ? space.y : 0;

  bitcoin
    .filter(n => !hasNode(synced, n.name))
    .forEach(n => {
      synced.nodes[n.name] = createBitcoinChartNode({
        icons,
        node: n,
        yOffset,
      }).node;
    });

  lightning
    .filter(n => !hasNode(synced, n.name))
    .forEach(n => {
      synced.nodes[n.name] = createLightningChartNode({
        icons,
        node: n,
        yOffset,
      }).node;
    });

  tap
    .filter(n => !hasNode(synced, n.name))
    .forEach(n => {
      synced.nodes[n.name] = createTapdChartNode({
        chart: synced,
        icons,
        node: n,
      }).node;
    });

  Object.keys(synced.nodes)
    .filter(id => !names.has(id))
    .forEach(id => delete synced.nodes[id]);

  const links = nodeLinks(network);

  // A changed backend or peer leaves a node link that Polar does not make
  Object.entries(synced.links)
    .filter(([, link]) => isLink(link) && nodeLinkTypes.includes(type(link)))
    .filter(([id]) => !links.has(id))
    .forEach(([id]) => delete synced.links[id]);

  links.forEach((link, id) => {
    if (!hasKey(synced.links, id) || !isLink(synced.links[id])) {
      synced.links[id] = link;
    }
  });

  Object.entries(synced.links)
    .filter(([, link]) => {
      return (
        !isLink(link) ||
        !hasNode(synced, link.from.nodeId) ||
        !hasNode(synced, link.to.nodeId)
      );
    })
    .forEach(([id]) => {
      delete synced.links[id];

      // A channel port has the id of its channel link
      Object.values(synced.nodes)
        .filter(node => isObject(node.ports) && !nodePortIds.includes(id))
        .forEach(node => delete node.ports[id]);
    });

  if (isGone(synced, synced.selected)) {
    synced.selected = {};
  }

  if (isGone(synced, synced.hovered)) {
    synced.hovered = {};
  }

  allNodes(network).forEach(n => {
    const node = synced.nodes[n.name];

    if (!isObject(node.properties)) {
      node.properties = {};
    }

    node.properties.status = statusCode(n.status);
  });

  return synced;
};
