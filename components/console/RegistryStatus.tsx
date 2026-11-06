import type { ReactNode } from "react";

import { registryMessage } from "./messages";
import styles from "./console.module.css";

export function PageHeader({ title, lede }: { title: string; lede: string }) {
  return (
    <header className={styles.pageHeader}>
      <h1>{title}</h1>
      <p>{lede}</p>
    </header>
  );
}

export function LoadingState() {
  return (
    <p className={styles.status} role="status">
      Loading registry records.
    </p>
  );
}

export function ErrorState({ code, onRetry }: { code: string; onRetry?: () => void }) {
  return (
    <div className={styles.notice} role="alert">
      <h2>Registry unavailable</h2>
      <p>{registryMessage(code)}</p>
      {onRetry ? (
        <button type="button" className={styles.secondaryButton} onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className={styles.notice} role="status">
      <h2>{title}</h2>
      <p>{children}</p>
    </div>
  );
}
