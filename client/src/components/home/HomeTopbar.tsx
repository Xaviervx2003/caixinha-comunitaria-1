import { Menu, Plus } from 'lucide-react';
import { NavSection } from './types';

type HomeTopbarProps = {
  activeSection: NavSection;
  activeSectionLabel: string;
  onOpenSidebar: () => void;
  onOpenAddParticipant: () => void;
};

export function HomeTopbar({
  activeSection,
  activeSectionLabel,
  onOpenSidebar,
  onOpenAddParticipant,
}: HomeTopbarProps) {
  return (
    <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4 flex items-center justify-between flex-shrink-0">
      <div className="flex items-center gap-4">
        <button onClick={onOpenSidebar} className="lg:hidden text-gray-500 hover:text-gray-900">
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-lg font-black text-gray-900 capitalize">{activeSectionLabel}</h1>
          <p className="text-xs text-gray-400 hidden sm:block">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {activeSection === 'participantes' && (
          <button
            onClick={onOpenAddParticipant}
            className="flex items-center gap-2 bg-[#00C853] text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-[#00a844] transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Novo Membro</span>
          </button>
        )}
      </div>
    </header>
  );
}
