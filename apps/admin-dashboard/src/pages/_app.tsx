import type { AppProps } from 'next/app';

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={{ width: 220, borderRight: '1px solid #eee', padding: 16 }}>
        <h3>Admin</h3>
        <nav>
          <div><a href="/dashboard">Dashboard</a></div>
          <div><a href="/approvals">Approvals</a></div>
          <div><a href="/live">Live</a></div>
          <div><a href="/fraud">Fraud</a></div>
          <div><a href="/business">Business</a></div>
          <div><a href="/overrides">Overrides</a></div>
          <div><a href="/audit">Audit</a></div>
        </nav>
      </aside>
      <main style={{ flex: 1 }}>{children}</main>
    </div>
  );
}

export default function App({ Component, pageProps }: AppProps) {
  return (
    <Layout>
      <Component {...pageProps} />
    </Layout>
  );
}

