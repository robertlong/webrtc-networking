export default function connect() {
  const host = location.origin.replace(/^http/, 'ws');

  const ws = new WebSocket(host);

  const peerConnection = new RTCPeerConnection();

  peerConnection.addEventListener("datachannel", event => {
    const dataChannel = event.channel;

    dataChannel.send("Hello World!");

    dataChannel.addEventListener("message", event => {
      console.log(`Received DataChannel message: ${event.data}`);
    });
  });

  peerConnection.addEventListener("icecandidate", event => {
    if (event.candidate) {
      ws.send(JSON.stringify({ type: "icecandidate", candidate: event.candidate }));
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
      await peerConnection.setRemoteDescription(serverSessionDescription);
      const clientSessionDescription = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(clientSessionDescription);
      ws.send(JSON.stringify({ type: "clientSessionDescription", clientSessionDescription }));
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
        handleServerSessionDescription(message.serverSessionDescription)
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
}