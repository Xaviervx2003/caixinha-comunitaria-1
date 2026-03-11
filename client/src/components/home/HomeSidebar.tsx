import { PiggyBank, ChevronRight } from 'lucide-react';
import { NavSection } from './types';

type NavItem = {
  id: NavSection;
  label: string;
  icon: any;
};

type HomeSidebarProps = {
  sidebarOpen: boolean;
  activeSection: NavSection;
  navItems: NavItem[];
  debtors: number;
  userName?: string;
  onSelectSection: (section: NavSection) => void;
};

export function HomeSidebar({
  sidebarOpen,
  activeSection,
  navItems,
  debtors,
  userName,
  onSelectSection,
}: HomeSidebarProps) {
  return (
    <aside
      className={`
        fixed lg:static inset-y-0 left-0 z-30
        w-64 bg-[#0F1117] flex flex-col
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}
    >
      <div className="px-6 py-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="bg-[#00C853] p-2 rounded-lg">
            <PiggyBank className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-white font-black text-base leading-none">Caixinha</p>
            <p className="text-[#00C853] text-xs font-bold uppercase tracking-wider">Comunitária</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest px-3 mb-3">Menu</p>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          const badge = item.id === 'devedores' && debtors > 0 ? debtors : null;
          return (
            <button
              key={item.id}
              onClick={() => onSelectSection(item.id)}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all
                ${isActive
                  ? 'bg-[#00C853] text-white shadow-lg shadow-[#00C853]/20'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
                }
              `}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1 text-left">{item.label}</span>
              {badge && (
                <span className={`text-xs font-black px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white text-[#00C853]' : 'bg-[#FF3D00] text-white'}`}>
                  {badge}
                </span>
              )}
              {isActive && <ChevronRight className="w-3 h-3 opacity-70" />}
            </button>
          );
        })}
      </nav>

      <div className="px-4 py-4 border-t border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#00C853]/20 flex items-center justify-center flex-shrink-0">
            <span className="text-[#00C853] text-xs font-black">{userName?.charAt(0)?.toUpperCase()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-bold truncate">{userName}</p>
            <p className="text-gray-500 text-xs truncate">Beta v2.0</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
