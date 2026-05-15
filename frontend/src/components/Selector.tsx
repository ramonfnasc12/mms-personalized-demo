interface SelectorOption {
  value: string;
  label: string;
}

interface SelectorProps {
  label: string;
  options: SelectorOption[];
  value: string;
  onChange: (value: string) => void;
}

export function Selector({ label, options, value, onChange }: SelectorProps) {
  return (
    <div className="selector">
      <label className="selector-label">{label}</label>
      <select
        className="selector-dropdown"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
