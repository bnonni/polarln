// Ported from jamaljsr/polar (MIT): src/shared/types.ts (Status).

import type {Status} from '../typescript/index.js';

/** Polar v4.0.0 Status Labels, With the Status Number as the Index

  The Polar networks file has the numbers. The results have the labels, as in
  the Polar bridge results.
*/
const statusLabels: readonly Status[] = [
  'Starting',
  'Started',
  'Stopping',
  'Stopped',
  'Error',
];

/** Get the number of a status

  A status label gives its number. A number from 0 to 4 stays the same.

  <Status Value>

  @returns
  <Status Number> or undefined if the value is not a Polar status
*/
export const statusCode = (value: unknown): number | undefined => {
  if (typeof value === 'number') {
    return statusLabels[value] === undefined ? undefined : value;
  }

  const index = statusLabels.indexOf(value as Status);

  return index === -1 ? undefined : index;
};

/** Get the label of a status number

  A number that is not a Polar status stays the same, as in the Polar bridge

  <Status Value>

  @returns
  <Status Label String> or the value with no change
*/
export const statusLabel = (value: unknown): unknown =>
  (typeof value === 'number' && statusLabels[value]) || value;
