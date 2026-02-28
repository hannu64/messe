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


const generateAndSetRandomKey = async () => {
  const base64Key = await generateKey();  // your existing generateKey function
  const imported = await importKey(base64Key);
  if (imported) {
    setCryptoKey(imported);
    setKeyStatus('shared');
    setSharedKeyInput(base64Key);  // show in paste field too
    localStorage.setItem(`key_${chatId}`, base64Key);
    await navigator.clipboard.writeText(base64Key);
    alert('New random key generated and copied to clipboard!\nShare this securely with your friend.');
  }
};


function PrivateChat() {
  const { chatId } = useParams();
  const [messages, setMessages] = useState([]);
  const [decryptedMessages, setDecryptedMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [cryptoKey, setCryptoKey] = useState(null);
  const [sharedKeyInput, setSharedKeyInput] = useState('');
  const [keyStatus, setKeyStatus] = useState('loading');
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [chatNameInput, setChatNameInput] = useState('');
  const messagesEndRef = useRef(null);

  // Load messages from localStorage
  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem(`messages_${chatId}`)) || [];
    setMessages(stored);
  }, [chatId]);

  // Show name prompt if chat not saved yet
  useEffect(() => {
    const storedChats = JSON.parse(localStorage.getItem('chats')) || [];
    const existing = storedChats.find(c => c.id === chatId);
    if (!existing) {
      setShowNamePrompt(true);
    }
  }, [chatId]);

  // Load or derive key
  useEffect(() => {
    (async () => {
      const storedKey = localStorage.getItem(`key_${chatId}`);
      let key = null;
      if (storedKey) {
        key = await importKey(storedKey);
        setKeyStatus(key ? 'shared' : 'invalid');
      } else {
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
  }, [chatId]);



const formatMessageTime = (timestamp) => {
  if (!timestamp) return '';

  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  // Calculate days difference
  const diffTime = Math.abs(now - date);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  const timeStr = date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  if (isToday) {
    return timeStr;  // "16:00"
  }

  // Base date part with weekday and DD.MM
  let datePart = date.toLocaleDateString('fi-FI', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit'
  });

  // Add year if older than 7 days
  if (diffDays > 7) {
    const year = date.getFullYear();
    datePart += `.${year}`;
  }

  return `${datePart} ${timeStr}`;
};
  


  // Decrypt all messages when messages or key change
  useEffect(() => {
    if (!cryptoKey) return;
    const decryptAll = async () => {
      const decrypted = await Promise.all(
        messages.map(async (msg) => {
          if (!msg.encrypted) return { ...msg, text: '[No content]', status: 'ok' };
          try {
            const combined = Uint8Array.from(atob(msg.encrypted), c => c.charCodeAt(0));
            const iv = combined.slice(0, 12);
            const data = combined.slice(12);
            const buffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, data);
            return { ...msg, text: new TextDecoder().decode(buffer), status: 'ok' };
          } catch (err) {
            return { ...msg, text: '[Decryption failed]', status: 'error' };
          }
        })
      );
      setDecryptedMessages(decrypted);
    };
    decryptAll();
  }, [messages, cryptoKey]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [decryptedMessages]);

  // Polling – safer version with functional update
  useEffect(() => {
    const pollMessages = async () => {
      try {
        const res = await fetch(`https://i-msgnet-backend-production.up.railway.app/api/messages/${chatId}`);
        if (!res.ok) return;
        const remoteMsgs = await res.json();

        setMessages(prevMessages => {
          const localEncryptedSet = new Set(prevMessages.map(m => m.encrypted));

          const incoming = remoteMsgs.filter(rm => !localEncryptedSet.has(rm.encrypted));

          if (incoming.length === 0) return prevMessages;

          const newOnes = incoming.map(rm => ({
            encrypted: rm.encrypted,
            sender: 'them',
            timestamp: rm.timestamp || Date.now()  // prefer server timestamp if sent
          }));

          const updated = [...prevMessages, ...newOnes];
          localStorage.setItem(`messages_${chatId}`, JSON.stringify(updated));
          return updated;
        });
      } catch (err) {
        console.error('Polling error:', err);
      }
    };

    pollMessages(); // initial fetch
    const interval = setInterval(pollMessages, 8000);
    return () => clearInterval(interval);
  }, [chatId]);

  const copyKey = async () => {
    if (!cryptoKey) return;
    const raw = await crypto.subtle.exportKey('raw', cryptoKey);
    const base64 = btoa(String.fromCharCode(...new Uint8Array(raw)));
    await navigator.clipboard.writeText(base64);
    alert('Key copied! Share securely outside this app.');
  };

  const handleKeyPaste = async (e) => {
    const val = e.target.value.trim();
    setSharedKeyInput(val);
    if (val) {
      const imported = await importKey(val);
      if (imported) {
        setCryptoKey(imported);
        setKeyStatus('shared');
        localStorage.setItem(`key_${chatId}`, val);
      } else {
        setKeyStatus('invalid');
      }
    } else {
      localStorage.removeItem(`key_${chatId}`);
      const encoder = new TextEncoder();
      const material = await crypto.subtle.importKey(
        'raw',
        encoder.encode(chatId + 'fixed-salt-for-poc'),
        { name: 'PBKDF2' },
        false,
        ['deriveBits', 'deriveKey']
      );
      const demoKey = await crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: encoder.encode('salt-for-poc'), iterations: 100000, hash: 'SHA-256' },
        material,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
      setCryptoKey(demoKey);
      setKeyStatus('derived');
    }
  };

  const clearKey = () => {
    setSharedKeyInput('');
    localStorage.removeItem(`key_${chatId}`);
    (async () => {
      const encoder = new TextEncoder();
      const material = await crypto.subtle.importKey(
        'raw',
        encoder.encode(chatId + 'fixed-salt-for-poc'),
        { name: 'PBKDF2' },
        false,
        ['deriveBits', 'deriveKey']
      );
      const demoKey = await crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: encoder.encode('salt-for-poc'), iterations: 100000, hash: 'SHA-256' },
        material,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
      setCryptoKey(demoKey);
      setKeyStatus('derived');
    })();
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

    const msg = { encrypted: base64, sender: 'me', timestamp: Date.now() };
    setMessages(prev => {
      const updated = [...prev, msg];
      localStorage.setItem(`messages_${chatId}`, JSON.stringify(updated));
      return updated;
    });

    setNewMessage('');

    try {
      const response = await fetch('https://i-msgnet-backend-production.up.railway.app/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, encrypted: base64 })
      });

      if (!response.ok) {
        console.error('Send failed:', response.status, await response.text());
      }
    } catch (err) {
      console.error('Backend send error:', err);
    }
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
    const msg = { encrypted: base64, sender: 'them', timestamp: Date.now() };

    setMessages(prev => {
      const updated = [...prev, msg];
      localStorage.setItem(`messages_${chatId}`, JSON.stringify(updated));
      return updated;
    });
  };

  const handleSaveName = () => {
    const trimmed = chatNameInput.trim();
    if (trimmed.length < 2) return;

    const storedChats = JSON.parse(localStorage.getItem('chats')) || [];
    const updated = [...storedChats, { id: chatId, name: trimmed }];
    localStorage.setItem('chats', JSON.stringify(updated));
    setShowNamePrompt(false);
    setChatNameInput('');
    window.dispatchEvent(new Event('chatsUpdated'));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', padding: '20px', boxSizing: 'border-box' }}>
      <h2>Chat {chatId.slice(0, 8)}...</h2>

      {showNamePrompt && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            background: 'white',
            padding: '28px',
            borderRadius: '12px',
            width: '90%',
            maxWidth: '440px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.5rem' }}>
              Name this conversation
            </h3>
            <p style={{ margin: '0 0 20px 0', color: '#555' }}>
              Choose a clear label so you can easily find this chat later in the sidebar.
            </p>

            <input
              type="text"
              value={chatNameInput}
              onChange={(e) => setChatNameInput(e.target.value)}
              placeholder="e.g. Juha / Work friend / Alex"
              autoFocus
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '16px',
                border: '1px solid #ccc',
                borderRadius: '6px',
                marginBottom: '20px',
                boxSizing: 'border-box',
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSaveName();
                }
              }}
            />

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={handleSaveName}
                disabled={chatNameInput.trim().length < 2}
                style={{
                  padding: '10px 24px',
                  background: chatNameInput.trim().length >= 2 ? '#007bff' : '#ccc',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: chatNameInput.trim().length >= 2 ? 'pointer' : 'not-allowed',
                  fontWeight: 'bold',
                }}
              >
                Save name
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginBottom: '16px', padding: '12px', background: '#f8f9fa', borderRadius: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <strong>Key status:</strong>
          <span style={{ color: keyStatus === 'shared' ? 'green' : keyStatus === 'invalid' ? 'red' : 'orange' }}>
            {keyStatus === 'shared' ? 'Using shared key ✓' :
             keyStatus === 'derived' ? 'Demo mode (chatId-derived key)' :
             keyStatus === 'invalid' ? 'Invalid key' : 'Loading...'}
          </span>
        </div>

        {keyStatus !== 'shared' && (
          <div style={{ background: '#fff3cd', color: '#856404', padding: '12px', borderRadius: '6px', marginBottom: '12px', fontWeight: 'bold' }}>
            ⚠️ Warning: Secure chat is currently disabled in demo mode. Messages are NOT end-to-end encrypted.
            Paste a shared key from your friend to enable real security. Do NOT send sensitive information until then!
          </div>
        )}



        {keyStatus === 'derived' && (
          <div style={{ margin: '12px 0' }}>
            <p style={{ margin: '0 0 8px 0', fontWeight: 'bold' }}>
              Quick test mode (demo key derived from chat ID)
            </p>
            <button
              onClick={generateAndSetRandomKey}
              style={{ padding: '10px 20px', background: '#28a745', color: 'white', border: 'none', borderRadius: '6px', marginRight: '12px' }}
            >
              Generate real random key
            </button>
            <button
              onClick={copyKey}
              disabled={!cryptoKey}
              style={{ padding: '10px 20px', background: '#007bff', color: 'white', border: 'none', borderRadius: '6px' }}
            >
              Copy demo key (testing only)
            </button>
          </div>
        )}

        {keyStatus === 'shared' && (
          <small style={{ color: '#28a745', fontWeight: 'bold', display: 'block', margin: '12px 0' }}>
            ✓ Using secure random/shared key — messages are end-to-end encrypted
          </small>
        )}



        <button onClick={clearKey} style={{ padding: '8px 16px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
          Clear key / Back to demo
        </button>

        <div style={{ marginTop: '12px' }}>
          <label>Paste shared secret key:</label><br />
          <input
            type="text"
            value={sharedKeyInput}
            onChange={handleKeyPaste}
            placeholder="Paste base64 key here..."
            style={{ width: '100%', padding: '10px', marginTop: '4px', border: '1px solid #ccc', borderRadius: '6px' }}
          />
          <small style={{ color: '#666', display: 'block', marginTop: '4px' }}>
            One person creates the key and shares it securely (e.g. via Signal or in person).
            Both must paste the same key here for secure E2EE. Never send the key in this chat!
          </small>
        </div>

        <button onClick={simulateIncoming} disabled={!cryptoKey} style={{ marginTop: '12px', padding: '8px 16px', background: '#28a745', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
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
            {msg.text}


          <div style={{
            fontSize: '0.75em',
            opacity: 0.7,
            marginTop: '4px',
            textAlign: msg.sender === 'me' ? 'right' : 'left'
          }}>
            {formatMessageTime(msg.serverTimestamp || msg.timestamp || Date.now())}
          </div>

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
          style={{ marginLeft: '10px', padding: '12px 24px', background: '#25D366', color: 'white', border: 'none', borderRadius: '20px', cursor: 'pointer' }}
        >
          Send
        </button>
      </div>
    </div>
  );
}

export default PrivateChat;