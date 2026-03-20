/*
 * serialBridge.js
 *
 * Reads messages from the Arduino over USB serial and broadcasts them
 * to all connected frontend clients over WebSocket.
 * Also accepts commands from the frontend (STOP_FAN, START_FAN) and
 * forwards them to the Arduino over serial.
 *
 * WebSocket endpoint: ws://localhost:3002
 *
 * Messages Arduino → Frontend (JSON over WebSocket):
 *   { type: 'CONTAMINATION_DETECTED' }
 *   { type: 'FAN_STOPPED' }
 *   { type: 'DEMO_RESET' }
 *   { type: 'HEARTBEAT' }
 *   { type: 'ARDUINO_READY' }
 *   { type: 'ARDUINO_STATUS', connected: bool }
 *
 * Commands Frontend → Arduino (JSON over WebSocket):
 *   { command: 'STOP_FAN' }
 *   { command: 'START_FAN' }
 */

import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';
import { WebSocketServer } from 'ws';

const ARDUINO_PORT = process.env.ARDUINO_PORT || '/dev/cu.usbmodem21101';
const BAUD_RATE    = 9600;
const WS_PORT      = 3003;  // separate port so it doesn't clash with HTTP on 3002

let port   = null;
let parser = null;
let wss    = null;

// ── Broadcast a JSON message to all connected WebSocket clients ───────────────
function broadcast(obj) {
  if (!wss) return;
  const msg = JSON.stringify(obj);
  wss.clients.forEach(client => {
    if (client.readyState === 1) {  // OPEN
      client.send(msg);
    }
  });
}

// ── Send a raw string command to the Arduino ──────────────────────────────────
function sendToArduino(cmd) {
  if (!port || !port.isOpen) {
    console.warn('[SerialBridge] Cannot send — port not open:', cmd);
    return;
  }
  port.write(cmd + '\n', (err) => {
    if (err) console.error('[SerialBridge] Write error:', err.message);
    else console.log('[SerialBridge] → Arduino:', cmd);
  });
}

// ── Open serial port ──────────────────────────────────────────────────────────
function openSerial() {
  try {
    port = new SerialPort({ path: ARDUINO_PORT, baudRate: BAUD_RATE });
    parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

    port.on('open', () => {
      console.log(`[SerialBridge] Serial port open: ${ARDUINO_PORT}`);
      broadcast({ type: 'ARDUINO_STATUS', connected: true });
    });

    port.on('error', (err) => {
      console.error('[SerialBridge] Serial error:', err.message);
      broadcast({ type: 'ARDUINO_STATUS', connected: false });
      // Try to reconnect after 3 seconds
      setTimeout(openSerial, 3000);
    });

    port.on('close', () => {
      console.warn('[SerialBridge] Serial port closed. Reconnecting...');
      broadcast({ type: 'ARDUINO_STATUS', connected: false });
      setTimeout(openSerial, 3000);
    });

    parser.on('data', (line) => {
      const msg = line.trim();
      if (!msg) return;
      console.log('[SerialBridge] ← Arduino:', msg);

      // Map Arduino serial messages to WebSocket events
      const knownMessages = [
        'CONTAMINATION_DETECTED',
        'FAN_STOPPED',
        'DEMO_RESET',
        'HEARTBEAT',
        'ARDUINO_READY',
      ];

      if (knownMessages.includes(msg)) {
        broadcast({ type: msg });
      }
    });

  } catch (err) {
    console.error('[SerialBridge] Failed to open serial port:', err.message);
    console.warn('[SerialBridge] Demo tab will work without Arduino (manual mode).');
    broadcast({ type: 'ARDUINO_STATUS', connected: false });
  }
}

// ── Start WebSocket server ────────────────────────────────────────────────────
export function startSerialBridge() {
  wss = new WebSocketServer({ port: WS_PORT });

  wss.on('listening', () => {
    console.log(`[SerialBridge] WebSocket server listening on ws://localhost:${WS_PORT}`);
  });

  wss.on('connection', (ws) => {
    console.log('[SerialBridge] Frontend client connected');

    // Tell the new client whether Arduino is currently connected
    ws.send(JSON.stringify({
      type: 'ARDUINO_STATUS',
      connected: port ? port.isOpen : false,
    }));

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.command) {
          console.log('[SerialBridge] Command from frontend:', msg.command);
          sendToArduino(msg.command);
        }
      } catch {
        // ignore malformed messages
      }
    });

    ws.on('error', (err) => {
      console.warn('[SerialBridge] WS client error:', err.message);
    });
  });

  // Open serial after WebSocket server is ready
  openSerial();
}
