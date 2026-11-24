"use strict";

const velocityColor = "#7dd9f3";
const inwardColor = "#ffa985";
const fullTurn = 2 * Math.PI;
const startAngle = Math.PI / 5;

function drawArrow(context, start, end, color) {
  const direction = Math.atan2(end.y - start.y, end.x - start.x);
  context.strokeStyle = color;
  context.lineWidth = 3.5;
  context.beginPath();
  context.moveTo(start.x, start.y);
  context.lineTo(end.x, end.y);
  context.stroke();

  context.fillStyle = color;
  context.beginPath();
  context.moveTo(end.x, end.y);
  context.lineTo(end.x - 13 * Math.cos(direction - 0.42), end.y - 13 * Math.sin(direction - 0.42));
  context.lineTo(end.x - 13 * Math.cos(direction + 0.42), end.y - 13 * Math.sin(direction + 0.42));
  context.closePath();
  context.fill();
}

function drawOrbit(canvas, radius, angle, velocityLength, inwardLength) {
  const context = canvas.getContext("2d");
  const width = canvas.width / 2;
  const height = canvas.height / 2;
  const center = { x: width / 2, y: height / 2 };
  const radial = { x: Math.cos(angle), y: -Math.sin(angle) };
  const tangent = { x: radial.y, y: -radial.x };
  const object = { x: center.x + radius * radial.x, y: center.y + radius * radial.y };
  const velocityTip = { x: object.x + velocityLength * tangent.x, y: object.y + velocityLength * tangent.y };
  const inwardTip = { x: object.x - inwardLength * radial.x, y: object.y - inwardLength * radial.y };

  context.setTransform(2, 0, 0, 2, 0, 0);
  context.clearRect(0, 0, width, height);
  context.lineWidth = 1.5;
  context.strokeStyle = "#81a0b5";
  context.beginPath();
  context.arc(center.x, center.y, radius, 0, fullTurn);
  context.stroke();

  context.strokeStyle = "#7191a6";
  context.setLineDash([6, 6]);
  context.beginPath();
  context.moveTo(center.x, center.y);
  context.lineTo(object.x, object.y);
  context.stroke();
  context.setLineDash([]);

  context.fillStyle = "#b1c4d1";
  context.beginPath();
  context.arc(center.x, center.y, 3.2, 0, fullTurn);
  context.fill();
  context.font = "italic 14pt Cambria Math, serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("O", center.x - 14, center.y + 14);

  drawArrow(context, object, velocityTip, velocityColor);
  drawArrow(context, object, inwardTip, inwardColor);
  context.font = "italic 24pt Cambria Math, serif";
  context.fillStyle = velocityColor;
  context.fillText("v", velocityTip.x + 16 * radial.x + 9 * tangent.x,
    velocityTip.y + 16 * radial.y + 9 * tangent.y);
  context.fillStyle = inwardColor;
  context.fillText("a", (object.x + inwardTip.x) / 2 - 24 * tangent.x,
    (object.y + inwardTip.y) / 2 - 24 * tangent.y);

  context.fillStyle = "#f7f5ee";
  context.beginPath();
  context.arc(object.x, object.y, 7, 0, fullTurn);
  context.fill();
}

const sim = document.querySelector("#orbit-simulation");
const canvas = sim.querySelector("#orbit");
const radiusInput = sim.querySelector("#radius");
const rateInput = sim.querySelector("#rate");
const massInput = sim.querySelector("#mass");
const rateLabel = sim.querySelector("#rate-label");
const modeInputs = sim.querySelectorAll('input[name="fixed-rate"]');
const play = sim.querySelector("#play-orbit");
let angle = startAngle;
let frame = null;
let previousTime = null;
let model;

function readModel() {
  const radius = radiusInput.valueAsNumber;
  const rate = rateInput.valueAsNumber;
  const mass = massInput.valueAsNumber;
  const fixedAngularSpeed = modeInputs[1].checked;
  const speed = fixedAngularSpeed ? radius * rate : rate;
  const omega = fixedAngularSpeed ? rate : rate / radius;
  const acceleration = speed ** 2 / radius;
  return { radius, rate, mass, fixedAngularSpeed, speed, omega, acceleration, force: mass * acceleration };
}

function render() {
  drawOrbit(canvas, 83 * model.radius, angle,
    51 + 5 * model.speed, 20 + 2.8 * Math.sqrt(model.acceleration));
}

function updateReadout(id, value) {
  sim.querySelector("#" + id).value = value;
}

function updateModel() {
  model = readModel();
  rateLabel.innerHTML = model.fixedAngularSpeed ? "角速率 <i>ω</i>" : "線速率 <i>v</i>";
  const rateUnit = model.fixedAngularSpeed ? "rad s⁻¹" : "m s⁻¹";
  const controls = [
    [radiusInput, model.radius, "m"],
    [rateInput, model.rate, rateUnit],
    [massInput, model.mass, "kg"],
  ];
  for (const [input, value, unit] of controls) {
    const readout = value.toFixed(1) + " " + unit;
    updateReadout(input.id + "-value", readout);
    input.setAttribute("aria-valuetext", readout);
  }
  updateReadout("speed", model.speed.toFixed(2));
  updateReadout("omega", model.omega.toFixed(2));
  updateReadout("acceleration", model.acceleration.toFixed(2));
  updateReadout("net-force", model.force.toFixed(2));
  render();
}

function pause() {
  if (frame !== null) cancelAnimationFrame(frame);
  frame = null;
  previousTime = null;
  play.textContent = "播放";
}

function advance(time) {
  if (previousTime !== null) {
    const elapsed = Math.min((time - previousTime) / 1000, 0.1);
    angle = (angle + elapsed * model.omega / 4) % fullTurn;
    render();
  }
  previousTime = time;
  frame = requestAnimationFrame(advance);
}

play.addEventListener("click", () => {
  if (frame !== null) {
    pause();
    return;
  }
  play.textContent = "暫停";
  frame = requestAnimationFrame(advance);
});

sim.querySelector("#step-orbit").addEventListener("click", () => {
  pause();
  angle = (angle + model.omega * 0.1) % fullTurn;
  render();
});

sim.querySelector("#reset-orbit").addEventListener("click", () => {
  pause();
  angle = startAngle;
  modeInputs[0].checked = true;
  radiusInput.value = radiusInput.defaultValue;
  rateInput.value = rateInput.defaultValue;
  massInput.value = massInput.defaultValue;
  updateModel();
});

for (const input of [radiusInput, rateInput, massInput]) {
  input.addEventListener("input", updateModel);
}

for (const input of modeInputs) {
  input.addEventListener("change", () => {
    pause();
    radiusInput.value = radiusInput.defaultValue;
    rateInput.value = rateInput.defaultValue;
    updateModel();
  });
}

const sourcesSlide = document.getElementById("force-sources");
const sourceView = document.getElementById("source-view");
function showTextbookFigures(show) {
  sourcesSlide.classList.toggle("show-originals", show);
  sourceView.setAttribute("aria-pressed", String(show));
  sourceView.textContent = show ? "返回動畫" : "查看原教材圖";
}
sourceView.addEventListener("click", () => showTextbookFigures(!sourcesSlide.classList.contains("show-originals")));
updateModel();

Reveal.initialize({
  width: 1440,
  height: 810,
  margin: 0,
  controls: true,
  progress: true,
  slideNumber: "c/t",
  hash: true,
  transition: "none",
  center: false,
  keyboardCondition: (event) => !event.target?.closest?.("input, button, video"),
  plugins: [RevealNotes],
});

Reveal.on("slidechanged", ({ previousSlide }) => {
  if (previousSlide === sim) pause();
  if (previousSlide === sourcesSlide) showTextbookFigures(false);
  previousSlide?.querySelector("video")?.pause();
});
