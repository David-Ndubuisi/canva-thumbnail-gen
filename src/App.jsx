import { useState, useRef } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import "./App.css";

function App() {
  const [videoFile, setVideoFile] = useState(null);
  const [thumbnail, setThumbnail] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const ffmpegRef = useRef(new FFmpeg());

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) setVideoFile(file);
  };

  const extractFrame = async () => {
    setIsProcessing(true);
    const ffmpeg = ffmpegRef.current;

    const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(
        `${baseURL}/ffmpeg-core.wasm`,
        "application/wasm",
      ),
    });

    await ffmpeg.writeFile("input.mp4", await fetchFile(videoFile));

    await ffmpeg.exec([
      "-i",
      "input.mp4",
      "-ss",
      "00:00:01",
      "-frames:v",
      "1",
      "out.png",
    ]);

    const data = await ffmpeg.readFile("out.png");
    const url = URL.createObjectURL(
      new Blob([data.buffer], { type: "image/png" }),
    );

    setThumbnail(url);
    setIsProcessing(false);
  };

  // --- DOWNLOAD LOGIC ---
  const handleDownload = () => {
    if (!thumbnail) return;
    const link = document.createElement("a");
    link.href = thumbnail;
    link.download = "youtube_thumbnail_raw.png";
    link.click();
  };

  // --- CANVA REDIRECT LOGIC ---
  const handleDesignInCanva = () => {
    if (!thumbnail) return;

    // 1. Auto-download the image so the user has it ready
    handleDownload();

    // 2. Open Canva's YouTube Thumbnail creator in a new tab
    window.open("https://www.canva.com/create/youtube-thumbnails/", "_blank");
  };

  return (
    <div className="dashboard">
      {isProcessing && (
        <div className="overlay">
          <div className="spinner"></div>
          <p>PROCESSING VIDEO...</p>
          <small>Extracting high-quality frames</small>
        </div>
      )}

      <header>
        <h1>Canva Thumbnail Generator</h1>
        <p>Upload a video and get some pretty cool looking thumbnails.</p>
      </header>

      <main>
        <div className="card">
          <input
            type="file"
            accept="video/*"
            onChange={handleFileChange}
            id="v-up"
            hidden
          />
          <label htmlFor="v-up" className="upload-button">
            <i className="bx bx-cloud-upload"></i>
            {videoFile ? "Change Video" : "Upload Video"}
          </label>

          {videoFile && (
            <div className="file-info">
              <p>Ready: {videoFile.name}</p>
              <button onClick={extractFrame} className="process-btn">
                Generate Preview
              </button>
            </div>
          )}
        </div>

        {thumbnail && (
          <div className="card preview-card">
            <h3>Resulting Frame</h3>
            <img
              src={thumbnail}
              alt="Extracted frame"
              style={{ width: "100%", borderRadius: "12px" }}
            />
          </div>
        )}
      </main>

      {thumbnail && (
        <div className="action-bar">
          <button onClick={handleDownload} className="download-btn">
            <i className="bx bx-download"></i> Download Raw
          </button>

          <button onClick={handleDesignInCanva} className="canva-btn">
            Edit in Canva
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
