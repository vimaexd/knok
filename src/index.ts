import Express from 'express';
import Notifier from 'node-notifier';
import path from 'path';
import fs from 'fs';
import WebSocket from 'ws';

// Initialize Express & websocket
const wss = new WebSocket.Server({ port: 8069 });
const app = Express();

// Interfaces
interface WSMessage {
  op: number;
  d: {
    status?: number;
    msg?: string;
    sleepTime?: string;
  }
}

interface KnokData {
  status: number;
  sleepTime: string;
}

/*
  Opcodes
  1 - Status Update
  2 - Client Status Update
  3 - Notification

  Status codes
  1 = awake
  2 = busy
  3 = streaming
  4 = asleep
  5 = away
*/

let status = 1;
let sleepTime = "0:00";

const dataPath = path.join(__dirname, "data.json");

/**
 * Save status and sleep time to JSON file
 */
const save = () => {
  fs.writeFileSync(dataPath, JSON.stringify({
    status, sleepTime
  }));
}

/**
 * Load status and sleep time from JSON file in
 * case of loss of power or app shutdown
 */
const load = () => {
  const _data: Buffer = fs.readFileSync(dataPath);
  const data: KnokData = JSON.parse(_data.toString());

  status = data.status;
  sleepTime = data.sleepTime;
}

/**
 * A util function to send to all clients of a websocket
 * @param socket Websocket to sendall on
 */
const sendAll = (data: any) => {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

wss.on('connection', (ws) => {
  ws.on('message', (message: WSMessage) => {
    try {
      message = JSON.parse(message.toString())
    } catch {
      // Invalid message sent, so let's do nothing for now.
    }

    switch(message.op) {
      case 2: // Update status
        status = message.d.status;
        if(message.d.sleepTime) sleepTime = message.d.sleepTime;

        // Send new status to all clients
        sendAll(JSON.stringify(
          { op: 1, d: {status, sleepTime}}
        ));
        save();

        console.log(`[WS] status set to ${status}`);
        break;

      case 3: // Notification
        Notifier.notify({
          title: "Knock knock!",
          message: message.d.msg,
          icon: path.join(__dirname, 'wave.png')
        })
        console.log(`[WS] knock received with message ${message.d.msg}`)
        break;
    }
  });

  // Send current status when a new client connects
  ws.send(JSON.stringify({
    op: 1,
    d: {
      status, sleepTime
    }
  }));
});

// Serve views folder as static
app.use(Express.static("views"))

app.listen('8068', () => { console.log("[NET] up") })
wss.on('listening', () => { console.log("[WS] up") })
