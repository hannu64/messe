import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import PrivateChat from './PrivateChat.jsx';

function App() {
  return (
    <BrowserRouter>
      <div style={{ display: 'flex', height: '100vh' }}>
        <Sidebar />
        <div style={{ flex: 1 }}>
          <Routes>
            <Route path="/chat/:chatId" element={<PrivateChat />} />
            <Route path="/" element={<div style={{ padding: '20px' }}>Select a chat or start a new one.</div>} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;
