import React, { useEffect, useState, useRef, CSSProperties } from "react";
import "./App.css";

declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}

function App() {
  const [background1Style, setBackground1Style] = useState<CSSProperties>();
  const [background2Style, setBackground2Style] = useState<CSSProperties>();
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

      function animate() {
        const canvasCtx = canvasRef.current?.getContext("2d");
        if (!canvasCtx) {
          requestAnimationFrame(animate);
          return;
        }

        const bufferLength = analyzer.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyzer.getByteFrequencyData(dataArray);

        canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);

        canvasCtx.lineWidth = 5;
        canvasCtx.strokeStyle = "rgb(255, 255, 255)";
        canvasCtx.beginPath();

        const offset = 200;
        const maxJumpHeight = 100;
        const jumpRate = Math.pow(maxJumpHeight, 1 / 255);
        const radius = HEIGHT / 2 - offset;
        const sliceWidth = (2 * Math.PI) / numSlices;
        let angle = 0;
        let initialX = 0;
        let initialY = 0;

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
          const e = Math.pow(jumpRate, decibelTotal / binCount);

          const x = (radius + e) * Math.cos(angle) + radius + offset;
          const y = (radius + e) * Math.sin(angle) + radius + offset;

          if (i === 0) {
            canvasCtx.moveTo(x, y);
            initialX = x;
            initialY = y;
          } else {
            canvasCtx.lineTo(x, y);
          }

          angle += sliceWidth;
        }

        canvasCtx.lineTo(initialX, initialY);
        canvasCtx.stroke();
        requestAnimationFrame(animate);
      }

      console.log("starting animation");
      requestAnimationFrame(animate);
    }

    init();
  }, []);

  useEffect(() => {
    async function* backgroundGenerator(): AsyncGenerator<string> {
      while (true) {
        const imagesResponse = await fetch(
          "https://api.unsplash.com/photos/random?topics=6sMVjTLSkeQ&orientation=landscape&content_filter=high&count=30",
          {
            headers: {
              Authorization: process.env
                .REACT_APP_UNSPLASH_AUTHORIZATION as string,
            },
          }
        );

        const images = await imagesResponse.json();
        for (const image of images) {
          yield `linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)), url(${image.urls.raw}?w=${window.innerWidth}&h=${window.innerHeight}) no-repeat center center fixed`;
        }
      }
    }

    async function init() {
      let backgrounds = backgroundGenerator();
      let zIndex = 0;
      let background1 = (await backgrounds.next()).value;
      while (true) {
        setBackground1Style({
          background: background1,
          animation: "fadein 3s",
          opacity: 1,
          zIndex: zIndex,
        });

        await new Promise((resolve) => setTimeout(resolve, 10000));

        const background2 = (await backgrounds.next()).value;

        setBackground2Style({
          background: background2,
          opacity: 0,
          zIndex: zIndex++,
        });

        await new Promise((resolve) => setTimeout(resolve, 50000));

        setBackground2Style({
          background: background2,
          animation: "fadein 3s",
          opacity: 1,
          zIndex: zIndex,
        });

        await new Promise((resolve) => setTimeout(resolve, 10000));

        background1 = (await backgrounds.next()).value;

        setBackground1Style({
          background: background1,
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
      <div className="App-background" style={background1Style} />
      <div className="App-background" style={background2Style} />
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
