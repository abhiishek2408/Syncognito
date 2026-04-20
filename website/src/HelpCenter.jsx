export default function HelpCenter() {
  return (
    <div className="page-container">
      <div className="doc-header">
        <div className="doc-updated">Global Support</div>
        <h1 className="doc-title">Knowledge Base & Escalation</h1>
      </div>
      <div className="doc-content">
        <h2>Diagnostic Troubleshooting Guide</h2>
        <p>If you encounter desync phenomena or persistent websocket disconnects, sequentially execute our strict diagnostic protocol:</p>
        <ul>
          <li><strong>Verify Latency Conditions:</strong> If you are running on 3G cellular backhauls, packet propagation delays may cause perceived playback stutters. Toggle off the 'High Quality Audio' preset in Settings.</li>
          <li><strong>Empty Friend / Room Lists:</strong> If your backend fetching fails yielding an empty dashboard array, ensure you have not been disconnected from the host domain. Refreshing the screen forcibly drops the Axios cache.</li>
          <li><strong>Socket Reinstantiation:</strong> If a room halts silently, the easiest vector of repair is for the host to temporarily pause and play the track. This action multicasts a hard-sync packet.</li>
        </ul>

        <h2>Bug Reports & Ticket Escalation</h2>
        <p>Critical unresolvable logic faults belong in our issue tracking system. If the mobile app entirely crashes back to the OS launcher (force quits), we strongly request you capture the crash trace using developer tools. Submit your findings formally via our Github 'Issues' directory or directly via the "Bug Report" modal natively built into the App's settings.</p>

        <h2>Hardware Requirements</h2>
        <p>The client is heavily optimized natively for React Native's new architecture. We recommend an absolute minimum of 2GB RAM. Devices executing intensely aggressive battery-saver modes may kill our background audio-tasks; we suggest allowing unrestricted battery metrics for Syncognito.</p>
      </div>
    </div>
  );
}
