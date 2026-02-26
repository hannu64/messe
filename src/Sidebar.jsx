import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function Sidebar() {
  const [chats, setChats] = useState([]);
  const [newChatName, setNewChatName] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const storedChats = JSON.parse(localStorage.getItem('chats')) || [];
    setChats(storedChats);
  }, []);

  const addChat = () => {
    if (!newChatName) return;
    const newChatId = Date.now().toString();
    const updatedChats = [...chats, { id: newChatId, name: newChatName }];
    setChats(updatedChats);
    localStorage.setItem('chats', JSON.stringify(updatedChats));
    setNewChatName('');
    navigate(`/chat/${newChatId}`);
  };


  const removeChat = (chatId) => {
  if (!window.confirm(`Are you sure you want to remove "${chats.find(c => c.id === chatId)?.name || 'this chat'}"?`)) {
    return;
  }

  const updatedChats = chats.filter(chat => chat.id !== chatId);
  setChats(updatedChats);
  localStorage.setItem('chats', JSON.stringify(updatedChats));
  localStorage.removeItem(`messages_${chatId}`);
  localStorage.removeItem(`key_${chatId}`);

  if (window.location.pathname === `/chat/${chatId}`) {
    navigate('/');
  }
};


  return (
    <div style={{ width: '250px', borderRight: '1px solid #ccc', padding: '10px' }}>
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
        {chats.map((chat) => (
          <li key={chat.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <button
              onClick={() => navigate(`/chat/${chat.id}`)}
              style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              {chat.name}
              {localStorage.getItem(`key_${chat.id}`) && <span style={{ color: 'green', marginLeft: '6px' }}>🔒</span>}
            </button>
            <button
              onClick={() => removeChat(chat.id)}
              style={{ background: 'none', border: 'none', color: '#dc3545', cursor: 'pointer', fontSize: '1.2em' }}
              title="Remove chat"
            >
              🗑
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default Sidebar;