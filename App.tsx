import React, { useState } from 'react';
import { Dashboard } from './components/Dashboard';
import { ConnectionStatus } from './components/ConnectionStatus';
import { SocialConnection } from './components/SocialConnection';
import { SocialFeed } from './components/SocialFeed';
import { Activity, LayoutDashboard, Settings2, Sparkles, Share2, Users } from 'lucide-react';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'connection' | 'social' | 'community'>('dashboard');

  return (
    <div className="flex h-screen bg-slate-900 text-white overflow-hidden font-sans">

      {/* LEFT SIDEBAR NAVIGATION */}
      <div className="w-20 lg:w-64 bg-slate-950 border-r border-slate-800 flex flex-col flex-shrink-0 transition-all duration-300">

        {/* Brand Logo */}
        <div className="h-20 flex items-center justify-center lg:justify-start lg:px-6 border-b border-slate-800/50">
          <div className="bg-gradient-to-br from-purple-600 to-pink-600 p-2 rounded-lg shadow-lg shadow-purple-900/20">
            <Activity size={24} className="text-white" />
          </div>
          <span className="ml-3 font-bold text-lg tracking-tight hidden lg:block bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
            Shorts<span className="font-extrabold text-purple-400">Factory</span>
          </span>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 py-6 space-y-2 px-2 lg:px-4">

          <NavItem
            active={activeTab === 'dashboard'}
            onClick={() => setActiveTab('dashboard')}
            icon={<LayoutDashboard size={20} />}
            label="Generator"
            description="Create new content"
          />

          <NavItem
            active={activeTab === 'community'}
            onClick={() => setActiveTab('community')}
            icon={<Users size={20} />}
            label="Community"
            description="Social Feed"
          />

          <NavItem
            active={activeTab === 'social'}
            onClick={() => setActiveTab('social')}
            icon={<Share2 size={20} />}
            label="Integrations"
            description="External platforms"
          />

          <NavItem
            active={activeTab === 'connection'}
            onClick={() => setActiveTab('connection')}
            icon={<Settings2 size={20} />}
            label="Settings"
            description="API & System Check"
          />

        </nav>

        {/* Footer Info */}
        <div className="p-4 border-t border-slate-800 hidden lg:block">
          <div className="bg-slate-900 rounded-lg p-3 border border-slate-800/50">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles size={14} className="text-yellow-400" />
              <span className="text-xs font-semibold text-slate-300">Pro Plan</span>
            </div>
            <p className="text-[10px] text-slate-500 leading-tight">
              Powered by Gemini 1.5 Pro & Remotion
            </p>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-900 relative">

        {/* Header */}
        <header className="h-16 bg-slate-900/80 backdrop-blur border-b border-slate-800 flex items-center justify-center px-8 z-20">
          <h1 className="text-xl font-semibold text-white capitalize">
            {activeTab === 'dashboard' ? 'Content Generator' :
              activeTab === 'social' ? 'Social Integrations' :
                activeTab === 'community' ? 'Community Feed' : 'System Connection'}
          </h1>
          <div className="absolute right-8 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center text-xs font-bold ring-2 ring-slate-800">
              AI
            </div>
          </div>
        </header>

        {/* Content Container */}
        <main className="flex-1 overflow-hidden relative">
          {activeTab === 'dashboard' && <Dashboard />}
          {activeTab === 'social' && <SocialConnection />}
          {activeTab === 'community' && <SocialFeed />}
          {activeTab === 'connection' && <ConnectionStatus />}
        </main>

      </div>
    </div>
  );
};

// Subcomponent for Navigation Items
interface NavItemProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  description?: string;
}

const NavItem: React.FC<NavItemProps> = ({ active, onClick, icon, label, description }) => (
  <button
    onClick={onClick}
    className={`
      w-full flex items-center p-3 rounded-xl transition-all duration-200 group
      ${active
        ? 'bg-purple-600/10 text-purple-400 border border-purple-600/20'
        : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200 hover:border-slate-800 border border-transparent'}
    `}
  >
    <div className={`
      flex items-center justify-center w-6 h-6 mr-0 lg:mr-3 transition-colors
      ${active ? 'text-purple-400' : 'text-slate-500 group-hover:text-slate-300'}
    `}>
      {icon}
    </div>
    <div className="hidden lg:block text-left">
      <div className={`text-sm font-medium ${active ? 'text-purple-100' : 'text-slate-300'}`}>
        {label}
      </div>
      {description && (
        <div className={`text-[10px] ${active ? 'text-purple-400/70' : 'text-slate-600 group-hover:text-slate-500'}`}>
          {description}
        </div>
      )}
    </div>

    {active && (
      <div className="ml-auto hidden lg:block w-1.5 h-1.5 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.6)]" />
    )}
  </button>
);

export default App;
