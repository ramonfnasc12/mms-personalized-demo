import type { NotificationData } from '../types/index.js';

interface RecommendationDisplayProps {
  loading: boolean;
  notification: NotificationData | null;
}

export function RecommendationDisplay({ loading, notification }: RecommendationDisplayProps) {
  if (loading) {
    return (
      <div className="recommendation-container loading">
        <div className="spinner"></div>
        <p>Checking for recommendations...</p>
      </div>
    );
  }

  if (!notification) {
    return (
      <div className="recommendation-container empty">
        <p>Submit your preferences to get personalized recommendations</p>
      </div>
    );
  }

  if (notification.type === 'no_recommendation') {
    return (
      <div className="recommendation-container no-match">
        <div className="icon">🔍</div>
        <p>{notification.message}</p>
      </div>
    );
  }

  const { product, store, message, score } = notification;

  return (
    <div className="recommendation-container success">
      <div className="recommendation-header">
        <h2>Recommendation for You</h2>
        <span className="match-score">Match: {(score * 100).toFixed(0)}%</span>
      </div>

      <div className="product-card">
        <div className="product-header">
          <h3>{product.name}</h3>
          <div className="product-price">€{product.price.toFixed(2)}</div>
        </div>

        <p className="product-description">{product.description}</p>

        <div className="store-info">
          <span className="icon">📍</span>
          <span>{store.name}</span>
        </div>

        <div className="personalized-message">
          <p>{message}</p>
        </div>

        <div className="product-meta">
          <span className="category">{product.category}</span>
        </div>
      </div>
    </div>
  );
}
