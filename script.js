document.addEventListener("DOMContentLoaded", () => {
  // ===== Kontakt-Collapsible =====
  document.querySelectorAll('.kontakt-collapsible').forEach(section => {
    const header = section.querySelector('.kontakt-header');
    header.addEventListener('click', () => {
      section.classList.toggle('collapsed');
    });
  });

  // ===== Menü-Button MENÜ/X =====
  const burgerBtn = document.getElementById("burgerButton");
  const mobileMenu = document.getElementById("mobileMenu");
  let menuOpen = false;
  if (burgerBtn && mobileMenu) {
    burgerBtn.addEventListener("click", () => {
      menuOpen = !menuOpen;
      burgerBtn.classList.toggle("open", menuOpen);
      mobileMenu.classList.toggle("open", menuOpen);
    });
  }

  // ===== Share Button (Desktop + Mobil) =====
  const shareButtonDesktop = document.getElementById("shareButton");
  const shareButtonMobile = document.getElementById("shareButtonMobile");
  [shareButtonDesktop, shareButtonMobile].forEach(button => {
    if (button && navigator.share) {
      button.addEventListener("click", (e) => {
        e.preventDefault();
        navigator.share({
          title: "Abi-Treffen 2026",
          text: "Sei dabei beim 20. Klassentreffen der GSG-Jahrgangsstufe 2006!",
          url: window.location.href
        }).catch(err => {
          console.error("Teilen abgebrochen oder nicht möglich:", err);
        });
      });
    } else if (button) {
      button.style.display = "none";
    }
  });

  // ===== Countdown =====
  const countdownDate = new Date("2026-07-11T00:00:00").getTime();
  const countdownEls = document.querySelectorAll("#countdown, #countdown-box");
  function updateCountdown() {
    const now = new Date().getTime();
    const diff = countdownDate - now;
    const days = Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
    const text = diff < 0 ? "Es ist so weit!" : `Noch ${days} Tage!`;
    countdownEls.forEach(el => el.textContent = text);
  }
  updateCountdown();
  setInterval(updateCountdown, 1000 * 60 * 60);

  // ===== Login/Newsletter Status =====
  const newsletterBox = document.getElementById("newsletter");
  const galerieSection = document.getElementById("galerie");
  const galerieLoginBox = document.getElementById("galerie-login-box");
  const galerieLoginMitte = document.getElementById("galerie-login-mitte");
  const verbindlichSection = document.getElementById("verbindlich");
  const verbindlichForm = document.getElementById("verbindlich-form");
  const verbindlichVorname = document.getElementById("verbindlich-vorname");
  const verbindlichNachname = document.getElementById("verbindlich-nachname");
  const verbindlichEmail = document.getElementById("verbindlich-email");
  const verbindlichHoney = document.getElementById("verbindlich-honey");
  const verbindlichMessage = document.getElementById("verbindlich-message");
  const uploadBox = document.getElementById("upload-box");
  const uploadForm = document.getElementById("upload-form");
  const uploadFile = document.getElementById("upload-file");
  const uploadStatus = document.getElementById("upload-status");
  const galleryStatus = document.getElementById("gallery-status");
  function showGalerie() {
    newsletterBox?.classList.add("hidden");
    galerieLoginBox?.classList.add("hidden");
    galerieLoginMitte?.classList.add("hidden");
    galerieSection?.classList.remove("hidden");
  }
  function showLogin(hasNewsletter) {
    newsletterBox?.classList.toggle("hidden", !!hasNewsletter);
    galerieLoginBox?.classList.remove("hidden");
    galerieLoginMitte?.classList.remove("hidden");
    galerieSection?.classList.add("hidden");
  }
  function updateVerbindlichStatus() {
    const hasNewsletter = !!localStorage.getItem("newsletterVorname") || localStorage.getItem("loggedIn") === "true";
    const alreadyCommitted = localStorage.getItem("verbindlichAngemeldet") === "true";
    const shouldShow = hasNewsletter && !alreadyCommitted;

    verbindlichSection?.classList.toggle("hidden", !shouldShow);
    if (!shouldShow) return;

    const storedVorname = localStorage.getItem("newsletterVorname") || "";
    const storedNachname = localStorage.getItem("newsletterNachname") || "";
    const storedEmail = localStorage.getItem("newsletterEmail") || "";

    if (verbindlichVorname && !verbindlichVorname.value) verbindlichVorname.value = storedVorname;
    if (verbindlichNachname && !verbindlichNachname.value) verbindlichNachname.value = storedNachname;
    if (verbindlichEmail && !verbindlichEmail.value) verbindlichEmail.value = storedEmail;
  }
  function updateUploadStatus() {
    const loggedIn = localStorage.getItem("loggedIn") === "true";
    const uploadAllowed = localStorage.getItem("uploadAllowed") === "true";
    uploadBox?.classList.toggle("hidden", !(loggedIn && uploadAllowed));
  }
  function checkLoginNewsletterStatus() {
    if (localStorage.getItem("loggedIn") === "true") {
      showGalerie();
      loadGalleryList();
    } else {
      showLogin(localStorage.getItem("newsletterVorname"));
    }
    updateVerbindlichStatus();
    updateUploadStatus();
  }
  checkLoginNewsletterStatus();
  window.addEventListener("resize", checkLoginNewsletterStatus);

  // ===== Newsletter-Formular (robust, ohne Dopplung!) =====
  const newsletterForm = document.getElementById("newsletter-form");
  if (newsletterForm) {
    newsletterForm.addEventListener("submit", function (e) {
      e.preventDefault();
      const submitBtn = newsletterForm.querySelector("button[type='submit']");
      if (submitBtn) submitBtn.disabled = true;

      const email = document.getElementById("newsletter-email").value.trim();
      const vorname = document.getElementById("newsletter-vorname").value.trim();
      const nachname = document.getElementById("newsletter-nachname").value.trim();
      const honey = document.getElementById("newsletter-honey").value;

      if (honey) {
        if (submitBtn) submitBtn.disabled = false;
        return;
      }

      fetch("https://gsg-proxy.vercel.app/api/proxy", {
        method: "POST",
        body: new URLSearchParams({
          action: "newsletter",
          email,
          vorname,
          nachname,
          _honey: honey
        })
      })
      .then(async response => {
        const text = await response.text();
        try { return JSON.parse(text); }
        catch (err) {
          alert("Fehlerhafte Serverantwort!");
          throw err;
        }
      })
      .then(data => {
        if (data.result === "success") {
          localStorage.setItem("newsletterVorname", vorname);
          localStorage.setItem("newsletterNachname", nachname);
          localStorage.setItem("newsletterEmail", email);
          alert(`Danke für deine Anmeldung, ${vorname || "Freund/in"}! Bitte prüfe, ob die Bestätigungsmail angekommen ist (auch im Spam-Ordner). Nur so kannst du später auch die News bekommen!`);
          newsletterForm.reset();
          checkLoginNewsletterStatus();
        } else if (data.result === "ignored") {
          console.log("Spam-Schutz ausgelöst");
        } else {
          alert("Fehler bei der Anmeldung. Bitte versuche es später.");
          console.error(data.message || "Unbekannter Fehler");
        }
      })
      .catch(error => {
        alert("Es ist ein Fehler aufgetreten.");
        console.error("Fetch-Fehler:", error);
      })
      .finally(() => {
        if (submitBtn) submitBtn.disabled = false;
      });
    });
  }

  // ===== Verbindliche Anmeldung =====
  if (verbindlichForm) {
    verbindlichForm.addEventListener("submit", function (e) {
      e.preventDefault();
      const submitBtn = verbindlichForm.querySelector("button[type='submit']");
      if (submitBtn) submitBtn.disabled = true;

      const vorname = verbindlichVorname?.value.trim() || "";
      const nachname = verbindlichNachname?.value.trim() || "";
      const email = verbindlichEmail?.value.trim() || "";
      const honey = verbindlichHoney?.value || "";

      if (honey) {
        if (submitBtn) submitBtn.disabled = false;
        return;
      }

      let success = false;

      fetch("https://gsg-proxy.vercel.app/api/proxy", {
        method: "POST",
        body: new URLSearchParams({
          action: "verbindlich",
          email,
          vorname,
          nachname,
          _honey: honey
        })
      })
      .then(async response => {
        const text = await response.text();
        try { return JSON.parse(text); }
        catch (err) {
          if (verbindlichMessage) {
            verbindlichMessage.textContent = "Fehlerhafte Serverantwort!";
            verbindlichMessage.style.color = "red";
          }
          throw err;
        }
      })
      .then(data => {
        if (data.result === "success" || data.success === true) {
          success = true;
          localStorage.setItem("verbindlichAngemeldet", "true");
          if (verbindlichMessage) {
            verbindlichMessage.textContent = "Danke! Deine verbindliche Anmeldung ist eingegangen.";
            verbindlichMessage.style.color = "green";
          }
          setTimeout(() => {
            updateVerbindlichStatus();
          }, 1200);
        } else if (data.result === "ignored") {
          console.log("Spam-Schutz ausgelöst");
        } else {
          if (verbindlichMessage) {
            verbindlichMessage.textContent = "Fehler bei der Anmeldung. Bitte versuche es später.";
            verbindlichMessage.style.color = "red";
          }
          console.error(data.message || "Unbekannter Fehler");
        }
      })
      .catch(error => {
        if (verbindlichMessage) {
          verbindlichMessage.textContent = "Es ist ein Fehler aufgetreten.";
          verbindlichMessage.style.color = "red";
        }
        console.error("Fetch-Fehler:", error);
      })
      .finally(() => {
        if (submitBtn && !success) submitBtn.disabled = false;
      });
    });
  }


  // ===== Upload (Galerie) =====
  const MAX_UPLOAD_SIZE = 5 * 1024 * 1024;
  const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/heic", "image/heif", "image/jpg"];
  const ALLOWED_EXT = [".jpg", ".jpeg", ".png", ".heic", ".heif"];

  function isAllowedImage(file) {
    if (!file) return false;
    const name = (file.name || "").toLowerCase();
    const byExt = ALLOWED_EXT.some(ext => name.endsWith(ext));
    const byType = ALLOWED_TYPES.includes(file.type);
    return byType || (file.type === "" && byExt);
  }

  function setUploadMessage(text, color) {
    if (!uploadStatus) return;
    uploadStatus.textContent = text;
    uploadStatus.style.color = color || "";
  }

  if (uploadForm) {
    uploadForm.addEventListener("submit", function (e) {
      e.preventDefault();
      const submitBtn = uploadForm.querySelector("button[type='submit']");
      if (submitBtn) submitBtn.disabled = true;

      const file = uploadFile?.files?.[0];
      if (!file) {
        setUploadMessage("Bitte wähle eine Datei aus.", "red");
        if (submitBtn) submitBtn.disabled = false;
        return;
      }
      if (!isAllowedImage(file)) {
        setUploadMessage("Dateiformat nicht erlaubt. Bitte JPG, PNG oder HEIC/HEIF verwenden.", "red");
        if (submitBtn) submitBtn.disabled = false;
        return;
      }
      if (file.size > MAX_UPLOAD_SIZE) {
        setUploadMessage("Datei zu groß. Maximal 5 MB.", "red");
        if (submitBtn) submitBtn.disabled = false;
        return;
      }

      const loginEmail = localStorage.getItem("loginEmail") || "";
      const loginCode = localStorage.getItem("loginCode") || "";
      if (!loginEmail || !loginCode) {
        setUploadMessage("Bitte erneut in die Galerie einloggen.", "red");
        if (submitBtn) submitBtn.disabled = false;
        return;
      }

      setUploadMessage("Upload läuft...", "#0073b1");

      const reader = new FileReader();
      reader.onload = function () {
        const result = String(reader.result || "");
        const base64 = result.includes(",") ? result.split(",")[1] : result;

        fetch("https://gsg-proxy.vercel.app/api/proxy", {
          method: "POST",
          body: new URLSearchParams({
            action: "upload_image",
            email: loginEmail,
            code: loginCode,
            filename: file.name,
            mimeType: file.type || "",
            data: base64
          })
        })
        .then(async response => {
          const text = await response.text();
          try { return JSON.parse(text); }
          catch (err) {
            setUploadMessage("Fehlerhafte Serverantwort!", "red");
            throw err;
          }
        })
        .then(data => {
          if (data.result === "success" || data.success === true) {
            setUploadMessage("Danke! Bild wurde hochgeladen.", "green");
            uploadForm.reset();
            loadGalleryList(true);
          } else {
            setUploadMessage(data.message || "Upload fehlgeschlagen.", "red");
          }
        })
        .catch(err => {
          console.error("Upload-Fehler:", err);
          setUploadMessage("Upload fehlgeschlagen.", "red");
        })
        .finally(() => {
          if (submitBtn) submitBtn.disabled = false;
        });
      };

      reader.onerror = function () {
        setUploadMessage("Datei konnte nicht gelesen werden.", "red");
        if (submitBtn) submitBtn.disabled = false;
      };

      reader.readAsDataURL(file);
    });
  }

  // ===== Galerie-Login =====
  function setupLoginForm(formId, emailId, codeId, msgId) {
    const form = document.getElementById(formId);
    if (!form) return;
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      const email = document.getElementById(emailId).value.trim();
      const code = document.getElementById(codeId).value.trim();
      const msg = document.getElementById(msgId);
      if (!email || !code) return;
      fetch("https://gsg-proxy.vercel.app/api/proxy", {
        method: "POST",
        body: new URLSearchParams({
          action: "login",
          email,
          code
        })
      })
      .then(response => response.json())
      .then(data => {
        if (data.result === "success") {
          localStorage.setItem("loggedIn", "true");
          localStorage.setItem("subscriberName", data.name || "");
          localStorage.setItem("uploadAllowed", data.upload ? "true" : "false");
          localStorage.setItem("loginEmail", email);
          localStorage.setItem("loginCode", code);
          if (msg) {
            msg.textContent = "Erfolgreich eingeloggt.";
            msg.style.color = "green";
          }
          checkLoginNewsletterStatus();
        } else {
          if (msg) {
            msg.textContent = "Login fehlgeschlagen. Bitte prüfe deine Angaben.";
            msg.style.color = "red";
          }
        }
      })
      .catch(error => {
        if (msg) {
          msg.textContent = "Ein Fehler ist aufgetreten.";
          msg.style.color = "red";
        }
        console.error("Login-Fehler:", error);
      });
    });
  }
  setupLoginForm("loginForm", "loginEmail", "loginCode", "loginMessage");
  setupLoginForm("loginFormMitte", "loginEmailMitte", "loginCodeMitte", "loginMessageMitte");

  // ===== Kontaktformular =====
  const kontaktForm = document.getElementById("kontakt-form");
  kontaktForm?.addEventListener("submit", async function (e) {
    e.preventDefault();
    const name = kontaktForm.elements["name"].value.trim();
    const email = kontaktForm.elements["email"].value.trim();
    const message = kontaktForm.elements["message"].value.trim();
    try {
      const res = await fetch("https://gsg-proxy.vercel.app/api/proxy", {
        method: "POST",
        body: new URLSearchParams({ name, email, message })
      });
      const text = await res.text();
      alert(text === "Erfolg" ? "Nachricht erfolgreich gesendet!" : "Unbekannte Antwort.");
      kontaktForm.reset();
    } catch (error) {
      alert("Fehler beim Absenden. Bitte versuche es später.");
      console.error(error);
    }
  });

  // ===== Galerie (dynamisch) =====
  let galleryImages = [];
  let currentIndex = 0;
  let galleryLoaded = false;
  const galleryImage = document.getElementById("gallery-image");
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");

  function showGalleryMessage(message) {
    galleryImage?.classList.add("hidden");
    prevBtn?.classList.add("hidden");
    nextBtn?.classList.add("hidden");
    if (galleryStatus) galleryStatus.textContent = message;
  }

  function renderGallery() {
    if (!galleryImage) return;
    if (!galleryImages.length) {
      showGalleryMessage("Noch keine Bilder in der Galerie.");
      return;
    }
    galleryImage.classList.remove("hidden");
    prevBtn?.classList.remove("hidden");
    nextBtn?.classList.remove("hidden");
    if (galleryStatus) galleryStatus.textContent = "";

    currentIndex = ((currentIndex % galleryImages.length) + galleryImages.length) % galleryImages.length;
    galleryImage.src = galleryImages[currentIndex];
  }

  function setGalleryImages(list) {
    galleryImages = Array.isArray(list) ? list.filter(Boolean) : [];
    currentIndex = 0;
    renderGallery();
  }

  async function loadGalleryList(force = false) {
    if (galleryLoaded && !force) return;
    if (galleryStatus) galleryStatus.textContent = "Galerie wird geladen...";
    try {
      const res = await fetch("https://gsg-proxy.vercel.app/api/proxy", {
        method: "POST",
        body: new URLSearchParams({ action: "gallery_list" })
      });
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (err) {
        showGalleryMessage("Fehlerhafte Serverantwort!");
        throw err;
      }

      if (data.result === "success" || data.success === true) {
        galleryLoaded = true;
        setGalleryImages(data.images || []);
      } else {
        showGalleryMessage(data.message || "Galerie konnte nicht geladen werden.");
      }
    } catch (error) {
      console.error("Galerie-Fehler:", error);
      showGalleryMessage("Galerie konnte nicht geladen werden.");
    }
  }

  prevBtn?.addEventListener("click", () => {
    if (!galleryImages.length) return;
    currentIndex = (currentIndex - 1 + galleryImages.length) % galleryImages.length;
    renderGallery();
  });
  nextBtn?.addEventListener("click", () => {
    if (!galleryImages.length) return;
    currentIndex = (currentIndex + 1) % galleryImages.length;
    renderGallery();
  });
  galleryImage?.addEventListener("error", () => {
    console.error(`Bild nicht gefunden: ${galleryImage?.src}`);
  });

  // ===== Kalender-Links (.ics + Google) =====
  (function () {
    // 11.07.2026 15–24 Uhr CEST ⇒ 13:00–22:00 UTC
    const DTSTART = '20260711T130000Z';
    const DTEND   = '20260711T220000Z';

    const TITLE         = 'Klassentreffen 2026';
    const LOCATION_TEXT = 'Wirtshaus Ratze, Raichberg 4, 70186 Stuttgart';
    const DETAILS       = 'Wirtshaus Ratze';

    // --- .ics-Link befüllen ---
    const icsLink = document.getElementById('icsLink');
    if (icsLink) {
      function toUtcStamp(date) {
        const pad = n => String(n).padStart(2,'0');
        const d = new Date(date.getTime() - date.getTimezoneOffset()*60000);
        return (
          d.getUTCFullYear() + pad(d.getUTCMonth()+1) + pad(d.getUTCDate()) + 'T' +
          pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + 'Z'
        );
      }
      const ics = [
        'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Abi2006//Website//DE','CALSCALE:GREGORIAN','METHOD:PUBLISH',
        'BEGIN:VEVENT',
        'UID:klassentreffen-20260711T130000Z@abi2006.de',
        'DTSTAMP:' + toUtcStamp(new Date()),
        'DTSTART:' + DTSTART,
        'DTEND:' + DTEND,
        'SUMMARY:' + TITLE,
        'DESCRIPTION:' + 'Wirtshaus Ratze\\nAdresse: Raichberg 4\\, 70186 Stuttgart\\nTelefon: 0711 45146902',
        'LOCATION:' + 'Wirtshaus Ratze\\, Raichberg 4\\, 70186 Stuttgart',
        'END:VEVENT','END:VCALENDAR'
      ].join('\r\n');

      icsLink.href = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics);
      icsLink.download = 'klassentreffen-2026.ics';
    }

    // --- Google-Kalender-Link befüllen ---
    const gcalLink = document.getElementById('gcalLink');
    if (gcalLink) {
      const base = 'https://calendar.google.com/calendar/render?action=TEMPLATE';
      const params = new URLSearchParams({
        text: TITLE,
        dates: `${DTSTART}/${DTEND}`,
        location: LOCATION_TEXT,
        details: DETAILS
      });
      gcalLink.href = `${base}&${params.toString()}`;
      gcalLink.target = '_blank';
      gcalLink.rel = 'noopener noreferrer';
    }
  })();
});
