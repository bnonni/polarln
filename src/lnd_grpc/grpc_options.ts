import type {Options} from '@grpc/proto-loader';

/** Proto loader options

  The options are the same as in the @lightningpolar packages that Polar uses.
  There is no keepCase, so the field names are camelCase, as in Polar.
*/
export default {
  defaults: true,
  enums: String,
  longs: String,
  oneofs: true,
} satisfies Options;
