import RFB from "/noVNC/core/rfb.js";

const params = new URLSearchParams(window.location.search);
const path = params.get("path");
const status = params.get("status");
const title = params.get("title");
const language = params.get("language");
const clientType = params.get("client");
const theme = params.get("theme") === "light" ? "light" : "dark";
const screen = document.getElementById("screen");
const loading = document.getElementById("loading");
const mobileTools = document.getElementById("mobile-tools");
const mobileActions = document.getElementById("mobile-actions");
const toolsToggle = document.getElementById("tools-toggle");
const selectionMode = document.getElementById("selection-mode");
const zoomOut = document.getElementById("zoom-out");
const zoomIn = document.getElementById("zoom-in");
const clipboardPaste = document.getElementById("clipboard-paste");
const keyboardToggle = document.getElementById("keyboard-toggle");
const keyboardInput = document.getElementById("keyboard-input");
const KEYBOARD_HEIGHT_THRESHOLD = 150;
let zoomLevel = null;
let minimumZoom = null;
let controlsExpanded = false;
let edgeScrollDistance = { x: 0, y: 0 };
let screenHeight = window.innerHeight;
let longPressHandled = false;
if (!path) {
    throw new Error("Falta la ruta de conexión VNC");
}

if (title) {
    document.title = title;
}

if (language) {
    document.documentElement.lang = language;
}
document.documentElement.dataset.theme = theme;

const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
const url = new URL(path, `${protocol}//${window.location.host}`);
const rfb = new RFB(screen, url.href);

rfb.resizeSession = true;
rfb.scaleViewport = true;
rfb.showDotCursor = clientType === "mobile";

if (status) {
    const statusEvents = new EventSource(new URL(status, `${window.location.protocol}//${window.location.host}`));
    statusEvents.onmessage = ({ data }) => { loading.hidden = !JSON.parse(data).loading; };
    screen.addEventListener("pointerdown", () => {
        const interaction = new URL(status, `${window.location.protocol}//${window.location.host}`);
        interaction.pathname = interaction.pathname.replace("/status", "/interaction");
        void fetch(interaction, { method: "POST", keepalive: true }).catch(() => {});
    });
}

syncViewport();
window.visualViewport?.addEventListener("resize", syncViewport);
window.visualViewport?.addEventListener("scroll", syncViewport);

rfb.addEventListener("clipboard", ({ detail: { text } }) => void navigator.clipboard?.writeText(text).catch(() => {}));

if (clientType === "mobile") {
    mobileTools.hidden = false;
    enableEdgeScroll({ rfb });
    enableTextSelection({ rfb });
    setInteractionMode({ rfb, dragViewport: true });
    toolsToggle.addEventListener("click", toggleControls);
    selectionMode.addEventListener("click", () => setInteractionMode({ rfb, dragViewport: !rfb.dragViewport }));
    zoomOut.addEventListener("click", () => changeZoom({ rfb, delta: -0.25 }));
    zoomIn.addEventListener("click", () => changeZoom({ rfb, delta: 0.25 }));
    keyboardToggle.addEventListener("click", () => keyboardInput.focus());
    clipboardPaste.addEventListener("click", () => pasteClipboard({ rfb }));
    keyboardInput.addEventListener("beforeinput", (event) => {
        const keysym = getInputKeysym(event);
        if (keysym === null) {
            return;
        }

        event.preventDefault();
        sendKeysym({ rfb, keysym });
    });
    keyboardInput.addEventListener("keydown", (event) => {
        const keysym = KEY_SYMS[event.key];
        if (keysym === undefined) {
            return;
        }

        event.preventDefault();
        sendKeysym({ rfb, keysym, code: event.code });
    });
    keyboardInput.addEventListener("input", () => { keyboardInput.value = ""; });
}

function enableTextSelection({ rfb }) {
    rfb._canvas.addEventListener("gesturestart", (event) => {
        if (event.detail.type !== "longpress") {
            return;
        }

        longPressHandled = true;
        event.stopImmediatePropagation();
        selectTextAt({ rfb, clientX: event.detail.clientX, clientY: event.detail.clientY });
    }, true);
    rfb._canvas.addEventListener("gestureend", (event) => {
        if (!longPressHandled || event.detail.type !== "longpress") {
            return;
        }

        longPressHandled = false;
        event.stopImmediatePropagation();
    }, true);
}

function selectTextAt({ rfb, clientX, clientY }) {
    const bounds = rfb._canvas.getBoundingClientRect();
    const x = Math.min(Math.max(clientX - bounds.left, 0), bounds.width - 1);
    const y = Math.min(Math.max(clientY - bounds.top, 0), bounds.height - 1);
    rfb._handleMouseMove(x, y);
    for (let click = 0; click < 3; click += 1) {
        rfb._handleMouseButton(x, y, 0x1);
        rfb._handleMouseButton(x, y, 0);
    }
}

function toggleControls() {
    controlsExpanded = !controlsExpanded;
    mobileActions.hidden = !controlsExpanded;
    toolsToggle.textContent = controlsExpanded ? "›" : "‹";
    toolsToggle.setAttribute("aria-label", controlsExpanded ? "Ocultar controles" : "Mostrar controles");
}

function syncViewport() {
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    if (viewportHeight >= screenHeight - KEYBOARD_HEIGHT_THRESHOLD) {
        screenHeight = window.innerHeight;
        screen.style.height = `${screenHeight}px`;
    }

    if (zoomLevel !== null) {
        updateZoomViewport({ rfb });
    }
}

async function pasteClipboard({ rfb }) {
    const text = await navigator.clipboard?.readText().catch(() => "");
    if (text) {
        rfb.clipboardPasteFrom(text);
    }
}

function setInteractionMode({ rfb, dragViewport }) {
    rfb.dragViewport = dragViewport;
    edgeScrollDistance = { x: 0, y: 0 };
    selectionMode.setAttribute("aria-pressed", String(!dragViewport));
    if (!dragViewport) {
        rfb.focus();
    }
}

function enableEdgeScroll({ rfb }) {
    const viewportChangePos = rfb._display.viewportChangePos.bind(rfb._display);
    rfb._display.viewportChangePos = (deltaX, deltaY) => {
        const { x, y } = rfb._display._viewportLoc;
        viewportChangePos(deltaX, deltaY);
        const movedX = rfb._display._viewportLoc.x - x;
        const movedY = rfb._display._viewportLoc.y - y;
        if (!rfb.dragViewport || (movedX === deltaX && movedY === deltaY)) {
            return;
        }

        edgeScrollDistance.x += deltaX - movedX;
        edgeScrollDistance.y += deltaY - movedY;
        scrollAtViewportEdge({ rfb, axis: "x" });
        scrollAtViewportEdge({ rfb, axis: "y" });
    };
}

function scrollAtViewportEdge({ rfb, axis }) {
    while (Math.abs(edgeScrollDistance[axis]) >= 40) {
        const { x, y } = rfb._viewportDragPos;
        const distance = edgeScrollDistance[axis];
        const button = distance > 0 ? 0x10 : 0x8;
        if (axis === "x") {
            rfb.sendKey(0xffe1, "ShiftLeft", true);
        }

        rfb._handleMouseButton(x, y, button);
        rfb._handleMouseButton(x, y, 0);
        if (axis === "x") {
            rfb.sendKey(0xffe1, "ShiftLeft", false);
        }

        edgeScrollDistance[axis] += distance > 0 ? -40 : 40;
    }
}

function changeZoom({ rfb, delta }) {
    const scale = zoomLevel ?? rfb._display.scale;
    minimumZoom ??= scale;
    zoomLevel = Math.min(2, Math.max(minimumZoom, scale + delta));
    if (zoomLevel === minimumZoom) {
        zoomLevel = null;
        minimumZoom = null;
        rfb.clipViewport = false;
        rfb.scaleViewport = true;
        setInteractionMode({ rfb, dragViewport: true });
        return;
    }

    rfb.scaleViewport = false;
    rfb.clipViewport = true;
    updateZoomViewport({ rfb });
    setInteractionMode({ rfb, dragViewport: true });
}

function updateZoomViewport({ rfb }) {
    const { width, height } = screen.getBoundingClientRect();
    rfb._display.viewportChangeSize(width / zoomLevel, height / zoomLevel);
    rfb._display.scale = zoomLevel;
}

function getInputKeysym({ data, inputType }) {
    if (inputType === "deleteContentBackward") {
        return KEY_SYMS.Backspace;
    }

    if (inputType === "insertLineBreak") {
        return KEY_SYMS.Enter;
    }

    if (!data) {
        return null;
    }

    return [...data].map((character) => character.codePointAt(0));
}

function sendKeysym({ rfb, keysym, code = "Unidentified" }) {
    if (Array.isArray(keysym)) {
        keysym.forEach((key) => rfb.sendKey(key, code));
        return;
    }

    rfb.sendKey(keysym, code);
}

const KEY_SYMS = Object.freeze({
    Backspace: 0xff08,
    Tab: 0xff09,
    Enter: 0xff0d,
    Escape: 0xff1b,
    ArrowLeft: 0xff51,
    ArrowUp: 0xff52,
    ArrowRight: 0xff53,
    ArrowDown: 0xff54
});
