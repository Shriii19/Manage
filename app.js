const STORAGE_KEY = "project-assignment-tracker-v1";
const TASK_OPTIONS = [
  "Frontend",
  "Backend",
  "API",
  "Admin",
  "QA",
  "DevOps",
  "Database",
  "UI/UX"
];

const form = document.getElementById("project-form");
const taskOptionsContainer = document.getElementById("task-options");
const formError = document.getElementById("form-error");
const projectList = document.getElementById("project-list");
const projectTemplate = document.getElementById("project-template");
const stats = document.getElementById("stats");
const statusFilter = document.getElementById("statusFilter");
const assigneeFilter = document.getElementById("assigneeFilter");
const assignDateInput = document.getElementById("assignDate");

let projects = loadProjects();

buildTaskOptions();
setDefaultDate();
render();

form.addEventListener("submit", (event) => {
  event.preventDefault();
  formError.textContent = "";

  const projectName = form.projectName.value.trim();
  const assignedTo = form.assignedTo.value.trim();
  const assignDate = form.assignDate.value;
  const deadline = form.deadline.value;
  const priority = form.priority.value;
  const description = form.description.value.trim();
  const selectedTasks = getSelectedTasks();

  if (!projectName || !assignedTo || !assignDate || !deadline) {
    formError.textContent = "Project name, assignee, assign date, and deadline are required.";
    return;
  }

  if (deadline < assignDate) {
    formError.textContent = "Deadline cannot be earlier than assign date.";
    return;
  }

  if (selectedTasks.length === 0) {
    formError.textContent = "Select at least one task type or add a custom task tag.";
    return;
  }

  const newProject = {
    id: crypto.randomUUID(),
    projectName,
    assignedTo,
    assignDate,
    deadline,
    priority,
    description,
    tasks: selectedTasks,
    completed: false,
    createdAt: new Date().toISOString()
  };

  projects.push(newProject);
  persistProjects();
  form.reset();
  setDefaultDate();
  render();
});

statusFilter.addEventListener("change", render);
assigneeFilter.addEventListener("input", render);

function buildTaskOptions() {
  TASK_OPTIONS.forEach((task) => {
    const wrapper = document.createElement("label");
    wrapper.className = "task-option";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.name = "taskTypes";
    checkbox.value = task;

    const text = document.createElement("span");
    text.textContent = task;

    wrapper.append(checkbox, text);
    taskOptionsContainer.appendChild(wrapper);
  });
}

function getSelectedTasks() {
  const checkedTasks = Array.from(form.querySelectorAll("input[name='taskTypes']:checked")).map(
    (checkbox) => checkbox.value
  );

  const customTasks = form.customTasks.value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return [...new Set([...checkedTasks, ...customTasks])];
}

function setDefaultDate() {
  if (!assignDateInput.value) {
    assignDateInput.value = dateToYMD(new Date());
  }
}

function render() {
  const filteredProjects = projects
    .map((project) => ({ ...project, status: getStatus(project) }))
    .filter((project) => {
      const statusMatch =
        statusFilter.value === "all" || project.status.toLowerCase() === statusFilter.value;
      const assigneeMatch = project.assignedTo
        .toLowerCase()
        .includes(assigneeFilter.value.trim().toLowerCase());
      return statusMatch && assigneeMatch;
    })
    .sort((a, b) => a.deadline.localeCompare(b.deadline));

  projectList.innerHTML = "";

  if (filteredProjects.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No projects match the current filters.";
    projectList.appendChild(empty);
  } else {
    filteredProjects.forEach((project) => projectList.appendChild(createCard(project)));
  }

  const countOpen = projects.filter((project) => getStatus(project) === "Open").length;
  const countOverdue = projects.filter((project) => getStatus(project) === "Overdue").length;
  const countCompleted = projects.filter((project) => getStatus(project) === "Completed").length;
  stats.textContent = `Open: ${countOpen} | Overdue: ${countOverdue} | Completed: ${countCompleted}`;
}

function createCard(project) {
  const fragment = projectTemplate.content.cloneNode(true);

  const title = fragment.querySelector(".project-title");
  const owner = fragment.querySelector(".owner");
  const timeline = fragment.querySelector(".timeline");
  const taskChips = fragment.querySelector(".task-chips");
  const description = fragment.querySelector(".description");
  const statusChip = fragment.querySelector(".status-chip");
  const priorityChip = fragment.querySelector(".priority-chip");
  const toggleBtn = fragment.querySelector(".toggle-btn");
  const deleteBtn = fragment.querySelector(".delete-btn");

  title.textContent = project.projectName;
  owner.textContent = project.assignedTo;

  const dayInfo = getDaysInfo(project.deadline, project.completed);
  timeline.textContent = `${project.assignDate} to ${project.deadline} (${dayInfo})`;

  project.tasks.forEach((task) => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = task;
    chip.style.background = "#e2e8f0";
    chip.style.color = "#0f172a";
    taskChips.appendChild(chip);
  });

  description.textContent = project.description || "No additional notes.";

  const status = getStatus(project);
  statusChip.textContent = status;
  statusChip.classList.add(`status-${status.toLowerCase()}`);

  priorityChip.textContent = project.priority;
  priorityChip.classList.add(`priority-${project.priority}`);

  toggleBtn.textContent = project.completed ? "Reopen" : "Mark Complete";
  toggleBtn.addEventListener("click", () => {
    projects = projects.map((item) =>
      item.id === project.id ? { ...item, completed: !item.completed } : item
    );
    persistProjects();
    render();
  });

  deleteBtn.addEventListener("click", () => {
    projects = projects.filter((item) => item.id !== project.id);
    persistProjects();
    render();
  });

  return fragment;
}

function getStatus(project) {
  if (project.completed) {
    return "Completed";
  }

  const today = dateToYMD(new Date());
  if (project.deadline < today) {
    return "Overdue";
  }

  return "Open";
}

function getDaysInfo(deadline, isCompleted) {
  if (isCompleted) {
    return "completed";
  }

  const now = new Date();
  const end = new Date(`${deadline}T23:59:59`);
  const diffMs = end - now;
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays > 1) {
    return `${diffDays} days left`;
  }

  if (diffDays === 1) {
    return "1 day left";
  }

  if (diffDays === 0) {
    return "due today";
  }

  return `${Math.abs(diffDays)} days late`;
}

function loadProjects() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persistProjects() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

function dateToYMD(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
