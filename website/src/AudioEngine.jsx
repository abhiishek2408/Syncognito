export default function AudioEngine() {
  return (
    <div className="page-container">
      <div className="doc-header">
        <div className="doc-updated">Technical Architecture</div>
        <h1 className="doc-title">The Audio Engine</h1>
      </div>
      <div className="doc-content">
        <h2>Zero-Latency Implementation</h2>
        <p>Our custom-built WebSocket logic entirely bypasses traditional buffering paradigms. Audio metadata and control signals reach the endpoints within 0.05 milliseconds across standard broadband connections. Using a persistent TCP duplex stream ensures no handshake overhead delays sequential play actions.</p>
        
        <h2>Cross-Platform Sound Decoding</h2>
        <p>From iOS core audio APIs to Android native bridging, we guarantee perfectly smooth frequency spectrums without dropping packets. The audio stream passes through a proprietary digital buffer that pre-fetches the next three seconds of the track using memory mapping, eliminating UI thread blocking.</p>

        <h2>Hardware Audio Acceleration</h2>
        <p>Syncognito interacts directly with your device's System-on-Chip (SoC) DSP processor (Digital Signal Processor). This means audio decoding happens at the hardware level, dramatically offloading CPU pressure, extending your battery life up to 3x compared to competing Javascript-based web audio players.</p>

        <h2>Asynchronous Playhead Sync</h2>
        <p>If a user's network fully drops out, our asynchronous playhead tracking immediately pauses their stream locally. Upon reconnection, an aggressive time-sync event is fired calculating instantaneous ping RTT to seamlessly match them back up with the host's exact millisecond playback point.</p>
      </div>
    </div>
  );
}
