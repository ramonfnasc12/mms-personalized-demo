import { useState } from 'react';
import { Selector } from './Selector';
import { weatherOptions, eventOptions, positionOptions, activityProfiles } from '../data/options';
import { submitContext, getOrCreateCustomerId, getOrCreateTabId } from '../services/api.service';

interface SimulationPanelProps {
  onSubmit: () => void;
}

export function SimulationPanel({ onSubmit }: SimulationPanelProps) {
  const [weather, setWeather] = useState(weatherOptions[0].value);
  const [event, setEvent] = useState(eventOptions[0].value);
  const [position, setPosition] = useState(positionOptions[0].value);
  const [activity, setActivity] = useState(activityProfiles[0].value);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);

    try {
      const selectedWeather = weatherOptions.find(w => w.value === weather)!;
      const selectedEvent = eventOptions.find(e => e.value === event)!;
      const selectedPosition = positionOptions.find(p => p.value === position)!;
      const selectedActivity = activityProfiles.find(a => a.value === activity)!;

      const customerId = getOrCreateCustomerId();
      const tabId = getOrCreateTabId();

      await submitContext({
        customerId,
        tabId,
        position: {
          type: 'Point',
          coordinates: [selectedPosition.lon, selectedPosition.lat]
        },
        weather: {
          condition: selectedWeather.condition,
          temperature: selectedWeather.temp,
          label: selectedWeather.label
        },
        event: {
          type: selectedEvent.value,
          label: selectedEvent.label,
          description: selectedEvent.description
        },
        customerActivity: {
          profile: selectedActivity.value,
          recentViews: selectedActivity.recentViews,
          recentPurchases: selectedActivity.recentPurchases,
          cartItems: selectedActivity.cartItems
        }
      });

      onSubmit();
    } catch (err) {
      setError('Failed to submit context. Please try again.');
      console.error('Submit error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="simulation-panel">
      <h2>Simulation Controls</h2>
      <p className="subtitle">Configure customer context for personalized recommendations</p>

      <div className="selectors-grid">
        <Selector
          label="Weather Conditions"
          options={weatherOptions}
          value={weather}
          onChange={setWeather}
        />

        <Selector
          label="Local Events"
          options={eventOptions}
          value={event}
          onChange={setEvent}
        />

        <Selector
          label="Customer Location"
          options={positionOptions}
          value={position}
          onChange={setPosition}
        />

        <Selector
          label="Customer Profile"
          options={activityProfiles}
          value={activity}
          onChange={setActivity}
        />
      </div>

      {error && (
        <div className="error-message">{error}</div>
      )}

      <button
        className="submit-button"
        onClick={handleSubmit}
        disabled={submitting}
      >
        {submitting ? 'Submitting...' : 'Get Recommendation'}
      </button>
    </div>
  );
}
