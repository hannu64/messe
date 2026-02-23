import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

function PrivateChat() {
  const { chatId } = useParams();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');

  useEffect(() => {
    // Load messages from localStorage (per chat)
    const storedMessages = JSON.parse(localStorage.getItem(`messages_${chatId}`)) || [];
    setMessages(storedMessages);
  }, [chatId]);

  const sendMessage = async () => {
    if (!newMessage) return;

    // Placeholder E2EE: Encrypt message (use Web Crypto for real impl)
    const encoder = new TextEncoder();
    const data = encoder.encode(newMessage);
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
    const encryptedBase64 = btoa(String.fromCharCode(...new Uint8Array(encrypted)));

    const updatedMessages = [...messages, { text: encryptedBase64, sender: 'me' }];
    setMessages(updatedMessages);
    localStorage.setItem(`messages_${chatId}`, JSON.stringify(updatedMessages));
    setNewMessage('');
  };

  // Placeholder decrypt for display
  const decryptMessage = (encryptedBase64) => {
    // For demo: Just show as-is (implement real decrypt with shared keys later)
    return atob(encryptedBase64);
  };

  return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <h2>Chat {chatId}</h2>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {messages.map((msg, idx) => (
          <div key={idx} style={{ textAlign: msg.sender === 'me' ? 'right' : 'left' }}>
            {decryptMessage(msg.text)}
          </div>
        ))}
      </div>
      <input
        type="text"
        value={newMessage}
        onChange={(e) => setNewMessage(e.target.value)}
        placeholder="Type a message"
        style={{ width: '100%', marginBottom: '10px' }}
      />
      <button onClick={sendMessage}>Send</button>
    </div>
  );
}

export default PrivateChat;
