'use client';
import React, { useState } from 'react';
import { LayoutDashboard, CheckCircle, Clock, ListTodo, Users, LogOut, Menu, X } from 'lucide-react';
import styles from './DashboardLayout.module.css';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <div className={styles.layout}>
      {/* Mobile Header */}
      <div className={styles.mobileHeader}>
        <div className={styles.logo}>
          <LayoutDashboard size={24} className={styles.logoIcon} />
          <span>ClickUp Analytics</span>
        </div>
        <button onClick={() => setIsMobileOpen(!isMobileOpen)} className={styles.menuBtn}>
          {isMobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={`${styles.sidebar} ${isMobileOpen ? styles.sidebarOpen : ''} glass-panel`}>
        <div className={styles.sidebarHeader}>
          <LayoutDashboard size={28} className={styles.logoIcon} />
          <span className={styles.logoText}>ClickUp Analytics</span>
        </div>
        
        <nav className={styles.nav}>
          <a href="#" className={`${styles.navItem} ${styles.active}`}>
            <LayoutDashboard size={20} />
            <span>Visão Geral</span>
          </a>
          <a href="#" className={styles.navItem}>
            <CheckCircle size={20} />
            <span>Concluídas</span>
          </a>
          <a href="#" className={styles.navItem}>
            <Clock size={20} />
            <span>Atrasadas</span>
          </a>
          <a href="#" className={styles.navItem}>
            <ListTodo size={20} />
            <span>Todas as Tarefas</span>
          </a>
          <a href="#" className={styles.navItem}>
            <Users size={20} />
            <span>Equipe</span>
          </a>
        </nav>

        <div className={styles.sidebarFooter}>
          <button className={styles.logoutBtn}>
            <LogOut size={20} />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={styles.main}>
        {children}
      </main>

      {/* Overlay for mobile */}
      {isMobileOpen && (
        <div className={styles.overlay} onClick={() => setIsMobileOpen(false)}></div>
      )}
    </div>
  );
}
