export default function Privacy() {
  return (
    <div className="page-container">
      <div className="doc-header">
        <div className="doc-updated">Data Transparency</div>
        <h1 className="doc-title">Universal Privacy Policy</h1>
      </div>
      
      <div className="doc-content">
        <h2>1. Zero-Knowledge Information Collection</h2>
        <p>
          At Syncognito, we inherently prioritize your extreme privacy. We operate on a data-minimal architecture, collecting only what is technologically required to operate our real-time synchronization backend. This includes standard authentication credentials, your chosen arbitrary username, and anonymous diagnostic logs for WebSocket stability. We never scan, track, store, or sell metadata regarding your music library, specific song choices, or listening habits.
        </p>

        <h2>2. Public by Default Paradigm</h2>
        <p>
          As openly stated within the application's interface, your profile username, and the rooms you explicitly host are visible to members who possess your unique connection URI or User ID. Private chat logs within rooms are ephemeral; they exist in RAM for the lifecycle of the session and are purged off our physical cloud drives the exact millisecond the room breaks down.
        </p>

        <h2>3. Immutable Right to Erasure (Data Deletion)</h2>
        <p>
          Your identity belongs entirely to you. You have the absolute right to delete your account at any nanosecond in time through the advanced Settings panel within the native client. Executing an account deletion fires an unrecoverable destruction protocol: instantly burning your JWT access tokens, wiping your friend relational graphs, clearing all historical associations, and purging you from all geographical database shards sequentially.
        </p>

        <h2>4. Strict Third-Party Isolation</h2>
        <p>
          We rely on highly auditable, secure cloud infrastructure hosting providers to maintain the immense data throughput required for global audio syncing. However, we do not lease, trade, exchange, API-share, or sell your account metadata to unauthorized third parties, advertisers, or data-brokers. 
        </p>
      </div>
    </div>
  );
}
