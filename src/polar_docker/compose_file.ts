// Ported from jamaljsr/polar (MIT): src/lib/docker/composeFile.ts,
// src/lib/docker/nodeTemplates.ts (bitcoind and LND).

import type {BitcoinNode} from '../typescript/index.js';
import type {LndNode} from '../typescript/index.js';
import type {Network} from '../typescript/index.js';
import {bitcoinCredentials} from './docker_configs.js';
import {containerPrefix} from './docker_configs.js';
import {dockerConfigs} from './docker_configs.js';
import {containerName} from './node_names.js';

type Service = {
  command: string;
  container_name: string;
  expose: string[];
  hostname: string;
  image: string;
  ports: string[];
  restart?: 'always';
  stop_grace_period?: string;
  volumes: string[];
};

// Remove all line breaks and extra white space inside of a string
const trimInside = (text: string) => text.replace(/\s+/g, ' ').trim();

// Replace each {{variable}} in a command
const mergeCommand = (command: string, variables: {[key: string]: string}) => {
  return Object.entries(variables).reduce((merged, [key, value]) => {
    return merged.split(`{{${key}}}`).join(value);
  }, command);
};

const service = (svc: Service) => ({
  environment: {USERID: '${USERID:-1000}', GROUPID: '${GROUPID:-1000}'},
  stop_grace_period: '30s',
  ...svc,
});

const bitcoind = (node: BitcoinNode) => {
  const {name, ports} = node;
  const {imageName, volumeDirName} = dockerConfigs.bitcoind;

  const command = mergeCommand(
    node.docker.command || dockerConfigs.bitcoind.command,
    {
      rpcAuth: bitcoinCredentials.rpcauth,
      rpcUser: bitcoinCredentials.user,
    },
  );

  return service({
    image: node.docker.image || `${imageName}:${node.version}`,
    container_name: containerName(node),
    hostname: name,
    stop_grace_period: '5m',
    command: trimInside(command),
    volumes: [`./volumes/${volumeDirName}/${name}:/home/bitcoin/.bitcoin`],
    expose: ['18443', '18444', '28334', '28335'],
    ports: [
      `${ports.rpc}:18443`,
      `${ports.p2p}:18444`,
      `${ports.zmqBlock}:28334`,
      `${ports.zmqTx}:28335`,
    ],
  });
};

const lnd = (node: LndNode, backend: BitcoinNode) => {
  const {name, ports} = node;
  const {imageName, volumeDirName} = dockerConfigs.LND;

  const command = mergeCommand(
    node.docker.command || dockerConfigs.LND.command,
    {
      backendName: containerName(backend),
      containerName: containerName(node),
      name,
      rpcPass: bitcoinCredentials.pass,
      rpcUser: bitcoinCredentials.user,
    },
  );

  return service({
    image: node.docker.image || `${imageName}:${node.version}`,
    container_name: containerName(node),
    hostname: name,
    command: trimInside(command),
    restart: 'always',
    volumes: [`./volumes/${volumeDirName}/${name}:/home/lnd/.lnd`],
    expose: ['8080', '10009', '9735'],
    ports: [`${ports.rest}:8080`, `${ports.grpc}:10009`, `${ports.p2p}:9735`],
  });
};

/** Get the docker compose file of a network

  The file is JSON. JSON is valid YAML, so docker compose reads the file.

  {
    network: <Network Object>
  }

  @throws
  <Error>

  @returns
  {
    file: <Compose File JSON String>
  }
*/
export default ({network}: {network: Network}): {file: string} => {
  const {bitcoin, lightning, tap} = network.nodes;
  const services: {[name: string]: ReturnType<typeof service>} = {};

  bitcoin.forEach(node => (services[node.name] = bitcoind(node)));

  lightning.forEach(node => {
    if (node.implementation !== 'LND') {
      throw new Error(
        `polarDocker does not support ${node.implementation} nodes yet`,
      );
    }

    const backend =
      bitcoin.find(n => n.name === node.backendName) || bitcoin[0];

    services[node.name] = lnd(node, backend);
  });

  if (!!tap.length) {
    throw new Error('polarDocker does not support tapd nodes yet');
  }

  const content = {name: `${containerPrefix}-network-${network.id}`, services};

  return {file: `${JSON.stringify(content, null, 2)}\n`};
};
