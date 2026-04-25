import React, { useState, useEffect } from 'react';
import { Dashboard } from './components/Dashboard';
import { ConnectionStatus } from './components/ConnectionStatus';
import { SocialConnection } from './components/SocialConnection';
import { AuthScreen } from './components/AuthScreen';
import { MyVideos } from './components/MyVideos';
import { MyImages } from './components/MyImages';
import { GeneratorCarousel } from './components/GeneratorCarousel';
import { Activity, LayoutDashboard, Settings2, Sparkles, Share2, LogOut, FileVideo, ImageIcon, FolderOpen } from 'lucide-react';
import { supabase } from './src/lib/supabase';

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'generator-carousel' | 'my-videos' | 'my-images' | 'connection' | 'social'>('dashboard');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900 text-white">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (!session) {
    return <AuthScreen onAuthSuccess={() => { }} />;
  }

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
            Social<span className="font-extrabold text-purple-400">UP</span>
          </span>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 py-6 space-y-2 px-2 lg:px-4">

          <NavItem
            active={activeTab === 'dashboard'}
            onClick={() => setActiveTab('dashboard')}
            icon={<LayoutDashboard size={20} />}
            label="Gerador de Vídeos"
            description="Criar conteúdo em vídeo"
          />

          <NavItem
            active={activeTab === 'generator-carousel'}
            onClick={() => setActiveTab('generator-carousel')}
            icon={<ImageIcon size={20} />}
            label="Gerador de Imagens"
            description="Imagens e Carrosséis"
          />

          <NavItem
            active={activeTab === 'my-videos'}
            onClick={() => setActiveTab('my-videos')}
            icon={<FileVideo size={20} />}
            label="Meus Vídeos"
            description="Biblioteca salva"
          />

          <NavItem
            active={activeTab === 'my-images'}
            onClick={() => setActiveTab('my-images')}
            icon={<FolderOpen size={20} />}
            label="Minhas Imagens"
            description="Imagens e Carrosséis"
          />

          <NavItem
            active={activeTab === 'social'}
            onClick={() => setActiveTab('social')}
            icon={<Share2 size={20} />}
            label="Integrações"
            description="Plataformas externas"
          />

          <NavItem
            active={activeTab === 'connection'}
            onClick={() => setActiveTab('connection')}
            icon={<Settings2 size={20} />}
            label="Configurações"
            description="API e Conexões"
          />

        </nav>

        {/* User / Logout */}
        <div className="p-4 border-t border-slate-800">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 text-slate-400 hover:text-white hover:bg-slate-900 rounded-lg transition-colors"
          >
            <LogOut size={18} />
            <span className="hidden lg:block text-sm font-medium">Sair</span>
          </button>
        </div>

        {/* Footer Info */}
        <div className="p-4 pt-0 border-t border-slate-800 hidden lg:block">
          <div className="bg-slate-900 rounded-lg p-3 border border-slate-800/50 mt-4">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles size={14} className="text-yellow-400" />
              <span className="text-xs font-semibold text-slate-300">Plano Pro</span>
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
            {activeTab === 'dashboard' ? 'Gerador de Vídeos' :
              activeTab === 'generator-carousel' ? 'Gerador de Imagens / Carrosséis' :
              activeTab === 'social' ? 'Integrações Sociais' :
                activeTab === 'my-videos' ? 'Meus Vídeos' :
                activeTab === 'my-images' ? 'Minhas Imagens' : 'Configurações'}
          </h1>
          <div className="absolute right-8 flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-xs text-slate-400">Conectado como</p>
              <p className="text-sm font-medium text-white">{session.user.email}</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center text-xs font-bold ring-2 ring-slate-800">
              {session.user.email?.[0].toUpperCase()}
            </div>
          </div>
        </header>

        {/* Content Container */}
        <main className="flex-1 overflow-hidden relative">
          {activeTab === 'dashboard' && <Dashboard />}
          {activeTab === 'generator-carousel' && <GeneratorCarousel />}
          {activeTab === 'my-videos' && <MyVideos />}
          {activeTab === 'my-images' && <MyImages />}
          {activeTab === 'social' && <SocialConnection />}
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
