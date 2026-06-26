import React, { useState, useRef, useEffect } from 'react';
import api from '../lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MessageCircle, X, Send, Sparkles, Lock, Bot } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"


const AIChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([{ role: 'system', content: 'How can I help you today?' }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const response = await api.post('/api/chat/', { message: input });
      const aiMsg = { role: 'assistant', content: response.data.response };
      setMessages(prev => [...prev, aiMsg]);
    } catch (error) {
      console.error("Chat error", error);
      if (error.response && (error.response.status === 402 || error.response.status === 403)) {
        // Some backends might return 403 for feature flag check, keeping safe.
        setShowUpgradeModal(true);
      } else {
        setMessages(prev => [...prev, { role: 'system', content: 'Sorry, I encountered an error. Please try again later.' }]);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating Button */}
      {/* Floating Button */}
      {!isOpen && (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3 group">
          {/* Concierge Label */}
          <div className="bg-white/90 backdrop-blur-sm shadow-lg text-sissphere-primary text-xs font-semibold py-2 px-4 rounded-full border border-gray-100 opacity-0 transform translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 pointer-events-none">
            SISsphere Concierge
          </div>

          <Button
            onClick={() => setIsOpen(true)}
            className="rounded-full h-14 w-14 shadow-xl bg-sissphere-primary hover:bg-sissphere-primary/90 transition-all duration-300 transform hover:scale-105"
          >
            <Sparkles size={24} color="white" />
          </Button>
        </div>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-4 right-4 z-50 w-80 md:w-96 shadow-2xl rounded-2xl overflow-hidden border border-gray-100 bg-white flex flex-col animation-fade-in-up">
          <div className="p-4 bg-sissphere-primary text-white rounded-t-lg flex justify-between items-center cursor-pointer" onClick={() => setIsOpen(false)}>
            <div className="flex items-center space-x-2">
              <Bot size={20} />
              <span className="font-semibold">SISsphere AI Assistant</span>
            </div>
            <button onClick={() => setIsOpen(false)} className="hover:bg-white/20 p-1.5 rounded-full transition-colors">
              <X size={18} />
            </button>
          </div>

          <div className="h-80 overflow-y-auto p-4 bg-slate-50 space-y-3" ref={scrollRef}>
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm shadow-sm ${msg.role === 'user'
                  ? 'bg-sissphere-primary text-white rounded-br-none'
                  : 'bg-white border text-gray-800 rounded-bl-none'
                  }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border text-gray-500 text-xs px-3 py-2 rounded-2xl rounded-bl-none shadow-sm flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-75"></span>
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-150"></span>
                </div>
              </div>
            )}
          </div>

          <div className="p-3 bg-white border-t flex gap-2">
            <Input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="Ask about grades, fees..."
              className="flex-1 rounded-full border-gray-200 focus-visible:ring-sissphere-primary"
            />
            <Button size="icon" onClick={handleSend} disabled={loading} className="rounded-full bg-sissphere-primary hover:bg-sissphere-primary/90">
              <Send size={18} />
            </Button>
          </div>
        </div>
      )}

      {/* Upgrade Modal */}
      <Dialog open={showUpgradeModal} onOpenChange={setShowUpgradeModal}>
        <DialogContent className="sm:max-w-md text-center p-0 overflow-hidden">
          <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-6 flex justify-center">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
              <Lock className="text-white w-8 h-8" />
            </div>
          </div>
          <div className="p-6 pt-2">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-blue-600">
                Unlock AI Superpowers
              </DialogTitle>
            </DialogHeader>
            <p className="text-gray-600 mt-2 mb-6">
              The AI Chat Assistant is a <strong className="text-purple-600">Pro Tier</strong> feature.
              Upgrade your school plan to enable 24/7 instant answers for students and parents.
            </p>
            <div className="grid gap-3">
              <Button className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold h-11 shadow-md">
                Upgrade to Pro Now
              </Button>
              <Button variant="ghost" onClick={() => setShowUpgradeModal(false)} className="text-gray-500">
                Maybe Later
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AIChatWidget;
