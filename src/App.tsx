import React, { useEffect, useState, useRef, CSSProperties } from "react";
import "./App.css";

declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}

interface PhotographerInfo {
  name: string;
  username: string;
  profilePhoto: string;
}

interface AverageInfo {
  timestamp: number;
  average: number;
}

function App() {
  const [background1Style, setBackground1Style] = useState<CSSProperties>();
  const [background2Style, setBackground2Style] = useState<CSSProperties>();
  const [photographer1Info, setPhotographer1Info] =
    useState<PhotographerInfo>();
  const [photographer2Info, setPhotographer2Info] =
    useState<PhotographerInfo>();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const WIDTH = 800;
  const HEIGHT = 800;

  useEffect(() => {
    async function init() {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const analyzer = audioCtx.createAnalyser();

      const stream = await (navigator.mediaDevices as any).getUserMedia({
        video: false,
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      const mic = audioCtx.createMediaStreamSource(stream);
      mic.connect(analyzer);
      analyzer.fftSize = 8192;
      const frequenciesPerBin = audioCtx.sampleRate / analyzer.fftSize;

      const numSlices = 250;
      const maxFrequency = 2000;
      const targetFrequencyCoefficient = maxFrequency / Math.pow(numSlices, 2);
      const historyStorageSeconds = 30;

      const averageHistory: AverageInfo[] = [];
      let sliceOffset = 0;

      function animate() {
        const canvasCtx = canvasRef.current?.getContext("2d");
        if (!canvasCtx) {
          requestAnimationFrame(animate);
          return;
        }

        const bufferLength = analyzer.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyzer.getByteFrequencyData(dataArray);

        const offset = 200;
        const maxJumpHeight = 100;
        const jumpRate = Math.pow(maxJumpHeight, 1 / 255);
        const radius = HEIGHT / 2 - offset;
        const sliceWidth = (2 * Math.PI) / numSlices;
        let angle = (sliceOffset++ * sliceWidth) / 10;

        canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);

        while (
          averageHistory[0] &&
          averageHistory[0].timestamp <
            Date.now() - historyStorageSeconds * 1000
        ) {
          averageHistory.shift();
        }

        const minAverage = Math.min(...averageHistory.map((x) => x.average));
        const maxAverage = Math.max(...averageHistory.map((x) => x.average));

        const averageEnergy =
          dataArray.reduce((total, current) => (total += current)) /
          dataArray.length;

        averageHistory.push({ timestamp: Date.now(), average: averageEnergy });

        canvasCtx.beginPath();
        canvasCtx.arc(
          WIDTH / 2,
          HEIGHT / 2,
          radius -
            50 +
            50 *
              Math.min(
                1,
                Math.max(
                  0,
                  (averageEnergy - minAverage) / (maxAverage - minAverage)
                )
              ),
          0,
          2 * Math.PI,
          false
        );
        canvasCtx.fillStyle = "black";
        canvasCtx.fill();

        canvasCtx.lineWidth = 5;
        canvasCtx.strokeStyle = "rgb(255, 255, 255)";

        canvasCtx.beginPath();
        canvasCtx.moveTo(WIDTH / 2, HEIGHT / 2);
        canvasCtx.lineTo(WIDTH / 2 + 25, HEIGHT / 2);
        canvasCtx.lineTo(WIDTH / 2, HEIGHT / 2 - 50);
        canvasCtx.lineTo(WIDTH / 2 - 32.5, HEIGHT / 2 + 15);
        canvasCtx.lineTo(WIDTH / 2 + 49.27, HEIGHT / 2 + 15);
        canvasCtx.lineTo(WIDTH / 2 + 64.27, HEIGHT / 2 + 45);
        canvasCtx.lineTo(WIDTH / 2, HEIGHT / 2 - 83.54);
        canvasCtx.lineTo(WIDTH / 2, HEIGHT / 2 - 83.54);
        canvasCtx.lineTo(WIDTH / 2 - 64.27, HEIGHT / 2 + 45);
        canvasCtx.lineTo(WIDTH / 2 - 56.77, HEIGHT / 2 + 30);
        canvasCtx.lineTo(WIDTH / 2 + 40, HEIGHT / 2 + 30);
        canvasCtx.lineTo(WIDTH / 2 + 55, HEIGHT / 2 + 60);
        canvasCtx.lineTo(WIDTH / 2 + 88.54, HEIGHT / 2 + 60);
        canvasCtx.lineTo(WIDTH / 2, HEIGHT / 2 - 117.08);
        canvasCtx.lineTo(WIDTH / 2 - 88.54, HEIGHT / 2 + 60);
        canvasCtx.lineTo(WIDTH / 2 - 55, HEIGHT / 2 + 60);
        canvasCtx.lineTo(WIDTH / 2 - 47.5, HEIGHT / 2 + 45);
        canvasCtx.stroke();

        canvasCtx.beginPath();

        let currentFrequency = 0;
        let currentBin = 0;
        for (let i = 0; i < numSlices; i++) {
          let decibelTotal = 0;
          let binCount = 0;

          do {
            decibelTotal += dataArray[currentBin++];
            binCount += 1;
            currentFrequency += frequenciesPerBin;
          } while (
            currentFrequency <
            targetFrequencyCoefficient * Math.pow(i, 2)
          );
          const frequencyEnergy = Math.pow(jumpRate, decibelTotal / binCount);

          const x =
            (radius + frequencyEnergy) * Math.cos(angle) + radius + offset;
          const y =
            (radius + frequencyEnergy) * Math.sin(angle) + radius + offset;

          if (i === 0) {
            canvasCtx.moveTo(x, y);
          } else {
            canvasCtx.lineTo(x, y);
          }

          angle += sliceWidth;
        }

        canvasCtx.closePath();
        canvasCtx.stroke();
        requestAnimationFrame(animate);
      }

      console.log("starting animation");
      requestAnimationFrame(animate);
    }

    init();
  }, []);

  useEffect(() => {
    async function* backgroundGenerator(): AsyncGenerator<{
      background: string;
      photographerInfo: PhotographerInfo;
    }> {
      const topicResponse = await fetch(
        "https://api.unsplash.com/topics/wallpapers",
        {
          headers: {
            Authorization: process.env
              .REACT_APP_UNSPLASH_AUTHORIZATION as string,
          },
        }
      );
      const topicId = (await topicResponse.json()).id;

      while (true) {
        const imagesResponse = await fetch(
          `https://api.unsplash.com/photos/random?topics=${topicId}&orientation=landscape&content_filter=high&count=30`,
          {
            headers: {
              Authorization: process.env
                .REACT_APP_UNSPLASH_AUTHORIZATION as string,
            },
          }
        );
        const images = await imagesResponse.json();

        for (const image of images) {
          yield {
            background: `linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)), url(${image.urls.raw}&fit=crop&w=${window.innerWidth}&h=${window.innerHeight}) no-repeat center center fixed`,
            photographerInfo: {
              name: image.user.name,
              username: image.user.username,
              profilePhoto: image.user.profile_image.medium,
            },
          };
        }
      }
    }

    async function init() {
      let backgrounds = backgroundGenerator();
      let zIndex = 0;
      let background1 = (await backgrounds.next()).value;
      while (true) {
        setBackground1Style({
          background: background1.background,
          animation: "fadein 3s",
          opacity: 1,
          zIndex: zIndex,
        });
        setPhotographer1Info(background1.photographerInfo);

        await new Promise((resolve) => setTimeout(resolve, 10000));

        const background2 = (await backgrounds.next()).value;

        setBackground2Style({
          background: background2.background,
          opacity: 0,
          zIndex: zIndex++,
        });

        await new Promise((resolve) => setTimeout(resolve, 50000));

        setBackground2Style({
          background: background2.background,
          animation: "fadein 3s",
          opacity: 1,
          zIndex: zIndex,
        });
        setPhotographer2Info(background2.photographerInfo);

        await new Promise((resolve) => setTimeout(resolve, 10000));

        background1 = (await backgrounds.next()).value;

        setBackground1Style({
          background: background1.background,
          opacity: 0,
          zIndex: zIndex++,
        });

        await new Promise((resolve) => setTimeout(resolve, 50000));
      }
    }

    init();
  }, []);

  return (
    <div className="App">
      <div className="App-background" style={background1Style}>
        <div className="photo-credits">
          <img
            src={photographer1Info?.profilePhoto}
            alt={photographer1Info?.username}
          />
          Photo by {photographer1Info?.name}
          <br />@{photographer1Info?.username}
        </div>
      </div>
      <div className="App-background" style={background2Style}>
        <div className="photo-credits">
          <img
            src={photographer2Info?.profilePhoto}
            alt={photographer2Info?.username}
          />
          Photo by {photographer2Info?.name}
          <br />@{photographer2Info?.username}
        </div>
      </div>
      <canvas
        className="App-visualizer"
        id="visualizer"
        ref={canvasRef}
        width={WIDTH}
        height={HEIGHT}
      />
    </div>
  );
}

export default App;
