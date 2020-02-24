import { useEffect } from "react";
import connect from "../client";

export default function WebRTCClient() {
  useEffect(() => {
    connect();
    return () => {};
  });

  return "WebRTCClient";
}