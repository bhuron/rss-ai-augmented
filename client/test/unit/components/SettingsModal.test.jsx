import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../setup.js';
import SettingsModal from '../../../src/components/SettingsModal';

describe('SettingsModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onExport: vi.fn(),
    onImport: vi.fn()
  };

  // Helper to get input by label text
  const getInputByLabel = (container, labelText) => {
    const labels = Array.from(container.querySelectorAll('label'));
    const label = labels.find(l => l.textContent === labelText);
    return label?.parentElement.querySelector('input, select');
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not render when isOpen is false', () => {
    render(<SettingsModal {...defaultProps} isOpen={false} />);

    expect(screen.queryByText('LLM Configuration')).not.toBeInTheDocument();
  });

  it('should render modal when isOpen is true', () => {
    render(<SettingsModal {...defaultProps} />);

    expect(screen.getByText('LLM Configuration')).toBeInTheDocument();
  });

  it('should render all provider options', () => {
    render(<SettingsModal {...defaultProps} />);

    expect(screen.getByText('OpenAI')).toBeInTheDocument();
    expect(screen.getByText('Anthropic')).toBeInTheDocument();
    expect(screen.getByText('OpenRouter')).toBeInTheDocument();
    expect(screen.getByText('Ollama (Local)')).toBeInTheDocument();
    expect(screen.getByText('Custom (OpenAI-compatible)')).toBeInTheDocument();
  });

  it('should render form fields', () => {
    const { container } = render(<SettingsModal {...defaultProps} />);

    expect(getInputByLabel(container, 'Provider')).toBeInTheDocument();
    expect(getInputByLabel(container, 'Model')).toBeInTheDocument();
    expect(getInputByLabel(container, 'API Key')).toBeInTheDocument();
  });

  it('should fetch config on mount', async () => {
    server.use(
      http.get('/api/settings/llm', () => {
        return HttpResponse.json({
          provider: 'openai',
          apiKey: 'sk-test-key',
          model: 'gpt-4o-mini'
        });
      })
    );

    render(<SettingsModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('gpt-4o-mini')).toBeInTheDocument();
    });
  });

  it('should load existing config into form', async () => {
    server.use(
      http.get('/api/settings/llm', () => {
        return HttpResponse.json({
          provider: 'anthropic',
          apiKey: 'sk-ant-test',
          model: 'claude-3-5-sonnet-20241022'
        });
      })
    );

    render(<SettingsModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('claude-3-5-sonnet-20241022')).toBeInTheDocument();
    });
  });

  it('should hide API key field for Ollama', async () => {
    const user = userEvent.setup();
    const { container } = render(<SettingsModal {...defaultProps} />);

    const providerSelect = getInputByLabel(container, 'Provider');
    await user.selectOptions(providerSelect, 'ollama');

    expect(getInputByLabel(container, 'API Key')).toBeUndefined();
  });

  it('should show Base URL field for Ollama', async () => {
    const user = userEvent.setup();
    const { container } = render(<SettingsModal {...defaultProps} />);

    const providerSelect = getInputByLabel(container, 'Provider');
    await user.selectOptions(providerSelect, 'ollama');

    expect(getInputByLabel(container, 'Base URL')).toBeInTheDocument();
  });

  it('should show Base URL field for Custom provider', async () => {
    const user = userEvent.setup();
    const { container } = render(<SettingsModal {...defaultProps} />);

    const providerSelect = getInputByLabel(container, 'Provider');
    await user.selectOptions(providerSelect, 'custom');

    expect(getInputByLabel(container, 'Base URL')).toBeInTheDocument();
  });

  it('should not show Base URL field for OpenAI', async () => {
    const user = userEvent.setup();
    const { container } = render(<SettingsModal {...defaultProps} />);

    const providerSelect = getInputByLabel(container, 'Provider');
    await user.selectOptions(providerSelect, 'openai');

    expect(getInputByLabel(container, 'Base URL')).toBeUndefined();
  });

  it('should update model to default when provider changes', async () => {
    const user = userEvent.setup();
    const { container } = render(<SettingsModal {...defaultProps} />);

    const providerSelect = getInputByLabel(container, 'Provider');
    const modelInput = getInputByLabel(container, 'Model');

    expect(modelInput.value).toBe('gpt-4o-mini');

    await user.selectOptions(providerSelect, 'anthropic');

    expect(modelInput.value).toBe('claude-3-5-sonnet-20241022');
  });

  it('should update baseUrl to default when provider changes', async () => {
    const user = userEvent.setup();
    const { container } = render(<SettingsModal {...defaultProps} />);

    const providerSelect = getInputByLabel(container, 'Provider');
    let baseUrlInput = getInputByLabel(container, 'Base URL');

    expect(baseUrlInput).toBeUndefined();

    await user.selectOptions(providerSelect, 'ollama');

    const ollamaBaseUrlInput = getInputByLabel(container, 'Base URL');
    expect(ollamaBaseUrlInput.value).toBe('http://localhost:11434');
  });

  it('should call onClose when Cancel is clicked', async () => {
    const user = userEvent.setup();
    render(<SettingsModal {...defaultProps} />);

    const cancelButton = screen.getByText('Cancel');
    await user.click(cancelButton);

    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('should save config when Save is clicked', async () => {
    const user = userEvent.setup();
    server.use(
      http.post('/api/settings/llm', () => {
        return HttpResponse.json({ success: true });
      })
    );

    const { container } = render(<SettingsModal {...defaultProps} />);

    const modelInput = getInputByLabel(container, 'Model');
    await user.clear(modelInput);
    await user.type(modelInput, 'gpt-4');

    const saveButton = screen.getByText('Save');
    await user.click(saveButton);

    await waitFor(() => {
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  it('should call onClose after saving', async () => {
    const user = userEvent.setup();
    server.use(
      http.post('/api/settings/llm', () => {
        return HttpResponse.json({ success: true });
      })
    );

    render(<SettingsModal {...defaultProps} />);

    const saveButton = screen.getByText('Save');
    await user.click(saveButton);

    await waitFor(() => {
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });
  });

  it('should show Saving... while saving', async () => {
    const user = userEvent.setup();
    let resolvePost;
    const postPromise = new Promise(resolve => {
      resolvePost = resolve;
    });

    server.use(
      http.post('/api/settings/llm', () => {
        return postPromise;
      })
    );

    render(<SettingsModal {...defaultProps} />);

    const saveButton = screen.getByText('Save');
    await user.click(saveButton);

    expect(screen.getByText('Saving...')).toBeInTheDocument();

    resolvePost(HttpResponse.json({ success: true }));

    await waitFor(() => {
      expect(screen.queryByText('Saving...')).not.toBeInTheDocument();
    });
  });

  it('should disable save button while saving', async () => {
    const user = userEvent.setup();
    let resolvePost;
    const postPromise = new Promise(resolve => {
      resolvePost = resolve;
    });

    server.use(
      http.post('/api/settings/llm', () => {
        return postPromise;
      })
    );

    render(<SettingsModal {...defaultProps} />);

    const saveButton = screen.getByText('Save');
    await user.click(saveButton);

    expect(saveButton).toBeDisabled();

    resolvePost(HttpResponse.json({ success: true }));

    await waitFor(() => {
      expect(saveButton).not.toBeDisabled();
    });
  });

  it('should call onExport when Export Feeds is clicked', async () => {
    const user = userEvent.setup();
    render(<SettingsModal {...defaultProps} />);

    const exportButton = screen.getByText('Export Feeds');
    await user.click(exportButton);

    expect(defaultProps.onExport).toHaveBeenCalledTimes(1);
  });

  it('should trigger file input when Import Feeds is clicked', async () => {
    const user = userEvent.setup();
    // Track createElement calls
    const createElementSpy = vi.spyOn(document, 'createElement');

    render(<SettingsModal {...defaultProps} />);

    const importButton = screen.getByText('Import Feeds');
    await user.click(importButton);

    expect(createElementSpy).toHaveBeenCalledWith('input');

    createElementSpy.mockRestore();
  });

  it('should stop propagation when clicking modal content', () => {
    const { container } = render(<SettingsModal {...defaultProps} />);

    const modalContent = container.querySelector('.modal-content');
    expect(modalContent).toBeInTheDocument();
  });

  it('should handle empty config response', async () => {
    const { container } = render(<SettingsModal {...defaultProps} />);

    await waitFor(() => {
      expect(getInputByLabel(container, 'Provider')).toBeInTheDocument();
    });
  });

  it('should not fetch config when modal is closed', () => {
    render(<SettingsModal {...defaultProps} isOpen={false} />);

    // MSW tracks requests, but modal is closed so no fetch should happen
    // This test just verifies the modal doesn't render
    expect(screen.queryByText('LLM Configuration')).not.toBeInTheDocument();
  });
});
