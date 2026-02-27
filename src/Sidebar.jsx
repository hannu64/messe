import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function Sidebar() {
  const [chats, setChats] = useState([]);
  const [newChatName, setNewChatName] = useState('');
  const navigate = useNavigate();

  const loadChats = () => {
    try {
      const stored = JSON.parse(localStorage.getItem('chats')) || [];
      // Filter out invalid entries to prevent crashes
      const validChats = stored.filter(chat => 
        chat && typeof chat === 'object' && chat.id && typeof chat.name === 'string'
      );
      if (validChats.length < stored.length) {
        console.warn('Removed invalid chat entries from localStorage');
        localStorage.setItem('chats', JSON.stringify(validChats));
      }
      setChats(validChats);
    } catch (err) {
      console.error('Failed to load chats:', err);
      setChats([]);
    }
  };

  useEffect(() => {
    loadChats();
    const handleUpdate = () => loadChats();
    window.addEventListener('chatsUpdated', handleUpdate);
    return () => window.removeEventListener('chatsUpdated', handleUpdate);
  }, []);

  const addChat = () => {
    if (!newChatName.trim()) return;
    const newChatId = Date.now().toString();
    const updated = [...chats, { id: newChatId, name: newChatName.trim() }];
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
          // Safe name handling
          const safeName = (typeof chat.name === 'string' && chat.name.trim())
            ? chat.name
            : `Chat ${chat.id.slice(0, 8)}...`;
          const displayName = safeName.length > 28 
            ? safeName.slice(0, 25) + '...' 
            : safeName;

          return (
            <li 
              key={chat.id} 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between', 
                marginBottom: '8px',
                padding: '4px 8px',
                borderRadius: '4px',
                background: window.location.pathname === `/chat/${chat.id}` ? '#f0f0f0' : 'transparent'
              }}
            >
              <button
                onClick={() => navigate(`/chat/${chat.id}`)}
                title={safeName}
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