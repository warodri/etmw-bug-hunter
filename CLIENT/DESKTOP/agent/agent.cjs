#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const WebSocket = require('ws');
const { walkProject } = require('./dist/services/scanner/file-walker');
const { analyseContent } = require('./dist/services/scanner/file-analyzer');
const { meetsSeverity } = require('./dist/constants/severity');

const CONFIG_PATH = path.join(__dirname, 'config.json');
const FINDINGS_BATCH = 50;
const PROGRESS_EVERY = 25;
const HEARTBEAT_MS = 25_000;
const POLL_INTERVAL_MS = 2_000;

const config = readConfig();
const jobs = [];
let running = false;
let activeStop = false;
let socket = null;
let heartbeat = null;
let transport = 'ws';
let httpLoopStarted = false;
let outbox = [];
let outboxDraining = false;

function readConfig() {
  let raw;

  try {
    raw = fs.readFileSync(CONFIG_PATH, 'utf8');
  } catch {
    fail(`Missing ${CONFIG_PATH}. Download the agent again from the Bug Hunter dashboard.`);
  }

  let parsed;

  try {
    parsed = JSON.parse(raw);
  } catch {
    fail('config.json is not valid JSON. Download the agent again.');
  }

  if (!parsed.serverUrl || !parsed.apiUrl || !parsed.agentId || !parsed.token) {
    fail('config.json is incomplete. Download the agent again.');
  }

  return parsed;
}

function fail(message) {
  console.error(`[agent] ${message}`);
  process.exit(1);
}

function log(message, extra) {
  const suffix = extra ? ` ${JSON.stringify(extra)}` : '';
  console.log(`[agent ${new Date().toISOString()}] ${message}${suffix}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${config.token}`,
    'X-Agent-Id': config.agentId
  };
}

function send(payload) {
  if (transport === 'ws' && socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
    return;
  }

  if (transport === 'http') {
    outbox.push(payload);
    void drainOutbox();
  }
}

async function drainOutbox() {
  if (outboxDraining || transport !== 'http') return;

  outboxDraining = true;

  try {
    while (outbox.length > 0 && transport === 'http') {
      const payload = outbox[0];

      try {
        const response = await fetch(`${config.apiUrl}/agent/report`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        outbox.shift();
      } catch (error) {
        log('report failed; retrying', {
          message: error instanceof Error ? error.message : String(error)
        });
        await sleep(2_000);
      }
    }
  } finally {
    outboxDraining = false;
  }
}

function handleIncoming(message) {
  if (!message || typeof message.type !== 'string') return;

  if (message.type === 'hello') {
    log('paired', { agentId: message.agentId });
    return;
  }

  if (message.type === 'scan.start') {
    log('scan requested', { project: message.projectName, scanId: message.scanId });
    jobs.push(message);
    void runQueue();
    return;
  }

  if (message.type === 'scan.stop') {
    const queuedIndex = jobs.findIndex((job) => job.scanId === message.scanId);

    if (queuedIndex >= 0) {
      jobs.splice(queuedIndex, 1);
      send({ type: 'scan.stopped', scanId: message.scanId });
      return;
    }

    if (running) activeStop = true;
  }
}

function connect() {
  const ws = new WebSocket(config.serverUrl, {
    headers: {
      Authorization: `Bearer ${config.token}`,
      'X-Agent-Id': config.agentId
    },
    handshakeTimeout: 10_000
  });

  socket = ws;
  transport = 'ws';

  ws.on('open', () => {
    log('connected over WebSocket', {
      server: config.serverUrl,
      agent: config.agentName ?? config.agentId
    });

    if (heartbeat) clearInterval(heartbeat);
    heartbeat = setInterval(() => send({ type: 'heartbeat' }), HEARTBEAT_MS);
    heartbeat.unref?.();
  });

  ws.on('message', (data) => {
    let message;

    try {
      message = JSON.parse(data.toString());
    } catch {
      return;
    }

    handleIncoming(message);
  });

  ws.on('unexpected-response', (_request, response) => {
    log('WebSocket rejected; switching to HTTPS polling', { status: response.statusCode });
    response.resume();
    startHttpMode();
  });

  ws.on('error', (error) => {
    if (transport === 'ws') {
      log('WebSocket unavailable; switching to HTTPS polling', { message: error.message });
      startHttpMode();
    }
  });

  ws.on('close', () => {
    if (transport === 'ws') {
      log('WebSocket closed; switching to HTTPS polling');
      startHttpMode();
    }
  });
}

function startHttpMode() {
  if (transport === 'http') return;

  transport = 'http';

  if (heartbeat) {
    clearInterval(heartbeat);
    heartbeat = null;
  }

  if (socket) {
    const dying = socket;
    socket = null;

    try {
      dying.removeAllListeners();
      // `terminate()` on a socket that never finished its handshake emits an error; keep a
      // listener so the fallback does not crash the process.
      dying.on('error', () => {});
      dying.terminate();
    } catch {
      // Already gone.
    }
  }

  log('using HTTPS polling fallback', { api: config.apiUrl });

  if (!httpLoopStarted) {
    httpLoopStarted = true;
    void pollLoop();
  }
}

async function pollLoop() {
  while (transport === 'http') {
    try {
      const response = await fetch(`${config.apiUrl}/agent/poll`, {
        method: 'POST',
        headers: authHeaders(),
        body: '{}'
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();

      for (const job of data.jobs ?? []) {
        handleIncoming(job);
      }
    } catch (error) {
      log('poll failed; retrying', {
        message: error instanceof Error ? error.message : String(error)
      });
      await sleep(POLL_INTERVAL_MS);
    }

    await sleep(POLL_INTERVAL_MS);
  }
}

async function runQueue() {
  if (running) return;

  running = true;

  try {
    while (jobs.length > 0) {
      const job = jobs.shift();
      if (!job) break;

      activeStop = false;

      try {
        await runScan(job);
      } catch (error) {
        send({
          type: 'scan.error',
          scanId: job.scanId,
          message: error instanceof Error ? error.message : 'The desktop agent failed.'
        });
      }
    }
  } finally {
    running = false;
  }
}

async function runScan(job) {
  const info = await fs.promises.stat(job.path).catch(() => null);

  if (!info || !info.isDirectory()) {
    send({
      type: 'scan.error',
      scanId: job.scanId,
      message: `No folder exists at ${job.path} on this computer.`
    });
    return;
  }

  const walk = await walkProject(job.path, {
    ignoreList: Array.isArray(job.ignoreGlobs) ? job.ignoreGlobs : [],
    maxFileBytes: Number(job.maxFileBytes) || 512 * 1024,
    maxFiles: Number(job.maxFiles) || 20_000
  });

  let filesScanned = 0;
  let pending = [];

  const flush = () => {
    if (pending.length === 0) return;

    send({ type: 'scan.findings', scanId: job.scanId, findings: pending });
    pending = [];
  };

  send({
    type: 'scan.progress',
    scanId: job.scanId,
    cursor: 0,
    totalFiles: walk.files.length,
    filesScanned: 0,
    filesSkipped: walk.skipped
  });

  for (let index = 0; index < walk.files.length; index += 1) {
    if (activeStop) {
      flush();
      send({
        type: 'scan.stopped',
        scanId: job.scanId,
        cursor: index,
        totalFiles: walk.files.length,
        filesScanned,
        filesSkipped: walk.skipped
      });
      log('scan stopped', { scanId: job.scanId, filesScanned });
      return;
    }

    const file = walk.files[index];

    let content;

    try {
      content = await fs.promises.readFile(file.absolutePath, 'utf8');
    } catch {
      continue;
    }

    if (content.includes('\u0000')) continue;

    const detections = analyseContent(file, content).filter((detection) =>
      meetsSeverity(detection.severity, job.minSeverity ?? 'info')
    );

    for (const detection of detections) {
      pending.push({
        filePath: file.relativePath,
        line: detection.line,
        column: detection.column,
        detectorId: detection.detectorId,
        rule: detection.rule,
        category: detection.category,
        severity: detection.severity,
        message: detection.message,
        snippet: detection.snippet,
        aiGenerated: false
      });
    }

    filesScanned += 1;

    if (pending.length >= FINDINGS_BATCH) flush();

    if ((index + 1) % PROGRESS_EVERY === 0) {
      send({
        type: 'scan.progress',
        scanId: job.scanId,
        cursor: index + 1,
        totalFiles: walk.files.length,
        filesScanned,
        filesSkipped: walk.skipped
      });
    }
  }

  flush();

  send({
    type: 'scan.done',
    scanId: job.scanId,
    cursor: walk.files.length,
    totalFiles: walk.files.length,
    filesScanned,
    filesSkipped: walk.skipped,
    truncated: walk.truncated
  });

  log('scan done', { scanId: job.scanId, filesScanned, files: walk.files.length });
}

const major = Number.parseInt(process.versions.node.split('.')[0], 10);

if (!Number.isFinite(major) || major < 20) {
  fail(`Node.js 20 or newer is required (found ${process.versions.node}).`);
}

log('starting', { node: process.versions.node, platform: process.platform });
connect();
