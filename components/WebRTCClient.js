import { useRef, useEffect, useCallback, useState } from "react";
import connect from "../client";

export default function WebRTCClient() {
  const client = useRef();
  const videoRef = useRef();
  const [track, setTrack] = useState(null);

  useEffect(() => {
    client.current = connect();

    return () => {
      client.current.close();
    };
  }, []);

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

  return (
    <div>
      <video autoPlay width={320} height={240} ref={videoRef} />
      <button onClick={onToggleVideo}>Toggle Video</button>
    </div>
  );
}