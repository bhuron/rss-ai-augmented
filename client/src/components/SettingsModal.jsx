import React, { useState, useEffect } from 'react';

const PROVIDERS = [
  { id: 'openai', name: 'OpenAI', defaultModel: 'gpt-4o-mini', needsBaseUrl: false },
  { id: 'anthropic', name: 'Anthropic', defaultModel: 'claude-3-5-sonnet-20241022', needsBaseUrl: false },
  { id: 'openrouter', name: 'OpenRouter', defaultModel: 'anthropic/claude-3.5-sonnet', needsBaseUrl: false },
  { id: 'ollama', name: 'Ollama (Local)', defaultModel: 'llama3.2', needsBaseUrl: true, defaultBaseUrl: 'http://localhost:11434' },
  { id: 'custom', name: 'Custom (OpenAI-compatible)', defaultModel: 'gpt-3.5-turbo', needsBaseUrl: true },
];

function SettingsModal({ isOpen, onClose, onExport, onImport }) {
  const [config, setConfig] = useState({
    provider: 'openai',
    apiKey: '',
    baseUrl: '',
    model: 'gpt-4o-mini'
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchConfig();
    }
  }, [isOpen]);

  const fetchConfig = async () => {
    const res = await fetch('/api/settings/llm');
    const data = await res.json();
    if (data.provider) {
      setConfig(data);
    }
  };

  const handleProviderChange = (provider) => {
    const providerInfo = PROVIDERS.find(p => p.id === provider);
    setConfig({
      ...config,
      provider,
      model: providerInfo.defaultModel,
      baseUrl: providerInfo.defaultBaseUrl || ''
    });
  };

  const handleSave = async () => {
    setSaving(true);
    await fetch('/api/settings/llm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    setSaving(false);
    onClose();
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.opml,.xml';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          onImport(event.target.result);
          onClose();
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  if (!isOpen) return null;

  const selectedProvider = PROVIDERS.find(p => p.id === config.provider);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>LLM Configuration</h2>
        
        <div className="form-group">
          <label>Provider</label>
          <select 
            value={config.provider} 
            onChange={(e) => handleProviderChange(e.target.value)}
          >
            {PROVIDERS.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Model</label>
          <input
            type="text"
            value={config.model}
            onChange={(e) => setConfig({ ...config, model: e.target.value })}
            placeholder={selectedProvider?.defaultModel}
          />
        </div>

        {config.provider !== 'ollama' && (
          <div className="form-group">
            <label>API Key</label>
            <input
              type="password"
              value={config.apiKey}
              onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
              placeholder="Enter your API key"
            />
          </div>
        )}

        {selectedProvider?.needsBaseUrl && (
          <div className="form-group">
            <label>Base URL</label>
            <input
              type="text"
              value={config.baseUrl}
              onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })}
              placeholder={selectedProvider.defaultBaseUrl || 'https://api.example.com/v1'}
            />
          </div>
        )}

        <div className="modal-actions">
          <button onClick={onClose}>Cancel</button>
          <button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>

        <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #e0e0e0' }}>
          <h3 style={{ fontSize: '14px', color: '#666', marginBottom: '12px' }}>Feed Management</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={onExport} style={{ flex: 1, padding: '8px', background: '#f8f9fa', color: '#333', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>
              📥 Export Feeds
            </button>
            <button onClick={handleImport} style={{ flex: 1, padding: '8px', background: '#f8f9fa', color: '#333', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>
              📤 Import Feeds
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingsModal;
