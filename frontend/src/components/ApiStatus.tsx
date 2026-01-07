import { useEffect, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export function ApiStatus() {
  const [status, setStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [backendUrl, setBackendUrl] = useState<string>('');

  useEffect(() => {
    checkApiHealth();
    setBackendUrl(API_BASE);
  }, []);

  const checkApiHealth = async () => {
    try {
      const response = await fetch(`${API_BASE}/health`, { 
        method: 'GET',
        signal: AbortSignal.timeout(5000) 
      });
      
      if (response.ok) {
        setStatus('connected');
      } else {
        setStatus('error');
      }
    } catch (error) {
      console.error('Backend health check failed:', error);
      setStatus('error');
    }
  };

  if (status === 'checking') {
    return null;
  }

  if (status === 'error') {
    return (
      <div className="bg-yellow-900 border-l-4 border-yellow-500 text-yellow-200 p-4 mb-6">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            ⚠️
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium">Backend API Not Connected</h3>
            <div className="mt-2 text-sm">
              <p>The frontend cannot reach the backend API.</p>
              <p className="mt-1 font-mono text-xs">Trying to connect to: {backendUrl}</p>
              <p className="mt-2">
                <strong>To fix:</strong> Set VITE_API_URL environment variable in Vercel to your backend URL
                (e.g., <code className="bg-yellow-800 px-1 rounded">https://your-app.fly.dev/api</code>)
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-green-900 border-l-4 border-green-500 text-green-200 p-3 mb-6">
      <div className="flex items-center">
        <div className="flex-shrink-0">✅</div>
        <div className="ml-3">
          <p className="text-sm">Backend connected: {backendUrl}</p>
        </div>
      </div>
    </div>
  );
}
