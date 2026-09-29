export default function Loading() {
  return <div className="app-shell" aria-busy="true" aria-label="Memuat dashboard">
    <aside className="sidebar"/>
    <div className="workspace">
      <header className="topbar"/>
      <main className="page-content">
        <div className="skeleton skeleton-title"/>
        <section className="kpi-grid">{[0, 1, 2, 3].map((key) => <div className="skeleton skeleton-card" key={key}/>)}</section>
        <section className="overview-grid"><div className="skeleton skeleton-panel"/><div className="skeleton skeleton-panel"/></section>
        <div className="skeleton skeleton-panel"/>
      </main>
    </div>
  </div>;
}
