import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';

// ... (generateKey and importKey functions stay exactly the same as before)

function PrivateChat() {
  const { chatId } = useParams();
  const [messages, setMessages] = useState([]);
  const [decryptedMessages, setDecryptedMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [cryptoKey, setCryptoKey] = useState(null);
  const [sharedKey, setSharedKey] = useState('');
  const [keyStatus, setKeyStatus] = useState('loading');
  const messagesEndRef = useRef(null);

  // ... (all useEffect, copyKeyToClipboard, handlePasteKey, sendMessage stay exactly the same)

  // NEW: Simulate incoming message from the other person
  const simulateIncoming = async () => {
    if (!cryptoKey) return;

    const fakeText = ["Hei!", "Mitä kuuluu?", "Haha totta!", "Tänään sataa taas 😅", "Nähdään huomenna?"][Math.floor(Math.random()*5)];

    const encoder = new TextEncoder();
    const data = encoder.encode(fakeText);
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, data);
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);

    const base64 = btoa(String.fromCharCode(...combined));

    const fakeMsg = { encrypted: base64, sender: 'them' };
    const updated = [...messages, fakeMsg];

    setMessages(updated);
    localStorage.setItem(`messages_${chatId}`, JSON.stringify(updated));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', padding: '20px', boxSizing: 'border-box' }}>
      <h2>Chat {chatId.slice(0, 8)}...</h2>

      {/* Key sharing UI - unchanged except we add the simulate button */}
      <div style={{ marginBottom: '16px', padding: '12px', background: '#f8f9fa', borderRadius: '8px' }}>
        {/* ... existing key status, copy button, paste input ... */}

        <button
          onClick={simulateIncoming}
          disabled={!cryptoKey}
          style={{ marginTop: '12px', padding: '8px 16px', background: '#28a745', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
        >
          Simulate incoming message from friend
        </button>
      </div>

      {/* Messages area - unchanged */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 0', display: 'flex', flexDirection: 'column' }}>
        {decryptedMessages.map((msg, idx) => (
          <div
            key={idx}
            style={{
              alignSelf: msg.sender === 'me' ? 'flex-end' : 'flex-start',
              maxWidth: '70%',
              margin: '8px 0',
              padding: '10px 14px',
              borderRadius: '18px',
              background: msg.sender === 'me' ? '#dcf8c6' : '#e3f2fd',
              boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
              wordBreak: 'break-word'
            }}
          >
            {msg.text || '[Loading...]'}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area - unchanged */}
      {/* ... same as before ... */}
    </div>
  );
}

export default PrivateChat;
