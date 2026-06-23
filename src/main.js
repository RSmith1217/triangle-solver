const form = document.querySelector("#triangleForm");
const clearButton = document.querySelector("#clearButton");
const formMessage = document.querySelector("#formMessage");
const resultsSection = document.querySelector("#resultsSection");
const statusBadge = document.querySelector("#statusBadge");
const triangleStage = document.querySelector("#triangleStage");
const polygon = document.querySelector("#trianglePolygon");
const alternateTriangle = document.querySelector("#alternateTriangle");
const alternatePolygon = document.querySelector("#alternatePolygon");
const alternateVertex = document.querySelector("#alternateVertex");
const alternateLabel = document.querySelector("#alternateLabel");
const alternateSideLabel = document.querySelector("#alternateSideLabel");
const ambiguousAltitude = document.querySelector("#ambiguousAltitude");
const altitudeLine = document.querySelector("#altitudeLine");
const altitudeLabel = document.querySelector("#altitudeLabel");
const angleArcs = document.querySelector("#angleArcs");
const labels = document.querySelector("#diagramLabels");
const diagramDesc = document.querySelector("#diagramDesc");
const vertices = ["A", "B", "C"].map((key) => document.querySelector(`#vertex${key}`));
const fields = [...form.querySelectorAll("input")];

const toRad = (degrees) => (degrees * Math.PI) / 180;
const toDeg = (radians) => (radians * 180) / Math.PI;
const clamp = (value, min = -1, max = 1) => Math.min(max, Math.max(min, value));
const round = (value) => Number(value.toFixed(10));

function getValues() {
  const data = Object.fromEntries(new FormData(form));
  const parsed = {};
  for (const [key, value] of Object.entries(data)) {
    parsed[key] = value.trim() === "" ? null : Number(value);
  }
  return parsed;
}

function validate(values) {
  const supplied = Object.entries(values).filter(([, value]) => value !== null);
  const sides = ["a", "b", "c"].filter((key) => values[key] !== null);
  const angles = ["A", "B", "C"].filter((key) => values[key] !== null);

  if (supplied.length !== 3) return "Enter exactly three known values.";
  if (!sides.length) return "Include at least one known side length.";
  if (supplied.some(([, value]) => !Number.isFinite(value) || value <= 0)) {
    return "All known values must be positive numbers.";
  }
  if (angles.some((key) => values[key] >= 180)) {
    return "Every angle must be less than 180°.";
  }
  if (angles.reduce((sum, key) => sum + values[key], 0) >= 180 && angles.length > 1) {
    return "The known angles must add to less than 180°.";
  }
  return "";
}

function solveSSS(v) {
  const { a, b, c } = v;
  if (a + b <= c || a + c <= b || b + c <= a) {
    throw new Error("Those side lengths do not satisfy the triangle inequality.");
  }
  return [{
    ...v,
    A: toDeg(Math.acos(clamp((b*b + c*c - a*a) / (2*b*c)))),
    B: toDeg(Math.acos(clamp((a*a + c*c - b*b) / (2*a*c)))),
    C: toDeg(Math.acos(clamp((a*a + b*b - c*c) / (2*a*b)))),
    method: "SSS · Law of Cosines"
  }];
}

function solveSAS(v) {
  const knownAngle = ["A", "B", "C"].find((key) => v[key] !== null);
  const opposite = knownAngle.toLowerCase();
  const adjacentSides = ["a", "b", "c"].filter((key) => key !== opposite);
  if (adjacentSides.some((key) => v[key] === null)) return null;

  const [x, y] = adjacentSides;
  const solved = { ...v };
  solved[opposite] = Math.sqrt(
    solved[x] ** 2 + solved[y] ** 2 -
    2 * solved[x] * solved[y] * Math.cos(toRad(solved[knownAngle]))
  );
  return solveSSS(solved).map((solution) => ({ ...solution, method: "SAS · Law of Cosines" }));
}

function solveAnglesAndSide(v) {
  const solved = { ...v };
  const missingAngle = ["A", "B", "C"].find((key) => solved[key] === null);
  if (missingAngle) {
    solved[missingAngle] = 180 - ["A", "B", "C"]
      .filter((key) => key !== missingAngle)
      .reduce((sum, key) => sum + solved[key], 0);
  }
  const knownSide = ["a", "b", "c"].find((key) => solved[key] !== null);
  const knownOppositeAngle = knownSide.toUpperCase();
  const scale = solved[knownSide] / Math.sin(toRad(solved[knownOppositeAngle]));
  for (const side of ["a", "b", "c"]) {
    if (solved[side] === null) solved[side] = scale * Math.sin(toRad(solved[side.toUpperCase()]));
  }
  return [{ ...solved, method: "ASA / AAS · Law of Sines" }];
}

function solveSSA(v) {
  const knownPairSide = ["a", "b", "c"].find(
    (side) => v[side] !== null && v[side.toUpperCase()] !== null
  );
  if (!knownPairSide) return null;

  const otherKnownSide = ["a", "b", "c"].find(
    (side) => side !== knownPairSide && v[side] !== null
  );
  const pairAngle = knownPairSide.toUpperCase();
  const otherAngle = otherKnownSide.toUpperCase();
  const sineValue = v[otherKnownSide] * Math.sin(toRad(v[pairAngle])) / v[knownPairSide];

  if (sineValue > 1 + 1e-10) throw new Error("These values cannot form a triangle.");
  const primary = toDeg(Math.asin(clamp(sineValue)));
  const candidates = [primary];
  if (Math.abs(primary - 90) > 1e-9) candidates.push(180 - primary);

  return candidates
    .filter((angle) => v[pairAngle] + angle < 180 - 1e-9)
    .map((angle) => {
      const solved = { ...v, [otherAngle]: angle };
      const thirdAngle = ["A", "B", "C"].find((key) => solved[key] === null);
      solved[thirdAngle] = 180 - solved[pairAngle] - solved[otherAngle];
      const thirdSide = thirdAngle.toLowerCase();
      solved[thirdSide] = v[knownPairSide] *
        Math.sin(toRad(solved[thirdAngle])) / Math.sin(toRad(v[pairAngle]));
      return { ...solved, method: "SSA · Law of Sines (ambiguous case)" };
    });
}

function solveTriangle(values) {
  const sideCount = ["a", "b", "c"].filter((key) => values[key] !== null).length;
  const angleCount = 3 - sideCount;
  let solutions;

  if (sideCount === 3) solutions = solveSSS(values);
  else if (angleCount === 2) solutions = solveAnglesAndSide(values);
  else if (sideCount === 2 && angleCount === 1) {
    solutions = solveSAS(values) || solveSSA(values);
  }

  if (!solutions?.length) throw new Error("Those values cannot form a triangle.");
  return solutions.map(addMeasurements);
}

function addMeasurements(solution) {
  const s = (solution.a + solution.b + solution.c) / 2;
  const area = Math.sqrt(Math.max(0, s * (s-solution.a) * (s-solution.b) * (s-solution.c)));
  return {
    ...Object.fromEntries(Object.entries(solution).map(([key, value]) => [
      key, typeof value === "number" ? round(value) : value
    ])),
    area,
    perimeter: solution.a + solution.b + solution.c
  };
}

function formatNumber(value) {
  if (Math.abs(value) >= 10000 || (Math.abs(value) < .001 && value !== 0)) {
    return value.toExponential(3);
  }
  return Number(value.toFixed(3)).toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function triangleCoordinates(solution) {
  const raw = {
    A: { x: 0, y: 0 },
    B: { x: solution.c, y: 0 },
    C: {
      x: solution.b * Math.cos(toRad(solution.A)),
      y: solution.b * Math.sin(toRad(solution.A))
    }
  };
  const xs = Object.values(raw).map((p) => p.x);
  const ys = Object.values(raw).map((p) => p.y);
  const width = Math.max(...xs) - Math.min(...xs);
  const height = Math.max(...ys) - Math.min(...ys);
  const scale = Math.min(410 / Math.max(width, 1e-9), 270 / Math.max(height, 1e-9));
  const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
  const baseY = Math.min(...ys);
  return Object.fromEntries(Object.entries(raw).map(([key, p]) => [
    key,
    { x: 300 + (p.x - centerX) * scale, y: 340 - (p.y - baseY) * scale }
  ]));
}

function svgText(text, x, y, className = "") {
  const node = document.createElementNS("http://www.w3.org/2000/svg", "text");
  node.setAttribute("x", x);
  node.setAttribute("y", y);
  node.setAttribute("text-anchor", "middle");
  if (className) node.setAttribute("class", className);
  node.textContent = text;
  return node;
}

function ambiguousCoordinates(primary, alternate) {
  const angleKey = ["A", "B", "C"].find(
    (key) => Math.abs(primary[key] - alternate[key]) < 1e-7
  );
  const varyingSide = ["a", "b", "c"].find(
    (key) => Math.abs(primary[key] - alternate[key]) > 1e-7
  );
  const fixedAdjacentSide = ["a", "b", "c"].find(
    (key) => key !== angleKey.toLowerCase() && key !== varyingSide
  );

  const angleVertex = angleKey;
  const movingVertex = fixedAdjacentSide.toUpperCase();
  const fixedVertex = varyingSide.toUpperCase();
  const raw = (solution) => ({
    [angleVertex]: { x: 0, y: 0 },
    [movingVertex]: { x: solution[varyingSide], y: 0 },
    [fixedVertex]: {
      x: solution[fixedAdjacentSide] * Math.cos(toRad(solution[angleKey])),
      y: solution[fixedAdjacentSide] * Math.sin(toRad(solution[angleKey]))
    }
  });

  const primaryRaw = raw(primary);
  const alternateRaw = raw(alternate);
  const allPoints = [...Object.values(primaryRaw), ...Object.values(alternateRaw)];
  const xs = allPoints.map((point) => point.x);
  const ys = allPoints.map((point) => point.y);
  const width = Math.max(...xs) - Math.min(...xs);
  const height = Math.max(...ys) - Math.min(...ys);
  const scale = Math.min(410 / Math.max(width, 1e-9), 270 / Math.max(height, 1e-9));
  const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
  const baseY = Math.min(...ys);
  const fit = (points) => Object.fromEntries(Object.entries(points).map(([key, point]) => [
    key,
    {
      x: 300 + (point.x - centerX) * scale,
      y: 340 - (point.y - baseY) * scale
    }
  ]));

  return {
    primary: fit(primaryRaw),
    alternate: fit(alternateRaw),
    movingVertex,
    fixedVertex,
    angleVertex,
    varyingSide,
    altitudeExpression: `${fixedAdjacentSide} sin ${angleKey}`
  };
}

function renderDiagram(solution, alternateSolution = null, activeIndex = 0) {
  const ambiguous = alternateSolution
    ? ambiguousCoordinates(solution, alternateSolution)
    : null;
  const p = ambiguous ? ambiguous.primary : triangleCoordinates(solution);
  polygon.setAttribute("points", `${p.A.x},${p.A.y} ${p.B.x},${p.B.y} ${p.C.x},${p.C.y}`);
  polygon.classList.toggle("deemphasized", activeIndex === 1);
  labels.classList.toggle("deemphasized", activeIndex === 1);
  [p.A, p.B, p.C].forEach((point, index) => {
    vertices[index].setAttribute("cx", point.x);
    vertices[index].setAttribute("cy", point.y);
  });

  labels.replaceChildren();
  angleArcs.replaceChildren();
  const centroid = {
    x: (p.A.x + p.B.x + p.C.x) / 3,
    y: (p.A.y + p.B.y + p.C.y) / 3
  };

  for (const key of ["A", "B", "C"]) {
    const point = p[key];
    const dx = point.x - centroid.x;
    const dy = point.y - centroid.y;
    const mag = Math.hypot(dx, dy) || 1;
    labels.append(svgText(
      `${ambiguous && key === ambiguous.movingVertex ? `${key}₁` : key}  ${formatNumber(solution[key])}°`,
      point.x + (dx / mag) * 43,
      point.y + (dy / mag) * 34 + 5
    ));
  }

  const sides = [
    ["a", p.B, p.C],
    ["b", p.A, p.C],
    ["c", p.A, p.B]
  ];
  sides.forEach(([key, p1, p2]) => {
    const mid = { x: (p1.x+p2.x)/2, y: (p1.y+p2.y)/2 };
    const dx = mid.x - centroid.x;
    const dy = mid.y - centroid.y;
    const mag = Math.hypot(dx, dy) || 1;
    labels.append(svgText(
      `${ambiguous && key === ambiguous.varyingSide ? `${key}₁` : key} = ${formatNumber(solution[key])}`,
      mid.x + (dx/mag)*19,
      mid.y + (dy/mag)*19 + 4,
      "side-label"
    ));
  });

  if (alternateSolution) {
    const alternate = ambiguous.alternate;
    alternatePolygon.setAttribute(
      "points",
      `${alternate.A.x},${alternate.A.y} ${alternate.B.x},${alternate.B.y} ${alternate.C.x},${alternate.C.y}`
    );
    alternateVertex.setAttribute("cx", alternate[ambiguous.movingVertex].x);
    alternateVertex.setAttribute("cy", alternate[ambiguous.movingVertex].y);
    const fixedPoint = p[ambiguous.fixedVertex];
    const baselineY = p[ambiguous.angleVertex].y;
    altitudeLine.setAttribute("x1", fixedPoint.x);
    altitudeLine.setAttribute("y1", fixedPoint.y);
    altitudeLine.setAttribute("x2", fixedPoint.x);
    altitudeLine.setAttribute("y2", baselineY);
    altitudeLabel.setAttribute("x", fixedPoint.x + 8);
    altitudeLabel.setAttribute("y", (fixedPoint.y + baselineY) / 2);
    altitudeLabel.textContent = `h = ${ambiguous.altitudeExpression}`;
    ambiguousAltitude.classList.add("visible");
    const alternateMovingPoint = alternate[ambiguous.movingVertex];
    const alternateAngle = alternateSolution[ambiguous.movingVertex];
    alternateLabel.textContent =
      `${ambiguous.movingVertex}₂  ${formatNumber(alternateAngle)}°`;
    alternateLabel.setAttribute("x", alternateMovingPoint.x);
    alternateLabel.setAttribute("y", alternateMovingPoint.y + 31);
    const baseStart = alternate[ambiguous.angleVertex];
    alternateSideLabel.textContent =
      `${ambiguous.varyingSide}₂ = ${formatNumber(alternateSolution[ambiguous.varyingSide])}`;
    alternateSideLabel.setAttribute("x", (baseStart.x + alternateMovingPoint.x) / 2);
    alternateSideLabel.setAttribute("y", baseStart.y + 18);
    alternateTriangle.classList.add("visible");
    alternateTriangle.classList.toggle("selected", activeIndex === 1);
  } else {
    alternateTriangle.classList.remove("visible", "selected");
    ambiguousAltitude.classList.remove("visible");
    alternatePolygon.setAttribute("points", "");
    alternateVertex.setAttribute("cx", 0);
    alternateVertex.setAttribute("cy", 0);
    alternateLabel.textContent = "";
    alternateSideLabel.textContent = "";
  }

  diagramDesc.textContent =
    `A triangle with sides ${formatNumber(solution.a)}, ${formatNumber(solution.b)}, and ${formatNumber(solution.c)}.${
      alternateSolution ? " An alternate valid solution is nested inside it." : ""
    }`;
  triangleStage.classList.add("solved");
}

function renderResults(solutions, activeIndex = 0, givenKeys = []) {
  const solution = solutions[activeIndex];
  const given = new Set(givenKeys);
  const tabs = solutions.length > 1
    ? `<div class="solution-tabs">${solutions.map((_, index) =>
        `<button class="solution-tab ${index === activeIndex ? "active" : ""}" data-solution="${index}">
          Solution ${index + 1}
        </button>`).join("")}</div>`
    : "";

  const cards = [
    ["a", "side a", solution.a, "units"],
    ["b", "side b", solution.b, "units"],
    ["c", "side c", solution.c, "units"],
    ["area", "Area", solution.area, "units²"],
    ["A", "ANGLE A", solution.A, "°"],
    ["B", "ANGLE B", solution.B, "°"],
    ["C", "ANGLE C", solution.C, "°"],
    ["perimeter", "Perimeter", solution.perimeter, "units"]
  ];

  resultsSection.innerHTML = `${tabs}<div class="result-grid">
    ${cards.map(([key, label, value, unit]) =>
      `<div class="result-card ${given.has(key) ? "given" : "calculated"} ${
        key === "area" || key === "perimeter" ? "metric" : ""
      }">
        <span>${label}</span><strong>${formatNumber(value)} <em>${unit}</em></strong>
      </div>`).join("")}
    </div>
    <p class="method-line"><b>Method:</b> ${solution.method}${
      solutions.length > 1 ? " · Two valid triangles were found." : ""
    }</p>`;

  resultsSection.querySelectorAll("[data-solution]").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.solution);
      renderResults(solutions, index, givenKeys);
    });
  });
  renderDiagram(solutions[0], solutions[1] || null, activeIndex);
}

function resetApp() {
  form.reset();
  formMessage.textContent = "";
  resultsSection.innerHTML = `<div class="empty-results">
    <div><span>3</span><p>known values</p></div><b>+</b>
    <div><span>1</span><p>side minimum</p></div><b>=</b>
    <div class="accent"><span>△</span><p>complete triangle</p></div>
  </div>`;
  statusBadge.classList.remove("solved");
  statusBadge.innerHTML = "<i></i> Waiting for values";
  triangleStage.classList.remove("solved");
  alternateTriangle.classList.remove("visible", "selected");
  ambiguousAltitude.classList.remove("visible");
  alternatePolygon.setAttribute("points", "");
  alternateVertex.setAttribute("cx", 0);
  alternateVertex.setAttribute("cy", 0);
  alternateLabel.textContent = "";
  alternateSideLabel.textContent = "";
  polygon.classList.remove("deemphasized");
  labels.classList.remove("deemphasized");
  const defaults = [[122,340], [492,340], [335,90]];
  polygon.setAttribute("points", defaults.map((point) => point.join(",")).join(" "));
  defaults.forEach((point, index) => {
    vertices[index].setAttribute("cx", point[0]);
    vertices[index].setAttribute("cy", point[1]);
  });
  labels.replaceChildren();
  fields[0].focus();
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  formMessage.textContent = "";
  const values = getValues();
  const error = validate(values);
  if (error) {
    formMessage.textContent = error;
    return;
  }
  try {
    const solutions = solveTriangle(values);
    const givenKeys = Object.entries(values)
      .filter(([, value]) => value !== null)
      .map(([key]) => key);
    renderResults(solutions, 0, givenKeys);
    statusBadge.classList.add("solved");
    statusBadge.innerHTML = `<i></i> ${solutions.length > 1 ? "2 solutions found" : "Triangle solved"}`;
  } catch (solveError) {
    formMessage.textContent = solveError.message;
  }
});

fields.forEach((field) => field.addEventListener("input", () => {
  formMessage.textContent = "";
}));
clearButton.addEventListener("click", resetApp);
