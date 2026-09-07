import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Users, LayoutDashboard, Plus, ChevronRight, Hash } from 'lucide-react';
import { storage } from '../lib/storage';
import { cn } from '../lib/utils';

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [clients, setClients] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      storage.getClients().then(setClients);
    }
  }, [isOpen]);
  
  const filteredItems = useMemo(() => {
    const search = query.toLowerCase();
    const results = [
      { id: 'dash', label: 'Ver Dashboard Global', icon: LayoutDashboard, action: () => navigate('/dashboard'), category: 'Ações' },
      { id: 'new', label: 'Cadastrar Novo Cliente', icon: Plus, action: () => navigate('/clientes/novo'), category: 'Ações' },
      ...clients.filter(c => c.name.toLowerCase().includes(search)).map(c => ({
        id: c.id,
        label: `Dashboard: ${c.name}`,
        icon: Users,
        action: () => navigate(`/clientes/${c.id}`),
        category: 'Clientes'
      }))
    ];
    return results.filter(item => item.label.toLowerCase().includes(search));
  }, [query, clients, navigate]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      
      if (!isOpen) return;

      if (e.key === 'Escape') setIsOpen(false);
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, filteredItems.length - 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const item = filteredItems[selectedIndex];
        if (item) {
          item.action();
          setIsOpen(false);
        }
      }
    };

    const handleOpenEvent = () => setIsOpen(true);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('open-command-palette', handleOpenEvent);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('open-command-palette', handleOpenEvent);
    };
  }, [isOpen, filteredItems, selectedIndex]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => setIsOpen(false)}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
      />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: -20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-xl glass rounded-2xl overflow-hidden shadow-2xl relative z-10 border border-white/10"
      >
        <div className="flex items-center gap-3 px-6 py-4 border-b border-white/5">
          <Search size={20} className="text-text-muted" />
          <input 
            autoFocus
            placeholder="O que você está procurando? (Busque por clientes ou ações...)"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            className="flex-1 bg-transparent border-none outline-none text-base placeholder:text-text-muted"
          />
          <kbd className="hidden sm:block px-2 py-1 rounded bg-white/5 border border-white/10 text-[10px] font-mono text-text-muted">ESC</kbd>
        </div>

        <div className="max-h-[400px] overflow-y-auto p-2 scrollbar-hide">
          {filteredItems.length > 0 ? (
            <div className="space-y-1">
              {filteredItems.map((item, idx) => (
                <button
                  key={item.id}
                  onClick={() => {
                    item.action();
                    setIsOpen(false);
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={cn(
                    "w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all text-sm group text-left",
                    selectedIndex === idx ? "bg-white/10 text-white" : "text-text-secondary hover:bg-white/5"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                      selectedIndex === idx ? "bg-accent-mint/20 text-accent-mint" : "bg-white/5 text-text-muted"
                    )}>
                      <item.icon size={18} />
                    </div>
                    <div>
                      <p className="font-medium">{item.label}</p>
                      <p className="text-[10px] text-text-muted uppercase tracking-widest font-bold">{item.category}</p>
                    </div>
                  </div>
                  <ChevronRight size={14} className={cn("opacity-0 transition-all", selectedIndex === idx && "opacity-100 translate-x-1")} />
                </button>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-text-muted flex flex-col items-center">
               <Hash size={32} className="mb-2 opacity-20" />
               <p>Nenhum resultado para "{query}"</p>
            </div>
          )}
        </div>

        <div className="bg-white/[0.02] px-6 py-3 border-t border-white/5 flex items-center justify-between text-[10px] font-bold text-text-muted uppercase tracking-widest">
           <span>Select <kbd className="bg-white/5 p-1 rounded">↵</kbd></span>
           <span>Navigate <kbd className="bg-white/5 p-1 rounded">↑↓</kbd></span>
        </div>
      </motion.div>
    </div>
  );
}
