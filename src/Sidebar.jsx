import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function Sidebar() {
  const [chats, setChats] = useState([]);
  const [newChatName, setNewChatName] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // Load chats from localStorage
    const storedChats = JSON.parse(localStorage.getItem('chats')) || [];
    setChats(storedChats);
  }, []);

  const addChat = () => {
    if (!newChatName) return;
    const newChatId = Date.now().toString(); // Simple unique ID
    const updatedChats = [...chats, { id: newChatId, name: newChatName }];
    setChats(updatedChats);
    localStorage.setItem('chats', JSON.stringify(updatedChats));
    setNewChatName('');
    navigate(`/chat/${newChatId}`);
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
      <button onClick={addChat} style={{ width: '100%' }}>+ Add Chat</button> {/* Text icon fix: using "+" text */}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {chats.map((chat) => (
          <li key={chat.id}>
            <button onClick={() => navigate(`/chat/${chat.id}`)} style={{ width: '100%', textAlign: 'left' }}>
              {chat.name}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default Sidebar;
