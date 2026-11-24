import { Outlet, createRootRoute } from '@tanstack/react-router';

import styles from './root.module.css';

export const APP_TITLE = 'Dragons of Mugloar';

const RootLayout = () => (
  <div className={styles.layout}>
    <header className={styles.header}>
      <h1 className={styles.title}>{APP_TITLE}</h1>
    </header>
    <main className={styles.main}>
      <Outlet />
    </main>
  </div>
);

export const Route = createRootRoute({ component: RootLayout });
