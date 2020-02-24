import { useRef, useEffect, useCallback, useState } from "react";
import connect from "../client";

export default function WebRTCClient() {
  const client = useRef();
  const videoRef = useRef();
  const inputRef = useRef();
  const [track, setTrack] = useState(null);
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    client.current = connect();

    client.current.onMessage((message) => {
      setMessages((messages) => [message, ...messages]);
    });

    return () => {
      client.current.close();
    };
  }, [setMessages]);

  const onToggleVideo = useCallback(async () => {
    if (track) {
      videoRef.current.srcObject = null;
      client.current.removeTrack(track);
      setTrack(null);
    } else {
      const stream = await navigator.mediaDevices.getUserMedia({video: true});
      const track = client.current.addTrack(stream.getTracks()[0]);
      setTrack(track);
      videoRef.current.srcObject = stream;
    }  
  }, [client, videoRef, track, setTrack]);

  const onSendMessage = useCallback(() => {
    client.current.sendMessage(inputRef.current.value);
  }, [client, inputRef]);

  return (
    <div>
      <video autoPlay width={320} height={240} ref={videoRef} />
      <button onClick={onToggleVideo}>Toggle Video</button>
      <div>
        {messages.map((msg, i) => (<p key={i}>{msg}</p>))}
      </div>
      <input ref={inputRef} onSubmit={onSendMessage} placeholder="Message..." />
      <button onClick={onSendMessage}>Send Message</button>
    </div>
  );
}