import type { ReactNode } from 'react';

import styles from './Panel.module.css';

export const Panel = ({ children, titleId }: { children: ReactNode; titleId?: string }) => (
  <section className={styles.panel} aria-labelledby={titleId}>
    {children}
  </section>
);
