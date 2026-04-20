export default function Cookies() {
  return (
    <div className="page-container">
      <div className="doc-header">
        <div className="doc-updated">Data Compliance</div>
        <h1 className="doc-title">Cookies & Tracking Policy</h1>
      </div>
      <div className="doc-content">
        <h2>What are Cookies?</h2>
        <p>Cookies are small text files stored locally by our website and mobile application to remember your session states, caching preferences, and authentication tokens. They allow our platform to recognize you instantly without requiring repetitive logins every time you open the streaming app.</p>
        
        <h2>Strictly Functional Utilization</h2>
        <p>Syncognito explicitly utilizes generic, anonymous, HTTP-only functional cookies for secure API authorization. Because we treat your data as heavily compartmentalized, we **do not** deploy cross-site tracking pixels, marketing fingerprinting, or third-party advertising analytics scripts on any of our infrastructure.</p>

        <h2>Local Storage & AsyncStorage</h2>
        <p>On the native Android mobile application, we bypass traditional web cookies, relying entirely on isolated AsyncStorage silos. This ensures your token authentication, Dark Theme preferences, and High Quality audio toggle states are stored securely on the encrypted portion of your local phone disk, never accessible by other installed applications.</p>

        <h2>Your Right to Clear Data</h2>
        <p>You maintain ultimate sovereignty over your session data. Clearing your browser cache or executing a 'Clear Data' operation in the Android app settings menu will permanently purge all local configurations and cryptographic access tokens. We honor this purge instantly.</p>
      </div>
    </div>
  );
}
