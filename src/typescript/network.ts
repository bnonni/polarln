// Polar network and node shapes, as the Polar v4 HTTP bridge returns them.
// Ported from jamaljsr/polar (MIT): src/shared/types.ts, src/types/index.ts.

/** Automatic Mine Interval Seconds (0 is off) */
export type AutoMineMode = 0 | 30 | 60 | 300 | 600;

/** Node Implementation */
export type NodeImplementation =
  | 'bitcoind'
  | 'btcd'
  | 'c-lightning'
  | 'eclair'
  | 'litd'
  | 'LND'
  | 'tapd';

/** Network or Node Status (the bridge sends the label, not the number) */
export type Status =
  | 'Error'
  | 'Locked'
  | 'Started'
  | 'Starting'
  | 'Stopped'
  | 'Stopping';

type CommonNode = {
  /** Docker Image and Command Overrides (empty string is the default) */
  docker: {command: string; image: string};
  /** Error Message */
  errorMsg?: string;
  /** Node Id in the Network */
  id: number;
  /** Node Name */
  name: string;
  /** Network Id */
  networkId: number;
  /** Node Status */
  status: Status;
  /** Implementation Version */
  version: string;
};

export type BitcoinNode = CommonNode & {
  implementation: 'bitcoind' | 'btcd';
  /** Peer Node Names */
  peers: string[];
  /** Host Ports (bitcoind: rpc, p2p, zmqBlock, zmqTx) */
  ports: Record<string, number>;
  type: 'bitcoin';
};

type CommonLightningNode = CommonNode & {
  /** Bitcoin Backend Node Name */
  backendName: string;
  type: 'lightning';
};

export type CLightningNode = CommonLightningNode & {
  implementation: 'c-lightning';
  paths: {
    rune: string;
    tlsCert?: string;
    tlsClientCert?: string;
    tlsClientKey?: string;
  };
  ports: {grpc: number; p2p: number; rest: number};
};

export type EclairNode = CommonLightningNode & {
  implementation: 'eclair';
  ports: {p2p: number; rest: number};
};

export type LitdNode = CommonLightningNode & {
  implementation: 'litd';
  /** Integrated lnd Node Name (the same as the litd node name) */
  lndName: string;
  paths: {
    /** lnd Admin Macaroon Path */
    adminMacaroon: string;
    /** lnd Invoice Macaroon Path */
    invoiceMacaroon: string;
    /** litd Macaroon Path */
    litMacaroon: string;
    /** litd TLS Certificate Path */
    litTlsCert: string;
    /** lnd Read-Only Macaroon Path */
    readonlyMacaroon: string;
    /** Integrated tapd Admin Macaroon Path */
    tapMacaroon: string;
    /** lnd TLS Certificate Path */
    tlsCert: string;
  };
  /** Host Ports (web is the litd, lnd proxy, and tapd gRPC port) */
  ports: {grpc: number; p2p: number; rest: number; web: number};
};

export type LndNode = CommonLightningNode & {
  implementation: 'LND';
  paths: {
    adminMacaroon: string;
    invoiceMacaroon: string;
    readonlyMacaroon: string;
    tlsCert: string;
  };
  ports: {grpc: number; p2p: number; rest: number};
};

export type LightningNode = CLightningNode | EclairNode | LitdNode | LndNode;

export type TapdNode = CommonNode & {
  implementation: 'tapd';
  /** lnd Backend Node Name */
  lndName: string;
  paths: {adminMacaroon: string; tlsCert: string};
  ports: {grpc: number; rest: number};
  type: 'tap';
};

export type PolarNode = BitcoinNode | LightningNode | TapdNode;

export type Network = {
  autoMineMode: AutoMineMode;
  description?: string;
  id: number;
  /** Blocks to Mine With the Manual Mine Button */
  manualMineCount?: number;
  name: string;
  nodes: {
    bitcoin: BitcoinNode[];
    lightning: LightningNode[];
    tap: TapdNode[];
  };
  /** Network Directory Path */
  path: string;
  /** Activity Simulation Settings */
  simulation?: unknown;
  status: Status;
};
