// Child process of the networks file lock test. It adds 1 to the count key of
// one network for a number of times, from a start time.
//
// Arguments: <data directory> <network id> <number of changes> <start time ms>

import type {Network} from '../../src/index.js';
import dataFolder from '../../src/polar_docker/data_folder.js';
import {changeNetworks} from '../../src/polar_docker/network_file.js';
import {delay} from '../../src/polar_docker/wait_for.js';

const [dataDir, id, changes, startAt] = process.argv.slice(2);

const folder = dataFolder({dataDir});

await delay(Math.max(0, Number(startAt) - Date.now()));

for (let i = 0; i < Number(changes); i += 1) {
  await changeNetworks({
    change: networks => {
      const network = networks.find(n => n.id === Number(id)) as Network & {
        count?: number;
      };

      network.count = (network.count ?? 0) + 1;
    },
    folder,
  });
}
