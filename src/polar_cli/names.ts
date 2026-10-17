const underscores = /_/g;
const upperCase = /[A-Z]/g;

/** Get the command name of a tool name (open_channel gives open-channel) */
export const commandName = (tool: string) => tool.replace(underscores, '-');

/** Get the flag name of an argument name (networkId gives network-id) */
export const flagName = (arg: string) =>
  arg.replace(upperCase, letter => `-${letter.toLowerCase()}`);
