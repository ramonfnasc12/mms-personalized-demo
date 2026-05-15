import { useState, useEffect } from 'react';
import { SimulationPanel } from './components/SimulationPanel';
import { RecommendationDisplay } from './components/RecommendationDisplay';
import { connectSSE, getOrCreateCustomerId, getOrCreateTabId } from './services/api.service';
import type { NotificationData } from './types/index.js';
import './App.css';

function App() {
  const [notification, setNotification] = useState<NotificationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const customerId = getOrCreateCustomerId();
    const tabId = getOrCreateTabId();

    console.log('Connecting to SSE...', { customerId, tabId });

    const eventSource = connectSSE(
      customerId,
      tabId,
      (data) => {
        console.log('Received notification:', data);
        setNotification(data);
        setLoading(false);
      },
      (error) => {
        console.error('SSE error:', error);
        setConnected(false);
      }
    );

    eventSource.addEventListener('open', () => {
      console.log('SSE connection established');
      setConnected(true);
    });

    return () => {
      console.log('Closing SSE connection');
      eventSource.close();
    };
  }, []);

  const handleSubmit = () => {
    setLoading(true);
    setNotification(null);
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1>MediaMarktSaturn Contextualization Demo</h1>
          <p className="tagline">Real-time personalized recommendations powered by MongoDB</p>
          <div className="connection-status">
            <span className={`status-indicator ${connected ? 'connected' : 'disconnected'}`}></span>
            <span>{connected ? 'Connected' : 'Connecting...'}</span>
          </div>
        </div>
      </header>

      <main className="app-main">
        <div className="content-grid">
          <section className="panel-section">
            <SimulationPanel onSubmit={handleSubmit} />
          </section>

          <section className="recommendation-section">
            <RecommendationDisplay loading={loading} notification={notification} />
          </section>
        </div>
      </main>

      <footer className="app-footer">
        <p>
          Powered by{' '}
          <a href="https://www.mongodb.com" target="_blank" rel="noopener noreferrer">
            MongoDB Atlas
          </a>
          {' '}•{' '}
          <a href="https://aws.amazon.com/bedrock/" target="_blank" rel="noopener noreferrer">
            AWS Bedrock
          </a>
        </p>
      </footer>
    </div>
  );
}

export default App;
