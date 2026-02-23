import { useState, useCallback } from 'react';
import type { AgentStatus } from '@cc-spacemolt/shared';

interface ChatInputProps {
  status: AgentStatus;
  connected: boolean;
  supportsInput: boolean;
  initialPrompt: string;
  onSendMessage: (text: string) => void;
  onStart: (instructions?: string) => void;
}

export function ChatInput({
  status,
  connected,
  supportsInput,
  initialPrompt,
  onSendMessage,
  onStart,
}: ChatInputProps) {
  const [text, setText] = useState('');
  const [instructions, setInstructions] = useState('');

  const handleSubmit = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSendMessage(trimmed);
    setText('');
  }, [text, onSendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  // Show start button when idle or done
  if (status === 'idle' || status === 'done') {
    return (
      <div className="px-4 py-3 bg-gray-900 border-t border-gray-800 shrink-0 flex flex-col gap-2">
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder={initialPrompt || 'Enter instructions...'}
          rows={2}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-y min-h-[2.5rem] text-base"
        />
        <button
          onClick={() => onStart(instructions.trim() || undefined)}
          disabled={!connected}
          className="w-full py-2 bg-green-700 text-green-100 rounded font-medium hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status === 'done' ? 'Restart Agent' : 'Start Agent'}
        </button>
      </div>
    );
  }

  // Hide input if provider doesn't support it
  if (!supportsInput) return null;

  return (
    <div className="px-4 py-3 bg-gray-900 border-t border-gray-800 shrink-0">
      <div className="flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Send a message..."
          disabled={status !== 'running' || !connected}
          className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 disabled:opacity-50"
        />
        <button
          onClick={handleSubmit}
          disabled={!text.trim() || status !== 'running' || !connected}
          className="px-4 py-2 bg-blue-700 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Send
        </button>
      </div>
    </div>
  );
}
