import Fastify from "fastify"
import FastifyNextJSPlugin from "fastify-nextjs";
import FastifyWSPlugin from "fastify-ws";
import { RTCPeerConnection } from "wrtc";

const fastify = Fastify({ logger: true })
  .register(FastifyNextJSPlugin)
  .register(FastifyWSPlugin)
  .after(setupRoutes);

function sendErrorMessage(ws, error) {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify({ type: "error", message: error.message }));
  }
}

async function onConnect(ws, request) {
  try {
    fastify.log.info("Client connected.");

    const peerConnection = new RTCPeerConnection();

    // Create unreliable DataChannel (UDP-like)
    const dataChannel = peerConnection.createDataChannel("peerConnection", { ordered: false, maxRetransmits: 0 });

    // Send icecandidates as they are discovered
    peerConnection.addEventListener("icecandidate", event => {
      if (event.candidate) {
        ws.send(JSON.stringify({ type: "icecandidate", candidate: event.candidate }));
      }
    });

    peerConnection.addEventListener("track", (event) => {
      console.log("track added", event.track);
    });

    dataChannel.addEventListener("open", () => {
      fastify.log.info("DataChannel open.");
    });

    dataChannel.addEventListener("message", (event) => {
      fastify.log.info(`Received DataChannel message: "${event.data}"`);
      dataChannel.send(event.data);
    });

    const pendingIceCandidates = [];

    async function handleIceCandidate(candidate) {
      try {
        // Not sure why wrtc doesn't handle this like the browser.
        if (!candidate.candidate) {
          return;
        }

        if (!peerConnection.remoteDescription) {
          pendingIceCandidates.push(pendingIceCandidates);
        } else {
          await peerConnection.addIceCandidate(candidate)
        }
      } catch (error) {
        fastify.log.error(error);
        sendErrorMessage(ws, error);
      }
    }

    async function handleClientSessionDescription(clientSessionDescription) {
      try {
        if (clientSessionDescription.type === "offer" && peerConnection.signalingState !== "stable") {
          await Promise.all([
            peerConnection.setLocalDescription({ type: "rollback" }),
            peerConnection.setRemoteDescription(clientSessionDescription)
          ]);
        } else {
          await peerConnection.setRemoteDescription(clientSessionDescription);
        }
  
        if (clientSessionDescription.type == "offer") {
          const serverSessionDescription = await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(serverSessionDescription);
          ws.send(JSON.stringify({ type: "serverSessionDescription", serverSessionDescription }));
        }

        for (const pendingIceCandidate of pendingIceCandidates) {
          await peerConnection.addIceCandidate(pendingIceCandidate);
        }
      } catch (error) {
        fastify.log.error(error);
        sendErrorMessage(ws, error);
      }
    }

    ws.on("message", data => {
      try {
        const message = JSON.parse(data);

        switch (message.type) {
          case "icecandidate":
            handleIceCandidate(message.candidate);
            break;
          case "clientSessionDescription":
            handleClientSessionDescription(message.clientSessionDescription);
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

    peerConnection.addEventListener("negotiationneeded", async () => {
      try {
        const serverSessionDescription = await peerConnection.createOffer();

        if (peerConnection.signalingState !== "stable") {
          return;
        }

        await peerConnection.setLocalDescription(serverSessionDescription);
        ws.send(JSON.stringify({ type: "serverSessionDescription", serverSessionDescription }));
      } catch (error) {
        fastify.log.error(error);
        sendErrorMessage(ws, error);
      }
    });

  } catch (error) {
    fastify.log.error(error);

    if (ws) {
      ws.close();
    }
  }
}

function setupRoutes() {
  fastify.next("/");
  fastify.ws.on("connection", onConnect);
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