import {deepStrictEqual} from 'node:assert/strict';
import {equal} from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {mkdtemp} from 'node:fs/promises';
import {rm} from 'node:fs/promises';
import {symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';

import {isPolarHome} from '../../src/polar_app/polar_home.js';
import {polarHome} from '../../src/polar_app/polar_home.js';

// Run a function with a new home directory in the temporary folder
const withHome = async (use: (home: string) => Promise<void>) => {
  const home = await mkdtemp(join(tmpdir(), 'polarln-home-'));

  try {
    await use(home);
  } finally {
    await rm(home, {force: true, recursive: true});
  }
};

test('The Polar home is .polar if there is no .local/share/polar', () => {
  return withHome(async home => {
    const dotPolar = join(home, '.polar');

    equal(polarHome({home}), dotPolar, 'Got .polar with no folders');

    await mkdir(dotPolar);
    await mkdir(join(home, '.local', 'share'), {recursive: true});

    equal(polarHome({home}), dotPolar, 'Got .polar');

    equal(isPolarHome({dataDir: dotPolar, home}), true, 'Got the Polar home');
  });
});

test('The Polar home is .local/share/polar if that folder exists', () => {
  return withHome(async home => {
    const xdg = join(home, '.local', 'share', 'polar');

    await mkdir(join(home, '.polar'));
    await mkdir(xdg, {recursive: true});

    equal(polarHome({home}), xdg, 'Got .local/share/polar');

    equal(isPolarHome({dataDir: xdg, home}), true, 'Got the Polar home');
  });
});

test('A symbolic link to the Polar home is the Polar home', () => {
  return withHome(async home => {
    const dotPolar = join(home, '.polar');
    const link = join(home, 'link');
    const homeLink = join(home, 'home-link');

    await mkdir(join(home, 'other'));
    await mkdir(dotPolar);
    await symlink(dotPolar, link);
    await symlink(home, homeLink);

    deepStrictEqual(
      [
        isPolarHome({dataDir: link, home}),
        isPolarHome({dataDir: join(homeLink, '.polar'), home}),
        isPolarHome({dataDir: dotPolar, home: homeLink}),
        isPolarHome({dataDir: join(home, 'other', '..', '.polar'), home}),
      ],
      [true, true, true, true],
      'Got the Polar home for each path to the same folder',
    );
  });
});

test('Both Polar folders are the Polar home', () => {
  return withHome(async home => {
    const dirs = [join(home, '.local', 'share', 'polar'), join(home, '.polar')];

    deepStrictEqual(
      dirs.map(dataDir => isPolarHome({dataDir, home})),
      [true, true],
      'Got the Polar home for the folders that are not there',
    );

    for (const dir of dirs) {
      await mkdir(dir, {recursive: true});
    }

    deepStrictEqual(
      dirs.map(dataDir => isPolarHome({dataDir, home})),
      [true, true],
      'Got the Polar home for the folders that exist',
    );
  });
});

test('A different folder is not the Polar home', () => {
  return withHome(async home => {
    const dotPolar = join(home, '.polar');
    const other = join(home, 'other');

    await mkdir(join(dotPolar, 'networks'), {recursive: true});
    await mkdir(join(other, '.polar'), {recursive: true});

    deepStrictEqual(
      [
        isPolarHome({dataDir: join(home, '.polarln'), home}),
        isPolarHome({dataDir: join(dotPolar, 'networks'), home}),
        isPolarHome({dataDir: home, home}),
        isPolarHome({dataDir: join(other, '.polar'), home}),
        isPolarHome({dataDir: dotPolar, home: other}),
      ],
      [false, false, false, false, false],
      'Got no Polar home',
    );
  });
});
