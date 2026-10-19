/** Arguments of a Docker Backend Tool */
export type ToolArgs<T> = {
  /** Tool Arguments */
  args: Partial<T>;
  /** Data Directory Path */
  dataDir: string;
};
