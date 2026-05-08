import { useState, useRef } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import "./App.css";

function App() {
  const [videoFile, setVideoFile] = useState(null);
  const [thumbnails, setThumbnails] = useState([]);
  const [selectedThumbnail, setSelectedThumbnail] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isStudioMode, setIsStudioMode] = useState(false); // NEW STATE
  const ffmpegRef = useRef(new FFmpeg());
  const [filters, setFilters] = useState({
    saturation: 100,
    contrast: 100,
    hasBorder: false,
  });

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setVideoFile(file);
      setThumbnails([]);
      setSelectedThumbnail(null);
      setIsStudioMode(false);
    }
  };

  const getVideoDuration = (file) => {
    return new Promise((resolve) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src);
        resolve(video.duration);
      };
      video.src = URL.createObjectURL(file);
    });
  };

  const extractFrame = async () => {
    const isIsolated = window.crossOriginIsolated;

    if (!isIsolated) {
      console.error("Security headers are missing!");
      alert("Check your Vite config or _headers file.");
      return;
    }

    setIsProcessing(true);
    setThumbnails([]);
    setSelectedThumbnail(null);

    try {
      const duration = await getVideoDuration(videoFile);
      const ffmpeg = ffmpegRef.current;

      ffmpeg.on("log", ({ message }) => {
        console.log("[FFmpeg]:", message);
      });

      if (!ffmpeg.loaded) {
        const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";
        await ffmpeg.load({
          coreURL: await toBlobURL(
            `${baseURL}/ffmpeg-core.js`,
            "text/javascript",
          ),
          wasmURL: await toBlobURL(
            `${baseURL}/ffmpeg-core.wasm`,
            "application/wasm",
          ),
        });
      }

      await ffmpeg.writeFile("input.mp4", await fetchFile(videoFile));

      const numFrames = 5;
      const interval = duration / (numFrames + 1);
      const generatedThumbs = [];

      for (let i = 1; i <= numFrames; i++) {
        const targetTime = interval * i;
        const timeString = new Date(targetTime * 1000)
          .toISOString()
          .slice(11, 19);
        const outName = `out_${i}.png`;

        await ffmpeg.exec([
          "-y",
          "-i",
          "input.mp4",
          "-ss",
          timeString,
          "-frames:v",
          "1",
          outName,
        ]);

        const data = await ffmpeg.readFile(outName);
        const url = URL.createObjectURL(
          new Blob([data.buffer], { type: "image/png" }),
        );
        generatedThumbs.push({ id: i, url });
      }

      setThumbnails(generatedThumbs);
    } catch (error) {
      console.error("FFmpeg Error:", error);
      alert("Failed to process video. See console for details.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!selectedThumbnail) return;
    const link = document.createElement("a");
    link.href = selectedThumbnail;
    link.download = "youtube_thumbnail_raw.png";
    link.click();
  };

  const handleDesignInCanva = () => {
    if (!selectedThumbnail) return;
    handleDownload();
    window.open("https://www.canva.com/create/youtube-thumbnails/", "_blank");
  };

  const toggleFilter = (type) => {
    setFilters((prev) => ({
      ...prev,
      [type]:
        type === "hasBorder" ? !prev.hasBorder : prev[type] === 100 ? 150 : 100,
    }));
  };

  return (
    <div className="dashboard">
      {isProcessing && (
        <div className="overlay">
          <div className="spinner"></div>
          <p>EXTRACTING MULTIPLE FRAMES...</p>
          <small>Generating your timeline</small>
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
                Generate Filmstrip
              </button>
            </div>
          )}
        </div>

        {thumbnails.length > 0 && (
          <div className="card preview-card">
            <h3 style={{ marginBottom: "1.5rem" }}>
              Select Your Preferred Frame
            </h3>
            <div className="filmstrip-container">
              {thumbnails.map((thumb) => (
                <div
                  key={thumb.id}
                  className={`filmstrip-item ${selectedThumbnail === thumb.url ? "selected" : ""}`}
                  onClick={() => setSelectedThumbnail(thumb.url)}
                >
                  <img src={thumb.url} alt={`Extracted frame ${thumb.id}`} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- NEW STUDIO MODE SECTION --- */}
        {selectedThumbnail && (
          <div className="card studio-card">
            <div className="studio-header">
              <h3>Thumbnail Preview</h3>
              <div className="enhancement-group">
                <button
                  className={`filter-btn ${filters.saturation > 100 ? "active" : ""}`}
                  onClick={() => toggleFilter("saturation")}
                >
                  <i className="bx bxs-magic-wand"></i> Boost Color
                </button>
                <button
                  className={`filter-btn ${filters.contrast > 100 ? "active" : ""}`}
                  onClick={() => toggleFilter("contrast")}
                >
                  <i className="bx bxs-adjust"></i> Pop Contrast
                </button>
                <button
                  className={`filter-btn ${filters.hasBorder ? "active" : ""}`}
                  onClick={() => toggleFilter("hasBorder")}
                >
                  <i className="bx bx-border-all"></i> Add Border
                </button>

                <div className="divider"></div>

                <button
                  className={`toggle-btn ${isStudioMode ? "active" : ""}`}
                  onClick={() => setIsStudioMode(!isStudioMode)}
                >
                  <i
                    className={`bx ${isStudioMode ? "bx-toggle-right" : "bx-toggle-left"}`}
                  ></i>
                  Studio Mode
                </button>
              </div>
            </div>

            <div className="studio-canvas">
              <div className="yt-mock-card">
                <div className="yt-thumbnail-wrapper">
                  <img
                    src={selectedThumbnail}
                    alt="Hero Frame"
                    className="hero-img"
                    style={{
                      filter: `saturate(${filters.saturation}%) contrast(${filters.contrast}%)`,
                      outline: filters.hasBorder
                        ? "8px solid var(--primary)"
                        : "none",
                      outlineOffset: "-8px",
                    }}
                  />

                  {isStudioMode && (
                    <>
                      <div className="yt-play-btn"></div>
                      <div className="yt-timestamp">14:05</div>
                    </>
                  )}
                </div>

                {isStudioMode && (
                  <div className="yt-metadata">
                    <div className="yt-avatar"></div>
                    <div className="yt-text-group">
                      <h4>The Ultimate THUMBNAIL!!</h4>
                      <p>Client Channel • 1.4M views • 2 hours ago</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {selectedThumbnail && (
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
