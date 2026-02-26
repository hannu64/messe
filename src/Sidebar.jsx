import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function Sidebar() {
  const [chats, setChats] = useState([]);
  const [newChatName, setNewChatName] = useState('');
  const navigate = useNavigate();

  const loadChats = () => {
    const stored = JSON.parse(localStorage.getItem('chats')) || [];
    setChats(stored);
  };

  useEffect(() => {
    loadChats();

    // Listen for changes from PrivateChat (name prompt)
    const handleUpdate = () => loadChats();
    window.addEventListener('chatsUpdated', handleUpdate);

    return () => window.removeEventListener('chatsUpdated', handleUpdate);
  }, []);

  const addChat = () => {
    if (!newChatName) return;
    const newChatId = Date.now().toString();
    const updated = [...chats, { id: newChatId, name: newChatName }];
    setChats(updated);
    localStorage.setItem('chats', JSON.stringify(updated));
    setNewChatName('');
    navigate(`/chat/${newChatId}`);
  };

  const removeChat = (chatId) => {
    const chatName = chats.find(c => c.id === chatId)?.name || 'this chat';
    if (!window.confirm(`Are you sure you want to remove "${chatName}"?`)) return;

    const updated = chats.filter(c => c.id !== chatId);
    setChats(updated);
    localStorage.setItem('chats', JSON.stringify(updated));
    localStorage.removeItem(`messages_${chatId}`);
    localStorage.removeItem(`key_${chatId}`);

    if (window.location.pathname === `/chat/${chatId}`) {
      navigate('/');
    }
  };

  return (
    <div style={{ width: '250px', borderRight: '1px solid #ccc', padding: '10px', overflowY: 'auto' }}>
      <h2>Chats</h2>
      <input
        type="text"
        value={newChatName}
        onChange={(e) => setNewChatName(e.target.value)}
        placeholder="New chat name"
        style={{ width: '100%', marginBottom: '10px' }}
      />
      <button onClick={addChat} style={{ width: '100%' }}>+ Add Chat</button>

      <ul style={{ listStyle: 'none', padding: 0, marginTop: '20px' }}>
        {chats.map((chat) => {
          const displayName = chat.name.length > 28 
            ? chat.name.slice(0, 25) + '...' 
            : chat.name;

          return (
            <li key={chat.id} style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              marginBottom: '8px',
              padding: '4px 8px',
              borderRadius: '4px',
              background: window.location.pathname === `/chat/${chat.id}` ? '#f0f0f0' : 'transparent'
            }}>
              <button
                onClick={() => navigate(`/chat/${chat.id}`)}
                title={chat.name}   // tooltip shows full name
                style={{ 
                  flex: 1, 
                  textAlign: 'left', 
                  background: 'none', 
                  border: 'none', 
                  cursor: 'pointer',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {displayName}
                {localStorage.getItem(`key_${chat.id}`) && <span style={{ color: 'green', marginLeft: '6px' }}>🔒</span>}
              </button>

              <button
                onClick={() => removeChat(chat.id)}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  color: '#dc3545', 
                  cursor: 'pointer', 
                  fontSize: '1.3em',
                  padding: '4px'
                }}
                title="Remove chat"
              >
                🗑
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default Sidebar;