import React from 'react';
import { ShieldCheck, Trash2, Clock, CheckCircle } from 'lucide-react';

export default function DataDeletion() {
  return (
    <div className="page-container">
      <div className="doc-header">
        <div className="doc-updated">Compliance & Control</div>
        <h1 className="doc-title">Data Deletion Policy</h1>
      </div>
      
      <div className="doc-content">
        <p className="doc-intro" style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto 40px', color: '#888', fontSize: '20px', lineHeight: '1.6' }}>
          At Syncognito, we believe you should have total control over your digital footprint. This policy outlines how you can delete your data and what happens when you do.
        </p>

        <div className="feature-grid-simple">
          <div className="feature-card-simple">
            <Trash2 className="icon-neon" size={32} />
            <h3>App-Based Deletion</h3>
            <p>Syncognito includes a built-in account deletion feature. You can find the <strong>'Delete Account'</strong> button within the <strong>Settings</strong> or <strong>Profile</strong> section of the mobile application.</p>
          </div>

          <div className="feature-card-simple">
            <ShieldCheck className="icon-neon" size={32} />
            <h3>What is Deleted?</h3>
            <p>When you request account deletion, we remove your personal identifiers, synchronized music history, active rooms, friend lists, and preferences from our active databases.</p>
          </div>

          <div className="feature-card-simple">
            <Clock className="icon-neon" size={32} />
            <h3>Immediate vs Retention</h3>
            <p>Deletion is immediate for your active profile and room history. Some metadata may be retained in encrypted backups for up to <strong>30 days</strong> before being permanently purged.</p>
          </div>

          <div className="feature-card-simple">
            <CheckCircle className="icon-neon" size={32} />
            <h3>NGL Anonymity</h3>
            <p>Anonymous messages (NGLs) are dissociated from your account immediately. The text of the message remains, but all links to your deleted identity are destroyed.</p>
          </div>
        </div>

        <h2 style={{ marginTop: '60px' }}>Steps to Delete Your Account</h2>
        <div className="doc-list-wrapper">
          <ol className="doc-list">
            <li>Open the <strong>Syncognito</strong> app on your mobile device.</li>
            <li>Navigate to your <strong>Profile</strong> screen (bottom right tab).</li>
            <li>Tap on the <strong>Settings</strong> icon (gear icon).</li>
            <li>Scroll to the bottom and select <strong>"Delete Account"</strong>.</li>
            <li>Confirm your choice. Your session will be terminated and deletion will begin.</li>
          </ol>
        </div>

        <div className="info-box">
          <p><strong>Note:</strong> Once an account is deleted, it cannot be recovered. All your personalized playlists and room codes will be permanently lost.</p>
        </div>
      </div>
    </div>
  );
}
