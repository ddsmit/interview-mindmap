const state = {
  answers: [],
  categories: [],
  selectedCategory: null,
  selectedAnswerTag: null,
};

const mapStage = document.getElementById("mapStage");
const mapViewport = document.getElementById("mapViewport");
const answerTemplate = document.getElementById("answerTemplate");
const answerModal = document.getElementById("answerModal");
const modalBackdrop = document.getElementById("modalBackdrop");
const closeModalBtn = document.getElementById("closeModalBtn");
const modalContent = document.getElementById("modalContent");

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
  const displayedNodes = [];

  mapStage.innerHTML = "";

  const selectedCategoryId = state.selectedCategory;
  const categoryNodes = buildCategoryNodes(center, viewportWidth, viewportHeight);
  const selectedCategoryNode = categoryNodes.find((node) => node.id === selectedCategoryId) || null;

  let situationNodes = [];
  if (selectedCategoryNode) {
    const answersForCategory = state.answers.filter((answer) =>
      answer.categories.includes(selectedCategoryNode.id)
    );
    situationNodes = buildSituationNodes(
      selectedCategoryNode,
      answersForCategory,
      viewportWidth,
      viewportHeight
    );
  }

  if (!selectedCategoryNode) {
    const rootNode = {
      id: "root",
      label: "Question Categories",
      type: "root",
      x: center.x,
      y: center.y,
    };
    resolveNodeOverlaps([rootNode, ...categoryNodes], new Set(["root"]));

    drawLinks(rootNode, categoryNodes, false);
    drawNode(rootNode);
    displayedNodes.push(rootNode);
    for (const node of categoryNodes) {
      drawNode(node);
      displayedNodes.push(node);
    }
  } else {
    resolveNodeOverlaps([selectedCategoryNode, ...situationNodes], new Set([selectedCategoryNode.id]));

    drawNode(selectedCategoryNode);
    displayedNodes.push(selectedCategoryNode);
    drawLinks(selectedCategoryNode, situationNodes, false);
    for (const node of situationNodes) {
      drawNode(node);
      displayedNodes.push(node);
    }
  }

  applyTransform(center, selectedCategoryNode, displayedNodes, viewportWidth, viewportHeight);
}

function buildCategoryNodes(center, viewportWidth, viewportHeight) {
  const mobile = window.innerWidth < 900;
  const minRadius = Math.max(130, Math.min(viewportWidth, viewportHeight) * 0.24);
  return layoutNodesInRings({
    items: state.categories,
    center,
    minRadius,
    ringStep: mobile ? 104 : 98,
    minSpacing: mobile ? 152 : 176,
    xStretch: mobile ? 0.74 : 1,
    yStretch: mobile ? 1.28 : 1,
    mapItem: (category) => ({
      id: category,
      label: categoryLabel(category),
      type: "category",
    }),
  });
}

function buildSituationNodes(categoryNode, answers, viewportWidth, viewportHeight) {
  const mobile = window.innerWidth < 900;
  const minRadius = Math.max(170, Math.min(viewportWidth, viewportHeight) * 0.28);
  return layoutNodesInRings({
    items: answers,
    center: { x: categoryNode.x, y: categoryNode.y },
    minRadius,
    ringStep: mobile ? 118 : 112,
    minSpacing: mobile ? 172 : 212,
    xStretch: mobile ? 0.7 : 1,
    yStretch: mobile ? 1.22 : 1,
    mapItem: (answer) => ({
      id: answer.tag,
      label: answer.title,
      type: "situation",
      answer,
    }),
  });
}

function layoutNodesInRings({
  items,
  center,
  minRadius,
  ringStep,
  minSpacing,
  xStretch,
  yStretch,
  mapItem,
}) {
  if (!items.length) return [];

  const rings = [];
  let remaining = items.length;
  let radius = minRadius;

  while (remaining > 0) {
    const effectivePerimeter = 2 * Math.PI * radius * ((xStretch + yStretch) / 2);
    const capacity = Math.max(4, Math.floor(effectivePerimeter / minSpacing));
    const count = Math.min(capacity, remaining);
    rings.push({ radius, count });
    remaining -= count;
    radius += ringStep;
  }

  const nodes = [];
  let cursor = 0;
  for (let ringIndex = 0; ringIndex < rings.length; ringIndex += 1) {
    const ring = rings[ringIndex];
    for (let i = 0; i < ring.count; i += 1) {
      const angle = (Math.PI * 2 * i) / ring.count - Math.PI / 2 + ringIndex * 0.22;
      const item = items[cursor];
      const base = mapItem(item);
      nodes.push({
        ...base,
        x: center.x + ring.radius * xStretch * Math.cos(angle),
        y: center.y + ring.radius * yStretch * Math.sin(angle),
      });
      cursor += 1;
    }
  }

  return nodes;
}

function resolveNodeOverlaps(nodes, fixedIds) {
  if (nodes.length < 2) return;

  const gap = window.innerWidth < 900 ? 12 : 16;
  const maxIterations = 220;

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    let movedAny = false;

    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const a = nodes[i];
        const b = nodes[j];
        const aSize = estimateNodeSize(a.type);
        const bSize = estimateNodeSize(b.type);

        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const overlapX = (aSize.width + bSize.width) / 2 + gap - Math.abs(dx);
        const overlapY = (aSize.height + bSize.height) / 2 + gap - Math.abs(dy);

        if (overlapX <= 0 || overlapY <= 0) continue;

        movedAny = true;
        const moveOnX = overlapX < overlapY;
        const shift = (moveOnX ? overlapX : overlapY) + 0.5;
        const sign = (moveOnX ? dx : dy) >= 0 ? 1 : -1;
        const aFixed = fixedIds.has(a.id);
        const bFixed = fixedIds.has(b.id);

        if (!aFixed && !bFixed) {
          if (moveOnX) {
            a.x -= (shift / 2) * sign;
            b.x += (shift / 2) * sign;
          } else {
            a.y -= (shift / 2) * sign;
            b.y += (shift / 2) * sign;
          }
          continue;
        }

        if (aFixed && !bFixed) {
          if (moveOnX) b.x += shift * sign;
          else b.y += shift * sign;
          continue;
        }

        if (!aFixed && bFixed) {
          if (moveOnX) a.x -= shift * sign;
          else a.y -= shift * sign;
        }
      }
    }

    if (!movedAny) break;
  }
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
      render();
    });
  }

  mapStage.appendChild(button);
}

function applyTransform(center, selectedCategoryNode, displayedNodes, viewportWidth, viewportHeight) {
  if (!displayedNodes.length) {
    mapStage.style.transform = "translate(0px, 0px) scale(1)";
    return;
  }

  const bounds = getNodeBounds(displayedNodes);
  const padding = window.innerWidth < 900 ? 14 : 24;
  const contentWidth = Math.max(1, bounds.maxX - bounds.minX);
  const contentHeight = Math.max(1, bounds.maxY - bounds.minY);
  const fitScale = Math.min(
    1,
    (viewportWidth - padding * 2) / contentWidth,
    (viewportHeight - padding * 2) / contentHeight
  );

  const targetScale = selectedCategoryNode ? (window.innerWidth < 900 ? 1.02 : 1.06) : 1;
  const scale = Math.min(targetScale, fitScale);

  const contentCenterX = (bounds.minX + bounds.maxX) / 2;
  const contentCenterY = (bounds.minY + bounds.maxY) / 2;
  const x = center.x - contentCenterX * scale;
  const y = center.y - contentCenterY * scale;

  mapStage.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
}

function getNodeBounds(nodes) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const node of nodes) {
    const size = estimateNodeSize(node.type);
    const left = node.x - size.width / 2;
    const right = node.x + size.width / 2;
    const top = node.y - size.height / 2;
    const bottom = node.y + size.height / 2;

    if (left < minX) minX = left;
    if (top < minY) minY = top;
    if (right > maxX) maxX = right;
    if (bottom > maxY) maxY = bottom;
  }

  return { minX, minY, maxX, maxY };
}

function estimateNodeSize(type) {
  const mobile = window.innerWidth < 900;

  if (type === "situation") {
    return mobile ? { width: 132, height: 76 } : { width: 168, height: 88 };
  }
  if (type === "root") {
    return mobile ? { width: 136, height: 64 } : { width: 176, height: 74 };
  }
  return mobile ? { width: 132, height: 76 } : { width: 168, height: 88 };
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
