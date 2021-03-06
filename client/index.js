export default function connect() {
  const host = location.origin.replace(/^http/, 'ws');

  const ws = new WebSocket(host);

  const peerConnection = new RTCPeerConnection();

  let onMessageCallback;
  let dataChannel;
  let onVideoStreamCallback;

  peerConnection.addEventListener("datachannel", event => {
    dataChannel = event.channel;

    dataChannel.addEventListener("message", event => {
      if (onMessageCallback) {
        onMessageCallback(event.data);
      }
    });
  });

  peerConnection.addEventListener("track", (event) => {
    onVideoStreamCallback(new MediaStream([event.track]));
  });

  peerConnection.addEventListener("icecandidate", event => {
    if (event.candidate) {
      ws.send(JSON.stringify({ type: "icecandidate", candidate: event.candidate }));
    }
  });

  peerConnection.addEventListener("negotiationneeded", async event => {
    try {
      const clientSessionDescription = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(clientSessionDescription);
      ws.send(JSON.stringify({ type: "clientSessionDescription", clientSessionDescription }));
    } catch (error) {
      console.error(`Error renegotiating connection: ${error}`);
    }
  });

  async function handleIceCandidate(candidate) {
    try {
      await peerConnection.addIceCandidate(candidate);  
    } catch (error) {
      console.error(`Error adding ICE candidate: ${error}`);
    }
  }

  async function handleServerSessionDescription(serverSessionDescription) {
    try {
      if (serverSessionDescription.type === "offer" && peerConnection.signalingState !== "stable") {
        await Promise.all([
          peerConnection.setLocalDescription({ type: "rollback" }),
          peerConnection.setRemoteDescription(serverSessionDescription)
        ]);
      } else {
        await peerConnection.setRemoteDescription(serverSessionDescription);
      }

      if (serverSessionDescription.type == "offer") {
        const clientSessionDescription = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(clientSessionDescription);
        ws.send(JSON.stringify({ type: "clientSessionDescription", clientSessionDescription }));
      }
    } catch (error) {
      console.error(`Error negotiating PeerConnection ${error}`);
    }
  }

  ws.addEventListener("message", event => {
    const message = JSON.parse(event.data);

    switch(message.type) {
      case "icecandidate":
        handleIceCandidate(message.candidate);
        break;
      case "serverSessionDescription":
        handleServerSessionDescription(message.serverSessionDescription);
        break;
      default:
        console.log(`Received unknown message type: "${message.type}"`);
        break;
    }
  });

  ws.addEventListener("close", () => {
    console.log("WebSocket closed.")
    peerConnection.close();
  });

  return {
    sendMessage: (message) => {
      if (dataChannel && dataChannel.readyState === "open") {
        dataChannel.send(message);
      }
    },
    onMessage: (callback) => {
      onMessageCallback = callback;
    },
    addTrack: (track, ...streams) => {
      return peerConnection.addTrack(track, ...streams);
    },
    removeTrack: (trackRtpSender) => {
      peerConnection.removeTrack(trackRtpSender);
    },
    onVideoStream: (callback) => {
      onVideoStreamCallback = callback;
    },
    close: () => {
      ws.close();
    }
  };
}