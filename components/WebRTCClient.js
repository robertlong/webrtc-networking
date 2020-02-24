import { useRef, useEffect } from "react";
import Client from "../client";

export default function WebRTCClient() {
  const client = useRef();

  useEffect(() => {
    client.current = new Client();

    client.current.connect();

    return () => {
      client.current.disconnect();
    };
  });

  return "WebRTCClient";
}