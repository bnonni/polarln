// Ported from jamaljsr/polar (MIT): src/store/models/mcp/lightning/payments/payInvoice.ts.

import type {PayInvoiceArgs} from '../../polar_methods/index.js';
import {payInvoice} from '../lightning_actions.js';
import {networkById} from '../network_file.js';
import {findLndNode} from './find_node.js';
import type {ToolArgs} from './types.js';
import {validateNetworkId} from './validate.js';
import {validateRequired} from './validate.js';

/** Pay an invoice from a lightning node */
export default async ({args, dataDir}: ToolArgs<PayInvoiceArgs>) => {
  validateNetworkId(args.networkId);
  validateRequired(args.fromNode, 'fromNode name');
  validateRequired(args.invoice, 'Invoice');

  const network = await networkById({dataDir, id: args.networkId});

  const node = findLndNode({network, nodeName: args.fromNode});

  const receipt = await payInvoice({
    amount: args.amount,
    invoice: args.invoice as string,
    node,
  });

  return {
    success: true,
    message: `Paid invoice from node "${args.fromNode}"`,
    networkId: args.networkId,
    fromNode: args.fromNode,
    invoice: args.invoice,
    amount: args.amount,
    preimage: receipt.preimage,
    destination: receipt.destination,
  };
};
