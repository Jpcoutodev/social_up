import React, { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, LogOut, ExternalLink, Loader2, Share2 } from 'lucide-react';

interface SocialAccount {
  id: string;
  name: string;
  icon: React.ReactNode;
  color: string; // Tailwind class or hex
  description: string;
  connected: boolean;
  username?: string;
}

// Custom TikTok Icon since Lucide doesn't have it explicitly
const TikTokIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
    <path d="M19.589 6.686a4.793 4.793 0 0 1-3.77-4.245V2h-3.445v13.672a2.896 2.896 0 0 1-5.201 1.743l-.002-.001.002.001a2.895 2.895 0 0 1 3.183-4.51v-3.5a6.394 6.394 0 0 0-5.394 9.365 6.394 6.394 0 0 0 10.964-2.413V8.25c1.2.918 2.793 1.31 4.383 1.223V6.106a4.807 4.807 0 0 1-.72-.045z" />
  </svg>
);

// Lucide Imports for others
import { Youtube, Facebook, Instagram } from 'lucide-react';

export const SocialConnection: React.FC = () => {
  const [accounts, setAccounts] = useState<SocialAccount[]>([
    {
      id: 'youtube',
      name: 'YouTube Shorts',
      icon: <Youtube size={24} />,
      color: 'bg-red-600',
      description: 'Auto-post to your channel as Shorts.',
      connected: false
    },
    {
      id: 'instagram',
      name: 'Instagram Reels',
      icon: <Instagram size={24} />,
      color: 'bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500',
      description: 'Share directly to your Reels feed.',
      connected: false
    },
    {
      id: 'tiktok',
      name: 'TikTok',
      icon: <TikTokIcon />,
      color: 'bg-black border border-slate-700',
      description: 'Sync with your TikTok profile.',
      connected: false
    },
    {
      id: 'facebook',
      name: 'Facebook Reels',
      icon: <Facebook size={24} />,
      color: 'bg-blue-600',
      description: 'Publish to your Page or Profile.',
      connected: false
    }
  ]);

  const [n8nUrl, setN8nUrl] = useState('');
  const [bundleUrl, setBundleUrl] = useState('');
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // Load state from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem('connected_socials');
    if (saved) {
      const savedState = JSON.parse(saved);
      setAccounts(prev => prev.map(acc => ({
        ...acc,
        connected: savedState[acc.id]?.connected || false,
        username: savedState[acc.id]?.username
      })));
    }

    // Load n8n config
    const savedN8n = localStorage.getItem('n8n_config');
    if (savedN8n) {
      const config = JSON.parse(savedN8n);
      setN8nUrl(config.webhookUrl || '');
      setBundleUrl(config.bundleUrl || '');
    }
  }, []);

  const saveN8nConfig = () => {
    localStorage.setItem('n8n_config', JSON.stringify({ webhookUrl: n8nUrl, bundleUrl }));
    alert('n8n Configuration Saved!');
  };

  const handleConnect = (id: string) => {
    setLoadingId(id);

    // Simulate OAuth Delay
    setTimeout(() => {
      const mockUsername = `@user_${Math.floor(Math.random() * 1000)}`;

      setAccounts(prev => {
        const newAccounts = prev.map(acc =>
          acc.id === id ? { ...acc, connected: true, username: mockUsername } : acc
        );

        // Save to local storage
        const storageState = newAccounts.reduce((acc, curr) => ({
          ...acc,
          [curr.id]: { connected: curr.connected, username: curr.username }
        }), {});
        localStorage.setItem('connected_socials', JSON.stringify(storageState));

        return newAccounts;
      });
      setLoadingId(null);
    }, 1500);
  };

  const handleDisconnect = (id: string) => {
    setAccounts(prev => {
      const newAccounts = prev.map(acc =>
        acc.id === id ? { ...acc, connected: false, username: undefined } : acc
      );

      const storageState = newAccounts.reduce((acc, curr) => ({
        ...acc,
        [curr.id]: { connected: curr.connected, username: curr.username }
      }), {});
      localStorage.setItem('connected_socials', JSON.stringify(storageState));

      return newAccounts;
    });
  };

  return (
    <div className="p-8 max-w-6xl mx-auto h-full overflow-y-auto custom-scrollbar">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">Social Integrations</h2>
          <p className="text-slate-400">Connect your accounts to enable one-click publishing.</p>
        </div>
        <div className="bg-slate-800 p-3 rounded-lg border border-slate-700 flex items-center gap-2 text-sm text-slate-300">
          <Share2 size={16} />
          <span>Auto-Publish Enabled</span>
        </div>
      </div>

      {/* n8n Configuration Section */}
      <div className="mb-8 bg-slate-900/50 border border-purple-500/30 p-6 rounded-xl">
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          ⚡ n8n Automation Setup
        </h3>
        <p className="text-slate-400 text-sm mb-4">
          Configure your n8n Webhook and Hosted Bundle to enable Cloud Rendering & Posting.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">n8n Webhook URL (POST)</label>
            <input
              type="text"
              value={n8nUrl}
              onChange={(e) => setN8nUrl(e.target.value)}
              placeholder="https://n8n.your-domain.com/webhook/..."
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:border-purple-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Remotion Bundle URL (Vercel/Netlify)</label>
            <input
              type="text"
              value={bundleUrl}
              onChange={(e) => setBundleUrl(e.target.value)}
              placeholder="https://my-video-project.vercel.app/bundle"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:border-purple-500 outline-none"
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={saveN8nConfig}
            className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg transition-colors"
          >
            Save Configuration
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-6">
        {accounts.map((account) => (
          <div
            key={account.id}
            className={`
              relative overflow-hidden rounded-xl border transition-all duration-300
              ${account.connected
                ? 'bg-slate-800/80 border-slate-600 shadow-lg shadow-purple-900/10'
                : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'}
            `}
          >
            {/* Header / Banner */}
            <div className={`h-24 ${account.connected ? account.color : 'bg-slate-800'} flex items-center justify-center relative transition-colors duration-500`}>
              <div className="text-white transform scale-150 opacity-90">
                {account.icon}
              </div>
              {/* Status Badge */}
              <div className="absolute top-4 right-4">
                {account.connected ? (
                  <div className="bg-black/30 backdrop-blur-md px-3 py-1 rounded-full flex items-center gap-1.5 text-xs font-bold text-white border border-white/20">
                    <CheckCircle2 size={12} className="text-green-400" />
                    CONNECTED
                  </div>
                ) : (
                  <div className="bg-black/30 backdrop-blur-md px-3 py-1 rounded-full flex items-center gap-1.5 text-xs font-bold text-slate-400 border border-white/10">
                    <div className="w-2 h-2 rounded-full bg-slate-500" />
                    DISCONNECTED
                  </div>
                )}
              </div>
            </div>

            {/* Content Body */}
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-bold text-white">{account.name}</h3>
                  <p className="text-sm text-slate-400 mt-1">{account.description}</p>
                </div>
              </div>

              {account.connected && (
                <div className="mb-6 p-3 bg-slate-950/50 rounded-lg border border-slate-700/50 flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-mono">ACCOUNT</span>
                  <span className="text-sm text-white font-medium">{account.username}</span>
                </div>
              )}

              <div className="flex gap-3">
                {account.connected ? (
                  <>
                    <button className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2">
                      <ExternalLink size={16} />
                      View Channel
                    </button>
                    <button
                      onClick={() => handleDisconnect(account.id)}
                      className="px-4 py-2.5 bg-red-900/20 hover:bg-red-900/40 border border-red-800/50 text-red-400 text-sm font-medium rounded-lg transition-colors"
                    >
                      <LogOut size={18} />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleConnect(account.id)}
                    disabled={loadingId !== null}
                    className={`
                      w-full py-3 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2
                      ${loadingId === account.id
                        ? 'bg-slate-700 text-slate-400'
                        : 'bg-white hover:bg-slate-200 text-slate-900'}
                    `}
                  >
                    {loadingId === account.id ? (
                      <>
                        <Loader2 className="animate-spin" size={16} />
                        Connecting...
                      </>
                    ) : (
                      <>
                        Connect {account.name}
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
