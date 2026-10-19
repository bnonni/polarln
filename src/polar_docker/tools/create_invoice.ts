// Ported from jamaljsr/polar (MIT): src/store/models/mcp/lightning/payments/createInvoice.ts.

import type {CreateInvoiceArgs} from '../../polar_methods/index.js';
import {createInvoice} from '../lnd_service.js';
import {networkById} from '../network_file.js';
import {findLndNode} from './find_node.js';
import type {ToolArgs} from './types.js';
import {validateNetworkId} from './validate.js';
import {validatePositiveNumber} from './validate.js';
import {validateRequired} from './validate.js';

/** Create an invoice on a lightning node */
export default async ({args, dataDir}: ToolArgs<CreateInvoiceArgs>) => {
  validateNetworkId(args.networkId);
  validateRequired(args.nodeName, 'Node name');
  validatePositiveNumber(args.amount, 'Amount');

  const network = await networkById({dataDir, id: args.networkId});

  const node = findLndNode({network, nodeName: args.nodeName});

  const invoice = await createInvoice({
    amount: args.amount as number,
    memo: args.memo,
    node,
  });

  return {
    success: true,
    message: `Created invoice for ${args.amount} sats on node "${args.nodeName}"`,
    networkId: args.networkId,
    nodeName: args.nodeName,
    amount: args.amount,
    memo: args.memo,
    invoice,
  };
};
