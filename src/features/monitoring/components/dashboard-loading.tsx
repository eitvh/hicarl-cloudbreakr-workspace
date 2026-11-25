import Image from "next/image";

export function DashboardLoading() {
  return (
    <main className="dash-shell dashboard-loading" aria-label="Pipeline dashboard" aria-busy="true">
      <span className="sr-only" role="status">Loading dashboard</span>
      <div className="dash-workspace" aria-hidden="true">
        <header className="pipeline-header">
          <div className="dash-header">
            <div className="flex items-center gap-3">
              <span className="cloudbreakr-symbol"><Image src="/brand/cloudbreakr-symbol.png" width={192} height={192} alt="" priority/></span>
              <strong className="cloudbreakr-title">Cloudbreakr</strong>
            </div>
            <i className="loading-line w-20"/>
          </div>
          <div className="dash-heading">
            <div className="pipeline-identity"><Image className="instagram-outline" src="/brand/instagram-outline.svg" alt="" width={36} height={36}/><h1>IG Post Pipeline Automation</h1></div>
            <i className="loading-line w-32"/>
          </div>
        </header>
        <div className="loading-filters">{[0,1,2].map(i=><i key={i} className="loading-line"/>)}</div>
        <div className="dash-metrics">{[0,1,2,3].map(i=>(
          <div key={i} className="loading-card">
            <i className="loading-line w-2/5"/><i className="loading-line loading-value"/><i className="loading-line w-1/2"/>
          </div>
        ))}</div>
        <div className="loading-panels">
          <div className="loading-nav">{[0,1,2,3].map(i=><i key={i} className="loading-line"/>)}</div>
          {[0,1].map(i=><div className="loading-card" key={i}>
            <i className="loading-line w-1/3"/><i className="loading-line loading-value"/>
            <i className="loading-line w-full"/><i className="loading-line w-4/5"/><i className="loading-line w-3/5"/>
          </div>)}
        </div>
      </div>
    </main>
  );
}
