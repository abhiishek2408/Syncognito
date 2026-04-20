export default function Pricing() {
  return (
    <div className="page-container">
      <div className="doc-header">
        <div className="doc-updated">Account Upgrades</div>
        <h1 className="doc-title">Project Pricing Matrices</h1>
      </div>
      <div className="doc-content">
        <h2>Open Beta (Current Tier: Free)</h2>
        <p>Syncognito is currently in robust open beta, heavily subsidized by our internal development teams. Therefore, core synchronization functionality is 100% free. You can host limitless rooms, invite as many geographical peers to your session as you desire, and stream continuously without artificial time caps, embedded tracking, or audio advertisements breaking your flow state.</p>
        
        <h2>Future-Proof Audio Standards</h2>
        <p>Our commitment is that the core sync-social experience must remain barrier-free. Basic audio transmission and socket syncing will never be placed behind a strict paywall.</p>

        <h2>Anticipated 'Audiophile Pro' Tier</h2>
        <p>Once out of beta, we anticipate launching a strictly optional 'Audiophile Pro' subscription structure. This will cater specifically to power users who demand edge-server routing to push absolute zero-compression, lossless FLAC format audio bitrates across the WebRTC streams. The Pro tier may also include bespoke AMOLED room themes, elevated API rate-limits, and priority technical routing.</p>
      </div>
    </div>
  );
}
