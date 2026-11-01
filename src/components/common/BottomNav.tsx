import React from 'react';
import { ModuleType } from '../../types';
import {
  LayoutDashboard,
  Bot,
  Flame,
  Clapperboard,
  Rocket,
  Sliders
} from 'lucide-react';

interface BottomNavProps {
  currentModule: ModuleType;
  onChangeModule: (mod: ModuleType) => void;
}

interface NavItem {
  id: ModuleType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard },
  { id: 'ai-manager', label: 'Đội AI', icon: Bot, badge: 5 },
  { id: 'product-hunter', label: 'Săn Deal', icon: Flame },
  { id: 'content-factory', label: 'Nội dung', icon: Clapperboard },
  { id: 'campaign-center', label: 'Chiến dịch', icon: Rocket },
  { id: 'system-control', label: 'Hệ thống', icon: Sliders }
];

export const BottomNav: React.FC<BottomNavProps> = ({ currentModule, onChangeModule }) => {
  return (
    <nav 
      aria-label="Điều hướng chính"
      className="sticky bottom-0 z-40 bg-[#0B0F17]/95 backdrop-blur-xl border-t border-slate-800/80 pb-safe shadow-2xl"
    >
      <div className="grid grid-cols-6 items-center h-16 max-w-lg mx-auto px-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentModule === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onChangeModule(item.id)}
              className={`relative flex flex-col items-center justify-center min-h-[44px] min-w-[44px] py-1 px-0.5 rounded-xl transition-all duration-150 ${
                isActive
                  ? 'text-cyan-400 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {/* Active top glow indicator */}
              {isActive && (
                <span className="absolute -top-[1px] w-8 h-[2px] bg-cyan-400 shadow-[0_0_8px_#00F0FF] rounded-full" />
              )}

              <div className="relative">
                <Icon
                  className={`w-5 h-5 transition-transform duration-150 ${
                    isActive ? 'scale-110 text-cyan-400' : 'text-slate-400'
                  }`}
                />
                {item.badge && (
                  <span className="absolute -top-1.5 -right-2 bg-purple-600 text-[9px] font-bold text-white px-1 py-0.2 rounded-full min-w-[14px] text-center">
                    {item.badge}
                  </span>
                )}
              </div>

              <span className={`text-[10px] tracking-tight mt-1 whitespace-nowrap truncate max-w-full ${isActive ? 'text-cyan-300' : 'text-slate-400'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
