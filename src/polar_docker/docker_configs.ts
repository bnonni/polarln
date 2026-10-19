// Polar v4.0.0 values for the bitcoind and LND nodes.
// Ported from jamaljsr/polar (MIT): src/utils/constants.ts.

/** Node Implementations That the Docker Backend Supports */
export type DockerImplementation = 'bitcoind' | 'LND';

type RepoImage = {
  /** Highest bitcoind Version for Each Version (LND) */
  compatibility?: {[version: string]: string};
  latest: string;
  versions: string[];
};

/** First Host Port of Each Node Port (Polar BasePorts) */
export const basePorts = {
  bitcoind: {p2p: 19444, rest: 18443, zmqBlock: 28334, zmqTx: 29335},
  LND: {grpc: 10001, p2p: 9735, rest: 8081},
};

/** bitcoind RPC Credentials of All Polar Networks */
export const bitcoinCredentials = {
  pass: 'polarpass',
  rpcauth:
    '5e5e98c21f5c814568f8b55d83b23c1c$$066b03f92df30b11de8e4b1b1cd5b1b4281aa25205bd57df9be82caf97a05526',
  user: 'polaruser',
};

/** Blocks for a Confirmed Transaction */
export const blocksTilConfirmed = 6;

/** Prefix of the Container Names and the Compose Project Names */
export const containerPrefix = 'polarln';

/** Default Node Commands, Docker Images, and Volume Directories */
export const dockerConfigs: {
  [implementation in DockerImplementation]: {
    command: string;
    imageName: string;
    volumeDirName: string;
  };
} = {
  bitcoind: {
    command: [
      'bitcoind',
      '-server=1',
      '-regtest=1',
      '-rpcauth={{rpcUser}}:{{rpcAuth}}',
      '-debug=1',
      '-zmqpubrawblock=tcp://0.0.0.0:28334',
      '-zmqpubrawtx=tcp://0.0.0.0:28335',
      '-zmqpubhashblock=tcp://0.0.0.0:28336',
      '-txindex=1',
      '-dnsseed=0',
      '-rpcbind=0.0.0.0',
      '-rpcallowip=0.0.0.0/0',
      '-rpcport=18443',
      '-rest',
      '-listen=1',
      '-listenonion=0',
      '-fallbackfee=0.0002',
      '-blockfilterindex=1',
      '-peerblockfilters=1',
    ].join('\n  '),
    imageName: 'polarlightning/bitcoind',
    volumeDirName: 'bitcoind',
  },
  LND: {
    command: [
      'lnd',
      '--noseedbackup',
      '--debuglevel=debug',
      '--trickledelay=5000',
      '--alias={{name}}',
      '--externalip={{name}}',
      '--tlsextradomain={{name}}',
      '--tlsextradomain={{containerName}}',
      '--tlsextradomain=host.docker.internal',
      '--listen=0.0.0.0:9735',
      '--rpclisten=0.0.0.0:10009',
      '--restlisten=0.0.0.0:8080',
      '--bitcoin.active',
      '--bitcoin.regtest',
      '--bitcoin.node=bitcoind',
      '--bitcoind.rpchost={{backendName}}',
      '--bitcoind.rpcuser={{rpcUser}}',
      '--bitcoind.rpcpass={{rpcPass}}',
      '--bitcoind.zmqpubrawblock=tcp://{{backendName}}:28334',
      '--bitcoind.zmqpubrawtx=tcp://{{backendName}}:28335',
      '--accept-keysend',
      '--accept-amp',
    ].join('\n  '),
    imageName: 'polarlightning/lnd',
    volumeDirName: 'lnd',
  },
};

/** Docker Image Versions (Polar defaultRepoState version 77) */
export const repoState: {[implementation in DockerImplementation]: RepoImage} =
  {
    bitcoind: {
      latest: '30.0',
      versions: ['30.0', '29.0', '28.0', '27.0', '26.0'],
    },
    LND: {
      compatibility: {
        '0.20.0-beta': '30.0',
        '0.19.3-beta': '30.0',
        '0.19.2-beta': '30.0',
        '0.19.1-beta': '30.0',
        '0.19.0-beta': '30.0',
        '0.18.5-beta': '30.0',
        '0.18.4-beta': '30.0',
        '0.18.3-beta': '27.0',
        '0.18.2-beta': '27.0',
        '0.18.1-beta': '27.0',
        '0.18.0-beta': '27.0',
        '0.17.5-beta': '27.0',
        '0.16.4-beta': '27.0',
      },
      latest: '0.20.0-beta',
      versions: [
        '0.20.0-beta',
        '0.19.3-beta',
        '0.19.2-beta',
        '0.19.1-beta',
        '0.19.0-beta',
        '0.18.5-beta',
        '0.18.4-beta',
        '0.18.3-beta',
        '0.18.2-beta',
        '0.18.1-beta',
        '0.18.0-beta',
        '0.17.5-beta',
        '0.16.4-beta',
      ],
    },
  };
