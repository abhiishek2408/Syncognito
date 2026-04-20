import { Code } from 'lucide-react';

export default function OpenSource() {
  return (
    <div className="page-container">
      <div className="doc-header">
        <div className="doc-updated">Community Mission</div>
        <h1 className="doc-title">Open Source Declarations</h1>
      </div>
      <div className="doc-content">
        <h2>A Commitment to Open Communities</h2>
        <p>We firmly believe in the power of open communities, transparent code architectures, and collaborative engineering. The core playback synchronization algorithm modules of Syncognito are provided to the developer community under permissive open-source licenses to encourage academic research and third-party innovations.</p>
        
        <h2>Third-Party License Acknowledgements</h2>
        <p>Syncognito would not exist without the incredible open-source ecosystem. We heavily utilize React, React Native, Vite Workspace configurations, Express.js, and Lucide Icons. We extend our deepest gratitude to the thousands of independent contributors maintaining these mission-critical repositories.</p>

        <h2>Code Governance</h2>
        <p>While the primary application backend logic remains proprietary to ensure zero abuse of our cloud network bandwidth, the underlying interface components, socket parsers, and UI templates are routinely sanitized and open-sourced. Pull requests for bug fixes, performance optimizations, and regional localization are highly welcomed.</p>

        <a href="#" className="btn-primary" style={{ marginTop: '30px' }}>
          <Code size={20} /> View Our Repositories
        </a>
      </div>
    </div>
  );
}
