import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';

// Generate random AES-256 key and export as base64
const generateKey = async () => {
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  const exported = await crypto.subtle.exportKey('raw', key);
  return btoa(String.fromCharCode(...new Uint8Array(exported)));
};

// Import base64 string back to CryptoKey
const importKey = async (base64Key) => {
  try {
    const raw = Uint8Array.from(atob(base64Key), c => c.charCodeAt(0));
    return await crypto.subtle.importKey(
      'raw',
      raw,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  } catch (err) {
    console.error('Invalid key format:', err);
    return null;
  }
};

function PrivateChat() {
  const { chatId } = useParams();
  const [messages, setMessages] = useState([]); // {encrypted: base64, sender: 'me' | 'them'}
  const [decryptedMessages, setDecryptedMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [cryptoKey, setCryptoKey] = useState(null);
  const [sharedKey, setSharedKey] = useState('');
  const [keyStatus, setKeyStatus] = useState('loading');
  const messagesEndRef = useRef(null);

  // Load messages + shared key from localStorage
  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem(`messages_${chatId}`)) || [];
    setMessages(stored);

    const storedKey = localStorage.getItem(`key_${chatId}`);
    setSharedKey(storedKey || '');
  }, [chatId]);

  // Initialize or load key
  useEffect(() => {
    (async () => {
      let key = null;

      if (sharedKey) {
        key = await importKey(sharedKey);
        setKeyStatus(key ? 'shared' : 'invalid');
      } else {
        // Fallback: derive from chatId (for old chats)
        const encoder = new TextEncoder();
        const material = await crypto.subtle.importKey(
          'raw',
          encoder.encode(chatId + 'fixed-salt-for-poc'),
          { name: 'PBKDF2' },
          false,
          ['deriveBits', 'deriveKey']
        );
        key = await crypto.subtle.deriveKey(
          { name: 'PBKDF2', salt: encoder.encode('salt-for-poc'), iterations: 100000, hash: 'SHA-256' },
          material,
          { name: 'AES-GCM', length: 256 },
          true,
          ['encrypt', 'decrypt']
        );
        setKeyStatus('derived');
      }

      setCryptoKey(key);
    })();
  }, [chatId, sharedKey]);

  // Decrypt when messages or key change
  useEffect(() => {
    if (!cryptoKey) return;

    const decryptAll = async () => {
      const decrypted = await Promise.all(
        messages.map(async (msg) => {
          if (!msg.encrypted) {
            return { ...msg, text: '[No content]', status: 'ok' };
          }
          try {
            const combined = Uint8Array.from(atob(msg.encrypted), c => c.charCodeAt(0));
            const iv = combined.slice(0, 12);
            const data = combined.slice(12);

            const buffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, data);
            return { ...msg, text: new TextDecoder().decode(buffer), status: 'ok' };
          } catch (err) {
            console.error('Decrypt error:', err);
            return { ...msg, text: '[Decryption failed]', status: 'error' };
          }
        })
      );
      setDecryptedMessages(decrypted);
    };
    decryptAll();
  }, [messages, cryptoKey]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [decryptedMessages]);

  const copyKey = async () => {
    if (!cryptoKey) return;
    const raw = await crypto.subtle.exportKey('raw', cryptoKey);
    const base64 = btoa(String.fromCharCode(...new Uint8Array(raw)));
    await navigator.clipboard.writeText(base64);
    alert('Key copied! Share securely outside this app.');
  };

  const handleKeyPaste = (e) => {
    const val = e.target.value.trim();
    setSharedKey(val);
    if (val) {
      localStorage.setItem(`key_${chatId}`, val);
    } else {
      localStorage.removeItem(`key_${chatId}`);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !cryptoKey) return;

    const encoder = new TextEncoder();
    const data = encoder.encode(newMessage);
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, data);
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);

    const base64 = btoa(String.fromCharCode(...combined));
    const msg = { encrypted: base64, sender: 'me' };
    const updated = [...messages, msg];

    setMessages(updated);
    localStorage.setItem(`messages_${chatId}`, JSON.stringify(updated));
    setNewMessage('');
  };

  const simulateIncoming = async () => {
    if (!cryptoKey) {
      alert('No key loaded yet');
      return;
    }

    const fakeTexts = [
      'Hei hei!',
      'Mitäs kuuluu?',
      '😂😂 totta',
      'Sataa taas...',
      'Milloin nähdään?'
    ];
    const text = fakeTexts[Math.floor(Math.random() * fakeTexts.length)];

    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, data);
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);

    const base64 = btoa(String.fromCharCode(...combined));
    const msg = { encrypted: base64, sender: 'them' };
    const updated = [...messages, msg];

    setMessages(updated);
    localStorage.setItem(`messages_${chatId}`, JSON.stringify(updated));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', padding: '20px', boxSizing: 'border-box' }}>
      <h2>Chat {chatId.slice(0, 8)}...</h2>

      <div style={{ marginBottom: '16px', padding: '12px', background: '#f8f9fa', borderRadius: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <strong>Key status:</strong>
          <span style={{ color: keyStatus === 'shared' ? 'green' : keyStatus === 'invalid' ? 'red' : 'orange' }}>
            {keyStatus === 'loading' ? 'Loading...' :
             keyStatus === 'shared' ? 'Using shared key ✓' :
             keyStatus === 'derived' ? 'Using demo key (chatId-derived)' :
             'Invalid key'}
          </span>
        </div>

        <button
          onClick={copyKey}
          disabled={!cryptoKey}
          style={{ padding: '8px 16px', background: '#007bff', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
        >
          Copy my key to clipboard
        </button>

        <div style={{ marginTop: '12px' }}>
          <label>Paste friend's key:</label><br />
          <input
            type="text"
            value={sharedKey}
            onChange={handleKeyPaste}
            placeholder="Paste base64 key here..."
            style={{ width: '100%', padding: '10px', marginTop: '4px', border: '1px solid #ccc', borderRadius: '6px' }}
          />
          <small style={{ color: '#666', display: 'block', marginTop: '4px' }}>
            Share your key securely (Signal, in person etc). Never send it here!
          </small>
        </div>

        <button
          onClick={simulateIncoming}
          disabled={!cryptoKey}
          style={{ marginTop: '12px', padding: '8px 16px', background: '#28a745', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
        >
          Simulate incoming message (test decrypt)
        </button>
      </div>

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

      <div style={{ display: 'flex', paddingTop: '10px', borderTop: '1px solid #eee' }}>
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message"
          style={{ flex: 1, padding: '12px', border: '1px solid #ccc', borderRadius: '20px' }}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
        />
        <button
          onClick={sendMessage}
          style={{ marginLeft: '10px', padding: '12px 24px', background: '#25D366', color: 'white', border: 'none', borderRadius: '20px' }}
        >
          Send
        </button>
      </div>
    </div>
  );
}

export default PrivateChat;
