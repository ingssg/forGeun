"use client";
import axios from "axios";
import { useEffect, useState } from "react";
import {
  OpenVidu,
  Session,
  Publisher,
  StreamManager,
  Device,
  Subscriber,
} from "openvidu-browser";

import io from 'socket.io-client';
import UserVideoComponent from "../components/UserVideoComponent";

const APPLICATION_SERVER_URL = "http://localhost:5001/";

export default function Home() {
  const [mySessionId, setMySessionId] = useState<string>("SessionA");
  const [myUserName, setMyUserName] = useState<string>(
    "Participant" + Math.floor(Math.random() * 100)
  );
  const [session, setSession] = useState<Session | undefined>(undefined);
  const [mainStreamManager, setMainStreamManager] = useState<any>(undefined);
  const [publisher, setPublisher] = useState<Publisher | undefined>(undefined);
  const [subscribers, setSubscribers] = useState<StreamManager[]>([]);
  const [currentVideoDevice, setCurrentVideoDevice] = useState<Device | null>(
    null
  );
  const [isAvatar, setIsAvatar] = useState<boolean>(true);
  const [isLoveMode, setIsLoveMode] = useState<boolean>(false);
  const [isMatched, setIsMatched] = useState<boolean>(true);
  const [isChooseMode, setIsChooseMode] = useState<boolean>(false);
  const [isOneToOneMode, setIsOneToOneMode] = useState<boolean>(false);

  // 어떻게든 종료 하면 세션에서 나가게함.
  useEffect(() => {
    console.log("메인이 실행되었습니다.");
    const handleBeforeUnload = () => leaveSession();
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      console.log("메인이 종료되었습니다.");
    };
  });

  // 세션 아이디 변경
  const handleChangeSessionId = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMySessionId(e.target.value);
  };

  // 유저 이름 변경
  const handleChangeUserName = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMyUserName(e.target.value);
  };

  // 메인 비디오 스트림을 변경
  const handleMainVideoStream = (stream: StreamManager) => {
    if (mainStreamManager !== stream) {
      setMainStreamManager(stream);
    }
  };

  // 구독자 한 놈 빼기
  const deleteSubscriber = (streamManager: StreamManager) => {
    setSubscribers((prevSubscribers) =>
      prevSubscribers.filter((sub) => sub !== streamManager)
    );
  };

  const joinSession = () => {
    const OV = new OpenVidu();

    const newSession = OV.initSession();
    setSession(newSession);

    const socket = io('http://localhost:3000/meeting', {
      transports: ['websocket'],    
    });
    socket.emit('ready', {participantName: myUserName});

    // 큐 취소 버튼 (추후 추가)

    // socket.on('startCall', async ({sessionId, token, participantName}) => {
       
    // })

    console.log(socket);

    newSession.on("streamCreated", (event) => {
      // 새로운 스트림이 생성될 때, 해당 스트림을 구독
      const subscriber = newSession.subscribe(event.stream, undefined);
      // 구독한 스트림을 구독자 목록에 추가
      setSubscribers((prevSubscribers) => [...prevSubscribers, subscriber]);
    });

    newSession.on("streamDestroyed", (event) => {
      deleteSubscriber(event.stream.streamManager);
    });

    newSession.on("exception", (exception) => {
      console.warn(exception);
    });

    getToken().then((token) => {
      newSession
        .connect(token, { clientData: myUserName })
        .then(async () => {
          const publisher = await OV.initPublisherAsync(undefined, {
            audioSource: undefined,
            videoSource: undefined,
            publishAudio: true,
            publishVideo: true,
            resolution: "640x480",
            frameRate: 30,
            insertMode: "APPEND",
            mirror: true,
          });

          newSession.publish(publisher);

          const devices = await OV.getDevices();
          const videoDevices = devices.filter(
            (device) => device.kind === "videoinput"
          );
          const currentVideoDeviceId = publisher.stream
            .getMediaStream()
            .getVideoTracks()[0]
            .getSettings().deviceId;
          const currentVideoDevice = videoDevices.find(
            (device) => device.deviceId === currentVideoDeviceId
          );

          if (currentVideoDevice) {
            setCurrentVideoDevice(currentVideoDevice);
          }
          setMainStreamManager(publisher);
          setPublisher(publisher);
        })
        .catch((error) => {
          console.log(
            "There was an error connecting to the session:",
            error.code,
            error.message
          );
        });
    });
  };

  const leaveSession = () => {
    if (session) {
      session.disconnect();
    }

    setSession(undefined);
    setSubscribers([]);
    setMySessionId("SessionA");
    setMyUserName("Participant" + Math.floor(Math.random() * 100));
    setMainStreamManager(undefined);
    setPublisher(undefined);
  };

  const switchCamera = async () => {
    try {
      const OV = new OpenVidu();
      const devices = await OV.getDevices();
      const videoDevices = devices.filter(
        (device) => device.kind === "videoinput"
      );

      if (videoDevices.length > 1 && currentVideoDevice) {
        const newVideoDevice = videoDevices.find(
          (device) => device.deviceId !== currentVideoDevice.deviceId
        );

        if (newVideoDevice) {
          const newPublisher = OV.initPublisher(undefined, {
            videoSource: newVideoDevice.deviceId,
            publishAudio: true,
            publishVideo: true,
            mirror: true,
          });

          await session?.unpublish(mainStreamManager);
          await session?.publish(newPublisher);

          setCurrentVideoDevice(newVideoDevice);
          setMainStreamManager(newPublisher);
          setPublisher(newPublisher);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const getToken = async () => {
    const sessionId = await createSession(mySessionId);
    return await createToken(sessionId);
  };

  const createSession = async (sessionId: string) => {
    const response = await axios.post(
      APPLICATION_SERVER_URL + "api/sessions",
      { customSessionId: sessionId },
      { headers: { "Content-Type": "application/json" } }
    );
    return response.data as string; // The sessionId
  };

  const createToken = async (sessionId: string) => {
    const response = await axios.post(
      APPLICATION_SERVER_URL + "api/sessions/" + sessionId + "/connections",
      {},
      { headers: { "Content-Type": "application/json" } }
    );
    return response.data as string; // The token
  };

  const openReal = () => {
    console.log("openReal");
    const videoElements = document.querySelectorAll("video");
    const canvasElements = document.querySelectorAll("canvas");
    if (isAvatar) {
      videoElements.forEach((video) => {
        video.style.display = "block";
      });
      canvasElements.forEach((canvas) => {
        canvas.style.display = "none";
      });
      setIsAvatar(false);
      return;
    }
    videoElements.forEach((video) => {
      video.style.display = "none";
    });
    canvasElements.forEach((canvas) => {
      canvas.style.display = "block";
    });
    setIsAvatar(true);
  };

  type showArrowProps = {
    from: string;
    to: string;
  };

  const datass: Array<showArrowProps> = [
    {from: 'a', to: 'd'},
    {from: 'b', to: 'e'},
    {from: 'c', to: 'f'},
    {from: 'd', to: 'a'},
    {from: 'e', to: 'b'},
    {from: 'f', to: 'c'},
  ];

  const showArrow = (datas: Array<showArrowProps>) => {
    const acc = [-2,-1,0,1,2,3];
    datas.forEach(({from, to}, idx) => {
      const fromUser = document.getElementById(from) as HTMLDivElement;
      const toUser = document.getElementById(to) as HTMLDivElement;
      const arrowContainer = fromUser?.querySelector('.arrow-container') as HTMLDivElement;
      const arrowBody = arrowContainer?.querySelector('.arrow-body') as HTMLDivElement;
      console.log(from, to)
      console.log(fromUser, toUser, arrowContainer, arrowBody)
      
      const rect1 = fromUser.getBoundingClientRect();
      const rect2 = toUser.getBoundingClientRect();
      console.log(rect1, rect2);
      const centerX1 = (rect1.left + rect1.width / 2) + acc[idx]*10;
      const centerY1 = rect1.top + rect1.height / 2 + acc[idx]*10;
      const centerX2 = rect2.left + rect2.width / 2 + acc[idx]*10;
      const centerY2 = rect2.top + rect2.height / 2 + acc[idx]*10;
      const halfWidth = Math.abs(rect1.right - rect1.left) * (3/4);
  
      const deltaX = centerX2 - centerX1;
      const deltaY = centerY2 - centerY1;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      const arrowWidth = distance - halfWidth;
      
      if(idx > 2) {
        arrowBody.style.backgroundColor = '#33C4D7'
        const arrowHead = arrowBody.querySelector('.arrow-head') as HTMLDivElement;
        arrowHead.style.borderBottom = '20px solid #33C4D7';
      }
      arrowBody.style.width = distance + 'px';
      arrowContainer.style.top = centerY1 - rect1.top + 'px';
      arrowContainer.style.left = centerX1 - rect1.left + 'px';
      arrowContainer.style.transform = `rotate(${Math.atan2(deltaY, deltaX) * 180 / Math.PI}deg)`;
      arrowContainer.classList.remove('hidden');
    });
  }

  const hideArrow = () => {
    const arrowContainers = document.querySelectorAll('.arrow-container');
    arrowContainers.forEach((arrowContainer) => {
      arrowContainer.classList.add('hidden');
    });
  }

  const changeLoveStickMode = () => {
    const videoContainer =
      document.getElementsByClassName("video-container")[0];
    const videoElements = document.querySelectorAll("video");
    const canvasElements = document.querySelectorAll("canvas");
    videoElements.forEach((video) => {
      video.style.width = "100%";
      video.style.height = "100%";
    });
    canvasElements.forEach((canvas) => {
      canvas.style.width = "100%";
      canvas.style.height = "100%";
    });
    if (!isLoveMode) {
      videoContainer.classList.add("love-stick");
      showArrow(datass);
      setIsLoveMode(true);
      return;
    }
    videoContainer.classList.remove("love-stick");
    hideArrow();
    setIsLoveMode(false);
  };

  const openKeyword = () => {
    const keyword = [
      "사랑",
      "행복",
      "기쁨",
      "슬픔",
      "화남",
      "놀람",
      "두려움",
      "짜증",
      "힘듦",
      "평화",
      "음주",
    ];
    const randomNum = Math.floor(Math.random() * 11);
    const keywordElement = document.getElementsByClassName("keyword")[0];
    keywordElement.innerHTML = keyword[randomNum];
  };

  const setGrayScale = () => {
    const camElement = document.getElementsByClassName("cam-wrapper")[0];
    if (isMatched) {
      camElement.classList.add("black-white");
      setIsMatched(false);
      return;
    }
    camElement.classList.remove("black-white");
    setIsMatched(true);
  };

  const setChooseMode = () => {
    // 선택 모드 일 때는 마우스 하버시에 선택 가능한 상태로 변경
    // 클릭 시에 선택된 상태로 변경
    const chooseBtns = document.getElementsByClassName("choose-btn");
    const btnArray = Array.from(chooseBtns);
    if (isChooseMode) {
      btnArray.forEach((btn) => {
        btn.classList.add("hidden");
      });

      setIsChooseMode(false);
      return;
    }
    btnArray.forEach((btn) => {
      btn.classList.remove("hidden");
    });
    setIsChooseMode(true);
  };

  const setOneToOneMode = () => {
    const videoContainer =
      document.getElementsByClassName("video-container")[0];
    const videoElements = document.querySelectorAll("video");
    const canvasElements = document.querySelectorAll("canvas");
    const streamElements = document.getElementsByClassName("stream-container");
    videoElements.forEach((video) => {
      video.style.width = "100%";
      video.style.height = "100%";
    });
    canvasElements.forEach((canvas) => {
      canvas.style.width = "100%";
      canvas.style.height = "100%";
    });
    if (!isOneToOneMode) {
      videoContainer.classList.add("one-one-four");
      for (let i = 0; i < streamElements.length; i++) {
        const className = String.fromCharCode(97 + i);
        streamElements[i].classList.add(className);
      }
      setIsOneToOneMode(true);
      return;
    }
    videoContainer.classList.remove("one-one-four");
    for (let i = 0; i < streamElements.length; i++) {
      const className = String.fromCharCode(97 + i);
      streamElements[i].classList.remove(className);
    }
    setIsOneToOneMode(false);
  };

  return (
    <div className="container">
      {session === undefined ? (
        <div id="join">
          <div id="img-div">
            <img
              src="resources/images/openvidu_grey_bg_transp_cropped.png"
              alt="OpenVidu logo"
            />
          </div>
          <div id="join-dialog" className="jumbotron vertical-center">
            <h1> Join a video session </h1>
            <form className="form-group" onSubmit={joinSession}>
              <p>
                <label>Participant: </label>
                <input
                  className="form-control"
                  type="text"
                  id="userName"
                  value={myUserName}
                  onChange={handleChangeUserName}
                  required
                />
              </p>
              <p>
                <label> Session: </label>
                <input
                  className="form-control"
                  type="text"
                  id="sessionId"
                  value={mySessionId}
                  onChange={handleChangeSessionId}
                  required
                />
              </p>
              <p className="text-center">
                <input
                  className="btn btn-lg btn-success"
                  name="commit"
                  type="submit"
                  value="JOIN"
                />
              </p>
            </form>
          </div>
        </div>
      ) : null}

      {session !== undefined ? (
        <div id="session">
          <div id="session-header">
            <h1 id="session-title">{mySessionId}</h1>
            <input
              className="btn btn-large btn-danger"
              type="button"
              id="buttonLeaveSession"
              onClick={leaveSession}
              value="Leave session"
            />
            <input
              className="btn btn-large btn-success"
              type="button"
              id="buttonSwitchCamera"
              onClick={switchCamera}
              value="Switch Camera"
            />
            <div className="btn-container">
              <button onClick={openReal}>캠 오픈</button>
              <button onClick={changeLoveStickMode}>사랑의 작대기</button>
              <button onClick={openKeyword}>키워드</button>
              <button onClick={setGrayScale}>흑백으로 만들기</button>
              <button onClick={setChooseMode}>선택모드</button>
              <button onClick={setOneToOneMode}>1:1모드</button>
              <button onClick={() => showArrow(datass)}>그냥 연결</button>
            </div>
          </div>
          <div className="keyword-wrapper">
            <p className="keyword"></p>
          </div>
          {/* {mainStreamManager !== undefined ? (
            <div id="main-video" className="col-md-6">
              <UserVideoComponent streamManager={mainStreamManager} />
            </div>
          ) : null} */}
          <div className="col-md-6 video-container">
            {publisher !== undefined ? (
              <div
                className="stream-container col-md-6 col-xs-6"
                onClick={() => handleMainVideoStream(publisher)}
              >
                <UserVideoComponent streamManager={publisher} />
              </div>
            ) : null}
            {subscribers.map((sub, i) => (
              <div
                key={sub.id}
                className="stream-container col-md-6 col-xs-6"
                onClick={() => handleMainVideoStream(sub)}
              >
                <span>{sub.id}</span>
                <UserVideoComponent streamManager={sub} />
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
