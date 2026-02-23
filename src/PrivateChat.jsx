import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';

// Derive fixed key from chatId (PoC only – same key for all "users" on same device/chatId)
const getKeyFromChatId = async (chatId) => {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(chatId + "fixed-salt-for-poc"), // NEVER use in production!
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode("salt-for-poc"),
      iterations: 100000,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
};

function PrivateChat() {
  const { chatId } = useParams();
  const [messages, setMessages] = useState([]); // stored as {encrypted: base64, sender: 'me'}
  const [decryptedMessages, setDecryptedMessages] = useState([]); // {text: string, sender, status}
  const [newMessage, setNewMessage] = useState('');
  const [cryptoKey, setCryptoKey] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const key = await getKeyFromChatId(chatId);
        setCryptoKey(key);
      } catch (err) {
        console.error('Key derivation failed:', err);
      }
    })();
  }, [chatId]);

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem(`messages_${chatId}`)) || [];
    setMessages(stored);
  }, [chatId]);

  // Decrypt all messages when key or messages change
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
            const encryptedData = combined.slice(12);

            const decryptedBuffer = await crypto.subtle.decrypt(
              { name: "AES-GCM", iv },
              cryptoKey,
              encryptedData
            );
            const text = new TextDecoder().decode(decryptedBuffer);
            return { ...msg, text, status: 'ok' };
          } catch (err) {
            console.error('Decrypt failed for msg:', err);
            return { ...msg, text: '[Decryption failed]', status: 'error' };
          }
        })
      );
      setDecryptedMessages(decrypted);
    };

    decryptAll();
  }, [messages, cryptoKey]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [decryptedMessages]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !cryptoKey) return;

    const encoder = new TextEncoder();
    const data = encoder.encode(newMessage);
    const iv = crypto.getRandomValues(new Uint8Array(12));

    try {
      const encrypted = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        cryptoKey,
        data
      );

      const combined = new Uint8Array(iv.length + encrypted.byteLength);
      combined.set(iv, 0);
      combined.set(new Uint8Array(encrypted), iv.length);

      const encryptedBase64 = btoa(String.fromCharCode(...combined));

      const newMsg = { encrypted: encryptedBase64, sender: 'me' };
      const updated = [...messages, newMsg];
      setMessages(updated);
      localStorage.setItem(`messages_${chatId}`, JSON.stringify(updated));
      setNewMessage('');
    } catch (err) {
      console.error('Encryption failed:', err);
    }
  };

  return (
    <div style={{ 
      padding: '20px', 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100vh', 
      boxSizing: 'border-box' 
    }}>
      <h2>Chat {chatId.slice(0, 8)}...</h2>
      <div style={{ 
        flex: 1, 
        overflowY: 'auto', 
        padding: '10px 0', 
        display: 'flex', 
        flexDirection: 'column' 
      }}>
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
      <div style={{ 
        display: 'flex', 
        paddingTop: '10px', 
        borderTop: '1px solid #eee' 
      }}>
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
