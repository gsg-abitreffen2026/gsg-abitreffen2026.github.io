document.addEventListener("DOMContentLoaded", () => {
  const grid = document.getElementById("galleryGrid");
  const status = document.getElementById("galleryGridStatus");
  const loginNotice = document.getElementById("galleryLoginNotice");
  const lightbox = document.getElementById("galleryLightbox");
  const lightboxImage = document.getElementById("lightboxImage");
  const lightboxLabel = document.getElementById("lightboxLabel");
  const lightboxClose = document.getElementById("lightboxClose");
  const lightboxPrev = document.getElementById("lightboxPrev");
  const lightboxNext = document.getElementById("lightboxNext");

  let galleryItems = [];
  let currentIndex = -1;

  function showStatus(message, color) {
    if (!status) return;
    status.textContent = message;
    status.style.color = color || "";
  }

  function toGalleryUrl(url) {
    if (!url) return "";
    if (url.includes("drive.google.com/thumbnail")) return url;
    const match = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1600`;
    }
    return url;
  }

  function normalizeGalleryItem(item) {
    if (typeof item === "string") {
      const url = toGalleryUrl(item);
      return url ? { url, uploader: "" } : null;
    }
    if (item && typeof item === "object") {
      const rawUrl = item.url || item.image || item.src || "";
      const url = toGalleryUrl(rawUrl);
      if (!url) return null;
      return { url, uploader: item.uploader || item.name || "" };
    }
    return null;
  }

  function isLightboxOpen() {
    return lightbox && !lightbox.classList.contains("hidden");
  }

  function renderLightbox() {
    if (!lightbox || !lightboxImage || currentIndex < 0) return;
    const item = galleryItems[currentIndex];
    lightboxImage.src = item.url;
    if (lightboxLabel) {
      lightboxLabel.textContent = item.uploader || "";
    }
  }

  function openLightboxAt(index) {
    if (!lightbox || !lightboxImage || !galleryItems.length) return;
    currentIndex = ((index % galleryItems.length) + galleryItems.length) % galleryItems.length;
    renderLightbox();
    lightbox.classList.remove("hidden");
    lightbox.setAttribute("aria-hidden", "false");
  }

  function stepLightbox(direction) {
    if (!galleryItems.length) return;
    if (currentIndex < 0) {
      currentIndex = 0;
    }
    openLightboxAt(currentIndex + direction);
  }

  function closeLightbox() {
    if (!lightbox || !lightboxImage) return;
    lightbox.classList.add("hidden");
    lightbox.setAttribute("aria-hidden", "true");
    lightboxImage.src = "";
    if (lightboxLabel) lightboxLabel.textContent = "";
    currentIndex = -1;
  }

  lightboxClose?.addEventListener("click", (e) => {
    e.preventDefault();
    closeLightbox();
  });

  lightboxPrev?.addEventListener("click", (e) => {
    e.preventDefault();
    stepLightbox(-1);
  });

  lightboxNext?.addEventListener("click", (e) => {
    e.preventDefault();
    stepLightbox(1);
  });

  lightbox?.addEventListener("click", (e) => {
    if (e.target === lightbox) closeLightbox();
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeLightbox();
      return;
    }
    if (!isLightboxOpen()) return;
    if (e.key === "ArrowLeft") stepLightbox(-1);
    if (e.key === "ArrowRight") stepLightbox(1);
  });

  const loggedIn = localStorage.getItem("loggedIn") === "true";
  if (!loggedIn) {
    if (loginNotice) {
      loginNotice.textContent = "Bitte zuerst einloggen, um die Galerie zu sehen.";
      loginNotice.style.color = "#b91c1c";
    }
    return;
  }

  showStatus("Galerie wird geladen...", "#0073b1");
  fetch("https://gsg-proxy.vercel.app/api/proxy", {
    method: "POST",
    body: new URLSearchParams({ action: "gallery_list" })
  })
  .then(async response => {
    const text = await response.text();
    try { return JSON.parse(text); }
    catch (err) {
      console.error("Galerie-Response:", text.slice(0, 200));
      throw err;
    }
  })
  .then(data => {
    if (!(data.result === "success" || data.success === true)) {
      showStatus(data.message || "Galerie konnte nicht geladen werden.", "red");
      return;
    }

    galleryItems = Array.isArray(data.images)
      ? data.images.map(normalizeGalleryItem).filter(Boolean)
      : [];

    if (!galleryItems.length) {
      showStatus("Noch keine Bilder in der Galerie.", "");
      return;
    }

    if (grid) {
      grid.classList.remove("hidden");
      grid.innerHTML = "";
      galleryItems.forEach((item, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "gallery-thumb";

        const img = document.createElement("img");
        img.src = item.url;
        img.alt = "Galeriebild";
        img.loading = "lazy";
        img.decoding = "async";
        button.appendChild(img);

        if (item.uploader) {
          const label = document.createElement("span");
          label.className = "thumb-label";
          label.textContent = item.uploader;
          button.appendChild(label);
        }

        button.addEventListener("click", () => openLightboxAt(index));
        grid.appendChild(button);
      });
    }

    showStatus("", "");
  })
  .catch(err => {
    console.error("Galerie-Fehler:", err);
    showStatus("Galerie konnte nicht geladen werden.", "red");
  });
});
