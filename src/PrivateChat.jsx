import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';

// Helper: Generate a random AES-256 key and export as base64
const generateKey = async () => {
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  const exported = await crypto.subtle.exportKey('raw', key);
  return btoa(String.fromCharCode(...new Uint8Array(exported)));
};

// Helper: Import base64 string back to CryptoKey
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
  const [messages, setMessages] = useState([]);           // stored: {encrypted: base64, sender: 'me'}
  const [decryptedMessages, setDecryptedMessages] = useState([]); // {text, sender, status}
  const [newMessage, setNewMessage] = useState('');
  const [cryptoKey, setCryptoKey] = useState(null);
  const [sharedKey, setSharedKey] = useState('');         // user-entered base64 key
  const [keyStatus, setKeyStatus] = useState('loading');  // 'loading' | 'derived' | 'shared' | 'invalid'
  const messagesEndRef = useRef(null);

  // Load stored messages + shared key
  useEffect(() => {
    const storedMessages = JSON.parse(localStorage.getItem(`messages_${chatId}`)) || [];
    setMessages(storedMessages);

    const storedSharedKey = localStorage.getItem(`key_${chatId}`);
    if (storedSharedKey) {
      setSharedKey(storedSharedKey);
    }
  }, [chatId]);

  // Derive or import key
  useEffect(() => {
    (async () => {
      let key = null;

      // Priority 1: Use user-provided shared key
      if (sharedKey) {
        key = await importKey(sharedKey);
        if (key) {
          setKeyStatus('shared');
        } else {
          setKeyStatus('invalid');
        }
      }
      // Priority 2: Fallback to chatId-derived key (old chats)
      else {
        const encoder = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
          'raw',
          encoder.encode(chatId + 'fixed-salt-for-poc'),
          { name: 'PBKDF2' },
          false,
          ['deriveBits', 'deriveKey']
        );
        key = await crypto.subtle.deriveKey(
          { name: 'PBKDF2', salt: encoder.encode('salt-for-poc'), iterations: 100000, hash: 'SHA-256' },
          keyMaterial,
          { name: 'AES-GCM', length: 256 },
          true,
          ['encrypt', 'decrypt']
        );
        setKeyStatus('derived');
      }

      setCryptoKey(key);
    })();
  }, [chatId, sharedKey]);

  // Decrypt messages when key or messages change
  useEffect(() => {
    if (!cryptoKey) return;

    const decryptAll = async () => {
      const decrypted = await Promise.all(
        messages.map(async (msg) => {
          if (msg.sender !== 'me' || !msg.encrypted) {
            return { ...msg, text: '[Other user or legacy message]', status: 'ok' };
          }
          try {
            const combined = Uint8Array.from(atob(msg.encrypted), c => c.charCodeAt(0));
            const iv = combined.slice(0, 12);
            const data = combined.slice(12);

            const buffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, data);
            return { ...msg, text: new TextDecoder().decode(buffer), status: 'ok' };
          } catch (err) {
            console.error('Decrypt failed:', err);
            return { ...msg, text: '[Decryption failed]', status: 'error' };
          }
        })
      );
      setDecryptedMessages(decrypted);
    };

    decryptAll();
  }, [messages, cryptoKey]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [decryptedMessages]);

  const copyKeyToClipboard = async () => {
    if (!cryptoKey) return;
    const exported = await crypto.subtle.exportKey('raw', cryptoKey);
    const base64 = btoa(String.fromCharCode(...new Uint8Array(exported)));
    await navigator.clipboard.writeText(base64);
    alert('Key copied to clipboard! Share it securely with your friend.');
  };

  const handlePasteKey = (e) => {
    const value = e.target.value.trim();
    setSharedKey(value);
    if (value) {
      localStorage.setItem(`key_${chatId}`, value);
    } else {
      localStorage.removeItem(`key_${chatId}`);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !cryptoKey) return;

    const encoder = new TextEncoder();
    const data = encoder.encode(newMessage);
    const iv = crypto.getRandomValues(new Uint8Array(12));

    try {
      const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, data);
      const combined = new Uint8Array(iv.length + encrypted.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(encrypted), iv.length);

      const base64 = btoa(String.fromCharCode(...combined));
      const newMsg = { encrypted: base64, sender: 'me' };
      const updated = [...messages, newMsg];

      setMessages(updated);
      localStorage.setItem(`messages_${chatId}`, JSON.stringify(updated));
      setNewMessage('');
    } catch (err) {
      console.error('Send failed:', err);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', padding: '20px', boxSizing: 'border-box' }}>
      <h2>Chat {chatId.slice(0, 8)}...</h2>

      {/* Key sharing UI */}
      <div style={{ marginBottom: '16px', padding: '12px', background: '#f8f9fa', borderRadius: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <strong>Encryption key status:</strong>
          <span style={{ color: keyStatus === 'shared' ? 'green' : keyStatus === 'invalid' ? 'red' : 'orange' }}>
            {keyStatus === 'loading' ? 'Loading...' :
             keyStatus === 'shared' ? 'Using shared key ✓' :
             keyStatus === 'derived' ? 'Using chat-derived key (demo)' :
             'Invalid key'}
          </span>
        </div>

        <button
          onClick={copyKeyToClipboard}
          disabled={!cryptoKey}
          style={{ padding: '8px 16px', background: '#007bff', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
        >
          Copy key to clipboard
        </button>

        <div style={{ marginTop: '12px' }}>
          <label>Paste friend's key here:</label><br />
          <input
            type="text"
            value={sharedKey}
            onChange={handlePasteKey}
            placeholder="Paste base64 key here..."
            style={{ width: '100%', padding: '10px', marginTop: '4px', border: '1px solid #ccc', borderRadius: '6px' }}
          />
          <small style={{ color: '#666', display: 'block', marginTop: '4px' }}>
            Share your key securely (e.g. via Signal, in person). Do NOT send over this chat!
          </small>
        </div>
      </div>

      {/* Messages */}
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
              background: msg.sender === 'me' ? '#dcf8c6' : '#ffffff',
              boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
              wordBreak: 'break-word'
            }}
          >
            {msg.text || '[Loading...]'}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{ display: 'flex', paddingTop: '10px', borderTop: '1px solid #eee' }}>
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message"
          style={{ flex: 1, padding: '12px', border: '1px solid #ccc', borderRadius: '20px' }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
        />
        <button
          onClick={sendMessage}
          style={{
            marginLeft: '10px',
            padding: '12px 24px',
            background: '#25D366',
            color: 'white',
            border: 'none',
            borderRadius: '20px',
            cursor: 'pointer'
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}

export default PrivateChat;
