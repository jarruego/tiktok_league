import React from 'react';

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (color: string) => void;
  disabled?: boolean;
}

const ColorPicker: React.FC<ColorPickerProps> = ({ label, value, onChange, disabled }) => {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <span style={{ minWidth: 90 }}>{label}:</span>
      <input
        type="color"
        value={value || '#1e90ff'}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        style={{ width: 36, height: 36, border: 'none', background: 'none', cursor: disabled ? 'not-allowed' : 'pointer' }}
      />
      <span style={{ fontFamily: 'monospace', fontSize: 13 }}>{value}</span>
    </div>
  );
};

export default ColorPicker;
