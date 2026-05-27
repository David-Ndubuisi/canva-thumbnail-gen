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
  // NEW: State for the active preset
  const [activePreset, setActivePreset] = useState("none");
  // Add these right below your activePreset state
  const [isTextEnabled, setIsTextEnabled] = useState(false);
  const [overlayText, setOverlayText] = useState("");
  const [textSize, setTextSize] = useState(48);

  // NEW: Font and Position States
  const [textFont, setTextFont] = useState('"Outfit", sans-serif');
  const [textPosX, setTextPosX] = useState(50); // Starts at 50% (Center)
  const [textPosY, setTextPosY] = useState(8); // Starts at 8% (Top)

  // NEW: The CSS definitions for our preset filters
  const PRESETS = {
    none: "",
    bw: "grayscale(100%) contrast(120%)",
    cinematic:
      "contrast(125%) saturate(110%) brightness(90%) sepia(15%) hue-rotate(-5deg)",
    vintage: "sepia(70%) contrast(110%) brightness(90%) hue-rotate(-15deg)",
    cyberpunk:
      "saturate(200%) contrast(120%) hue-rotate(45deg) brightness(95%)",
  };

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

  const handleDownloadEdited = () => {
    if (!selectedThumbnail) return;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;

      // 1. Apply image filters
      const manualFilters = `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturation}%)`;
      const presetFilter = PRESETS[activePreset];
      ctx.filter = `${manualFilters} ${presetFilter}`.trim();

      // 2. Draw the image
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // 3. Draw the Text Overlay (if enabled)
      // 3. Draw the Text Overlay (if enabled)
      if (isTextEnabled && overlayText) {
        ctx.filter = "none";

        const domImg = document.querySelector(".hero-img");
        const scale = canvas.width / domImg.clientWidth;

        // Apply dynamic font and scaled size
        const scaledFontSize = textSize * scale;
        ctx.font = `800 ${scaledFontSize}px ${textFont}`;
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";

        ctx.shadowColor = "rgba(0,0,0,0.8)";
        ctx.shadowBlur = 15 * scale;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 5 * scale;

        ctx.lineWidth = 4 * scale;
        ctx.strokeStyle = "#000000";

        // Convert percentage sliders to exact canvas pixels
        const xPosition = canvas.width * (textPosX / 100);
        const yPosition = canvas.height * (textPosY / 100);
        const textValue = overlayText.toUpperCase();

        ctx.strokeText(textValue, xPosition, yPosition);
        ctx.fillText(textValue, xPosition, yPosition);
      }

      const link = document.createElement("a");
      link.download = "youtube_thumbnail_edited.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    };

    img.src = selectedThumbnail;
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

        {/* UPDATED HORIZONTAL FILMSTRIP PRESENTATION WITH NAVIGATION ARROWS */}
        {thumbnails.length > 0 && (
          <div className="card preview-card">
            <h3 style={{ marginBottom: "1.5rem" }}>
              Select Your Preferred Frame
            </h3>

            <div className="filmstrip-slider-wrapper">
              {/* Left Navigation Arrow */}
              <button
                className="scroll-arrow left-arrow"
                onClick={() => {
                  const container = document.getElementById(
                    "filmstrip-container-id",
                  );
                  if (container) container.scrollLeft -= 300; // Scrolls back by roughly one frame width
                }}
                aria-label="Scroll Left"
              >
                <i className="bx bx-chevron-left"></i>
              </button>

              {/* The Scrollable Strip */}
              <div className="filmstrip-container" id="filmstrip-container-id">
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

              {/* Right Navigation Arrow */}
              <button
                className="scroll-arrow right-arrow"
                onClick={() => {
                  const container = document.getElementById(
                    "filmstrip-container-id",
                  );
                  if (container) container.scrollLeft += 300; // Scrolls forward by roughly one frame width
                }}
                aria-label="Scroll Right"
              >
                <i className="bx bx-chevron-right"></i>
              </button>
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
                  <button
                    onClick={() => {
                      resetFilters();
                      setActivePreset("none");
                    }}
                    className="reset-link-btn"
                  >
                    Reset All
                  </button>
                </div>

                {/* NEW: PRESET SELECTORS */}
                <div className="control-label" style={{ marginBottom: "10px" }}>
                  <span>Quick Presets</span>
                </div>
                <div className="preset-group">
                  <button
                    className={`preset-btn ${activePreset === "none" ? "active" : ""}`}
                    onClick={() => setActivePreset("none")}
                  >
                    Normal
                  </button>
                  <button
                    className={`preset-btn ${activePreset === "cinematic" ? "active" : ""}`}
                    onClick={() => setActivePreset("cinematic")}
                  >
                    Cinematic
                  </button>
                  <button
                    className={`preset-btn ${activePreset === "bw" ? "active" : ""}`}
                    onClick={() => setActivePreset("bw")}
                  >
                    B&W
                  </button>
                  <button
                    className={`preset-btn ${activePreset === "vintage" ? "active" : ""}`}
                    onClick={() => setActivePreset("vintage")}
                  >
                    Vintage
                  </button>
                  <button
                    className={`preset-btn ${activePreset === "cyberpunk" ? "active" : ""}`}
                    onClick={() => setActivePreset("cyberpunk")}
                  >
                    Cyberpunk
                  </button>
                </div>

                <div className="panel-divider"></div>

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
                <div className="control-header-flex">
                  <div className="control-label" style={{ marginBottom: 0 }}>
                    <span>Headline Text</span>
                  </div>
                  <button
                    className={`toggle-btn micro ${isTextEnabled ? "active" : ""}`}
                    onClick={() => setIsTextEnabled(!isTextEnabled)}
                  >
                    {isTextEnabled ? "ON" : "OFF"}
                  </button>
                </div>

                {isTextEnabled && (
                  <div className="text-editor-box">
                    <input
                      type="text"
                      placeholder="ENTER HEADLINE..."
                      maxLength={20}
                      value={overlayText}
                      onChange={(e) => setOverlayText(e.target.value)}
                      className="text-input"
                    />

                    <div
                      className="control-group"
                      style={{ marginTop: "1.2rem", marginBottom: 0 }}
                    >
                      <div className="control-label">
                        <span>Font Style</span>
                      </div>
                      <select
                        value={textFont}
                        onChange={(e) => setTextFont(e.target.value)}
                        className="text-input select-input"
                        style={{ padding: "0.6rem", cursor: "pointer" }}
                      >
                        <option value='"Outfit", sans-serif'>
                          Outfit (Modern)
                        </option>
                        <option value="Impact, sans-serif">
                          Impact (Classic Meme)
                        </option>
                        <option value='"Arial Black", sans-serif'>
                          Arial Black (Heavy)
                        </option>
                        <option value='"Courier New", monospace'>
                          Courier (Typewriter)
                        </option>
                      </select>
                    </div>

                    <div
                      className="control-group"
                      style={{ marginTop: "1.2rem", marginBottom: 0 }}
                    >
                      <div className="control-label">
                        <span>Text Size</span>
                        <span className="value-indicator">{textSize}px</span>
                      </div>
                      <input
                        type="range"
                        min="24"
                        max="84"
                        value={textSize}
                        onChange={(e) => setTextSize(parseInt(e.target.value))}
                        className="premium-slider"
                      />
                    </div>

                    <div
                      className="control-group"
                      style={{ marginTop: "1.2rem", marginBottom: 0 }}
                    >
                      <div className="control-label">
                        <span>Horizontal Position</span>
                        <span className="value-indicator">{textPosX}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={textPosX}
                        onChange={(e) => setTextPosX(parseInt(e.target.value))}
                        className="premium-slider"
                      />
                    </div>

                    <div
                      className="control-group"
                      style={{ marginTop: "1.2rem", marginBottom: 0 }}
                    >
                      <div className="control-label">
                        <span>Vertical Position</span>
                        <span className="value-indicator">{textPosY}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={textPosY}
                        onChange={(e) => setTextPosY(parseInt(e.target.value))}
                        className="premium-slider"
                      />
                    </div>
                  </div>
                )}
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
                        // Combine manual sliders AND the active preset
                        filter:
                          `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturation}%) ${PRESETS[activePreset]}`.trim(),
                      }}
                    />

                    {isTextEnabled && overlayText && (
                      <div
                        className="thumbnail-text-overlay"
                        style={{
                          fontSize: `${textSize}px`,
                          fontFamily: textFont,
                          left: `${textPosX}%`,
                          top: `${textPosY}%`,
                        }}
                      >
                        {overlayText.toUpperCase()}
                      </div>
                    )}

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
          <button onClick={handleDownload} className="download-btn secondary">
            Raw (Original)
          </button>
          <button
            onClick={handleDownloadEdited}
            className="download-btn primary-action"
          >
            <i className="bx bx-download"></i> Download Edited
          </button>
          <div
            style={{
              width: "1px",
              height: "24px",
              background: "#444",
              margin: "0 10px",
            }}
          ></div>
          <button onClick={handleDesignInCanva} className="canva-btn">
            Edit in Canva
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
