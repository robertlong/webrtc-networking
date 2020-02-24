function AsyncBarrier() {
  const barrier = {};

  barrier.ready = new Promise((resolve, reject) => {
    barrier.resolve = resolve;
    barrier.reject = reject;
  });

  return barrier;
}

function waitForEvent(eventEmitter, successEvent, errorEvent = "error") {
  return new Promise((resolve, reject) => {
    let cleanup;

    const onSuccess = (event) => {
      cleanup();
      resolve(event);
    };

    const onError = (event) => {
      cleanup();
      reject(new Error(event));
    };

    cleanup = () => {
      eventEmitter.removeEventListener(successEvent, onSuccess);
      eventEmitter.removeEventListener(errorEvent, onError);
    };

    eventEmitter.addEventListener(successEvent, onSuccess);
    eventEmitter.addEventListener(errorEvent, onError);
  });
}

export default class Client {
  constructor() {
    this.ws = null;
    this.peerConnection = null;
    this.dataChannel = null;
    this.serverSessionDescriptionBarrier = new AsyncBarrier();
    this.pendingIceCandidates = [];
  }

  async connect() {
    const host = location.origin.replace(/^http/, 'ws');

    const ws = this.ws = new WebSocket(host);
    ws.addEventListener("message", this.onWebsocketMessage);

    const peerConnection = this.peerConnection = new RTCPeerConnection();

    // Create unreliable DataChannel (UDP-like)
    const dataChannel = this.dataChannel = peerConnection.createDataChannel("peerConnection", { ordered: false, maxRetransmits: 0 });

    // Wait to be connected to the signaling server
    await waitForEvent(ws, "open");
    
    // Send icecandidates as they are discovered
    peerConnection.addEventListener("icecandidate", event => {
      if (event.candidate) {
        ws.send(JSON.stringify({ type: "icecandidate", candidate: event.candidate }));
      }
    });

    // Negotiate session with server
    const clientSessionDescription = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(clientSessionDescription);
    ws.send(JSON.stringify({ type: "clientSessionDescription", clientSessionDescription }));
    const serverSessionDescription = await this.serverSessionDescriptionBarrier.ready;
    await peerConnection.setRemoteDescription(serverSessionDescription);

    // Add icecandidates that came in before the remoteDescription was set.
    for (const pendingCandidate of this.pendingIceCandidates) {
      await this.peerConnection.addIceCandidate(pendingCandidate);
    }

    // Data channel should be open and ready to communicate on.
    await waitForEvent(dataChannel, "open", "error");    

    console.log("DataChannel open");
    dataChannel.addEventListener("message", (event) => console.log(`Received DataChannel message: ${event.data}`));
    dataChannel.send("Hello World!");

  }

  onWebsocketMessage = event => {
    const message = JSON.parse(event.data);

    switch(message.type) {
      case "icecandidate":
        if (!this.peerConnection.remoteDescription) {
          // Pool candidates until the remoteDescription is set.
          this.pendingIceCandidates.push(message.candidate);
        } else {
          this.peerConnection.addIceCandidate(message.candidate).catch(console.error);
        }
        break;
      case "serverSessionDescription":
        this.serverSessionDescriptionBarrier.resolve(message.serverSessionDescription);
        break;
      default:
        console.log(`Received unknown message type: "${message.type}"`);
        break;
    }
  };

  disconnect() {
    this.ws.close();
    this.peerConnection.close();
  }
}