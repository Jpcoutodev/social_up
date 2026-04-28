import React, { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Server, ShieldCheck, Cpu, RefreshCw, Sparkles, Zap, BarChart3, DollarSign } from 'lucide-react';
import { checkProviderConnection } from '../src/lib/aiProxy';
import { getBrandPrompt, setBrandPrompt as saveBrandPrompt } from '../services/geminiService';
import { supabase } from '../src/lib/supabase';

type Status = 'idle' | 'checking' | 'ok' | 'error';

interface UsageRow {
  id: string;
  user_email: string;
  provider: string;
  action: string;
  units_in: number;
  units_out: number;
  estimated_cost_usd: number;
  created_at: string;
}

interface UsageSummary {
  totalCost: number;
  totalCalls: number;
  byUser: Record<string, { calls: number; cost: number }>;
  byProvider: Record<string, { calls: number; cost: number }>;
}

export const ConnectionStatus: React.FC = () => {
  const [minimaxStatus, setMinimaxStatus] = useState<Status>('idle');
  const [minimaxMessage, setMinimaxMessage] = useState('');
  const [minimaxLatency, setMinimaxLatency] = useState<number | null>(null);

  const [geminiStatus, setGeminiStatus] = useState<Status>('idle');
  const [geminiMessage, setGeminiMessage] = useState('');
  const [geminiLatency, setGeminiLatency] = useState<number | null>(null);

  const [brandPrompt, setBrandPromptState] = useState('');
  const [brandSaved, setBrandSaved] = useState(false);

  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [loadingUsage, setLoadingUsage] = useState(false);

  useEffect(() => {
    setBrandPromptState(getBrandPrompt());
    runAllChecks();
    fetchUsage();
  }, []);

  const runAllChecks = async () => {
    setMinimaxStatus('checking');
    setGeminiStatus('checking');

    const [mm, gm] = await Promise.all([
      checkProviderConnection('minimax'),
      checkProviderConnection('gemini'),
    ]);

    setMinimaxStatus(mm.ok ? 'ok' : 'error');
    setMinimaxMessage(mm.message);
    setMinimaxLatency(mm.ok ? mm.latencyMs : null);

    setGeminiStatus(gm.ok ? 'ok' : 'error');
    setGeminiMessage(gm.message);
    setGeminiLatency(gm.ok ? gm.latencyMs : null);
  };

  const fetchUsage = async () => {
    setLoadingUsage(true);
    try {
      const { data, error } = await supabase
        .from('usage_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      setUsage(data || []);
    } catch (e) {
      console.error('Failed to load usage:', e);
    } finally {
      setLoadingUsage(false);
    }
  };

  const handleSaveBrandPrompt = () => {
    saveBrandPrompt(brandPrompt);
    setBrandSaved(true);
    setTimeout(() => setBrandSaved(false), 2000);
  };

  const summary: UsageSummary = usage.reduce(
    (acc, row) => {
      acc.totalCost += Number(row.estimated_cost_usd) || 0;
      acc.totalCalls += 1;
      const user = row.user_email || 'unknown';
      acc.byUser[user] = acc.byUser[user] || { calls: 0, cost: 0 };
      acc.byUser[user].calls += 1;
      acc.byUser[user].cost += Number(row.estimated_cost_usd) || 0;
      acc.byProvider[row.provider] = acc.byProvider[row.provider] || { calls: 0, cost: 0 };
      acc.byProvider[row.provider].calls += 1;
      acc.byProvider[row.provider].cost += Number(row.estimated_cost_usd) || 0;
      return acc;
    },
    { totalCost: 0, totalCalls: 0, byUser: {}, byProvider: {} } as UsageSummary
  );

  return (
    <div className="p-8 max-w-5xl mx-auto w-full h-full overflow-y-auto custom-scrollbar">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-white mb-2">Painel do Admin</h2>
        <p className="text-slate-400">Status das integrações de IA e estatísticas de uso. As chaves de API ficam armazenadas como Secrets no Supabase — nenhuma chave aparece aqui.</p>
      </div>

      {/* Provider Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <ProviderCard
          name="MiniMax"
          subtitle="Vídeo + Legendas + Pessoa em Produtos"
          icon={<Zap size={28} />}
          color="orange"
          status={minimaxStatus}
          message={minimaxMessage}
          latency={minimaxLatency}
        />
        <ProviderCard
          name="Google Gemini"
          subtitle="Promoção de Produtos (objeto preservado)"
          icon={<Sparkles size={28} />}
          color="purple"
          status={geminiStatus}
          message={geminiMessage}
          latency={geminiLatency}
        />
      </div>

      <div className="flex justify-end mb-8">
        <button
          onClick={runAllChecks}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-colors"
        >
          <RefreshCw size={14} /> Testar conexões
        </button>
      </div>

      {/* Brand Prompt */}
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 mb-8">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
          <Cpu className="text-purple-400" size={20} />
          Brand Guidelines (compartilhado)
        </h3>
        <p className="text-sm text-slate-400 mb-3">
          Diretrizes de marca aplicadas em todas as gerações de legendas (tom de voz, valores, restrições).
        </p>
        <textarea
          value={brandPrompt}
          onChange={(e) => setBrandPromptState(e.target.value)}
          placeholder="Ex: Tom amigável, sempre em primeira pessoa, evitar jargões técnicos, focar no benefício para o cliente..."
          className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-sm text-slate-200 resize-none h-28 focus:border-purple-500 outline-none"
        />
        <div className="flex justify-end mt-3">
          <button
            onClick={handleSaveBrandPrompt}
            className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {brandSaved ? 'Salvo!' : 'Salvar'}
          </button>
        </div>
      </div>

      {/* Usage Stats */}
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 mb-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <BarChart3 className="text-cyan-400" size={20} />
            Estatísticas de Uso (últimas 200 chamadas)
          </h3>
          <button
            onClick={fetchUsage}
            disabled={loadingUsage}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium rounded transition-colors"
          >
            {loadingUsage ? <Loader2 className="animate-spin" size={12} /> : <RefreshCw size={12} />}
            Atualizar
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Kpi label="Total de chamadas" value={summary.totalCalls.toString()} />
          <Kpi label="Custo estimado (USD)" value={`$${summary.totalCost.toFixed(4)}`} icon={<DollarSign size={14} />} />
          <Kpi label="MiniMax" value={`${summary.byProvider.minimax?.calls || 0} • $${(summary.byProvider.minimax?.cost || 0).toFixed(4)}`} />
          <Kpi label="Gemini" value={`${summary.byProvider.gemini?.calls || 0} • $${(summary.byProvider.gemini?.cost || 0).toFixed(4)}`} />
        </div>

        {/* By User */}
        <h4 className="text-xs font-bold uppercase text-slate-500 mb-2 tracking-wider">Por usuário</h4>
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {Object.entries(summary.byUser).length === 0 ? (
            <p className="text-sm text-slate-500 italic">Nenhum dado de uso ainda.</p>
          ) : (
            Object.entries(summary.byUser)
              .sort(([, a], [, b]) => b.cost - a.cost)
              .map(([email, stats]) => (
                <div key={email} className="flex items-center justify-between py-2 px-3 bg-slate-900/50 rounded text-sm">
                  <span className="text-slate-300 truncate">{email}</span>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-slate-400">{stats.calls} chamadas</span>
                    <span className="text-cyan-400 font-mono">${stats.cost.toFixed(4)}</span>
                  </div>
                </div>
              ))
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-slate-500">
        <ShieldCheck size={14} />
        <span>As chaves de API ficam apenas em Supabase Secrets (variáveis de ambiente das Edge Functions). Nunca trafegam pelo browser.</span>
      </div>
    </div>
  );
};

const ProviderCard = ({ name, subtitle, icon, color, status, message, latency }: {
  name: string;
  subtitle: string;
  icon: React.ReactNode;
  color: 'orange' | 'purple';
  status: Status;
  message: string;
  latency: number | null;
}) => {
  const accent = color === 'orange' ? 'text-orange-400' : 'text-purple-400';
  const ring = color === 'orange' ? 'shadow-orange-900/20' : 'shadow-purple-900/20';
  const bar = color === 'orange' ? 'bg-gradient-to-r from-orange-500 to-red-500' : 'bg-gradient-to-r from-purple-500 to-pink-500';

  return (
    <div className={`bg-slate-800 rounded-xl border border-slate-700 p-6 shadow-xl ${ring} relative overflow-hidden`}>
      <div className={`absolute top-0 left-0 w-full h-1 ${bar}`} />
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={accent}>{icon}</div>
          <div>
            <h3 className="text-lg font-bold text-white">{name}</h3>
            <p className="text-xs text-slate-500">{subtitle}</p>
          </div>
        </div>
        {status === 'checking' && <Loader2 className="animate-spin text-slate-400" size={18} />}
        {status === 'ok' && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-500/15 border border-green-500/30 text-green-400 text-xs font-bold rounded-full">
            <CheckCircle2 size={12} /> Online
          </div>
        )}
        {status === 'error' && (
          <div className="px-2.5 py-1 bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-bold rounded-full">
            Offline
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between p-2 bg-slate-900/50 rounded text-sm">
          <span className="text-slate-400 flex items-center gap-2"><Server size={12} /> Status</span>
          <span className={status === 'ok' ? 'text-green-400' : status === 'error' ? 'text-red-400' : 'text-slate-400'}>
            {status === 'ok' ? 'Conectado' : status === 'error' ? 'Falha' : 'Verificando...'}
          </span>
        </div>
        {latency !== null && (
          <div className="flex items-center justify-between p-2 bg-slate-900/50 rounded text-sm">
            <span className="text-slate-400">Latência</span>
            <span className={`font-mono ${latency < 1500 ? 'text-green-400' : 'text-yellow-400'}`}>{latency}ms</span>
          </div>
        )}
        {message && status === 'error' && (
          <div className="p-2 bg-red-900/20 border border-red-800 rounded text-red-300 text-xs break-all">
            {message}
          </div>
        )}
      </div>
    </div>
  );
};

const Kpi = ({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) => (
  <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-700">
    <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1">
      {icon}
      {label}
    </div>
    <div className="text-lg font-bold text-white">{value}</div>
  </div>
);
