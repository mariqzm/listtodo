const API_URL = 'http://localhost:3000';
const authScreen = document.getElementById('authScreen');
const tasksScreen = document.getElementById('tasksScreen');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const showLoginTab = document.getElementById('showLoginTab');
const showRegisterTab = document.getElementById('showRegisterTab');
const loginError = document.getElementById('loginError');
const registerError = document.getElementById('registerError');
const tasksList = document.getElementById('tasksList');
const tasksError = document.getElementById('tasksError');
const addTaskForm = document.getElementById('addTaskForm');
const taskTitleInput = document.getElementById('taskTitle');
const logoutBtn = document.getElementById('logoutBtn');
const userNameDisplay = document.getElementById('userNameDisplay');
let currentUser = null;
let authToken = localStorage.getItem('authToken');
function init() {
  showLoginTab.addEventListener('click', () => switchAuthTab('login'));
  showRegisterTab.addEventListener('click', () => switchAuthTab('register'));
  loginForm.addEventListener('submit', handleLogin);
  registerForm.addEventListener('submit', handleRegister);
  addTaskForm.addEventListener('submit', handleAddTask);
  logoutBtn.addEventListener('click', handleLogout);

  if (authToken) {
    const savedUserName = localStorage.getItem('userName');
    if (savedUserName) {
      currentUser = { user_name: savedUserName };
      showTasksScreen();
      loadTasks();
    } else {
      logout();
    }
  } else {
    showAuthScreen();
  }
}
function showAuthScreen() {
  authScreen.classList.add('active');
  tasksScreen.classList.remove('active');
}

function showTasksScreen() {
  authScreen.classList.remove('active');
  tasksScreen.classList.add('active');
  if (currentUser) {
    userNameDisplay.textContent = currentUser.user_name;
  }
}

function switchAuthTab(tab) {
  const loginFormEl = document.getElementById('loginForm');
  const registerFormEl = document.getElementById('registerForm');
  const loginTab = document.getElementById('showLoginTab');
  const registerTab = document.getElementById('showRegisterTab');

  if (tab === 'login') {
    loginFormEl.classList.add('active');
    registerFormEl.classList.remove('active');
    loginTab.classList.add('active');
    registerTab.classList.remove('active');
  } else {
    registerFormEl.classList.add('active');
    loginFormEl.classList.remove('active');
    registerTab.classList.add('active');
    loginTab.classList.remove('active');
  }
  loginError.textContent = '';
  registerError.textContent = '';
}

async function handleLogin(e) {
  e.preventDefault();
  loginError.textContent = '';

  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;

  if (!username || !password) {
    loginError.textContent = 'Заполните все поля';
    return;
  }

  try {
    const response = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_name: username, user_password: password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Ошибка входа');
    }

    authToken = data.token;
    localStorage.setItem('authToken', authToken);
    currentUser = data.user;
    localStorage.setItem('userName', currentUser.user_name);

    showTasksScreen();
    loadTasks();
  } catch (error) {
    loginError.textContent = error.message;
  }
}

async function handleRegister(e) {
  e.preventDefault();
  registerError.textContent = '';

  const username = document.getElementById('registerUsername').value.trim();
  const password = document.getElementById('registerPassword').value;

  if (!username || !password) {
    registerError.textContent = 'Заполните все поля';
    return;
  }

  if (password.length < 6) {
    registerError.textContent = 'Пароль должен быть не менее 6 символов';
    return;
  }

  try {
    const response = await fetch(`${API_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_name: username, user_password: password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Ошибка регистрации');
    }

    const loginResponse = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_name: username, user_password: password })
    });

    const loginData = await loginResponse.json();

    if (!loginResponse.ok) {
      throw new Error(loginData.error || 'Ошибка автоматического входа');
    }

    authToken = loginData.token;
    localStorage.setItem('authToken', authToken);
    currentUser = loginData.user;
    localStorage.setItem('userName', currentUser.user_name);

    showTasksScreen();
    loadTasks();
  } catch (error) {
    registerError.textContent = error.message;
  }
}

function handleLogout() {
  authToken = null;
  currentUser = null;
  localStorage.removeItem('authToken');
  localStorage.removeItem('userName');
  showAuthScreen();
  document.getElementById('loginUsername').value = '';
  document.getElementById('loginPassword').value = '';
  document.getElementById('registerUsername').value = '';
  document.getElementById('registerPassword').value = '';
}

async function loadTasks() {
  if (!authToken) {
    logout();
    return;
  }

  try {
    const response = await fetch(`${API_URL}/items`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (response.status === 401) {
      logout();
      return;
    }

    const tasks = await response.json();

    if (!response.ok) {
      throw new Error(tasks.error || 'Ошибка загрузки задач');
    }

    renderTasks(tasks);
  } catch (error) {
    tasksError.textContent = error.message;
  }
}

function renderTasks(tasks) {
  tasksList.innerHTML = '';

  if (tasks.length === 0) {
    tasksList.innerHTML = '<div class="empty-message">У вас пока нет задач. Добавьте первую!</div>';
    return;
  }

  tasks.forEach(task => {
    const taskElement = createTaskElement(task);
    tasksList.appendChild(taskElement);
  });
}

function createTaskElement(task) {
  const div = document.createElement('div');
  div.className = 'task-item';
  div.dataset.id = task.id;

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'task-checkbox';
  checkbox.checked = task.completed;
  checkbox.addEventListener('change', () => toggleTaskCompletion(task.id, checkbox.checked));

  const titleSpan = document.createElement('span');
  titleSpan.className = `task-title ${task.completed ? 'completed' : ''}`;
  titleSpan.textContent = task.title;

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'delete-btn';
  deleteBtn.innerHTML = '×';
  deleteBtn.title = 'Удалить задачу';
  deleteBtn.addEventListener('click', () => deleteTask(task.id));

  div.appendChild(checkbox);
  div.appendChild(titleSpan);
  div.appendChild(deleteBtn);

  return div;
}

async function handleAddTask(e) {
  e.preventDefault();
  const title = taskTitleInput.value.trim();

  if (!title) return;

  try {
    const response = await fetch(`${API_URL}/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ title })
    });

    if (response.status === 401) {
      logout();
      return;
    }

    const newTask = await response.json();

    if (!response.ok) {
      throw new Error(newTask.error || 'Ошибка создания задачи');
    }

    taskTitleInput.value = '';
    const taskElement = createTaskElement(newTask);
    tasksList.prepend(taskElement);

    const emptyMsg = tasksList.querySelector('.empty-message');
    if (emptyMsg) emptyMsg.remove();

    tasksError.textContent = '';
  } catch (error) {
    tasksError.textContent = error.message;
  }
}

async function toggleTaskCompletion(taskId, completed) {
  try {
    const response = await fetch(`${API_URL}/items/${taskId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ completed })
    });

    if (response.status === 401) {
      logout();
      return;
    }

    const updatedTask = await response.json();

    if (!response.ok) {
      throw new Error(updatedTask.error || 'Ошибка обновления задачи');
    }

    const taskElement = document.querySelector(`.task-item[data-id="${taskId}"]`);
    if (taskElement) {
      const titleSpan = taskElement.querySelector('.task-title');
      titleSpan.classList.toggle('completed', completed);
    }
  } catch (error) {
    tasksError.textContent = error.message;
    const checkbox = document.querySelector(`.task-item[data-id="${taskId}"] .task-checkbox`);
    if (checkbox) checkbox.checked = !completed;
  }
}

async function deleteTask(taskId) {
  if (!confirm('Вы уверены, что хотите удалить эту задачу?')) return;

  try {
    const response = await fetch(`${API_URL}/items/${taskId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (response.status === 401) {
      logout();
      return;
    }

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Ошибка удаления задачи');
    }

    const taskElement = document.querySelector(`.task-item[data-id="${taskId}"]`);
    if (taskElement) {
      taskElement.remove();
    }

    if (tasksList.children.length === 0) {
      tasksList.innerHTML = '<div class="empty-message">У вас пока нет задач. Добавьте первую!</div>';
    }

    tasksError.textContent = '';
  } catch (error) {
    tasksError.textContent = error.message;
  }
}

init();