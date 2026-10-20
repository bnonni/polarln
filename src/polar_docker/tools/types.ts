import type {DataFolder} from '../data_folder.js';

/** Arguments of a Docker Backend Tool */
export type ToolArgs<T> = {
  /** Tool Arguments */
  args: Partial<T>;
  /** Data Folder */
  folder: DataFolder;
};
