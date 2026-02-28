import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

function Sidebar() {
  const [chats, setChats] = useState([]);
  const [newChatName, setNewChatName] = useState('');
  const [editingChatId, setEditingChatId] = useState(null);
  const [editNameInput, setEditNameInput] = useState('');
  const editInputRef = useRef(null);
  const navigate = useNavigate();

  const loadChats = () => {
    try {
      const stored = JSON.parse(localStorage.getItem('chats')) || [];
      const validChats = stored.filter(chat => 
        chat && typeof chat === 'object' && chat.id && typeof chat.name === 'string'
      );
      if (validChats.length < stored.length) {
        console.warn('Removed invalid chat entries');
        localStorage.setItem('chats', JSON.stringify(validChats));
      }

      // Enrich with simple last-message preview (sender-based)
      const enriched = validChats.map(chat => {
        const msgs = JSON.parse(localStorage.getItem(`messages_${chat.id}`)) || [];
        let preview = 'No messages yet';
        if (msgs.length > 0) {
          const lastSender = msgs[msgs.length - 1].sender;
          preview = lastSender === 'me' ? 'You sent a message' : 'Friend replied';
        }
        return { ...chat, preview };
      });

      setChats(enriched);
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

  useEffect(() => {
    if (editingChatId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingChatId]);

  const startEdit = (chat) => {
    setEditingChatId(chat.id);
    setEditNameInput(chat.name);
  };

  const saveEdit = (chatId) => {
    if (!editNameInput.trim()) {
      cancelEdit();
      return;
    }
    const updated = chats.map(c => 
      c.id === chatId ? { ...c, name: editNameInput.trim() } : c
    );
    setChats(updated);
    localStorage.setItem('chats', JSON.stringify(updated.map(c => ({ id: c.id, name: c.name }))));
    window.dispatchEvent(new Event('chatsUpdated'));
    cancelEdit();
  };

  const cancelEdit = () => {
    setEditingChatId(null);
    setEditNameInput('');
  };

  const handleKeyDown = (e, chatId) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveEdit(chatId);
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  };

  const addChat = () => {
    if (!newChatName.trim()) return;
    const newChatId = Date.now().toString();
    const updated = [...chats, { id: newChatId, name: newChatName.trim() }];
    setChats(updated);
    localStorage.setItem('chats', JSON.stringify(updated.map(c => ({ id: c.id, name: c.name }))));
    setNewChatName('');
    navigate(`/chat/${newChatId}`);
  };

  const removeChat = (chatId) => {
    const chatName = chats.find(c => c.id === chatId)?.name || 'this chat';
    if (!window.confirm(`Are you sure you want to remove "${chatName}"?`)) return;

    const updated = chats.filter(c => c.id !== chatId);
    setChats(updated);
    localStorage.setItem('chats', JSON.stringify(updated.map(c => ({ id: c.id, name: c.name }))));
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
          const isEditing = editingChatId === chat.id;
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
                flexDirection: 'column',
                marginBottom: '12px',
                padding: '6px 8px',
                borderRadius: '6px',
                background: window.location.pathname === `/chat/${chat.id}` ? '#f0f0f0' : 'transparent'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                {isEditing ? (
                  <input
                    ref={editInputRef}
                    type="text"
                    value={editNameInput}
                    onChange={(e) => setEditNameInput(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, chat.id)}
                    onBlur={() => saveEdit(chat.id)}
                    style={{
                      flex: 1,
                      padding: '4px 8px',
                      border: '1px solid #007bff',
                      borderRadius: '4px',
                      outline: 'none'
                    }}
                  />
                ) : (
                  <button
                    onClick={() => navigate(`/chat/${chat.id}`)}
                    title={safeName}
                    style={{ 
                      flex: 1, 
                      textAlign: 'left', 
                      background: 'none', 
                      border: 'none', 
                      cursor: 'pointer',
                      fontWeight: '500'
                    }}
                  >
                    {displayName}
                    {localStorage.getItem(`key_${chat.id}`) && <span style={{ color: 'green', marginLeft: '6px' }}>🔒</span>}
                  </button>
                )}

                <div style={{ display: 'flex', gap: '4px' }}>
                  {!isEditing && (
                    <button
                      onClick={() => startEdit(chat)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#007bff',
                        cursor: 'pointer',
                        fontSize: '1.1em',
                        padding: '2px 6px'
                      }}
                      title="Rename chat"
                    >
                      ✏️
                    </button>
                  )}

                  {isEditing && (
                    <button
                      onClick={() => saveEdit(chat.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#28a745',
                        cursor: 'pointer',
                        fontSize: '1.3em',
                        padding: '2px 6px'
                      }}
                      title="Save"
                    >
                      ✓
                    </button>
                  )}

                  <button
                    onClick={() => removeChat(chat.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#dc3545',
                      cursor: 'pointer',
                      fontSize: '1.3em',
                      padding: '2px 6px'
                    }}
                    title="Remove chat"
                  >
                    🗑
                  </button>
                </div>
              </div>

              {/* Simple sender-based preview */}
              <div style={{
                fontSize: '0.85em',
                color: '#666',
                marginTop: '4px',
                paddingLeft: '4px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {chat.preview}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default Sidebar;