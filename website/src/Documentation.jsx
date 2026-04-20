export default function Documentation() {
  return (
    <div className="page-container">
      <div className="doc-header">
        <div className="doc-updated">Developer Hub</div>
        <h1 className="doc-title">Platform Documentation</h1>
      </div>
      <div className="doc-content">
        <h2>Getting Started</h2>
        <p>Syncognito is built on a modern MERN stack overlaid with extreme WebSocket performance optimizations. The backend runs on Node.js using Express, establishing persistent bi-directional communication channels using HTTP upgrade headers. You will need Node v18+ and a local MongoDB instance running to emulate the backend server.</p>
        
        <h2>Socket Topology & State Sync</h2>
        <p>Our room logic does not rely on regular REST database polling. Instead, all Room IDs act as dynamic Socket.io namespaces. When a host fires a `pause_song` event, it's multicast strictly to that namespace with an embedded timestamp marker to correct for varying client packet travel times.</p>

        <h2>React Native Client Patterns</h2>
        <p>The Android client uses React Context combined with robust global interceptor layers in Axios to manage authentication states globally. The UI strictly adheres to a glassmorphic aesthetic built via raw flexbox styling for max UI thread performance. Avoid injecting heavy CSS-in-JS libraries; use our structured native stylesheets.</p>

        <h2>Deployment Pipelines</h2>
        <p>For production deployment, the backend is built to run flawlessly inside stateless Docker containers clustered behind an NGINX reverse-proxy handling the WebSocket WSS terminal handshakes. Do not attempt to load-balance socket rooms without enabling Sticky Sessions or a Redis Adapter backplane.</p>
      </div>
    </div>
  );
}
