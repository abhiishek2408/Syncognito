export default function ApiReference() {
  return (
    <div className="page-container">
      <div className="doc-header">
        <div className="doc-updated">Developers</div>
        <h1 className="doc-title">API & Webhooks Reference</h1>
      </div>
      <div className="doc-content">
        <h2>RESTful Architecture Definitions</h2>
        <p>The backend operates standard Node.js Express controllers mapped strictly to predictable HTTP verbs. Our primary models traverse User authentication protocols (`/api/auth/*`), dynamic Room instantiations (`/api/rooms/*`), and stateless friend interactions (`/api/users/friends/*`). All endpoints require strict Bearer JWT Authorization headers formatted implicitly as JSON.</p>
        
        <h2>WebSocket Emitter Catalog</h2>
        <p>Unlike standard server polling, playback state dictates rely on an asynchronous Event-Driven pattern mapped through Socket.io. Below is the primary emission matrix:</p>
        <ul>
          <li><strong>`join_room`</strong>: Subscribes the current socket instance to a specific physical room hash. Requires the room's secret passcode.</li>
          <li><strong>`play_song` & `pause_song`</strong>: Host-exclusive command triggers that replicate playback intent globally. Contains latency timestamp markers.</li>
          <li><strong>`sync_timestamp`</strong>: Fired aggressively upon track reload or user scrubbing. Carries a decimal payload forcing all clients to align digital playheads.</li>
        </ul>

        <h2>Response Status Harmonization</h2>
        <p>Our middleware forces a unified JSON schema for all responses. 200 HTTP statuses will yield an `ok: true` payload, while 4XX and 5XX anomalies trigger a dedicated Node errorHandler interceptor to return raw logical failure strings, mitigating unhandled promise rejections on the client bridge.</p>
      </div>
    </div>
  );
}
