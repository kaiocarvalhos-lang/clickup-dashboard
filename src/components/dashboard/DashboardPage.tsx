'use client';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  LayoutDashboard, CheckCircle, Clock, ListTodo, Users, LogOut, Menu, X,
  RefreshCw, ExternalLink, MoreHorizontal, Filter, ChevronDown, Search,
  AlertTriangle, TrendingUp, UserCheck, UserX, MessageSquare, Trophy, Target
} from 'lucide-react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, FunnelChart, Funnel, LabelList
} from 'recharts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import styles from './Dashboard.module.css';

// ── Types ──
interface Assignee {
  id: number;
  username: string;
  color: string;
  profilePicture: string | null;
}

interface Task {
  id: string;
  name: string;
  status: string;
  originalStatus: string;
  statusColor: string;
  dueDate: number | null;
  dateCreated: number | null;
  dateClosed: number | null;
  assignees: Assignee[];
  space: string;
  folder: string | null;
  list: string;
  url: string;
}

type View = 'overview' | 'completed' | 'overdue' | 'all' | 'team' | 'leads';

// ── Lead Stage Detection ──
const LEAD_STAGE_KEYWORDS: Record<string, string[]> = {
  abordado: ['abordado', 'abordados', 'contacted', 'novo lead', 'new lead', 'prospecção', 'prospecting', 'primeiro contato', 'abordagem'],
  qualificado: ['qualificado', 'qualificados', 'qualified', 'sql', 'mql', 'lead qualificado'],
  desqualificado: ['desqualificado', 'desqualificados', 'disqualified', 'não qualificado', 'descartado', 'sem fit'],
  interacao: ['interação', 'interacao', 'negociação', 'negociacao', 'proposta', 'proposal', 'reunião', 'reuniao', 'meeting', 'demonstração', 'demo', 'follow up', 'follow-up', 'em negociação', 'apresentação'],
  fechado: ['fechado', 'fechados', 'ganho', 'won', 'closed won', 'cliente', 'convertido', 'venda fechada', 'contrato assinado'],
  perdido: ['perdido', 'perdidos', 'lost', 'closed lost', 'não fechou', 'cancelado'],
};

function classifyLeadStage(originalStatus: string): string | null {
  const s = originalStatus.toLowerCase().trim();
  for (const [stage, keywords] of Object.entries(LEAD_STAGE_KEYWORDS)) {
    if (keywords.some(kw => s.includes(kw) || s === kw)) return stage;
  }
  return null;
}

// ── Main Component ──
export default function DashboardPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>('overview');
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSpace, setSelectedSpace] = useState<string>('all');
  const [selectedAssignee, setSelectedAssignee] = useState<string>('all');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/clickup');
      const data = await res.json();
      setTasks(data.tasks || []);
      if (data.error) setError(data.error);
      setLastUpdated(new Date());
    } catch (err: any) {
      setError('Falha ao conectar ao servidor.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // ── Derived Data ──
  const spaces = useMemo(() => {
    const s = new Set(tasks.map(t => t.space).filter(Boolean));
    return Array.from(s).sort();
  }, [tasks]);

  const allAssignees = useMemo(() => {
    const map = new Map<number, Assignee>();
    tasks.forEach(t => t.assignees.forEach(a => map.set(a.id, a)));
    return Array.from(map.values()).sort((a, b) => a.username.localeCompare(b.username));
  }, [tasks]);

  // ── Leads Pipeline Data ──
  const leadsData = useMemo(() => {
    let leadTasks = tasks.map(t => ({ ...t, leadStage: classifyLeadStage(t.originalStatus) })).filter(t => t.leadStage !== null);

    if (selectedSpace !== 'all') leadTasks = leadTasks.filter(t => t.space === selectedSpace);
    if (selectedAssignee !== 'all') leadTasks = leadTasks.filter(t => t.assignees.some(a => String(a.id) === selectedAssignee));

    const stages = {
      abordado: { count: 0, label: 'Abordados', color: '#6366f1', icon: 'target' },
      qualificado: { count: 0, label: 'Qualificados', color: '#10b981', icon: 'usercheck' },
      desqualificado: { count: 0, label: 'Desqualificados', color: '#ef4444', icon: 'userx' },
      interacao: { count: 0, label: 'Em Interação', color: '#f59e0b', icon: 'message' },
      fechado: { count: 0, label: 'Fechados', color: '#059669', icon: 'trophy' },
      perdido: { count: 0, label: 'Perdidos', color: '#dc2626', icon: 'lost' },
    };

    leadTasks.forEach(t => {
      if (t.leadStage && stages[t.leadStage as keyof typeof stages]) {
        stages[t.leadStage as keyof typeof stages].count++;
      }
    });

    const total = leadTasks.length;
    const funnelData = Object.entries(stages)
      .filter(([_, v]) => v.count > 0)
      .map(([key, v]) => ({
        name: v.label,
        value: v.count,
        fill: v.color,
        percentage: total > 0 ? Math.round((v.count / total) * 100) : 0,
      }));

    return { tasks: leadTasks, stages, total, funnelData };
  }, [tasks, selectedSpace, selectedAssignee]);

  const filteredTasks = useMemo(() => {
    let result = tasks;

    // Filter by view
    if (view === 'completed') result = result.filter(t => t.status === 'completed');
    else if (view === 'overdue') result = result.filter(t => t.status === 'overdue');
    else if (view === 'leads') {
      result = result.filter(t => classifyLeadStage(t.originalStatus) !== null);
    }

    // Filter by space
    if (selectedSpace !== 'all') result = result.filter(t => t.space === selectedSpace);

    // Filter by assignee
    if (selectedAssignee !== 'all') {
      result = result.filter(t => t.assignees.some(a => String(a.id) === selectedAssignee));
    }

    // Filter by search
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(t =>
        t.name.toLowerCase().includes(term) ||
        t.originalStatus.toLowerCase().includes(term) ||
        t.assignees.some(a => a.username.toLowerCase().includes(term))
      );
    }

    return result;
  }, [tasks, view, selectedSpace, selectedAssignee, searchTerm]);

  const stats = useMemo(() => {
    const base = tasks.filter(t => {
      if (selectedSpace !== 'all' && t.space !== selectedSpace) return false;
      if (selectedAssignee !== 'all' && !t.assignees.some(a => String(a.id) === selectedAssignee)) return false;
      return true;
    });
    let completed = 0, overdue = 0, inProgress = 0, notStarted = 0;
    base.forEach(t => {
      if (t.status === 'completed') completed++;
      else if (t.status === 'overdue') overdue++;
      else if (t.status === 'in_progress') inProgress++;
      else notStarted++;
    });
    return { completed, overdue, inProgress, notStarted, total: base.length };
  }, [tasks, selectedSpace, selectedAssignee]);

  const chartData = useMemo(() =>
    [
      { name: 'Concluídas', value: stats.completed, color: '#10b981' },
      { name: 'Atrasadas', value: stats.overdue, color: '#ef4444' },
      { name: 'Em Andamento', value: stats.inProgress, color: '#3b82f6' },
      { name: 'Não Iniciadas', value: stats.notStarted, color: '#9ca3af' },
    ].filter(d => d.value > 0),
    [stats]
  );

  const teamData = useMemo(() => {
    const map = new Map<string, { completed: number; overdue: number; inProgress: number; notStarted: number }>();

    const base = tasks.filter(t => {
      if (selectedSpace !== 'all' && t.space !== selectedSpace) return false;
      return true;
    });

    base.forEach(task => {
      if (task.assignees.length === 0) {
        const key = 'Não atribuído';
        if (!map.has(key)) map.set(key, { completed: 0, overdue: 0, inProgress: 0, notStarted: 0 });
        const entry = map.get(key)!;
        if (task.status === 'completed') entry.completed++;
        else if (task.status === 'overdue') entry.overdue++;
        else if (task.status === 'in_progress') entry.inProgress++;
        else entry.notStarted++;
      } else {
        task.assignees.forEach(a => {
          const key = a.username;
          if (!map.has(key)) map.set(key, { completed: 0, overdue: 0, inProgress: 0, notStarted: 0 });
          const entry = map.get(key)!;
          if (task.status === 'completed') entry.completed++;
          else if (task.status === 'overdue') entry.overdue++;
          else if (task.status === 'in_progress') entry.inProgress++;
          else entry.notStarted++;
        });
      }
    });

    return Array.from(map.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => (b.completed + b.inProgress + b.overdue + b.notStarted) - (a.completed + a.inProgress + a.overdue + a.notStarted));
  }, [tasks, selectedSpace]);

  // ── Helpers ──
  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

  const handleNavClick = (v: View) => {
    setView(v);
    setIsMobileOpen(false);
  };

  // ── Render ──
  return (
    <div className={styles.layout}>
      {/* Mobile Header */}
      <div className={styles.mobileHeader}>
        <div className={styles.mobileLogo}>
          <LayoutDashboard size={22} color="#10b981" />
          <span>ClickUp Analytics</span>
        </div>
        <button onClick={() => setIsMobileOpen(!isMobileOpen)} className={styles.menuBtn} aria-label="Menu">
          {isMobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={`${styles.sidebar} ${isMobileOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.sidebarHeader}>
          <LayoutDashboard size={28} color="#10b981" />
          <span className={styles.logoText}>ClickUp Analytics</span>
        </div>

        <nav className={styles.nav}>
          <button onClick={() => handleNavClick('overview')} className={`${styles.navItem} ${view === 'overview' ? styles.active : ''}`}>
            <LayoutDashboard size={20} />
            <span>Visão Geral</span>
          </button>
          <button onClick={() => handleNavClick('completed')} className={`${styles.navItem} ${view === 'completed' ? styles.active : ''}`}>
            <CheckCircle size={20} />
            <span>Concluídas</span>
            <span className={`${styles.navBadge} ${styles.navBadgeGreen}`}>{stats.completed}</span>
          </button>
          <button onClick={() => handleNavClick('overdue')} className={`${styles.navItem} ${view === 'overdue' ? styles.active : ''}`}>
            <Clock size={20} />
            <span>Atrasadas</span>
            {stats.overdue > 0 && <span className={`${styles.navBadge} ${styles.navBadgeRed}`}>{stats.overdue}</span>}
          </button>
          <button onClick={() => handleNavClick('all')} className={`${styles.navItem} ${view === 'all' ? styles.active : ''}`}>
            <ListTodo size={20} />
            <span>Todas as Tarefas</span>
            <span className={`${styles.navBadge} ${styles.navBadgeGray}`}>{stats.total}</span>
          </button>
          <button onClick={() => handleNavClick('team')} className={`${styles.navItem} ${view === 'team' ? styles.active : ''}`}>
            <Users size={20} />
            <span>Equipe</span>
          </button>

          <div className={styles.navDivider}><span>COMERCIAL</span></div>
          <button onClick={() => handleNavClick('leads')} className={`${styles.navItem} ${view === 'leads' ? styles.active : ''}`}>
            <TrendingUp size={20} />
            <span>Pipeline de Leads</span>
            {leadsData.total > 0 && <span className={`${styles.navBadge} ${styles.navBadgePurple}`}>{leadsData.total}</span>}
          </button>
        </nav>

        <div className={styles.sidebarFooter}>
          {lastUpdated && (
            <p className={styles.lastUpdated}>
              Atualizado: {format(lastUpdated, "HH:mm", { locale: ptBR })}
            </p>
          )}
          <button onClick={fetchTasks} className={styles.refreshBtn} disabled={loading}>
            <RefreshCw size={18} className={loading ? styles.spinning : ''} />
            <span>Atualizar Dados</span>
          </button>
        </div>
      </aside>

      {/* Overlay */}
      {isMobileOpen && <div className={styles.overlay} onClick={() => setIsMobileOpen(false)} />}

      {/* Main */}
      <main className={styles.main}>
        {/* Error Banner */}
        {error && (
          <div className={styles.errorBanner}>
            <AlertTriangle size={18} />
            <span>{error}. Exibindo dados de demonstração.</span>
          </div>
        )}

        {/* Header */}
        <header className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>
              {view === 'overview' && 'Visão Geral'}
              {view === 'completed' && 'Tarefas Concluídas'}
              {view === 'overdue' && 'Tarefas Atrasadas'}
              {view === 'all' && 'Todas as Tarefas'}
              {view === 'team' && 'Visão por Equipe'}
              {view === 'leads' && 'Pipeline Comercial'}
            </h1>
            <p className={styles.pageSubtitle}>
              {view === 'overview' && 'Acompanhe o progresso de todos os espaços em tempo real.'}
              {view === 'completed' && 'Tarefas finalizadas com sucesso.'}
              {view === 'overdue' && 'Tarefas que passaram do prazo definido.'}
              {view === 'all' && 'Lista completa de todas as tarefas nos seus espaços.'}
              {view === 'team' && 'Carga de trabalho e desempenho de cada membro.'}
              {view === 'leads' && 'Acompanhe o funil de vendas e a jornada dos seus leads.'}
            </p>
          </div>
        </header>

        {/* Filters */}
        <div className={styles.filtersBar}>
          <div className={styles.searchWrapper}>
            <Search size={18} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Buscar tarefa, responsável..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className={styles.searchInput}
            />
          </div>
          <div className={styles.filterGroup}>
            <div className={styles.selectWrapper}>
              <Filter size={16} />
              <select value={selectedSpace} onChange={e => setSelectedSpace(e.target.value)} className={styles.filterSelect}>
                <option value="all">Todos os Espaços</option>
                {spaces.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <ChevronDown size={16} className={styles.selectChevron} />
            </div>
            <div className={styles.selectWrapper}>
              <Users size={16} />
              <select value={selectedAssignee} onChange={e => setSelectedAssignee(e.target.value)} className={styles.filterSelect}>
                <option value="all">Todos os Responsáveis</option>
                {allAssignees.map(a => <option key={a.id} value={String(a.id)}>{a.username}</option>)}
              </select>
              <ChevronDown size={16} className={styles.selectChevron} />
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className={styles.loadingState}>
            <RefreshCw size={32} className={styles.spinning} color="#10b981" />
            <p>Carregando dados do ClickUp...</p>
          </div>
        )}

        {/* Content */}
        {!loading && (
          <>
            {/* KPI Cards – visible in overview, all, team */}
            {(view === 'overview' || view === 'all' || view === 'team') && (
              <div className={styles.kpiGrid}>
                <button onClick={() => setView('completed')} className={`${styles.kpiCard} ${styles.kpiClickable}`}>
                  <div className={styles.kpiHeader}>
                    <span className={styles.kpiLabel}>Concluídas</span>
                    <div className={`${styles.kpiIcon} ${styles.iconGreen}`}><CheckCircle size={20} /></div>
                  </div>
                  <div className={styles.kpiValue}>{stats.completed}</div>
                  <div className={styles.kpiSub}>
                    {stats.total > 0 ? `${Math.round((stats.completed / stats.total) * 100)}% do total` : '-'}
                  </div>
                </button>

                <button onClick={() => setView('overdue')} className={`${styles.kpiCard} ${styles.kpiClickable}`}>
                  <div className={styles.kpiHeader}>
                    <span className={styles.kpiLabel}>Atrasadas</span>
                    <div className={`${styles.kpiIcon} ${styles.iconRed}`}><Clock size={20} /></div>
                  </div>
                  <div className={styles.kpiValue}>{stats.overdue}</div>
                  <div className={styles.kpiSub}>Precisam de atenção</div>
                </button>

                <button onClick={() => handleNavClick('all')} className={`${styles.kpiCard} ${styles.kpiClickable}`}>
                  <div className={styles.kpiHeader}>
                    <span className={styles.kpiLabel}>Em Andamento</span>
                    <div className={`${styles.kpiIcon} ${styles.iconBlue}`}><ListTodo size={20} /></div>
                  </div>
                  <div className={styles.kpiValue}>{stats.inProgress}</div>
                  <div className={styles.kpiSub}>Trabalhando ativamente</div>
                </button>

                <button onClick={() => handleNavClick('all')} className={`${styles.kpiCard} ${styles.kpiClickable}`}>
                  <div className={styles.kpiHeader}>
                    <span className={styles.kpiLabel}>Não Iniciadas</span>
                    <div className={`${styles.kpiIcon} ${styles.iconGray}`}><MoreHorizontal size={20} /></div>
                  </div>
                  <div className={styles.kpiValue}>{stats.notStarted}</div>
                  <div className={styles.kpiSub}>No backlog</div>
                </button>
              </div>
            )}

            {/* Charts – overview only */}
            {view === 'overview' && (
              <div className={styles.chartsGrid}>
                <div className={styles.chartCard}>
                  <h2 className={styles.sectionTitle}>Distribuição por Status</h2>
                  <div className={styles.chartContainer}>
                    {chartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={280}>
                        <PieChart>
                          <Pie data={chartData} cx="50%" cy="50%" innerRadius={65} outerRadius={95} paddingAngle={4} dataKey="value" animationBegin={0} animationDuration={800}>
                            {chartData.map((entry, i) => <Cell key={i} fill={entry.color} stroke="none" />)}
                          </Pie>
                          <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', padding: '12px' }} />
                          <Legend verticalAlign="bottom" height={40} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className={styles.emptyChart}>Sem dados disponíveis</p>
                    )}
                  </div>
                </div>

                <div className={styles.chartCard}>
                  <h2 className={styles.sectionTitle}>Tarefas por Espaço</h2>
                  <div className={styles.chartContainer}>
                    {spaces.length > 0 ? (
                      <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={spaces.map(s => {
                          const spaceTasks = tasks.filter(t => t.space === s);
                          return {
                            name: s.length > 12 ? s.substring(0, 12) + '…' : s,
                            concluídas: spaceTasks.filter(t => t.status === 'completed').length,
                            atrasadas: spaceTasks.filter(t => t.status === 'overdue').length,
                            andamento: spaceTasks.filter(t => t.status === 'in_progress').length,
                            backlog: spaceTasks.filter(t => t.status === 'not_started').length,
                          };
                        })} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                          <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                          <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                          <Bar dataKey="concluídas" fill="#10b981" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="atrasadas" fill="#ef4444" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="andamento" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="backlog" fill="#d1d5db" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className={styles.emptyChart}>Sem dados disponíveis</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Team View */}
            {view === 'team' && (
              <div className={styles.chartCard} style={{ marginBottom: '1.5rem' }}>
                <h2 className={styles.sectionTitle}>Carga de Trabalho por Membro</h2>
                <div className={styles.chartContainer}>
                  {teamData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={Math.max(280, teamData.length * 45)}>
                      <BarChart data={teamData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
                        <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={120} />
                        <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                        <Legend />
                        <Bar dataKey="completed" name="Concluídas" fill="#10b981" stackId="a" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="inProgress" name="Em Andamento" fill="#3b82f6" stackId="a" />
                        <Bar dataKey="overdue" name="Atrasadas" fill="#ef4444" stackId="a" />
                        <Bar dataKey="notStarted" name="Não Iniciadas" fill="#d1d5db" stackId="a" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className={styles.emptyChart}>Sem dados de equipe disponíveis</p>
                  )}
                </div>
              </div>
            )}

            {/* Leads / Pipeline View */}
            {view === 'leads' && (
              <>
                {/* Lead KPI Cards */}
                <div className={styles.kpiGrid}>
                  <div className={`${styles.kpiCard} ${styles.kpiCardPurple}`}>
                    <div className={styles.kpiHeader}>
                      <span className={styles.kpiLabel}>Abordados</span>
                      <div className={`${styles.kpiIcon} ${styles.iconPurple}`}><Target size={20} /></div>
                    </div>
                    <div className={styles.kpiValue}>{leadsData.stages.abordado.count}</div>
                    <div className={styles.kpiSub}>Total de leads contatados</div>
                  </div>
                  <div className={`${styles.kpiCard}`}>
                    <div className={styles.kpiHeader}>
                      <span className={styles.kpiLabel}>Qualificados</span>
                      <div className={`${styles.kpiIcon} ${styles.iconGreen}`}><UserCheck size={20} /></div>
                    </div>
                    <div className={styles.kpiValue}>{leadsData.stages.qualificado.count}</div>
                    <div className={styles.kpiSub}>
                      {leadsData.stages.abordado.count > 0
                        ? `${Math.round((leadsData.stages.qualificado.count / leadsData.stages.abordado.count) * 100)}% dos abordados`
                        : 'Taxa de qualificação'}
                    </div>
                  </div>
                  <div className={`${styles.kpiCard}`}>
                    <div className={styles.kpiHeader}>
                      <span className={styles.kpiLabel}>Em Interação</span>
                      <div className={`${styles.kpiIcon} ${styles.iconAmber}`}><MessageSquare size={20} /></div>
                    </div>
                    <div className={styles.kpiValue}>{leadsData.stages.interacao.count}</div>
                    <div className={styles.kpiSub}>Negociando ativamente</div>
                  </div>
                  <div className={`${styles.kpiCard}`}>
                    <div className={styles.kpiHeader}>
                      <span className={styles.kpiLabel}>Fechados</span>
                      <div className={`${styles.kpiIcon} ${styles.iconGreen}`}><Trophy size={20} /></div>
                    </div>
                    <div className={styles.kpiValue}>{leadsData.stages.fechado.count}</div>
                    <div className={styles.kpiSub}>
                      {leadsData.total > 0
                        ? `${Math.round((leadsData.stages.fechado.count / leadsData.total) * 100)}% de conversão total`
                        : 'Taxa de conversão'}
                    </div>
                  </div>
                </div>

                {/* Funnel + Breakdown */}
                <div className={styles.chartsGrid}>
                  <div className={styles.chartCard}>
                    <h2 className={styles.sectionTitle}>Funil de Vendas</h2>
                    <div className={styles.funnelContainer}>
                      {leadsData.funnelData.length > 0 ? (
                        leadsData.funnelData.map((stage, i) => {
                          const maxVal = Math.max(...leadsData.funnelData.map(d => d.value));
                          const widthPct = maxVal > 0 ? Math.max(20, (stage.value / maxVal) * 100) : 20;
                          return (
                            <div key={stage.name} className={styles.funnelStep} style={{ animationDelay: `${i * 100}ms` }}>
                              <div className={styles.funnelLabel}>
                                <span className={styles.funnelStageName}>{stage.name}</span>
                                <span className={styles.funnelStageCount}>{stage.value}</span>
                              </div>
                              <div className={styles.funnelBarTrack}>
                                <div
                                  className={styles.funnelBar}
                                  style={{ width: `${widthPct}%`, background: stage.fill }}
                                />
                              </div>
                              <span className={styles.funnelPct}>{stage.percentage}%</span>
                            </div>
                          );
                        })
                      ) : (
                        <p className={styles.emptyChart}>
                          Nenhum lead detectado. Verifique se os status das tarefas no ClickUp usam nomes como &quot;Abordado&quot;, &quot;Qualificado&quot;, &quot;Em Negociação&quot;, &quot;Fechado&quot;, etc.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className={styles.chartCard}>
                    <h2 className={styles.sectionTitle}>Resumo do Pipeline</h2>
                    <div className={styles.chartContainer}>
                      {leadsData.funnelData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={280}>
                          <BarChart data={leadsData.funnelData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" horizontal={false} />
                            <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
                            <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={110} />
                            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                            <Bar dataKey="value" name="Leads" radius={[0, 6, 6, 0]}>
                              {leadsData.funnelData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <p className={styles.emptyChart}>Sem dados de pipeline</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Desqualificados + Perdidos summary */}
                {(leadsData.stages.desqualificado.count > 0 || leadsData.stages.perdido.count > 0) && (
                  <div className={styles.lostBanner}>
                    <div className={styles.lostItem}>
                      <UserX size={18} />
                      <span><strong>{leadsData.stages.desqualificado.count}</strong> leads desqualificados</span>
                    </div>
                    <div className={styles.lostDivider} />
                    <div className={styles.lostItem}>
                      <AlertTriangle size={18} />
                      <span><strong>{leadsData.stages.perdido.count}</strong> leads perdidos</span>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Tasks Table */}
            <div className={styles.tableCard}>
              <div className={styles.tableHeader}>
                <h2 className={styles.sectionTitle}>
                  {view === 'overview' ? 'Tarefas Recentes' : 'Tarefas'}
                  <span className={styles.taskCount}>{filteredTasks.length}</span>
                </h2>
              </div>
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Tarefa</th>
                      <th>Espaço / Lista</th>
                      <th>Responsáveis</th>
                      <th>Status</th>
                      <th>Prazo</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(view === 'overview' ? filteredTasks.slice(0, 10) : filteredTasks).map((task, idx) => (
                      <tr key={task.id} className={styles.tableRow} style={{ animationDelay: `${idx * 30}ms` }}>
                        <td className={styles.taskNameCell}>
                          <span className={styles.taskName}>{task.name}</span>
                        </td>
                        <td>
                          <div className={styles.spaceInfo}>
                            <span className={styles.spaceName}>{task.space}</span>
                            <span className={styles.listName}>{task.folder ? `${task.folder} / ` : ''}{task.list}</span>
                          </div>
                        </td>
                        <td>
                          <div className={styles.assigneeGroup}>
                            {task.assignees.length > 0 ? task.assignees.map(a => (
                              <div key={a.id} className={styles.avatar} style={{ background: a.color || '#10b981' }} title={a.username}>
                                {a.profilePicture ? (
                                  <img src={a.profilePicture} alt={a.username} className={styles.avatarImg} />
                                ) : (
                                  getInitials(a.username)
                                )}
                              </div>
                            )) : <span className={styles.unassigned}>—</span>}
                          </div>
                        </td>
                        <td>
                          <span className={`${styles.statusBadge} ${
                            task.status === 'completed' ? styles.badgeGreen :
                            task.status === 'overdue' ? styles.badgeRed :
                            task.status === 'in_progress' ? styles.badgeBlue : styles.badgeGray
                          }`}>
                            {task.status === 'completed' && 'Concluída'}
                            {task.status === 'overdue' && 'Atrasada'}
                            {task.status === 'in_progress' && 'Em Andamento'}
                            {task.status === 'not_started' && 'Não Iniciada'}
                          </span>
                        </td>
                        <td className={styles.dateCell}>
                          {task.dueDate ? (
                            <span className={task.status === 'overdue' ? styles.dateOverdue : ''}>
                              {format(new Date(task.dueDate), "dd MMM yyyy", { locale: ptBR })}
                            </span>
                          ) : '—'}
                        </td>
                        <td>
                          <a href={task.url} target="_blank" rel="noopener noreferrer" className={styles.linkBtn} title="Abrir no ClickUp">
                            <ExternalLink size={16} />
                          </a>
                        </td>
                      </tr>
                    ))}
                    {filteredTasks.length === 0 && (
                      <tr>
                        <td colSpan={6} className={styles.emptyTable}>
                          Nenhuma tarefa encontrada com os filtros selecionados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {view === 'overview' && filteredTasks.length > 10 && (
                <button onClick={() => setView('all')} className={styles.viewAllBtn}>
                  Ver todas as {filteredTasks.length} tarefas →
                </button>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
