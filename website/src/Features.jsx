export default function Features() {
  return (
    <div className="page-container">
      <div className="doc-header">
        <div className="doc-updated">App Capabilities</div>
        <h1 className="doc-title">Core Features</h1>
      </div>
      <div className="doc-content">
        <h2>1. Global Synchronized Listening Rooms</h2>
        <p>At the heart of Syncognito is our Real-Time Room architecture. Create a room as a 'Host' and select your track. Any friend who joins your room will have their playback mathematically locked to yours. If you pause, they pause. If you scrub to 1:45, they instantly scrub to 1:45. It's the ultimate remote listening party.</p>

        <h2>2. Universal Sync-Bridge Technology</h2>
        <p>Our proprietary Syncognito engine handles the heavy lifting of network jitter and latency. By using a specialized time-alignment protocol, the app compensates for varying internet speeds, ensuring that every person in a room hears the same kick-drum at the exact same millisecond. No more "1, 2, 3... Play!"—it just works.</p>

        <h2>3. Anonymous Question Prompts (NGL Style)</h2>
        <p>Tap into our specialized social interaction tab powered by AI. Generate anonymous, time-aware messaging links to share with your network. Let your friends drop fun, anonymous questions or song requests into your inbox. The integrated AI recommendation microservice dynamically tailors prompt ideas based on your vibe.</p>
        
        <h2>3. Social Alarm System</h2>
        <p>Why wake up alone? Syncognito features a unique 'Social Alarm' capability. Set a synchronized alarm with your friend group. When the clock strikes, the App forcefully triggers playback of the agreed-upon high-energy track across all connected devices simultaneously to get everyone out of bed together.</p>

        <h2>4. Advanced Friend Network & Room Keys</h2>
        <p>Add friends securely via encrypted search or exact username matching. Once connected, your live room status broadcasts to them natively on the dashboard. Don't want uninvited guests? Lock your room using auto-generated secure alphanumeric Room Keys.</p>

        <h2>5. Premium Pitch Black Navigation</h2>
        <p>The entire Mobile App UI is strictly engineered for High-End OLED/AMOLED displays. We utilize true hex #000000 backgrounds (Pitch Black) globally, combined with glowing neon fluid blobs and glassmorphic panels. No toggles needed—we abandoned basic dark grays for maximum aesthetic and infinite contrast.</p>

        <h2>6. Audiophile & Network Toggles</h2>
        <p>Take control of your data. Dive into Persistent Settings (saved locally via AsyncStorage) to toggle push notifications or activate "High Quality Audio" payloads for uncompressed streaming when you transition from cellular to strong broadband networks.</p>

        <h2>7. Complete Privacy Control</h2>
        <p>Transparency is guaranteed. If you wish to leave the platform, our Settings menu provides a 1-click 'Delete Account' modal that irreversibly shreds your user identity, room associations, and active tokens from our backend databases permanently.</p>
      </div>
    </div>
  );
}
