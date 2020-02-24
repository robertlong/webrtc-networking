import React from "react";
import dynamic from 'next/dynamic';
import Loading from "../components/Loading";

const WebRTCClient = dynamic(
  () => import('../components/WebRTCClient'),
  {
    ssr: false,
    loading: Loading
  }
);

export default () => <div>hello world <WebRTCClient /></div>;