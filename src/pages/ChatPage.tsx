import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Send, Bot, User, Loader2 } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  id: string;
}

export default function ChatPage() {
  const [searchParams] = useSearchParams();
  const stockCode = searchParams.get('stock');
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: stockCode
        ? `您好！我是您的AI投资助手。我可以帮您深度分析 ${stockCode}，或回答任何股票相关问题。`
        : '您好！我是您的AI投资助手。可以帮您分析股票、解读技术指标、回答投资问题。请直接输入您的问题。',
      id: 'welcome',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg: Message = { role: 'user', content: input.trim(), id: Date.now().toString() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    const assistantId = (Date.now() + 1).toString();
    setMessages((prev) => [...prev, { role: 'assistant', content: '', id: assistantId }]);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg.content, history: [] }),
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      if (!reader) {
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: '服务暂不可用，请稍后重试。' } : m))
        );
        setLoading(false);
        return;
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          const dataStr = trimmed.slice(6);
          if (dataStr === '[DONE]') continue;
          try {
            const data = JSON.parse(dataStr);
            if (data.chunk) {
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + data.chunk } : m))
              );
            }
          } catch {
            // ignore
          }
        }
      }
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, content: '请求出错，请检查网络后重试。' } : m))
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border-default px-4 py-3">
        <h1 className="text-base font-bold">
          <span className="text-gradient-gold">AI 投资助手</span>
        </h1>
        <p className="text-[10px] text-text-tertiary">流式对话 · 深度分析 · 仅供参考</p>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 px-4 py-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${
              msg.role === 'assistant' ? 'bg-accent-gold/20 text-accent-gold' : 'bg-bg-tertiary text-text-secondary'
            }`}>
              {msg.role === 'assistant' ? <Bot size={14} /> : <User size={14} />}
            </div>
            <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
              msg.role === 'assistant'
                ? 'bg-bg-secondary border border-border-default text-text-secondary'
                : 'bg-accent-gold/15 text-text-primary'
            }`}>
              {msg.content || (loading && msg.role === 'assistant' ? (
                <span className="inline-flex items-center gap-1">
                  <Loader2 size={12} className="animate-spin" /> 思考中...
                </span>
              ) : null)}
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t border-border-default bg-bg-secondary/80 backdrop-blur-md px-4 py-3">
        <div className="flex items-center gap-2 rounded-xl bg-bg-tertiary px-3 py-2 border border-border-default focus-within:border-accent-gold/50 transition-colors">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入股票问题..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-text-tertiary"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-gold text-bg-primary transition-opacity hover:opacity-80 disabled:opacity-30"
          >
            <Send size={14} />
          </button>
        </div>
      </form>
    </div>
  );
}
