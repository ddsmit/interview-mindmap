const state = {
  answers: [],
  categories: [],
  selectedCategory: null,
  selectedAnswerTag: null,
};

const mapStage = document.getElementById("mapStage");
const mapViewport = document.getElementById("mapViewport");
const answerTemplate = document.getElementById("answerTemplate");
const breadcrumb = document.getElementById("breadcrumb");
const backBtn = document.getElementById("backBtn");
const answerModal = document.getElementById("answerModal");
const modalBackdrop = document.getElementById("modalBackdrop");
const closeModalBtn = document.getElementById("closeModalBtn");
const modalContent = document.getElementById("modalContent");

backBtn.addEventListener("click", () => {
  if (state.selectedAnswerTag) {
    closeModal();
    return;
  }

  state.selectedCategory = null;
  render();
});

modalBackdrop.addEventListener("click", () => closeModal());
closeModalBtn.addEventListener("click", () => closeModal());
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !answerModal.classList.contains("hidden")) {
    closeModal();
  }
});
window.addEventListener("resize", () => render());

init();

async function init() {
  try {
    const manifestResponse = await fetch("/answers/index.json", { cache: "no-store" });
    if (!manifestResponse.ok) throw new Error("Could not load /answers/index.json");

    const manifest = await manifestResponse.json();
    const files = Array.isArray(manifest.files) ? manifest.files : [];
    if (!files.length) throw new Error("No markdown files found in answers/index.json");

    const parsedAnswers = await Promise.all(files.map(loadAndParseAnswer));
    state.answers = parsedAnswers.filter(Boolean);

    const categories = new Set();
    for (const answer of state.answers) {
      for (const category of answer.categories) categories.add(category);
    }
    state.categories = [...categories].sort((a, b) => a.localeCompare(b));

    render();
  } catch (error) {
    showError(error.message);
  }
}

async function loadAndParseAnswer(fileName) {
  const path = `/answers/${fileName}`;
  try {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) throw new Error(`Failed to load ${path}`);
    const markdown = await response.text();
    return parseAnswer(markdown, fileName);
  } catch (error) {
    console.error(error);
    return null;
  }
}

function parseAnswer(markdown, fileName) {
  const matterMatch = markdown.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!matterMatch) {
    throw new Error(`Missing front matter in ${fileName}`);
  }

  const frontMatter = parseFrontMatter(matterMatch[1]);
  const content = markdown.slice(matterMatch[0].length);
  const titleMatch = content.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : fileName;
  const sections = parseStarSections(content);

  return {
    fileName,
    tag: frontMatter.situation_tag || fileName.replace(/\.md$/, ""),
    categories: Array.isArray(frontMatter.question_categories)
      ? frontMatter.question_categories
      : [],
    title,
    sections,
  };
}

function parseFrontMatter(raw) {
  const lines = raw.split(/\r?\n/);
  const result = {};
  let currentArrayKey = null;

  for (const line of lines) {
    const arrayItem = line.match(/^\s*-\s*(.+)$/);
    if (arrayItem && currentArrayKey) {
      result[currentArrayKey].push(arrayItem[1].trim());
      continue;
    }

    const keyValue = line.match(/^([a-zA-Z0-9_\-]+):\s*(.*)$/);
    if (!keyValue) continue;

    const key = keyValue[1].trim();
    const value = keyValue[2].trim();

    if (value === "") {
      result[key] = [];
      currentArrayKey = key;
      continue;
    }

    result[key] = stripQuotes(value);
    currentArrayKey = null;
  }

  return result;
}

function parseStarSections(content) {
  const sections = {
    Situation: "",
    Task: "",
    Action: "",
    Result: "",
  };

  const headerRegex = /^##\s+(Situation|Task|Action|Result)\s*$/gm;
  const matches = [...content.matchAll(headerRegex)];

  for (let i = 0; i < matches.length; i += 1) {
    const current = matches[i];
    const name = current[1];
    const start = current.index + current[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : content.length;
    sections[name] = content
      .slice(start, end)
      .trim()
      .replace(/\n{2,}/g, "\n\n");
  }

  return sections;
}

function stripQuotes(value) {
  return value.replace(/^"(.+)"$/, "$1").replace(/^'(.+)'$/, "$1");
}

function render() {
  const viewportWidth = mapViewport.clientWidth;
  const viewportHeight = mapViewport.clientHeight;
  const center = { x: viewportWidth / 2, y: viewportHeight / 2 };

  mapStage.innerHTML = "";

  const rootNode = {
    id: "root",
    label: "Question Categories",
    type: "root",
    x: center.x,
    y: center.y,
    muted: Boolean(state.selectedCategory),
  };

  const categoryNodes = buildCategoryNodes(center, Math.min(viewportWidth, viewportHeight) * 0.32);
  const selectedCategoryNode = categoryNodes.find((node) => node.id === state.selectedCategory) || null;

  let situationNodes = [];
  if (selectedCategoryNode) {
    const answersForCategory = state.answers.filter((answer) =>
      answer.categories.includes(selectedCategoryNode.id)
    );
    situationNodes = buildSituationNodes(
      selectedCategoryNode,
      answersForCategory,
      Math.min(viewportWidth, viewportHeight) * 0.24
    );
  }

  const focused = Boolean(selectedCategoryNode);

  if (focused) {
    drawLinks(rootNode, categoryNodes, true);
    drawLinks(rootNode, [selectedCategoryNode], false);
    drawLinks(selectedCategoryNode, situationNodes, false);
  } else {
    drawLinks(rootNode, categoryNodes, false);
  }

  drawNode(rootNode);
  for (const node of categoryNodes) {
    node.muted = focused && node.id !== selectedCategoryNode.id;
    drawNode(node);
  }
  for (const node of situationNodes) {
    drawNode(node);
  }

  applyTransform(center, selectedCategoryNode);
  updateNavigation();
}

function buildCategoryNodes(center, radius) {
  const total = state.categories.length || 1;
  return state.categories.map((category, index) => {
    const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
    return {
      id: category,
      label: categoryLabel(category),
      type: "category",
      x: center.x + radius * Math.cos(angle),
      y: center.y + radius * Math.sin(angle),
    };
  });
}

function buildSituationNodes(categoryNode, answers, radius) {
  const total = answers.length || 1;
  return answers.map((answer, index) => {
    const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
    return {
      id: answer.tag,
      label: answer.title,
      type: "situation",
      x: categoryNode.x + radius * Math.cos(angle),
      y: categoryNode.y + radius * Math.sin(angle),
      answer,
    };
  });
}

function drawLinks(fromNode, toNodes, muted) {
  for (const toNode of toNodes) {
    const dx = toNode.x - fromNode.x;
    const dy = toNode.y - fromNode.y;
    const length = Math.hypot(dx, dy);
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

    const link = document.createElement("div");
    link.className = `link${muted ? " is-muted" : ""}`;
    link.style.width = `${length}px`;
    link.style.left = `${fromNode.x}px`;
    link.style.top = `${fromNode.y}px`;
    link.style.transform = `rotate(${angle}deg)`;
    mapStage.appendChild(link);
  }
}

function drawNode(node) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `node node-${node.type}`;
  button.style.left = `${node.x}px`;
  button.style.top = `${node.y}px`;
  button.textContent = node.label;
  button.setAttribute("role", "treeitem");

  if (
    (node.type === "category" && node.id === state.selectedCategory) ||
    (node.type === "situation" && node.id === state.selectedAnswerTag)
  ) {
    button.classList.add("is-active");
  }

  if (node.muted) {
    button.classList.add("is-muted");
  }

  if (node.type === "root") {
    button.addEventListener("click", () => {
      state.selectedCategory = null;
      closeModal();
      render();
    });
  }

  if (node.type === "category") {
    button.addEventListener("click", () => {
      const isSame = state.selectedCategory === node.id;
      state.selectedCategory = isSame ? null : node.id;
      closeModal();
      render();
    });
  }

  if (node.type === "situation") {
    button.addEventListener("click", () => {
      state.selectedAnswerTag = node.id;
      openModal(node.answer);
      updateNavigation();
      render();
    });
  }

  mapStage.appendChild(button);
}

function applyTransform(center, selectedCategoryNode) {
  if (!selectedCategoryNode) {
    mapStage.style.transform = "translate(0px, 0px) scale(1)";
    return;
  }

  const scale = window.innerWidth < 900 ? 1.16 : 1.28;
  const x = center.x - selectedCategoryNode.x;
  const y = center.y - selectedCategoryNode.y;
  mapStage.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
}

function updateNavigation() {
  if (!state.selectedCategory) {
    breadcrumb.textContent = "Home";
    backBtn.classList.add("hidden");
    return;
  }

  const category = categoryLabel(state.selectedCategory);
  const answer = state.answers.find((item) => item.tag === state.selectedAnswerTag) || null;
  breadcrumb.textContent = answer ? `Home / ${category} / ${answer.title}` : `Home / ${category}`;
  backBtn.classList.remove("hidden");
  backBtn.textContent = state.selectedAnswerTag ? "Back To Category" : "Back To Home";
}

function openModal(answer) {
  const card = answerTemplate.content.firstElementChild.cloneNode(true);
  card.querySelector('[data-role="title"]').textContent = answer.title;
  card.querySelector('[data-role="tag"]').textContent = `Tag: ${answer.tag}`;
  card.querySelector('[data-role="categories"]').textContent = `Categories: ${answer.categories.join(", ")}`;
  card.querySelector('[data-role="situation"]').textContent = answer.sections.Situation || "-";
  card.querySelector('[data-role="task"]').textContent = answer.sections.Task || "-";
  card.querySelector('[data-role="action"]').textContent = answer.sections.Action || "-";
  card.querySelector('[data-role="result"]').textContent = answer.sections.Result || "-";

  modalContent.innerHTML = "";
  modalContent.appendChild(card);
  answerModal.classList.remove("hidden");
}

function closeModal() {
  state.selectedAnswerTag = null;
  answerModal.classList.add("hidden");
  modalContent.innerHTML = "";
  updateNavigation();
}

function showError(message) {
  modalContent.innerHTML = `<h2>Load Error</h2><p class="error">${escapeHtml(message)}</p>`;
  answerModal.classList.remove("hidden");
}

function categoryLabel(category) {
  return category
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
