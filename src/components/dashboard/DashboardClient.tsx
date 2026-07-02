'use client';
import React, { useMemo } from 'react';
import styles from '@/app/page.module.css';
import { CheckCircle, Clock, ListTodo, MoreHorizontal } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Task {
  id: string;
  name: string;
  status: string;
  originalStatus: string;
  dueDate: number | null;
  assignees: any[];
  url: string;
}

export function DashboardClient({ tasks }: { tasks: Task[] }) {
  // Aggregate data
  const stats = useMemo(() => {
    let completed = 0, overdue = 0, inProgress = 0, notStarted = 0;
    
    tasks.forEach(task => {
      if (task.status === 'completed') completed++;
      else if (task.status === 'overdue') overdue++;
      else if (task.status === 'in_progress') inProgress++;
      else notStarted++;
    });

    return { completed, overdue, inProgress, notStarted };
  }, [tasks]);

  const chartData = [
    { name: 'Concluídas', value: stats.completed, color: '#10b981' },
    { name: 'Atrasadas', value: stats.overdue, color: '#ef4444' },
    { name: 'Em Andamento', value: stats.inProgress, color: '#3b82f6' },
    { name: 'Não Iniciadas', value: stats.notStarted, color: '#9ca3af' },
  ].filter(d => d.value > 0);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const getStatusBadge = (status: string, original: string) => {
    switch (status) {
      case 'completed': return <span className="status-badge status-completed">Concluída ({original})</span>;
      case 'overdue': return <span className="status-badge status-overdue">Atrasada ({original})</span>;
      case 'in_progress': return <span className="status-badge status-in-progress">Em Andamento ({original})</span>;
      default: return <span className="status-badge status-not-started">Não Iniciada ({original})</span>;
    }
  };

  return (
    <>
      {/* KPI Cards */}
      <div className={styles.kpiGrid}>
        <div className={`${styles.kpiCard} glass-panel`}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Concluídas</span>
            <div className={`${styles.kpiIconWrapper} ${styles.iconGreen}`}>
              <CheckCircle size={20} />
            </div>
          </div>
          <div className={styles.kpiValue}>{stats.completed}</div>
          <div className={styles.kpiSub}>Total de tarefas finalizadas</div>
        </div>

        <div className={`${styles.kpiCard} glass-panel`}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Atrasadas</span>
            <div className={`${styles.kpiIconWrapper} ${styles.iconRed}`}>
              <Clock size={20} />
            </div>
          </div>
          <div className={styles.kpiValue}>{stats.overdue}</div>
          <div className={styles.kpiSub}>Passaram do prazo definido</div>
        </div>

        <div className={`${styles.kpiCard} glass-panel`}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Em Andamento</span>
            <div className={`${styles.kpiIconWrapper} ${styles.iconBlue}`}>
              <ListTodo size={20} />
            </div>
          </div>
          <div className={styles.kpiValue}>{stats.inProgress}</div>
          <div className={styles.kpiSub}>Sendo trabalhadas ativamente</div>
        </div>

        <div className={`${styles.kpiCard} glass-panel`}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Não Iniciadas</span>
            <div className={`${styles.kpiIconWrapper} ${styles.iconGray}`}>
              <MoreHorizontal size={20} />
            </div>
          </div>
          <div className={styles.kpiValue}>{stats.notStarted}</div>
          <div className={styles.kpiSub}>Aguardando priorização</div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className={styles.contentGrid}>
        <div className={`${styles.chartSection} glass-panel`}>
          <h2 className={styles.sectionTitle}>Progresso por Status</h2>
          <div style={{ width: '100%', height: 300 }}>
            {chartData.length > 0 ? (
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                  />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className={styles.chartPlaceholder}>Sem dados disponíveis</div>
            )}
          </div>
        </div>

        <div className={`${styles.tableSection} glass-panel`}>
          <h2 className={styles.sectionTitle}>Todas as Tarefas</h2>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Tarefa</th>
                  <th>Responsáveis</th>
                  <th>Status</th>
                  <th>Prazo</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map(task => (
                  <tr key={task.id}>
                    <td className={styles.taskName}>
                      <a href={task.url} target="_blank" rel="noopener noreferrer">{task.name}</a>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {task.assignees.length > 0 ? task.assignees.map(user => (
                          <div key={user.id} className={styles.assignee} title={user.username}>
                            <div className={styles.avatar} style={user.color ? { background: user.color } : {}}>
                              {getInitials(user.username)}
                            </div>
                          </div>
                        )) : <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Não atribuído</span>}
                      </div>
                    </td>
                    <td>{getStatusBadge(task.status, task.originalStatus)}</td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                      {task.dueDate ? format(new Date(task.dueDate), "dd MMM, yyyy", { locale: ptBR }) : '-'}
                    </td>
                  </tr>
                ))}
                {tasks.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '2rem' }}>
                      Nenhuma tarefa encontrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
