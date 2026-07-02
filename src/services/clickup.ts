// ClickUp API Service
const CLICKUP_API_BASE = 'https://api.clickup.com/api/v2';

export interface ClickUpUser {
  id: number;
  username: string;
  color: string;
  profilePicture: string | null;
}

export interface ClickUpTask {
  id: string;
  name: string;
  status: {
    status: string;
    color: string;
    type: string; // open, custom, closed, done
  };
  date_created: string;
  date_updated: string;
  date_closed: string | null;
  date_done: string | null;
  due_date: string | null;
  assignees: ClickUpUser[];
  url: string;
}

export async function fetchClickUpData() {
  const token = process.env.CLICKUP_API_TOKEN;
  
  if (!token) {
    console.warn('No CLICKUP_API_TOKEN found. Returning mock data.');
    return getMockData();
  }

  try {
    // 1. Get Teams (Workspaces)
    const teamsRes = await fetch(`${CLICKUP_API_BASE}/team`, {
      headers: { Authorization: token }
    });
    if (!teamsRes.ok) throw new Error('Failed to fetch teams');
    const teamsData = await teamsRes.json();
    const teamId = teamsData.teams[0]?.id;

    if (!teamId) throw new Error('No teams found in ClickUp account');

    // 2. Get Tasks for the Workspace
    // Note: In a real app with many tasks, you'd need pagination.
    const tasksRes = await fetch(`${CLICKUP_API_BASE}/team/${teamId}/task?subtasks=true&include_closed=true`, {
      headers: { Authorization: token },
      // Next.js caching: revalidate every 60 seconds
      next: { revalidate: 60 }
    });
    
    if (!tasksRes.ok) throw new Error('Failed to fetch tasks');
    const tasksData = await tasksRes.json();
    
    return transformTasks(tasksData.tasks);
  } catch (error) {
    console.error('ClickUp API Error:', error);
    return getMockData(); // Fallback for demonstration
  }
}

function transformTasks(tasks: ClickUpTask[]) {
  const now = new Date().getTime();
  
  const transformed = tasks.map(task => {
    let simplifiedStatus = 'not_started';
    const type = task.status.type;
    
    if (type === 'closed' || type === 'done') {
      simplifiedStatus = 'completed';
    } else if (type === 'open' || type === 'custom') {
      // Check if overdue
      if (task.due_date && parseInt(task.due_date) < now) {
        simplifiedStatus = 'overdue';
      } else if (type === 'custom') {
        simplifiedStatus = 'in_progress';
      }
    }

    return {
      id: task.id,
      name: task.name,
      status: simplifiedStatus,
      originalStatus: task.status.status,
      dueDate: task.due_date ? parseInt(task.due_date) : null,
      assignees: task.assignees,
      url: task.url
    };
  });

  return transformed;
}

function getMockData() {
  return [
    {
      id: 'mock1', name: 'Atualizar layout da homepage', status: 'in_progress', originalStatus: 'in progress',
      dueDate: new Date().getTime() + 86400000, assignees: [{ id: 1, username: 'Kaio Sorato', color: '#10b981', profilePicture: null }], url: '#'
    },
    {
      id: 'mock2', name: 'Revisar relatórios de vendas', status: 'overdue', originalStatus: 'open',
      dueDate: new Date().getTime() - 86400000, assignees: [{ id: 2, username: 'Maria', color: '#ef4444', profilePicture: null }], url: '#'
    },
    {
      id: 'mock3', name: 'Deploy versão 2.0', status: 'completed', originalStatus: 'closed',
      dueDate: new Date().getTime() - 172800000, assignees: [{ id: 1, username: 'Kaio Sorato', color: '#10b981', profilePicture: null }], url: '#'
    },
    {
      id: 'mock4', name: 'Criar wireframes', status: 'not_started', originalStatus: 'open',
      dueDate: null, assignees: [], url: '#'
    },
    {
      id: 'mock5', name: 'Reunião de alinhamento', status: 'completed', originalStatus: 'done',
      dueDate: new Date().getTime() - 259200000, assignees: [{ id: 3, username: 'João', color: '#3b82f6', profilePicture: null }], url: '#'
    }
  ];
}
