export default function DocumentationLoading() {
  return <main className="workspace-docs docs-guide" aria-busy="true" aria-label="Loading documentation">
    <span className="sr-only" role="status">Loading documentation</span>
    <div className="docs-loading-header" aria-hidden="true"><strong>Cloudbreakr</strong><span className="loading-line"/></div>
    <div className="docs-layout" aria-hidden="true">
      <aside className="docs-loading-navigation">{Array.from({length: 7}, (_, i) => <span className="loading-line" key={i}/>)}</aside>
      <article className="docs-article docs-loading-article"><span className="docs-eyebrow">Documentation</span><h1>Instagram Post Monitoring</h1>
        <span className="loading-line"/><span className="loading-line"/>
        <div className="docs-loading-section"><span className="loading-line"/>{Array.from({length: 4}, (_, i) => <span className="loading-line" key={i}/>)}</div>
      </article>
    </div>
  </main>;
}
