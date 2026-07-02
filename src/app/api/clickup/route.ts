import { NextResponse } from 'next/server';

const CLICKUP_API_BASE = 'https://api.clickup.com/api/v2';

export async function GET() {
  const token = process.env.CLICKUP_API_TOKEN;

  if (!token) {
    return NextResponse.json({ error: 'CLICKUP_API_TOKEN not configured', tasks: getMockData() }, { status: 200 });
  }

  try {
    // 1. Get Teams (Workspaces)
    const teamsRes = await fetch(`${CLICKUP_API_BASE}/team`, {
      headers: { Authorization: token },
      cache: 'no-store',
    });
    if (!teamsRes.ok) {
      const errText = await teamsRes.text();
      console.error('Failed to fetch teams:', errText);
      return NextResponse.json({ error: 'Failed to fetch ClickUp teams', tasks: getMockData() }, { status: 200 });
    }
    const teamsData = await teamsRes.json();
    const teams = teamsData.teams || [];

    if (teams.length === 0) {
      return NextResponse.json({ error: 'No teams found', tasks: [] }, { status: 200 });
    }

    // 2. For each team, get all spaces
    const allTasks: any[] = [];

    for (const team of teams) {
      const spacesRes = await fetch(`${CLICKUP_API_BASE}/team/${team.id}/space?archived=false`, {
        headers: { Authorization: token },
        cache: 'no-store',
      });

      if (!spacesRes.ok) continue;
      const spacesData = await spacesRes.json();
      const spaces = spacesData.spaces || [];

      // 3. For each space, get folders and folderless lists
      for (const space of spaces) {
        // Get folders
        const foldersRes = await fetch(`${CLICKUP_API_BASE}/space/${space.id}/folder?archived=false`, {
          headers: { Authorization: token },
          cache: 'no-store',
        });
        if (foldersRes.ok) {
          const foldersData = await foldersRes.json();
          for (const folder of foldersData.folders || []) {
            for (const list of folder.lists || []) {
              const tasks = await fetchTasksFromList(list.id, token, space.name, folder.name, list.name);
              allTasks.push(...tasks);
            }
          }
        }

        // Get folderless lists
        const listsRes = await fetch(`${CLICKUP_API_BASE}/space/${space.id}/list?archived=false`, {
          headers: { Authorization: token },
          cache: 'no-store',
        });
        if (listsRes.ok) {
          const listsData = await listsRes.json();
          for (const list of listsData.lists || []) {
            const tasks = await fetchTasksFromList(list.id, token, space.name, null, list.name);
            allTasks.push(...tasks);
          }
        }
      }
    }

    return NextResponse.json({ tasks: transformTasks(allTasks), error: null }, { status: 200 });
  } catch (error: any) {
    console.error('ClickUp API Error:', error);
    return NextResponse.json({ error: error.message, tasks: getMockData() }, { status: 200 });
  }
}

async function fetchTasksFromList(listId: string, token: string, spaceName: string, folderName: string | null, listName: string) {
  const allTasks: any[] = [];
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    try {
      const res = await fetch(
        `${CLICKUP_API_BASE}/list/${listId}/task?page=${page}&subtasks=true&include_closed=true&order_by=updated&reverse=true`,
        {
          headers: { Authorization: token },
          cache: 'no-store',
        }
      );

      if (!res.ok) break;

      const data = await res.json();
      const tasks = (data.tasks || []).map((task: any) => ({
        ...task,
        _spaceName: spaceName,
        _folderName: folderName,
        _listName: listName,
      }));

      allTasks.push(...tasks);

      // ClickUp returns 100 tasks per page by default
      if (tasks.length < 100) {
        hasMore = false;
      } else {
        page++;
      }
    } catch {
      break;
    }
  }

  return allTasks;
}

function transformTasks(tasks: any[]) {
  const now = Date.now();

  return tasks.map((task) => {
    let simplifiedStatus = 'not_started';
    const statusType = task.status?.type || '';
    const statusName = (task.status?.status || '').toLowerCase();

    if (statusType === 'closed' || statusType === 'done' || statusName === 'complete' || statusName === 'closed' || statusName === 'done') {
      simplifiedStatus = 'completed';
    } else if (statusName.includes('progress') || statusName.includes('andamento') || statusName.includes('review') || statusName.includes('doing') || statusType === 'custom') {
      // Check if overdue first
      if (task.due_date && parseInt(task.due_date) < now && statusType !== 'closed') {
        simplifiedStatus = 'overdue';
      } else {
        simplifiedStatus = 'in_progress';
      }
    } else if (statusType === 'open') {
      if (task.due_date && parseInt(task.due_date) < now) {
        simplifiedStatus = 'overdue';
      } else {
        simplifiedStatus = 'not_started';
      }
    }

    return {
      id: task.id,
      name: task.name,
      status: simplifiedStatus,
      originalStatus: task.status?.status || 'Unknown',
      statusColor: task.status?.color || '#9ca3af',
      dueDate: task.due_date ? parseInt(task.due_date) : null,
      dateCreated: task.date_created ? parseInt(task.date_created) : null,
      dateClosed: task.date_closed ? parseInt(task.date_closed) : null,
      assignees: (task.assignees || []).map((a: any) => ({
        id: a.id,
        username: a.username || 'Sem nome',
        color: a.color || '#10b981',
        profilePicture: a.profilePicture || null,
      })),
      space: task._spaceName || '',
      folder: task._folderName || null,
      list: task._listName || '',
      url: task.url || '#',
    };
  });
}

function getMockData() {
  const now = Date.now();
  return [
    {
      id: 'mock1', name: 'Atualizar layout da homepage', status: 'in_progress', originalStatus: 'in progress', statusColor: '#3b82f6',
      dueDate: now + 86400000, dateCreated: now - 604800000, dateClosed: null,
      assignees: [{ id: 1, username: 'Kaio Sorato', color: '#10b981', profilePicture: null }],
      space: 'Marketing', folder: 'Website', list: 'Tarefas Q3', url: '#',
    },
    {
      id: 'mock2', name: 'Revisar relatórios de vendas', status: 'overdue', originalStatus: 'open', statusColor: '#ef4444',
      dueDate: now - 86400000, dateCreated: now - 1209600000, dateClosed: null,
      assignees: [{ id: 2, username: 'Maria Silva', color: '#ef4444', profilePicture: null }],
      space: 'Vendas', folder: null, list: 'Relatórios', url: '#',
    },
    {
      id: 'mock3', name: 'Deploy versão 2.0', status: 'completed', originalStatus: 'closed', statusColor: '#10b981',
      dueDate: now - 172800000, dateCreated: now - 2592000000, dateClosed: now - 172800000,
      assignees: [{ id: 1, username: 'Kaio Sorato', color: '#10b981', profilePicture: null }],
      space: 'Engenharia', folder: 'Backend', list: 'Sprint 14', url: '#',
    },
    {
      id: 'mock4', name: 'Criar wireframes do app mobile', status: 'not_started', originalStatus: 'open', statusColor: '#9ca3af',
      dueDate: now + 604800000, dateCreated: now - 259200000, dateClosed: null,
      assignees: [], space: 'Design', folder: null, list: 'Backlog', url: '#',
    },
    {
      id: 'mock5', name: 'Reunião de alinhamento', status: 'completed', originalStatus: 'done', statusColor: '#10b981',
      dueDate: now - 259200000, dateCreated: now - 604800000, dateClosed: now - 259200000,
      assignees: [{ id: 3, username: 'João Pedro', color: '#3b82f6', profilePicture: null }],
      space: 'Marketing', folder: null, list: 'Geral', url: '#',
    },
    {
      id: 'mock6', name: 'Configurar CI/CD pipeline', status: 'in_progress', originalStatus: 'in progress', statusColor: '#3b82f6',
      dueDate: now + 172800000, dateCreated: now - 432000000, dateClosed: null,
      assignees: [{ id: 4, username: 'Ana Costa', color: '#8b5cf6', profilePicture: null }, { id: 1, username: 'Kaio Sorato', color: '#10b981', profilePicture: null }],
      space: 'Engenharia', folder: 'DevOps', list: 'Infra', url: '#',
    },
    {
      id: 'mock7', name: 'Escrever documentação da API', status: 'not_started', originalStatus: 'to do', statusColor: '#9ca3af',
      dueDate: null, dateCreated: now - 86400000, dateClosed: null,
      assignees: [{ id: 4, username: 'Ana Costa', color: '#8b5cf6', profilePicture: null }],
      space: 'Engenharia', folder: 'Backend', list: 'Sprint 15', url: '#',
    },
    {
      id: 'mock8', name: 'Campanha de email marketing', status: 'overdue', originalStatus: 'open', statusColor: '#ef4444',
      dueDate: now - 432000000, dateCreated: now - 1209600000, dateClosed: null,
      assignees: [{ id: 5, username: 'Lucas Mendes', color: '#f59e0b', profilePicture: null }],
      space: 'Marketing', folder: 'Campanhas', list: 'Email', url: '#',
    },
    {
      id: 'mock9', name: 'Testes de usabilidade', status: 'in_progress', originalStatus: 'in review', statusColor: '#3b82f6',
      dueDate: now + 259200000, dateCreated: now - 604800000, dateClosed: null,
      assignees: [{ id: 2, username: 'Maria Silva', color: '#ef4444', profilePicture: null }],
      space: 'Design', folder: 'UX Research', list: 'Q3', url: '#',
    },
    {
      id: 'mock10', name: 'Preparar apresentação board', status: 'completed', originalStatus: 'done', statusColor: '#10b981',
      dueDate: now - 604800000, dateCreated: now - 1814400000, dateClosed: now - 518400000,
      assignees: [{ id: 3, username: 'João Pedro', color: '#3b82f6', profilePicture: null }, { id: 5, username: 'Lucas Mendes', color: '#f59e0b', profilePicture: null }],
      space: 'Vendas', folder: null, list: 'Board Q2', url: '#',
    },
  ];
}
