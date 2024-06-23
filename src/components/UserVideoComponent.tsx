"use client";
import React, { useRef, useEffect } from "react";
import OpenViduVideoComponent from "./OvVideo";

export default function UserVideoComponent(props: any) {
  const streamComponentRef = useRef<HTMLDivElement>(null);
  const nickname = JSON.parse(
    props.streamManager.stream.connection.data
  ).clientData;

  useEffect(() => {
    if (streamComponentRef.current) {
      streamComponentRef.current.id = nickname;
    }
  }, []);

  return (
    <div>
      {props.streamManager !== undefined ? (
        <div className="streamcomponent" ref={streamComponentRef}>
          <div className="arrow-container hidden" id="arrow">
            <div className="arrow-body">
              <div className="arrow-head"></div>
            </div>
          </div>
          <OpenViduVideoComponent streamManager={props.streamManager} />
          <div>
            <p className="nickname">{nickname}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
