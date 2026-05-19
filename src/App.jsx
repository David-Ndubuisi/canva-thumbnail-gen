import { useState, useRef } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import "./App.css";

function App() {
  const [videoFile, setVideoFile] = useState(null);
  const [thumbnails, setThumbnails] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedThumbnail, setSelectedThumbnail] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isStudioMode, setIsStudioMode] = useState(false);
  const ffmpegRef = useRef(new FFmpeg());

  // Refactored state: Now holds actual numeric values for standard CSS filters
  const [filters, setFilters] = useState({
    brightness: 100,
    contrast: 100,
    saturation: 100,
  });

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("video/")) {
      setVideoFile(file);
      setThumbnails([]);
      setSelectedThumbnail(null);
      setIsStudioMode(false);
    } else {
      alert("Please drop a valid video file.");
    }
  };

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

      const numFrames = duration > 300 ? 10 : 5;
      const interval = duration / (numFrames + 1);
      const generatedThumbs = [];

      for (let i = 1; i <= numFrames; i++) {
        const targetTime = interval * i;
        const timeString = new Date(targetTime * 1000)
          .toISOString()
          .slice(11, 19);
        const outName = `out_${i}.png`;

        await ffmpeg.exec([
          "-ss",
          timeString,
          "-i",
          "input.mp4",
          "-frames:v",
          "1",
          "-q:v",
          "2",
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

  // Handler for changes on individual sliders
  const handleFilterChange = (filterType, value) => {
    setFilters((prev) => ({
      ...prev,
      [filterType]: parseInt(value, 10),
    }));
  };

  // Reset function to revert options back to native levels
  const resetFilters = () => {
    setFilters({ brightness: 100, contrast: 100, saturation: 100 });
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

      <main>
        <div className="hero-section">
          <div className="hero-text">
            <h1>
              Extract <span className="text-gradient">Thumbnails</span>
              <br />
              Instantly.
            </h1>
            <p>
              Upload your video and let our engine generate high-fidelity,
              YouTube-ready frames in seconds.
            </p>
            <div className="hero-badges">
              <span className="badge">
                <i className="bx bx-check-circle"></i> Lightning Fast
              </span>
              <span className="badge">
                <i className="bx bx-check-circle"></i> 100% Browser-Based
              </span>
            </div>
          </div>

          <div
            className={`upload-dropzone ${isDragging ? "dragging" : ""}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="dropzone-content">
              {videoFile ? (
                <div className="file-ready-state">
                  <div className="success-icon">
                    <i className="bx bxs-file-archive"></i>
                  </div>
                  <h3>Video Loaded</h3>
                  <p className="filename">{videoFile.name}</p>

                  <div className="dropzone-actions">
                    <button
                      onClick={extractFrame}
                      className="process-btn primary-btn"
                    >
                      Generate Filmstrip{" "}
                      <i className="bx bx-right-arrow-alt"></i>
                    </button>
                    <input
                      type="file"
                      accept="video/*"
                      onChange={handleFileChange}
                      id="v-up"
                      hidden
                    />
                    <label htmlFor="v-up" className="text-link">
                      or select a different file
                    </label>
                  </div>
                </div>
              ) : (
                <div className="upload-prompt-state">
                  <input
                    type="file"
                    accept="video/*"
                    onChange={handleFileChange}
                    id="v-up"
                    hidden
                  />
                  <label htmlFor="v-up" className="upload-button primary-btn">
                    <i className="bx bx-cloud-upload"></i> Upload Video
                  </label>
                  <p className="drop-text">or drop a file here</p>
                  <p className="supported-text">Supports MP4, MOV, WEBM</p>
                </div>
              )}
            </div>
          </div>
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

        {/* --- STUDIO MODE & FINE TUNING SECTION --- */}
        {selectedThumbnail && (
          <div className="card studio-card">
            <div className="studio-workspace">
              {/* LEFT SIDE: FINE-TUNING PANEL CONTROL */}
              <div className="editor-panel">
                <div className="panel-header">
                  <h4>
                    <i className="bx bx-slider-alt"></i> Fine Tuning
                  </h4>
                  <button onClick={resetFilters} className="reset-link-btn">
                    Reset
                  </button>
                </div>

                <div className="control-group">
                  <div className="control-label">
                    <span>Exposure</span>
                    <span className="value-indicator">
                      {filters.brightness}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="175"
                    value={filters.brightness}
                    onChange={(e) =>
                      handleFilterChange("brightness", e.target.value)
                    }
                    className="premium-slider"
                  />
                </div>

                <div className="control-group">
                  <div className="control-label">
                    <span>Contrast</span>
                    <span className="value-indicator">{filters.contrast}%</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="175"
                    value={filters.contrast}
                    onChange={(e) =>
                      handleFilterChange("contrast", e.target.value)
                    }
                    className="premium-slider"
                  />
                </div>

                <div className="control-group">
                  <div className="control-label">
                    <span>Vibrancy / Saturation</span>
                    <span className="value-indicator">
                      {filters.saturation}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="25"
                    max="200"
                    value={filters.saturation}
                    onChange={(e) =>
                      handleFilterChange("saturation", e.target.value)
                    }
                    className="premium-slider"
                  />
                </div>

                <div className="panel-divider"></div>

                <button
                  className={`studio-toggle-bar-btn ${isStudioMode ? "active" : ""}`}
                  onClick={() => setIsStudioMode(!isStudioMode)}
                >
                  <i
                    className={`bx ${isStudioMode ? "bx-toggle-right" : "bx-toggle-left"}`}
                  ></i>
                  Studio Overlay Mode
                </button>
              </div>

              {/* RIGHT SIDE: CANVAS VIEW */}
              <div className="studio-canvas">
                <div className="yt-mock-card">
                  <div className="yt-thumbnail-wrapper">
                    <img
                      src={selectedThumbnail}
                      alt="Hero Frame"
                      className="hero-img"
                      style={{
                        filter: `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturation}%)`,
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
