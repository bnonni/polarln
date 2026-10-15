import type {PolarError} from '../typescript/index.js';

// Polar sends each tool failure as HTTP 500 with only an error message.
// The first rule that matches the message gives the code and the message.
const rules: [RegExp, number, string][] = [
  [/^Unknown tool\b/i, 501, 'PolarToolNotSupported'],
  [/\btimed out\b|\btimeout\b/i, 504, 'PolarToolTimedOut'],
  [/^Network\b.*\bnot found\b/i, 404, 'PolarNetworkNotFound'],
  [/\bnode\b.*\bnot found\b|\bhas no\b.*\bnodes\b/i, 404, 'PolarNodeNotFound'],
  [/\bnot found\b|\bdoes not exist\b/i, 404, 'PolarObjectNotFound'],
  [
    /\bis required\b|\bmust\b|\bcannot\b|\binvalid\b/i,
    400,
    'PolarRejectedArguments',
  ],
];

/** Get a rejection for a Polar tool error message

  {
    err: <Polar Error Message String>
    tool: <Tool Name String>
  }

  @returns
  [<Code Number>, <Message String>, {err, tool}]
*/
export default ({err, tool}: {err: string; tool: string}): PolarError => {
  const rule = rules.find(([pattern]) => pattern.test(err));

  if (!rule) {
    return [503, 'PolarToolFailed', {err, tool}];
  }

  const [, code, message] = rule;

  return [code, message, {err, tool}];
};
