import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import './styles/main.css';
import App from './App';
import Login from './auth/Login';
import Log from './routes/Log';
import History from './routes/History';
import Charts from './routes/Charts';
import Settings from './routes/Settings';
import AuthGate from './auth/AuthGate';

const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <AuthGate>
        <App />
      </AuthGate>
    ),
    children: [
      { path: '/', element: <Log /> },
      { path: '/history', element: <History /> },
      { path: '/charts', element: <Charts /> },
      { path: '/settings', element: <Settings /> },
    ],
  },
  { path: '/login', element: <Login /> },
]);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);