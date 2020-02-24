import Fastify from "fastify"
import FastifyNextJSPlugin from "fastify-nextjs";
import FastifyWSPlugin from "fastify-ws";
import { RTCPeerConnection } from "wrtc";

const fastify = Fastify({ logger: true })
  .register(FastifyNextJSPlugin)
  .register(FastifyWSPlugin)
  .after(setupRoutes);


const dataChannelOptions = {
  ordered: false,
  maxRetransmits: 0
};

function sendIceCandidateMessage(ws, candidate) {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify({ type: "icecandidate", candidate }));
  }
}

function sendServerSessionDescriptionMessage(ws, serverSessionDescription) {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify({ type: "serverSessionDescription", serverSessionDescription }));
  }
}

function sendErrorMessage(ws, error) {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify({ type: "error", message: error.message }));
  }
}

async function handleIceCandidate(ws, peerConnection, candidate) {
  try {
    // Not sure why wrtc doesn't handle this like the browser.
    if (!candidate.candidate) {
      return;
    }

    await peerConnection.addIceCandidate(candidate)
  } catch (error) {
    fastify.log.error(error);
    sendErrorMessage(ws, error);
  }
}

async function handleClientSessionDescription(ws, peerConnection, clientSessionDescription) {
  try {
    await peerConnection.setRemoteDescription(clientSessionDescription);
    const serverSessionDescription = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(serverSessionDescription);
    sendServerSessionDescriptionMessage(ws, serverSessionDescription);
  } catch (error) {
    fastify.log.error(error);
    sendErrorMessage(ws, error);
  }
}

function setupRoutes() {
  fastify.next("/");

  fastify.ws.on("connection", (ws, _request) => {
    fastify.log.info("Client connected.");

    const peerConnection = new RTCPeerConnection();

    // Send icecandidates as they are discovered
    peerConnection.addEventListener("icecandidate", event => {
      if (event.candidate) {
        sendIceCandidateMessage(ws, event.candidate);
      }
    });

    peerConnection.addEventListener("datachannel", (event) => {
      const dataChannel = event.channel;

      dataChannel.addEventListener("message", (event) => {
        fastify.log.info(`Received DataChannel message: "${event.data}"`);
        dataChannel.send(event.data);
      });
    });

    ws.on("message", data => {
      try {
        const message = JSON.parse(data);

        switch (message.type) {
          case "icecandidate":
            handleIceCandidate(ws, peerConnection, message.candidate);
            break;
          case "clientSessionDescription":
            handleClientSessionDescription(ws, peerConnection, message.clientSessionDescription);
            break;
          default:
            fastify.log.info(`Received message with unknown type: "${message.type}"`);
            break;
        }
      } catch (error) {
        sendErrorMessage(ws, error);
      }
    });

    ws.on("close", () => {
      fastify.log.info("Client disconnected.");
      peerConnection.close();
    });
  });
}

const start = async () => {
  try {
    await fastify.listen(3000);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();