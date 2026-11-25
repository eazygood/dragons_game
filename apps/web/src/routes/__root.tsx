import { Link, Outlet, createRootRoute } from '@tanstack/react-router';

import { sharedCopy } from '../shared/shared-copy.ts';
import styles from './root.module.css';

const RootLayout = () => (
  <>
    <header className={styles.header}>
      <h1 className={styles.title}>
        <Link to="/" className={styles.titleLink}>
          {sharedCopy.appTitle}
        </Link>
      </h1>
    </header>
    <main className={styles.main}>
      <Outlet />
    </main>
  </>
);

export const Route = createRootRoute({ component: RootLayout });
