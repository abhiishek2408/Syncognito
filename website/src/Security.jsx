export default function Security() {
  return (
    <div className="page-container">
      <div className="doc-header">
        <div className="doc-updated">Safety & Threat Intel</div>
        <h1 className="doc-title">Security Status Hub</h1>
      </div>
      <div className="doc-content">
        <h2>Cryptographic Workloads</h2>
        <p>Every single byte traversing the Syncognito backend, from standard username creation forms to real-time WebRTC audio chunks, is forced over strict HTTPS / TLS 1.3 protocol definitions. We do not permit any fallback downgrades to TLS 1.1 or legacy HTTP, ensuring packet sniffing and Man-in-The-Middle (MITM) attacks are cryptographically impossible.</p>
        
        <h2>JSON Web Token Isolation</h2>
        <p>Authentication is handled via aggressively expiring JWT payloads. Tokens contain absolutely no personally identifiable demographic information—only arbitrary backend database IDs and network roles. Our servers run active invalidation interceptors that terminate your token instance the second you hit 'Log Out' or 'Delete Account'.</p>

        <h2>DDoS Resiliency & Rate Limiting</h2>
        <p>To assure our audio streams remain perfectly synced, the backend API is fortified using advanced Express Rate-Limiting architectures and IP header sanitation via Helmet. We drop anomalous requests exceeding 10kb body payload restrictions immediately, suffocating automated botnet floods before they parse logic.</p>

        <h2>Dependency CVE Auditing</h2>
        <p>Our Node.js server dependencies are actively scanned using automated zero-day vulnerability checks. We guarantee isolation of database sanitization functions, preventing NoSQL injection attempts by wrapping all incoming strings with express-mongo-sanitize filters. Your data safety is mathematically enforced.</p>
      </div>
    </div>
  );
}
